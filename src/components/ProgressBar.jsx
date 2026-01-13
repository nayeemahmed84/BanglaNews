import React from 'react';
import './ProgressBar.css';

const ProgressBar = ({ current, total, label }) => {
  if (total === 0) return null;

  const percentage = Math.min(100, Math.max(0, (current / total) * 100));

  return (
    <div className="progress-container">
      <div className="progress-info">
        {label && <span className="progress-label">{label}</span>}
        <span className="progress-stats">{current} / {total}</span>
      </div>
      <div className="progress-track">
        <div 
          className="progress-fill" 
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
