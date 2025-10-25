import { useState, useEffect } from 'react';
import { authenticatedFetch } from '../utils/api';
import './BeforeAfterSlider.css';

function BeforeAfterSlider({ beforeImageId, afterImageId, name }) {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [beforeUrl, setBeforeUrl] = useState(null);
  const [afterUrl, setAfterUrl] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let beforeBlobUrl = null;
    let afterBlobUrl = null;

    const loadImages = async () => {
      try {
        const [beforeResponse, afterResponse] = await Promise.all([
          authenticatedFetch(`/api/images/${beforeImageId}`),
          authenticatedFetch(`/api/images/${afterImageId}`)
        ]);

        const beforeBlob = await beforeResponse.blob();
        const afterBlob = await afterResponse.blob();

        beforeBlobUrl = URL.createObjectURL(beforeBlob);
        afterBlobUrl = URL.createObjectURL(afterBlob);

        setBeforeUrl(beforeBlobUrl);
        setAfterUrl(afterBlobUrl);
        setLoading(false);
      } catch (error) {
        console.error('Error loading images:', error);
        setLoading(false);
      }
    };

    loadImages();

    return () => {
      if (beforeBlobUrl) URL.revokeObjectURL(beforeBlobUrl);
      if (afterBlobUrl) URL.revokeObjectURL(afterBlobUrl);
    };
  }, [beforeImageId, afterImageId]);

  const handleSliderChange = (e) => {
    setSliderPosition(e.target.value);
  };

  if (loading) {
    return (
      <div className="before-after-container">
        <div className="image-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
          <div className="spinner-large"></div>
        </div>
      </div>
    );
  }

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
