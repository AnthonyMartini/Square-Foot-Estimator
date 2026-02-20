import React, { useState } from 'react';

const ExtractionPanel = ({ extractions, onClear }) => {
  const [showDevInfo, setShowDevInfo] = useState(false);

  return (
    <div className="extraction-panel">
      <div className="extraction-header">
        <h3>Reference</h3>
        <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
            <input 
                type="checkbox" 
                checked={showDevInfo} 
                onChange={(e) => setShowDevInfo(e.target.checked)} 
            />
            Show Dev Info
        </label>
      </div>
      <div className="extraction-list">
        {extractions.length === 0 ? (
          <p className="empty-state">No reference selected.</p>
        ) : (
          extractions.map((ex, index) => (
            <div key={index} className="extraction-item">
              {showDevInfo && ex.points && ex.points.length === 4 && (
                  <div className="geometry-display" style={{ marginBottom: '10px', fontSize: '0.85em', background: '#f9f9f9', padding: '8px', borderRadius: '4px' }}>
                      <h4>Geometric Properties</h4>
                      {(() => {
                          // ----------------------------------------------------------------
                          // GEOMETRIC ANALYSIS
                          // ----------------------------------------------------------------
                          
                          // 1. Sort points (TL, TR, BR, BL) relative to centroid to ensure correct order
                          //Get points
                          const pts = [...ex.points];
                          //Get centroid
                          const cx = pts.reduce((sum, p) => sum + p.x, 0) / 4;
                          const cy = pts.reduce((sum, p) => sum + p.y, 0) / 4;
                          //Sort points into their corners
                          const sorted = [null, null, null, null];
                          pts.forEach(p => {
                              if (p.x < cx && p.y < cy) sorted[0] = p; // TL (Top-Left)
                              else if (p.x >= cx && p.y < cy) sorted[1] = p; // TR (Top-Right)
                              else if (p.x >= cx && p.y >= cy) sorted[2] = p; // BR (Bottom-Right)
                              else if (p.x < cx && p.y >= cy) sorted[3] = p; // BL (Bottom-Left)
                          });
                          if (sorted.some(p => !p)) return <p>Complex geometry</p>;
                          
                          const [tl, tr, br, bl] = sorted;
                          
                          // 2. Calculate pixel length of each side
                          const dist = (p1, p2) => Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
                          const top = dist(tl, tr).toFixed(1);
                          const right = dist(tr, br).toFixed(1);
                          const bottom = dist(br, bl).toFixed(1);
                          const left = dist(bl, tl).toFixed(1);
                          
                          // 3. Display the raw pixel lengths to help user understand distortion width/height
                          return (
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
                                  <div><strong>Side Lengths (px):</strong></div>
                                  <div></div>
                                  <div>Top: {top}</div>
                                  <div>Right: {right}</div>
                                  <div>Bottom: {bottom}</div>
                                  <div>Left: {left}</div>
                              </div>
                          );
                      })()}
                  </div>
              )}

              {showDevInfo && ex.matrix && (
                  <div className="matrix-display">
                      <h4>Transformation Matrix</h4>
                      <div className="matrix-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px', fontSize: '0.75em', marginBottom: '10px' }}>
                          {['Scale X', 'Skew X', 'Trans X', 'Skew Y', 'Scale Y', 'Trans Y', 'C Persp X', 'C Persp Y', 'Norm'].map((label, i) => (
                              <div key={i} style={{ background: '#eee', padding: '4px', textAlign: 'center', borderRadius: '3px', display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontSize: '0.7em', color: '#666', marginBottom: '2px' }}>{label}</span>
                                  <strong>{ex.matrix[i].toFixed(3)}</strong>
                              </div>
                          ))}
                      </div>
                  </div>
              )}

              {showDevInfo && ex.inverseMatrix && ex.sourceSize && (
                  <div className="physical-display" style={{ marginBottom: '10px', fontSize: '0.85em', background: '#f0f4ff', padding: '8px', borderRadius: '4px', border: '1px solid #d0d7ee' }}>
                      <h4>Physical Wall Mapping (Feet)</h4>
                      <p style={{ margin: '0 0 5px 0', fontSize: '0.8em', color: '#555' }}>
                        Reference Square is 6.5x6.5 inches (0.54 ft). Coords relative to Top-Left.
                      </p>
                      {(() => {
                          const m = ex.inverseMatrix;
                          const w = ex.sourceSize.width;
                          const h = ex.sourceSize.height;
                          
                          // REF SIZE: 6.5 inches = 6.5/12 feet
                          const REF_SIZE_FT = 6.5 / 12.0;

                          // Project a point (x,y) from the image to physical feet relative to the Top-Left of the reference grid
                          const project = (x, y) => {
                              const Z = m[6]*x + m[7]*y + m[8]; // w'
                              if (Math.abs(Z) < 0.0001) return { x: 0, y: 0 };
                              
                              // The homography maps to a unit square [0,1].
                              // To map to 6.5 inches, multiply by REF_SIZE_FT.
                              return {
                                  x: ((m[0]*x + m[1]*y + m[2]) / Z) * REF_SIZE_FT,
                                  y: ((m[3]*x + m[4]*y + m[5]) / Z) * REF_SIZE_FT
                              };
                          };
                          
                          const tl = project(0, 0);
                          const tr = project(w, 0);
                          const br = project(w, h);
                          const bl = project(0, h);
                          
                          const minX = Math.min(tl.x, tr.x, br.x, bl.x);
                          const maxX = Math.max(tl.x, tr.x, br.x, bl.x);
                          const minY = Math.min(tl.y, tr.y, br.y, bl.y);
                          const maxY = Math.max(tl.y, tr.y, br.y, bl.y);
                          
                          return (
                              <div>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', marginBottom: '8px' }}>
                                      <div style={{ fontWeight: 'bold' }}>Visible Wall Area (Feet):</div>
                                      <div></div>
                                      <div>Left Edge:</div>
                                      <div>{minX.toFixed(2)} ft</div>
                                      <div>Right Edge:</div>
                                      <div>{maxX.toFixed(2)} ft</div>
                                      <div>Top Edge:</div>
                                      <div>{minY.toFixed(2)} ft</div>
                                      <div>Bottom Edge:</div>
                                      <div>{maxY.toFixed(2)} ft</div>
                                  </div>

                                  <div style={{ fontSize: '0.8em', color: '#666', borderTop: '1px solid #ddd', paddingTop: '4px' }}>
                                      Image Corners:<br/>
                                      TL: ({tl.x.toFixed(1)}, {tl.y.toFixed(1)})<br/>
                                      TR: ({tr.x.toFixed(1)}, {tr.y.toFixed(1)})<br/>
                                      BR: ({br.x.toFixed(1)}, {br.y.toFixed(1)})<br/>
                                      BL: ({bl.x.toFixed(1)}, {bl.y.toFixed(1)})
                                  </div>

                                  <div style={{ fontSize: '0.8em', color: '#666', borderTop: '1px solid #ddd', paddingTop: '4px', marginTop: '4px' }}>
                                      <strong>Validation (Should be approx 0,0 - 0.54,0 - 0.54,0.54 - 0,0.54):</strong><br/>
                                      {(() => {
                                           if (ex.points && ex.points.length === 4) {
                                               const pts = [...ex.points];
                                               const cx = pts.reduce((sum, p) => sum + p.x, 0) / 4;
                                               const cy = pts.reduce((sum, p) => sum + p.y, 0) / 4;
                                               const sorted = [...pts].sort((a,b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
                                               
                                               const pTL = project(sorted[0].x, sorted[0].y);
                                               const pTR = project(sorted[1].x, sorted[1].y);
                                               const pBR = project(sorted[2].x, sorted[2].y);
                                               const pBL = project(sorted[3].x, sorted[3].y);
                                               
                                               return (
                                                  <>
                                                    TL Ref: {pTL.x.toFixed(2)}, {pTL.y.toFixed(2)} <br/>
                                                    TR Ref: {pTR.x.toFixed(2)}, {pTR.y.toFixed(2)} <br/>
                                                    BR Ref: {pBR.x.toFixed(2)}, {pBR.y.toFixed(2)} <br/>
                                                    BL Ref: {pBL.x.toFixed(2)}, {pBL.y.toFixed(2)}
                                                  </>
                                               );
                                           }
                                           return null;
                                      })()}
                                  </div>
                              </div>
                          );
                      })()}
                  </div>
              )}
              <img src={ex.dataURL} alt={`Reference`} />
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ExtractionPanel;
