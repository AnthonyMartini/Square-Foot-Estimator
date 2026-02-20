import { useState } from 'react'
import ImageUpload from './components/ImageUpload'
import AnnotationOverlay from './components/AnnotationOverlay'
import Toolbar from './components/Toolbar'
import './App.css'

import { detectFourSquares, extractImageRegion } from './utils/cvHelper'
import ExtractionPanel from './components/ExtractionPanel'
import MeasurementPanel from './components/MeasurementPanel'
import { useEffect } from 'react'

function App() {
  const [imageSrc, setImageSrc] = useState(null)
  const [activeTool, setActiveTool] = useState(null)
  const [annotations, setAnnotations] = useState([])
  const [isDetecting, setIsDetecting] = useState(false);
  const [extractions, setExtractions] = useState([]);

  const handleImageUpload = (src) => {
    setImageSrc(src)
    setAnnotations([]) // Clear annotations on new image
    setExtractions([])
    setActiveTool(null)
  }

  // Effect to handle extractions whenever annotations change
  useEffect(() => {
    if (!imageSrc) return;

    // Debounce slightly to avoid rapid updates during drag
    const timeoutId = setTimeout(async () => {
        const imgElement = document.querySelector('.annotation-image');
        if (!imgElement) {
            console.warn("Extraction: Image element not found");
            return;
        }

        const newExtractions = [];
        console.log("Extraction: Checking annotations...", annotations);
        
        for (let i = 0; i < annotations.length; i++) {
            const ann = annotations[i];
            
            // Allow extraction ONLY for the Reference Square (Red)
            // This enforces the "Single Extraction" rule since only one Red square can exist.
            if (ann.type === 'polygon' && ann.points.length === 4 && ann.color === 'red') {
                console.log(`Extraction: Processing Reference Square`, ann);
                try {
                    const { dataURL, matrix, inverseMatrix } = await extractImageRegion(imgElement, ann.points);
                    console.log(`Extraction: Success for Reference Square`);
                    newExtractions.push({
                        type: 'Reference',
                        dataURL: dataURL,
                        matrix: matrix,
                        inverseMatrix: inverseMatrix,
                        points: ann.points, // Pass points for geometry calculation
                        sourceSize: { width: imgElement.naturalWidth, height: imgElement.naturalHeight }
                    });
                    console.log("Extraction: Added Reference Square", newExtractions);
                } catch (e) {
                    console.error("Extraction failed for Reference Square", e);
                }
            } else {
                // Skip other annotations (normal polylines, etc.)
                // console.log(`Extraction: Skipping annotation ${i}`);
            }
        }
        setExtractions(newExtractions);

    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [annotations, imageSrc]);

  const handleToolChange = (tool) => {
    setActiveTool(tool)
  }

  const handleAddAnnotation = (annotation) => {
    // Enforce "Single Reference Square" rule:
    // If the new annotation is a Reference Square (Red), remove any existing ones.
    if (annotation.color === 'red') {
        const filtered = annotations.filter(a => a.color !== 'red');
        setAnnotations([...filtered, annotation]);
    } else {
        setAnnotations([...annotations, annotation]);
    }
  }

  const handleUpdateAnnotation = (index, newAnnotation) => {
    const updatedAnnotations = [...annotations];
    updatedAnnotations[index] = newAnnotation;
    setAnnotations(updatedAnnotations);
  }

  const handleDeleteAnnotation = (index) => {
    const updatedAnnotations = annotations.filter((_, i) => i !== index);
    setAnnotations(updatedAnnotations);
  }

  const handleAutoDetect = async () => {
      if (!imageSrc) return;
      setIsDetecting(true);
      try {
          const imgElement = document.querySelector('.annotation-image');
          if (!imgElement) throw new Error("Image not found");

          const result = await detectFourSquares(imgElement);
          
          if (result.boundingBox) {
              // Auto-Detect acts as a Reference Square (Red).
              // Remove any existing Reference Squares before adding this one.
              setAnnotations(prev => {
                  const filtered = prev.filter(a => a.color !== 'red');
                  return [...filtered, {
                      id: Date.now(),
                      type: 'polygon',
                      points: result.boundingBox,
                      color: 'red' // Reference Square color
                  }];
              });
          } else {
              // Debug mode: Show candidates if failed to find a perfect box
              alert(`Only found ${result.count} squares. Displaying them for debug.`);
              const debugAnnotations = result.candidates.map(points => ({
                  type: 'polygon',
                  points: points,
                  color: 'orange' // Debug color
              }));
              setAnnotations(prev => [...prev, ...debugAnnotations]);
          }
          
      } catch (error) {
          console.error("Detection failed:", error);
          alert("Detection failed: " + error.message);
      } finally {
          setIsDetecting(false);
      }
  };

  return (
    <div className="app-container">
      <h1>Image Annotation Tool</h1>
      
      {!imageSrc && <ImageUpload onImageUpload={handleImageUpload} />}

      {imageSrc && (
        <div className="workspace">
          <Toolbar 
            activeTool={activeTool} 
            onToolChange={handleToolChange} 
            onAutoDetect={handleAutoDetect} 
          />
          {isDetecting && <p>Detecting...</p>}
          
          <div className="main-layout">
              <div className="canvas-column">
                  <div className="canvas-wrapper">
                     <AnnotationOverlay 
                        imageSrc={imageSrc} 
                        activeTool={activeTool} 
                        annotations={annotations}
                        onAddAnnotation={handleAddAnnotation}
                        onUpdateAnnotation={handleUpdateAnnotation}
                        onDeleteAnnotation={handleDeleteAnnotation}
                        onFinishDrawing={() => setActiveTool(null)}
                     />
                  </div>
                  <button className="reset-button" onClick={() => setImageSrc(null)}>Upload New Image</button>
              </div>
              
              <div className="panels-column">
                  <ExtractionPanel extractions={extractions} onClear={() => setExtractions([])} />
                  
                  <MeasurementPanel 
                    annotations={annotations} 
                    referenceData={extractions.find(e => e.type === 'Reference')} 
                  />
              </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
