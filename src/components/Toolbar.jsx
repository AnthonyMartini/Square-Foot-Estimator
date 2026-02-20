import React from 'react';

const Toolbar = ({ activeTool, onToolChange, onAutoDetect }) => {
  return (
    <div className="toolbar">
      <button 
        className={`tool-button ${activeTool === 'polyline' ? 'active' : ''}`}
        onClick={() => onToolChange(activeTool === 'polyline' ? null : 'polyline')}
      >
        Polyline
      </button>
      <button
        className={`tool-button delete ${activeTool === 'delete' ? 'active' : ''}`}
        onClick={() => onToolChange(activeTool === 'delete' ? null : 'delete')}
      >
        Delete
      </button>
      <button 
        className={`tool-button ${activeTool === 'reference_square' ? 'active' : ''}`}
        onClick={() => onToolChange(activeTool === 'reference_square' ? null : 'reference_square')}
        style={{ borderColor: 'red', color: activeTool === 'reference_square' ? 'white' : 'red', background: activeTool === 'reference_square' ? 'red' : 'white' }}
      >
        Ref Square
      </button>
      <button 
        className="tool-button"
        onClick={() => onToolChange(null)}
        disabled={!activeTool}
      >
        Clear Selection
      </button>
      <button
        className="tool-button"
        onClick={onAutoDetect}
        title="Finds 4 squares and draws a bounding box"
      >
        Auto Detect
      </button>
    </div>
  );
};

export default Toolbar;
