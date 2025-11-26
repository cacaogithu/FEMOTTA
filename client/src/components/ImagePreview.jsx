import { useState, useEffect } from 'react';
import { authenticatedFetch } from '../utils/api';

function ImagePreview({ imageId, alt, className, refreshToken }) {
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let blobUrl = null;

    const loadImage = async () => {
      try {
        const cacheBuster = refreshToken || Date.now();
        const response = await authenticatedFetch(`/api/images/${imageId}?t=${cacheBuster}`);
        
        if (!response.ok) {
          throw new Error('Failed to load image');
        }

        const blob = await response.blob();
        blobUrl = URL.createObjectURL(blob);
        
        setImageUrl(blobUrl);
        setLoading(false);
      } catch (err) {
        console.error('Error loading image:', err);
        setError(true);
        setLoading(false);
      }
    };

    loadImage();

    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [imageId, refreshToken]);

  if (loading) {
    return (
      <div className={className} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '200px' }}>
        <div className="spinner-large"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={className} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '200px', color: '#999' }}>
        Failed to load image
      </div>
    );
  }

  return <img src={imageUrl} alt={alt} className={className} />;
}

export default ImagePreview;
