import React from 'react';

const MeasurementPanel = ({ annotations, referenceData }) => {
    // 1. Get the Inverse Matrix from the Reference extraction
    const inverseMatrix = referenceData?.inverseMatrix;

    if (!inverseMatrix) {
        return (
            <div className="measurement-panel">
                <h3>Measurements</h3>
                <p className="empty-state">Define a Reference Grid first to see measurements.</p>
            </div>
        );
    }

    // 2. Helper to project a single point (same logic as ExtractionPanel)
    // 2. Helper to project a single point (same logic as ExtractionPanel)
    const REF_SIZE_FT = 6.5 / 12.0;

    const project = (x, y) => {
        const m = inverseMatrix;
        const Z = m[6] * x + m[7] * y + m[8];
        if (Math.abs(Z) < 0.0001) return { x: 0, y: 0 };
        return {
            x: ((m[0] * x + m[1] * y + m[2]) / Z) * REF_SIZE_FT,
            y: ((m[3] * x + m[4] * y + m[5]) / Z) * REF_SIZE_FT
        };
    };

    // 3. Helper to calculate polygon area (Shoelace Formula)
    const calculateArea = (points) => {
        if (points.length < 3) return 0;
        let area = 0;
        for (let i = 0; i < points.length; i++) {
            const j = (i + 1) % points.length;
            area += points[i].x * points[j].y;
            area -= points[j].x * points[i].y;
        }
        return Math.abs(area) / 2.0;
    };

    // 4. Filter for non-reference annotations (Reference is Red)
    // We want to measure everything else (e.g. Green Polylines)
    const measureList = annotations.filter(ann => ann.color !== 'red' && ann.points.length >= 2);

    return (
        <div className="measurement-panel">
            <h3>Measurement Analysis</h3>
            <div className="measurement-list">
                {measureList.length === 0 ? (
                    <p className="empty-state">Draw new shapes (green) to measure them.</p>
                ) : (
                    measureList.map((ann, index) => {
                        // Project all points to physical feet
                        const physicalPoints = ann.points.map(p => project(p.x, p.y));
                        
                        // Calculate Area (if polygon/closed)
                        // If it's just a line (2 points), area is 0.
                        const area = calculateArea(physicalPoints);
                        
                        // Calculate Perimeter / Length
                        let perimeter = 0;
                        for(let i=0; i<physicalPoints.length - 1; i++) {
                             const p1 = physicalPoints[i];
                             const p2 = physicalPoints[i+1];
                             perimeter += Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
                        }
                        // Close loop for perimeter if it's a polygon? 
                        // The drawing tool usually treats 'polygon' as closed visually, 
                        // but let's assume if type 'polygon' we close it.
                        if (ann.type === 'polygon' && physicalPoints.length > 2) {
                            const pFirst = physicalPoints[0];
                            const pLast = physicalPoints[physicalPoints.length - 1];
                            perimeter += Math.sqrt(Math.pow(pFirst.x - pLast.x, 2) + Math.pow(pFirst.y - pLast.y, 2));
                        }

                        return (
                            <div key={ann.id || index} className="measurement-item" style={{ background: '#f0fff4', border: '1px solid #c6f6d5', borderRadius: '5px', padding: '10px', marginBottom: '10px' }}>
                                <h4 style={{ margin: '0 0 5px 0', color: '#2f855a' }}>Shape #{index + 1} ({ann.type})</h4>
                                
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', fontSize: '0.9em' }}>
                                    <div><strong>Area:</strong></div>
                                    <div>{area.toFixed(2)} sq ft</div>
                                    
                                    <div><strong>Perimeter:</strong></div>
                                    <div>{perimeter.toFixed(2)} ft</div>
                                </div>

                                <details style={{ marginTop: '5px', fontSize: '0.8em', color: '#555' }}>
                                    <summary style={{ cursor: 'pointer' }}>View Points (Feet)</summary>
                                    <div style={{ marginTop: '5px', paddingLeft: '10px', borderLeft: '2px solid #ddd' }}>
                                        {physicalPoints.map((p, i) => (
                                            <div key={i}>
                                                Pt {i+1}: ({p.x.toFixed(2)}, {p.y.toFixed(2)})
                                            </div>
                                        ))}
                                    </div>
                                </details>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default MeasurementPanel;
