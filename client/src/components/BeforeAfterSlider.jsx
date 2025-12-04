import { useState, useEffect } from 'react';
import { authenticatedFetch } from '../utils/api';
import './BeforeAfterSlider.css';

function BeforeAfterSlider({ beforeImageId, afterImageId, name, refreshToken }) {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [beforeUrl, setBeforeUrl] = useState(null);
  const [afterUrl, setAfterUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let beforeBlobUrl = null;
    let afterBlobUrl = null;
    let isMounted = true;

    const loadImages = async () => {
      if (!beforeImageId || !afterImageId) {
        setError('Missing image IDs');
        setLoading(false);
        return;
      }

      try {
        setError(null);
        const cacheBuster = refreshToken || Date.now();
        const [beforeResponse, afterResponse] = await Promise.all([
          authenticatedFetch(`/api/images/${beforeImageId}?t=${cacheBuster}`),
          authenticatedFetch(`/api/images/${afterImageId}?t=${cacheBuster}`)
        ]);

        if (!beforeResponse.ok || !afterResponse.ok) {
          throw new Error(`Failed to fetch images: ${beforeResponse.status}, ${afterResponse.status}`);
        }

        const beforeBlob = await beforeResponse.blob();
        const afterBlob = await afterResponse.blob();

        if (beforeBlob.size < 100 || afterBlob.size < 100) {
          throw new Error('Images appear to be invalid or empty');
        }

        beforeBlobUrl = URL.createObjectURL(beforeBlob);
        afterBlobUrl = URL.createObjectURL(afterBlob);

        if (isMounted) {
          setBeforeUrl(beforeBlobUrl);
          setAfterUrl(afterBlobUrl);
          setLoading(false);
          setError(null);
        }
      } catch (err) {
        console.error('Error loading images:', err);
        if (isMounted) {
          setError(err.message || 'Failed to load images');
          setLoading(false);
        }
      }
    };

    loadImages();

    return () => {
      isMounted = false;
      if (beforeBlobUrl) URL.revokeObjectURL(beforeBlobUrl);
      if (afterBlobUrl) URL.revokeObjectURL(afterBlobUrl);
    };
  }, [beforeImageId, afterImageId, refreshToken, retryCount]);

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    setRetryCount(prev => prev + 1);
  };

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

  if (error) {
    return (
      <div className="before-after-container">
        <div className="image-wrapper image-error-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', background: '#1a1a1a' }}>
          <div className="error-icon" style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <p style={{ color: '#ff6b6b', marginBottom: '8px', textAlign: 'center', padding: '0 16px' }}>
            Failed to load images
          </p>
          <p style={{ color: '#888', fontSize: '12px', marginBottom: '16px', textAlign: 'center', padding: '0 16px' }}>
            {error}
          </p>
          <button 
            onClick={handleRetry}
            style={{
              background: 'linear-gradient(135deg, #FFA500, #FF8C00)',
              border: 'none',
              borderRadius: '6px',
              padding: '10px 24px',
              color: '#000',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Retry Loading
          </button>
        </div>
      </div>
    );
  }

  if (!beforeUrl || !afterUrl) {
    return (
      <div className="before-after-container">
        <div className="image-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px', background: '#1a1a1a' }}>
          <p style={{ color: '#888' }}>Images not available</p>
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
