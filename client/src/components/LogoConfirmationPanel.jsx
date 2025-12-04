import { useState, useEffect } from 'react';
import { authenticatedFetch } from '../utils/api';
import './LogoConfirmationPanel.css';

const AVAILABLE_LOGOS = [
  { id: 'intel-core', name: 'Intel Core', path: '/api/logo-preview/intel-core' },
  { id: 'intel-core-ultra', name: 'Intel Core Ultra', path: '/api/logo-preview/intel-core-ultra' },
  { id: 'amd-ryzen', name: 'AMD Ryzen', path: '/api/logo-preview/amd-ryzen' },
  { id: 'nvidia', name: 'NVIDIA', path: '/api/logo-preview/nvidia' },
  { id: 'nvidia-50-series', name: 'NVIDIA 50 Series', path: '/api/logo-preview/nvidia-50-series' },
  { id: 'hydro-x', name: 'Hydro X', path: '/api/logo-preview/hydro-x' },
  { id: 'icue-link', name: 'iCUE Link', path: '/api/logo-preview/icue-link' },
  { id: 'corsair', name: 'Corsair', path: '/api/logo-preview/corsair' },
  { id: 'origin-pc', name: 'Origin PC', path: '/api/logo-preview/origin-pc' }
];

function LogoConfirmationPanel({ jobId, imageSpecs, images, onConfirm, onCancel }) {
  const [confirmedSpecs, setConfirmedSpecs] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Canonical name to ID mapping - must match server's logoIdToName dictionary
    const nameToId = {
      'Intel Core': 'intel-core',
      'Intel Core Ultra': 'intel-core-ultra',
      'AMD Ryzen': 'amd-ryzen',
      'NVIDIA': 'nvidia',
      'NVIDIA 50 Series': 'nvidia-50-series',
      'Hydro X': 'hydro-x',
      'iCUE Link': 'icue-link',
      'Corsair': 'corsair',
      'Origin PC': 'origin-pc'
    };
    
    // Valid logo IDs (for validation)
    const validLogoIds = new Set(Object.values(nameToId));
    
    const initialSpecs = imageSpecs.map((spec, idx) => {
      const existingLogos = spec.logo_names || spec.logoNames || [];
      
      // Convert display names to IDs, only keep valid/recognized IDs
      const normalizedLogos = existingLogos
        .map(logo => {
          // If it's already a valid ID, keep it
          if (validLogoIds.has(logo)) return logo;
          // If it's a known display name, convert to ID
          if (nameToId[logo]) return nameToId[logo];
          // Unknown logo - skip it (don't create invalid IDs)
          console.warn(`[LogoConfirmation] Unknown logo "${logo}" ignored for image ${idx + 1}`);
          return null;
        })
        .filter(Boolean);
      
      // Get image URL from images array
      const imageData = images && images[idx];
      const imageUrl = imageData?.publicUrl || imageData?.url || null;
      
      return {
        imageIndex: idx,
        title: spec.title,
        subtitle: spec.subtitle,
        selectedLogos: normalizedLogos,
        imageUrl: imageUrl
      };
    });
    
    console.log('[LogoConfirmation] Initialized specs with images:', initialSpecs.map((s, i) => ({
      index: i,
      title: s.title,
      imageUrl: s.imageUrl,
      logos: s.selectedLogos
    })));
    
    setConfirmedSpecs(initialSpecs);
  }, [imageSpecs, images]);

  const toggleLogo = (specIndex, logoId) => {
    setConfirmedSpecs(prev => {
      const updated = [...prev];
      const currentLogos = updated[specIndex].selectedLogos || [];
      
      if (currentLogos.includes(logoId)) {
        updated[specIndex].selectedLogos = currentLogos.filter(l => l !== logoId);
      } else {
        updated[specIndex].selectedLogos = [...currentLogos, logoId];
      }
      
      return updated;
    });
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    setError('');

    try {
      // Only send logo selections, not full specs (server preserves its own fields)
      const response = await authenticatedFetch('/api/upload/confirm-logos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          confirmedSpecs: confirmedSpecs.map(spec => ({
            imageIndex: spec.imageIndex,
            selectedLogos: spec.selectedLogos
          }))
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Confirmation failed');
      }

      const data = await response.json();
      onConfirm(data.jobId);
    } catch (err) {
      console.error('Confirmation error:', err);
      setError(err.message);
      setSubmitting(false);
    }
  };

  const getImageUrl = (spec, idx) => {
    if (spec.imageUrl) return spec.imageUrl;
    if (images[idx]?.publicUrl) return images[idx].publicUrl;
    if (images[idx]?.driveId) return `/api/images/${images[idx].driveId}`;
    return null;
  };

  return (
    <div className="logo-confirmation-panel">
      <div className="confirmation-header">
        <h2>Confirm Logo Assignments</h2>
        <p>Review and adjust which partner logos should appear on each image before processing.</p>
      </div>

      {error && <div className="confirmation-error">{error}</div>}

      <div className="confirmation-grid">
        {confirmedSpecs.map((spec, idx) => (
          <div key={idx} className="confirmation-card">
            <div className="card-image">
              {getImageUrl(spec, idx) ? (
                <img 
                  src={getImageUrl(spec, idx)} 
                  alt={spec.title || `Image ${idx + 1}`}
                  loading="lazy"
                />
              ) : (
                <div className="image-placeholder">Image {idx + 1}</div>
              )}
            </div>
            
            <div className="card-details">
              <h3 className="card-title">{spec.title || `Image ${idx + 1}`}</h3>
              {spec.subtitle && (
                <p className="card-subtitle">{spec.subtitle.substring(0, 80)}{spec.subtitle.length > 80 ? '...' : ''}</p>
              )}
            </div>

            <div className="card-logos">
              <label className="logos-label">Partner Logos:</label>
              <div className="logo-checkboxes">
                {AVAILABLE_LOGOS.map(logo => (
                  <label 
                    key={logo.id} 
                    className={`logo-checkbox ${spec.selectedLogos?.includes(logo.id) || spec.selectedLogos?.includes(logo.name) ? 'selected' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={spec.selectedLogos?.includes(logo.id) || spec.selectedLogos?.includes(logo.name) || false}
                      onChange={() => toggleLogo(idx, logo.id)}
                    />
                    <span className="logo-name">{logo.name}</span>
                  </label>
                ))}
              </div>
              {spec.selectedLogos?.length > 0 && (
                <div className="selected-count">
                  {spec.selectedLogos.length} logo{spec.selectedLogos.length !== 1 ? 's' : ''} selected
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="confirmation-actions">
        <button 
          className="cancel-btn"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </button>
        <button 
          className="confirm-btn"
          onClick={handleConfirm}
          disabled={submitting}
        >
          {submitting ? 'Processing...' : `Confirm & Process ${confirmedSpecs.length} Images`}
        </button>
      </div>
    </div>
  );
}

export default LogoConfirmationPanel;
