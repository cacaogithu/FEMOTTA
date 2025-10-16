import { useState } from 'react';
import './BeforeAfterSlider.css';

function BeforeAfterSlider({ beforeImageId, afterImageId, name }) {
  const [sliderPosition, setSliderPosition] = useState(50);

  const handleSliderChange = (e) => {
    setSliderPosition(e.target.value);
  };

  const beforeUrl = `/api/images/${beforeImageId}`;
  const afterUrl = `/api/images/${afterImageId}`;

  return (
    <div className="before-after-container">
      <div className="image-wrapper">
        <img 
          src={afterUrl} 
          alt={`After - ${name}`} 
          className="after-image"
        />
        <div 
          className="before-image-wrapper"
          style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
        >
          <img 
            src={beforeUrl} 
            alt={`Before - ${name}`} 
            className="before-image"
          />
        </div>
        <div 
          className="slider-line"
          style={{ left: `${sliderPosition}%` }}
        >
          <div className="slider-handle">
            <span className="arrow-left">◀</span>
            <span className="arrow-right">▶</span>
          </div>
        </div>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        value={sliderPosition}
        onChange={handleSliderChange}
        className="slider-input"
      />
      <div className="labels">
        <span className="label-before">Original</span>
        <span className="label-after">Edited</span>
      </div>
    </div>
  );
}

export default BeforeAfterSlider;
