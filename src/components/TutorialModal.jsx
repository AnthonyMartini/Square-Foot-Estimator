import React from 'react';
import RefMarkerPdf from '../assets/ReferenceMarker.pdf';
import Step1Img from '../assets/Step1.jpg';
import Step2Img from '../assets/Step2.png';

const TutorialModal = ({ onClose }) => {
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>How to Use the Square Footage Tool</h2>
                </div>
                
                <div className="modal-body">
                    <div className="tutorial-step">
                        <h3>1. Print the Reference Marker</h3>
                        <p>Print the 4-corner Reference marker. Measure the actual physical distance between the outer edges of the markers so the app can calibrate scale.</p>
                        <a href={RefMarkerPdf} download="ReferenceMarker.pdf" className="primary-button" style={{display: 'inline-block', marginBottom: '1rem', textDecoration: 'none', padding: '8px 16px', background: '#3b82f6', color: 'white', borderRadius: '4px'}}>
                            Download Reference Marker PDF
                        </a>
                        <div className="image-placeholder" style={{ padding: 0, overflow: 'hidden', border: 'none', background: 'transparent', textAlign: 'center' }}>
                            <img src={Step1Img} alt="Step 1: Setting up the Reference marker" style={{ maxWidth: '100%', maxHeight: '350px', width: 'auto', height: 'auto', borderRadius: '8px', display: 'block', margin: '0 auto' }} />
                        </div>
                    </div>

                    <div className="tutorial-step">
                        <h3>2. Upload and Draw to Measure</h3>
                        <p>Place the Reference marker on the surface, take a photo, and upload it. Click <strong>Auto Detect</strong> to find the Reference marker. Then, select the <strong>Polygon</strong> tool and click around the region you want to measure. Double-click to close the shape and calculate the area!</p>
                        <div className="image-placeholder" style={{ padding: 0, overflow: 'hidden', border: 'none', background: 'transparent', textAlign: 'center' }}>
                            <img src={Step2Img} alt="Step 2: Drawing a polygon to measure area" style={{ maxWidth: '100%', maxHeight: '350px', width: 'auto', height: 'auto', borderRadius: '8px', display: 'block', margin: '0 auto' }} />
                        </div>
                    </div>
                </div>
                
                <div className="modal-footer">
                    <button className="primary-button" onClick={onClose} style={{ backgroundColor: '#3b82f6', marginTop: '10px'}}>Got it!</button>
                </div>
            </div>
        </div>
    );
};

export default TutorialModal;
