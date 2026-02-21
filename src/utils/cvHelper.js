
export const detectFourSquares = (imageElement) => {
  return new Promise((resolve, reject) => {
    if (!window.cv) {
      reject(new Error("OpenCV is not loaded yet."));
      return;
    }

    try {
      const cv = window.cv;
      
      // CRITICAL: cv.imread(imageElement) reads the DISPLAYED size (or close to it) in some contexts.
      // We must force it to read the NATURAL size to match our coordinate system.
      const srcCanvas = document.createElement('canvas');
      srcCanvas.width = imageElement.naturalWidth;
      srcCanvas.height = imageElement.naturalHeight;
      const ctx = srcCanvas.getContext('2d');
      ctx.drawImage(imageElement, 0, 0, imageElement.naturalWidth, imageElement.naturalHeight);
      
      const src = cv.imread(srcCanvas);
      const gray = new cv.Mat();
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
      
      const binary = new cv.Mat();
      // Use adaptive thresholding for better robustness against lighting
      // THRESH_BINARY_INV makes black squares white, so findContours traces their inner edge tightly
      cv.adaptiveThreshold(gray, binary, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 11, 2);
      
      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();
      cv.findContours(binary, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

      const possibleSquares = [];

      for (let i = 0; i < contours.size(); ++i) {
        const cnt = contours.get(i);
        const approx = new cv.Mat();
        const perimeter = cv.arcLength(cnt, true);
        cv.approxPolyDP(cnt, approx, 0.02 * perimeter, true);

        // Filter for squares: 4 vertices, convex, reasonable area
        if (approx.rows === 4 && cv.isContourConvex(approx)) {
            const area = cv.contourArea(approx);
            if (area > 100) { // arbitrary small threshold to filter noise
                const rect = cv.boundingRect(approx);
                
                // Filter out the image border itself
                if (rect.width > src.cols * 0.95 || rect.height > src.rows * 0.95) {
                    approx.delete();
                    continue;
                }

                const aspectRatio = rect.width / rect.height;
                
                // Check if it's roughly square (tolerance 0.5 - 2.0 to handle perspective)
                if (aspectRatio >= 0.5 && aspectRatio <= 2.0) {
                    let points = [];
                    
                    try {
                        // Mathmatically snap corners to sub-pixel accuracy based on the image gradients
                        const cornersMat = cv.matFromArray(4, 1, cv.CV_32FC2, [
                            approx.data32S[0], approx.data32S[1],
                            approx.data32S[2], approx.data32S[3],
                            approx.data32S[4], approx.data32S[5],
                            approx.data32S[6], approx.data32S[7]
                        ]);
                        const winSize = new cv.Size(5, 5);
                        const zeroZone = new cv.Size(-1, -1);
                        const criteria = new cv.TermCriteria(cv.TERM_CRITERIA_EPS + cv.TERM_CRITERIA_MAX_ITER, 40, 0.001);
                        cv.cornerSubPix(gray, cornersMat, winSize, zeroZone, criteria);
                        
                        for(let j=0; j<4; j++) {
                            points.push({
                                x: cornersMat.data32F[j*2],
                                y: cornersMat.data32F[j*2+1]
                            });
                        }
                        cornersMat.delete();
                    } catch (e) {
                         // Fallback to integer perimeter points
                         for(let j=0; j<4; j++) {
                            points.push({
                                x: approx.data32S[j*2],
                                y: approx.data32S[j*2+1]
                            });
                        }
                    }
                    
                    possibleSquares.push({ area, points, contour: cnt }); 
                } else {
                    console.log(`Rejected candidate due to aspect ratio: ${aspectRatio.toFixed(2)}`);
                }
            }
        }
        approx.delete();
      }

      // Cleanup OpenCV logic objects
      src.delete();
      gray.delete();
      binary.delete();
      contours.delete();
      hierarchy.delete();

      possibleSquares.sort((a, b) => b.area - a.area);
      
      // Filter logic: Find the best group of 4 squares with similar areas.
      // This helps reject the "Paper" contour which is much larger than the fiducials.
      // Perspective can make backend squares up to ~50% smaller, but Paper is usually >500% larger.
      
      let topCandidates = [];
      
      if (possibleSquares.length >= 4) {
          let bestGroup = null;
          let bestScore = Infinity; // Lower is better (variance)
          
          // Try to find 4 consecutive squares with similar size
          for (let i = 0; i <= possibleSquares.length - 4; i++) {
              const group = possibleSquares.slice(i, i + 4);
              const maxArea = group[0].area;
              const minArea = group[3].area;
              
              // If the biggest in this group is > 3x the smallest, it's likely not our group 
              // (unless EXTREME perspective, but 3x is generous).
              // Ideally fiducials are within 0.5x - 1.5x of each other.
              const ratio = maxArea / minArea;
              
              if (ratio < 3.0) {
                  // This is a plausible group. Pick the one with tightest ratio?
                  // Or just pick the *largest* plausible group (assuming fiducials are main features)
                  // Iterate and take the first one that fits criteria? 'Large' is better.
                  bestGroup = group;
                  break; 
              }
          }
          
          if (bestGroup) {
              topCandidates = bestGroup;
              console.log("AutoDetect: Found consistent group of 4.", bestGroup.map(s => s.area));
          } else {
               // Fallback: Just take top 4, but maybe warn
               console.warn("AutoDetect: Could not find 4 similar squares. Using top 4.");
               topCandidates = possibleSquares.slice(0, 4);
          }
      } else {
          topCandidates = possibleSquares;
      }
      
      const scaleX = imageElement.width / imageElement.naturalWidth;
      const scaleY = imageElement.height / imageElement.naturalHeight;

      // NOTE: We used to scale points here. Now we return NATURAL coordinates.
      // Overlay handles scaling via viewBox.
      
      const results = {
          count: topCandidates.length,
          candidates: topCandidates.map(sq => sq.points), // Return raw natural points
          boundingBox: null
      };

      if (topCandidates.length === 4) {
          // Calculate skewed bounding box by connecting the OUTER corners of the 4 squares
          
          // 1. Calculate centroid of all 4 squares to establish a center
          let totalX = 0, totalY = 0;
          let pointCount = 0;
          topCandidates.forEach(sq => {
              sq.points.forEach(p => {
                  totalX += p.x;
                  totalY += p.y;
                  pointCount++;
              });
          });
          const centerX = totalX / pointCount;
          const centerY = totalY / pointCount;
          
          // 2. Identify which square is TL, TR, BL, BR relative to the center
          const sortedSquares = [null, null, null, null]; // TL, TR, BR, BL
          
          topCandidates.forEach(sq => {
              // Calculate center of this square
              const sqCx = sq.points.reduce((sum, p) => sum + p.x, 0) / 4;
              const sqCy = sq.points.reduce((sum, p) => sum + p.y, 0) / 4;
              
              if (sqCx < centerX && sqCy < centerY) sortedSquares[0] = sq; // TL
              else if (sqCx >= centerX && sqCy < centerY) sortedSquares[1] = sq; // TR
              else if (sqCx >= centerX && sqCy >= centerY) sortedSquares[2] = sq; // BR
              else if (sqCx < centerX && sqCy >= centerY) sortedSquares[3] = sq; // BL
          });
          
          // If sorting failed (e.g. not clearly separable quadrants), fallback to simple bounding box or just use what we have
          if (sortedSquares.every(s => s)) {
               const [tlSq, trSq, brSq, blSq] = sortedSquares;
               
               // 3. Find the "outermost" corner for each square
               // The outermost corner of a square relative to the center of the entire pattern
               // is the corner that is furthest from the pattern's overall centroid.
               const getExtremePoint = (sq) => {
                   return sq.points.reduce((best, p) => {
                       if (!best) return p;
                       const distToBest = Math.pow(best.x - centerX, 2) + Math.pow(best.y - centerY, 2);
                       const distToP = Math.pow(p.x - centerX, 2) + Math.pow(p.y - centerY, 2);
                       return distToP > distToBest ? p : best;
                   }, null);
               };
               
               const p1 = getExtremePoint(tlSq);
               const p2 = getExtremePoint(trSq);
               const p3 = getExtremePoint(brSq);
               const p4 = getExtremePoint(blSq);
               
               results.boundingBox = [p1, p2, p3, p4];
          } else {
              // Fallback to axis aligned if we couldn't determine order
              let allPoints = [];
              topCandidates.forEach(sq => allPoints = allPoints.concat(sq.points));
              let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
              allPoints.forEach(p => {
                  if (p.x < minX) minX = p.x;
                  if (p.y < minY) minY = p.y;
                  if (p.x > maxX) maxX = p.x;
                  if (p.y > maxY) maxY = p.y;
              });
               results.boundingBox = [
                  { x: minX, y: minY },
                  { x: maxX, y: minY },
                  { x: maxX, y: maxY },
                  { x: minX, y: maxY }
              ];
          }
      }

      resolve(results);

    } catch (e) {
      reject(e);
    }
  });
};

export const extractImageRegion = (imageElement, points) => {
    return new Promise((resolve, reject) => {
        try {
            // 1. Calculate the bounding box of the polygon
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            points.forEach(p => {
                if (p.x < minX) minX = p.x;
                if (p.y < minY) minY = p.y;
                if (p.x > maxX) maxX = p.x;
                if (p.y > maxY) maxY = p.y;
            });
            
            // Floor/Ceil to ensure we cover pixels
            minX = Math.floor(minX);
            minY = Math.floor(minY);
            maxX = Math.ceil(maxX);
            maxY = Math.ceil(maxY);
            
            const width = maxX - minX;
            const height = maxY - minY;
            
            if (width <= 0 || height <= 0) {
                reject(new Error("Invalid polygon dimensions"));
                return;
            }

            // 2. Create a canvas of the bounding box size
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            
            // 3. Define the clipping path
            // We need to shift all points by (-minX, -minY) to draw them on the new canvas relative to 0,0
            ctx.beginPath();
            points.forEach((p, index) => {
                if (index === 0) {
                    ctx.moveTo(p.x - minX, p.y - minY);
                } else {
                    ctx.lineTo(p.x - minX, p.y - minY);
                }
            });
            ctx.closePath();
            
            // 4. Clip!
            ctx.clip();
            
            // 5. Draw the original image, shifted so the correct region aligns with the clip
            // We draw the image at (-minX, -minY)
            ctx.drawImage(imageElement, -minX, -minY);
            
            // 6. Return transparent PNG
            const dataURL = canvas.toDataURL('image/png');

            // 7. Calculate Transformation Matrix (Unit Square -> Detected Quad)
            // This describes "how the square got distorted"
            const unitSrc = cv.matFromArray(4, 1, cv.CV_32FC2, [
                0, 0, 
                1, 0, 
                1, 1, 
                0, 1
            ]);
            
            // Destination is our detected points (in natural coords)
            // CRITICAL: Use the SORTED points to ensure consistent mapping (TL, TR, BR, BL)
            // Sort points angularly around the center to ensure 0=TL, 1=TR, 2=BR, 3=BL
            
            const cx = points.reduce((sum, p) => sum + p.x, 0) / 4;
            const cy = points.reduce((sum, p) => sum + p.y, 0) / 4;
            
            // Calculate angle for each point: Math.atan2(y, x)
            // Result is -PI to +PI.
            // TL should be around -135deg (-2.35 rad)
            // TR should be around -45deg (-0.78 rad)
            // BR should be around +45deg (+0.78 rad)
            // BL should be around +135deg (+2.35 rad)
            // We can just sort by angle.
            // Expected order if we start from -PI: TL (-135), TR (-45), BR (45), BL (135)
            
            const sorted = [...points].sort((a, b) => {
                const angA = Math.atan2(a.y - cy, a.x - cx);
                const angB = Math.atan2(b.y - cy, b.x - cx);
                return angA - angB; 
            });
            
            // sorted should now be [TL, TR, BR, BL] (approx)
            // atan2 range is -PI to PI.
            // TL (~ -3pi/4), TR (~ -pi/4), BR (~ pi/4), BL (~ 3pi/4).
            // Yes, this order is correct: -2.3, -0.7, 0.7, 2.3.
            
            const [tl, tr, br, bl] = sorted;

            const dstPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
                tl.x, tl.y,
                tr.x, tr.y,
                br.x, br.y,
                bl.x, bl.y
            ]);
            
            const M = cv.getPerspectiveTransform(unitSrc, dstPoints);
            
            // Safely read output
            let finalMatrixData = [];
            // CV_64F is type 6, CV_32F is type 5.
            if (M.type() === cv.CV_64F) {
                finalMatrixData = Array.from(M.data64F); 
            } else {
                finalMatrixData = Array.from(M.data32F);
            }
            
            // 8. Calculate Inverse Matrix (Detected Quad -> Unit Square)
            const M_inv = cv.getPerspectiveTransform(dstPoints, unitSrc);
            
            let finalInverseMatrixData = [];
            if (M_inv.type() === cv.CV_64F) {
                finalInverseMatrixData = Array.from(M_inv.data64F);
            } else {
                finalInverseMatrixData = Array.from(M_inv.data32F);
            }

            unitSrc.delete();
            dstPoints.delete();
            M.delete();
            M_inv.delete();

            resolve({ dataURL, matrix: finalMatrixData, inverseMatrix: finalInverseMatrixData });

        } catch (e) {
            reject(e);
        }
    });
};
