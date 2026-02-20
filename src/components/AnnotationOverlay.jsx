
import React, { useState, useRef, useEffect } from 'react';

const AnnotationOverlay = ({ imageSrc, activeTool, annotations, onAddAnnotation, onUpdateAnnotation, onDeleteAnnotation, onFinishDrawing }) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentAnnotation, setCurrentAnnotation] = useState(null);
  const containerRef = useRef(null);

  const [polylinePoints, setPolylinePoints] = useState([]);

  const annotationsRef = useRef(annotations);
  useEffect(() => {
      annotationsRef.current = annotations;
  }, [annotations]);

  const [draggingVertex, setDraggingVertex] = useState(null);

  const getCoordinates = (e) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const imgElement = containerRef.current.querySelector('.annotation-image');
    if (!imgElement) return { x: 0, y: 0 };

    const rect = imgElement.getBoundingClientRect();
    const scaleX = imgElement.naturalWidth / rect.width;
    const scaleY = imgElement.naturalHeight / rect.height;

    let x = (e.clientX - rect.left) * scaleX;
    let y = (e.clientY - rect.top) * scaleY;
    
    // Clamp to image bounds (Natural)
    x = Math.max(0, Math.min(x, imgElement.naturalWidth));
    y = Math.max(0, Math.min(y, imgElement.naturalHeight));

    return { x, y };
  };

  const [viewBox, setViewBox] = useState("0 0 100 100");
  const [visualScale, setVisualScale] = useState(1);

  useEffect(() => {
      const img = containerRef.current?.querySelector('.annotation-image');
      if (img) {
          const updateViewBox = () => {
              // Ensure we have dimensions
              if (img.naturalWidth && img.naturalHeight) {
                setViewBox(`0 0 ${img.naturalWidth} ${img.naturalHeight}`);
                // Calculate scale: 1 screen pixel = ? natural pixels
                // If natural is 4000 and client is 800, scale is 5.
                // We want things to be e.g. 10 screen pixels big, so 10 * 5 = 50 natural pixels.
                const rect = img.getBoundingClientRect();
                if (rect.width > 0) {
                    setVisualScale(img.naturalWidth / rect.width);
                }
              }
          };
          
          if (img.complete) {
              updateViewBox();
          } else {
              img.onload = updateViewBox;
          }
           window.addEventListener('resize', updateViewBox);
           return () => window.removeEventListener('resize', updateViewBox);
      }
  }, [imageSrc]);

  const handleVertexMouseDown = (e, annotationIndex, pointIndex) => {
      e.stopPropagation(); 
      e.preventDefault(); // Prevent text selection/native drag
      setDraggingVertex({ annotationIndex, pointIndex });
  };
  
  // Global event listeners for dragging
  useEffect(() => {
      if (draggingVertex) {
          const handleGlobalMove = (e) => {
              const { x, y } = getCoordinates(e);
              const { annotationIndex, pointIndex } = draggingVertex;
              const annotation = annotationsRef.current[annotationIndex];
              
              if (annotation && (annotation.type === 'polyline' || annotation.type === 'polygon')) {
                  const newPoints = [...annotation.points];
                  newPoints[pointIndex] = { x, y };
                  const newAnnotation = { ...annotation, points: newPoints };
                  onUpdateAnnotation(annotationIndex, newAnnotation);
              }
          };

          const handleGlobalUp = () => {
              setDraggingVertex(null);
          };

          window.addEventListener('mousemove', handleGlobalMove);
          window.addEventListener('mouseup', handleGlobalUp);
          return () => {
              window.removeEventListener('mousemove', handleGlobalMove);
              window.removeEventListener('mouseup', handleGlobalUp);
          };
      }
  }, [draggingVertex, onUpdateAnnotation]);

  const getDistanceToSegment = (p, v, w) => {
    const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
    if (l2 === 0) return (p.x - v.x) ** 2 + (p.y - v.y) ** 2;
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    const projection = { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) };
    return (p.x - projection.x) ** 2 + (p.y - projection.y) ** 2;
  };

  const isPointInPolygon = (point, vs) => {
      // ray-casting algorithm based on
      // https://github.com/substack/point-in-polygon
      let x = point.x, y = point.y;
      let inside = false;
      for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
          let xi = vs[i].x, yi = vs[i].y;
          let xj = vs[j].x, yj = vs[j].y;
          
          let intersect = ((yi > y) !== (yj > y))
              && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
          if (intersect) inside = !inside;
      }
      return inside;
  };

  const handleMouseDown = (e) => {
    if (!activeTool) return;
    
    const { x, y } = getCoordinates(e);
    
    // Scale threshold for hit testing
    const hitThreshold = 10 * visualScale;

    // Global Delete Logic (Geometric Hit Testing)
    if (activeTool === 'delete') {
        // iterate backwards to delete top-most first
        for (let i = annotations.length - 1; i >= 0; i--) {
            const ann = annotations[i];
            let hit = false;
            
            if (ann.type === 'rect') {
                const minX = Math.min(ann.startX, ann.endX);
                const maxX = Math.max(ann.startX, ann.endX);
                const minY = Math.min(ann.startY, ann.endY);
                const maxY = Math.max(ann.startY, ann.endY);
                if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
                    hit = true;
                }
            } else if (ann.type === 'line') {
                const dist = Math.sqrt(getDistanceToSegment({x, y}, {x: ann.startX, y: ann.startY}, {x: ann.endX, y: ann.endY}));
                if (dist < hitThreshold) hit = true; 
            } else if (ann.type === 'polyline' || ann.type === 'polygon') {
                // Check if inside (fill)
                if (ann.points.length > 2) {
                    if (isPointInPolygon({x, y}, ann.points)) {
                        hit = true;
                    }
                }
                
                // If not inside, check edges (stroke)
                if (!hit) {
                     for (let j = 0; j < ann.points.length - 1; j++) {
                        const p1 = ann.points[j];
                        const p2 = ann.points[j+1];
                        const dist = Math.sqrt(getDistanceToSegment({x, y}, p1, p2));
                        if (dist < hitThreshold) {
                            hit = true;
                            break;
                        }
                    }
                    // For polygon, check closing segment
                    if (!hit && ann.type === 'polygon' && ann.points.length > 0) {
                         const p1 = ann.points[ann.points.length - 1];
                         const p2 = ann.points[0];
                         const dist = Math.sqrt(getDistanceToSegment({x, y}, p1, p2));
                         if (dist < hitThreshold) hit = true;
                    }
                }
            }

            if (hit) {
                onDeleteAnnotation && onDeleteAnnotation(i);
                return; // Delete one at a time
            }
        }
        return;
    }

    // Ignore clicks on existing interactive elements if not drawing (and not deleting)
    const targetTag = e.target.tagName;
    if (targetTag === 'circle' || ((targetTag === 'polyline' || targetTag === 'polygon') && (activeTool === 'polyline' || activeTool === 'reference_square'))) {
         return; 
    }
    
    if (activeTool === 'polyline' || activeTool === 'reference_square') {
      setPolylinePoints(prev => [...prev, { x, y }]);
    }
  };

  const getClosestSegmentIndex = (clickPoint, points, isClosed) => {
      let minDst = Infinity;
      let closestIndex = -1;
      
      const numSegments = isClosed ? points.length : points.length - 1;
      
      for (let i = 0; i < numSegments; i++) {
          const p1 = points[i];
          const p2 = points[(i + 1) % points.length];
          const dst = getDistanceToSegment(clickPoint, p1, p2);
          if (dst < minDst) {
              minDst = dst;
              closestIndex = i;
          }
      }
      return closestIndex;
  };

  const handleEdgeClick = (e, annotationIndex) => {
      e.stopPropagation();
      if (activeTool === 'delete') {
          onDeleteAnnotation && onDeleteAnnotation(annotationIndex);
          return;
      }

      const clickPoint = getCoordinates(e);
      const annotation = annotations[annotationIndex];
      const isClosed = annotation.type === 'polygon';
      
      const segmentIndex = getClosestSegmentIndex(clickPoint, annotation.points, isClosed);
      
      // Check distance again to ensure we clicked ON the edge
      if (segmentIndex !== -1) {
           const p1 = annotation.points[segmentIndex];
           const p2 = annotation.points[(segmentIndex + 1) % annotation.points.length];
           const dist = Math.sqrt(getDistanceToSegment(clickPoint, p1, p2));
           
           if (dist < 10 * visualScale) {
                const newPoints = [...annotation.points];
                newPoints.splice(segmentIndex + 1, 0, clickPoint);
                
                onUpdateAnnotation && onUpdateAnnotation(annotationIndex, {
                    ...annotation,
                    points: newPoints
                });
           }
      }
  };

  const handleMouseMove = (e) => {
    const { x, y } = getCoordinates(e);

    if (activeTool === 'polyline' || activeTool === 'reference_square') {
        if (polylinePoints.length > 0) {
             setCurrentAnnotation({
                type: 'polyline-preview',
                startX: polylinePoints[polylinePoints.length - 1].x,
                startY: polylinePoints[polylinePoints.length - 1].y,
                endX: x,
                endY: y,
                color: activeTool === 'reference_square' ? 'red' : 'green' 
             });
        }
    }
  };

  const handleMouseUp = () => {
    if (activeTool === 'polyline' || activeTool === 'reference_square') return;
  };
  
  const handleDoubleClick = (e) => {
      if (activeTool === 'polyline' || activeTool === 'reference_square') {
          if (polylinePoints.length > 1) {
              onAddAnnotation({
                  type: 'polygon', // We create a polygon directly on close
                  points: polylinePoints,
                  color: activeTool === 'reference_square' ? 'red' : 'green'
              });
              setPolylinePoints([]);
              setCurrentAnnotation(null);
          }
      }
  };

  // ... (Helpers)
  const calculatePolygonArea = (points) => {
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      let j = (i + 1) % points.length;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
    }
    return Math.abs(area / 2);
  };

  const getPolygonCentroid = (points) => {
    let cx = 0, cy = 0, signedArea = 0;
    for (let i = 0; i < points.length; i++) {
        let x0 = points[i].x, y0 = points[i].y;
        let x1 = points[(i + 1) % points.length].x, y1 = points[(i + 1) % points.length].y;
        let a = x0 * y1 - x1 * y0;
        signedArea += a;
        cx += (x0 + x1) * a;
        cy += (y0 + y1) * a;
    }
    signedArea *= 0.5;
    cx = cx / (6 * signedArea);
    cy = cy / (6 * signedArea);
    return { x: cx, y: cy };
  };

  const renderShape = (annotation, index) => {
    const { type, startX, startY, endX, endY } = annotation;
    const isCurrent = index === 'current';
    const baseStyle = isCurrent ? { pointerEvents: 'none' } : {};
    
    // Scale stroke width
    const sw = 2 * visualScale;
    
    if (activeTool === 'delete' && !isCurrent) {
        baseStyle.cursor = 'not-allowed';
        baseStyle.pointerEvents = 'all'; // Ensure clickable for delete
    }

    const handleShapeClick = (e) => {
        if (activeTool === 'delete') {
            e.stopPropagation();
            onDeleteAnnotation && onDeleteAnnotation(index);
        }
    };
    
    if (type === 'rect') {
      const width = endX - startX;
      const height = endY - startY;
      return (
        <rect
          key={index}
          x={Math.min(startX, endX)}
          y={Math.min(startY, endY)}
          width={Math.abs(width)}
          height={Math.abs(height)}
          stroke="red"
          strokeWidth={sw}
          fill="rgba(255, 0, 0, 0.2)"
          style={baseStyle}
          onClick={handleShapeClick}
        />
      );
    } else if (type === 'line') {
      return (
        <line
          key={index}
          x1={startX}
          y1={startY}
          x2={endX}
          y2={endY}
          stroke="blue"
          strokeWidth={sw}
          style={baseStyle}
          onClick={handleShapeClick}
        />
      );
    } else if (type === 'polyline') {
        const { points } = annotation;
        const pointsStr = points.map(p => `${p.x},${p.y}`).join(' ');
        return (
            <polyline
                key={index}
                points={pointsStr}
                fill="none"
                stroke="green"
                strokeWidth={sw}
            />
        );
    } else if (type === 'polyline-preview') {
         return (
            <line
                key={index}
                x1={startX}
                y1={startY}
                x2={endX}
                y2={endY}
                stroke="green"
                strokeWidth={sw}
                strokeDasharray={`${4 * visualScale}`}
                style={{ pointerEvents: 'none' }}
            />
         );
    }
    return null;
  };

  return (
    <div 
      ref={containerRef} 
      className="annotation-container"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onDoubleClick={handleDoubleClick}
    >
      <img src={imageSrc} alt="To annotate" className="annotation-image" draggable="false" />
      <svg className="annotation-svg" viewBox={viewBox} preserveAspectRatio="none">
       {annotations.map((ann, i) => {
           if (ann.type === 'polyline' || ann.type === 'polygon') {
               const area = ann.type === 'polygon' ? calculatePolygonArea(ann.points) : 0;
               const centroid = ann.type === 'polygon' ? getPolygonCentroid(ann.points) : {x:0, y:0};
               const color = ann.color || 'green';
               const fillColor = color === 'red' ? 'rgba(255, 0, 0, 0.2)' : 'rgba(0, 255, 0, 0.2)';
               
               const sw = 2 * visualScale;
               const vertexRadius = 6 * visualScale; // Bigger vertices
               const fontSize = 12 * visualScale;
               const transparentSw = 10 * visualScale;

               return (
                   <g key={i}>
                       {ann.type === 'polygon' ? (
                           <>
                           <polygon
                               points={ann.points.map(p => `${p.x},${p.y}`).join(' ')}
                               fill={fillColor}
                               stroke={color}
                               strokeWidth={sw}
                               onClick={(e) => handleEdgeClick(e, i)}
                               style={activeTool === 'delete' ? { cursor: 'not-allowed', pointerEvents: 'all' } : {}}
                           />
                           <text
                               x={centroid.x}
                               y={centroid.y}
                               textAnchor="middle"
                               dominantBaseline="middle"
                               fill="white"
                               fontSize={fontSize}
                               style={{ pointerEvents: 'none', textShadow: `0px 0px ${2 * visualScale}px black` }}
                           >
                               {Math.round(area)} px²
                           </text>
                           </>
                       ) : (
                           <>
                               {/* Transparent Hit Area for Polyline */}
                               <polyline
                                   points={ann.points.map(p => `${p.x},${p.y}`).join(' ')}
                                   fill="none"
                                   stroke="transparent"
                                   strokeWidth={transparentSw}
                                   onClick={(e) => handleEdgeClick(e, i)}
                                   style={{ pointerEvents: 'all', cursor: activeTool === 'delete' ? 'not-allowed' : 'pointer' }}
                               />
                               {/* Visible Polyline */}
                               <polyline
                                   points={ann.points.map(p => `${p.x},${p.y}`).join(' ')}
                                   fill="none"
                                   stroke={color}
                                   strokeWidth={sw}
                                   style={{ pointerEvents: 'none' }}
                               />
                           </>
                       )}
                       
                       {ann.points.map((p, j) => (
                           <circle 
                               key={`${i}-point-${j}`} 
                               cx={p.x} 
                               cy={p.y} 
                               r={vertexRadius} 
                               fill="white" 
                               stroke={color}
                               strokeWidth={sw}
                               style={{ cursor: activeTool === 'delete' ? 'not-allowed' : 'grab' }}
                               onMouseDown={(e) => {
                                   if (activeTool === 'delete') {
                                       e.stopPropagation();
                                       onDeleteAnnotation && onDeleteAnnotation(i);
                                   } else {
                                       handleVertexMouseDown(e, i, j);
                                   }
                               }}
                           />
                       ))}
                   </g>
               );
           }
           return renderShape(ann, i);
        })}
        
        {(activeTool === 'polyline' || activeTool === 'reference_square') && polylinePoints.length > 0 && (
            <g>
                <polyline
                    points={polylinePoints.map(p => `${p.x},${p.y}`).join(' ')}
                    fill="none"
                    stroke={activeTool === 'reference_square' ? 'red' : 'green'}
                    strokeWidth={2 * visualScale}
                />
                {polylinePoints.map((p, j) => (
                   <circle 
                       key={`current-point-${j}`} 
                       cx={p.x} 
                       cy={p.y} 
                       r={6 * visualScale} 
                       fill={j === 0 ? "orange" : "white"}
                       stroke={activeTool === 'reference_square' ? 'red' : 'green'}
                       strokeWidth={2 * visualScale}
                       style={{ cursor: j === 0 ? 'pointer' : 'default' }}
                       onClick={(e) => {
                           if (j === 0 && polylinePoints.length > 2) {
                               e.stopPropagation();
                               onAddAnnotation({
                                  type: 'polygon',
                                  points: polylinePoints,
                                  color: activeTool === 'reference_square' ? 'red' : 'green'
                               });
                               setPolylinePoints([]);
                               setCurrentAnnotation(null);
                               onFinishDrawing && onFinishDrawing();
                           }
                       }}
                   />
               ))}
            </g>
        )}
        
        {currentAnnotation && renderShape(currentAnnotation, 'current')}
      </svg>
    </div>
  );
};

export default AnnotationOverlay;
