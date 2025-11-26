import { useState, useEffect } from 'react';
import { authenticatedFetch } from '../utils/api';
import BeforeAfterSlider from './BeforeAfterSlider';
import ImagePreview from './ImagePreview';
import ChatWidget from './ChatWidget';
import FeedbackWidget from './FeedbackWidget';
import WorkflowViewer from './WorkflowViewer';
import { generateAndDownloadPSD, initPhotopea } from '../services/photopeaService';
import './ResultsPage.css';

function TimeMetricsPanel({ jobId }) {
  const [jobData, setJobData] = useState(null);

  useEffect(() => {
    authenticatedFetch(`/api/upload/job/${jobId}`)
      .then(res => res.json())
      .then(data => setJobData(data.job))
      .catch(err => console.error('Job data error:', err));
  }, [jobId]);

  if (!jobData || !jobData.timeSavedMinutes) return null;

  return (
    <div className="time-metrics-panel">
      <h3>⏱️ Time & Efficiency Metrics</h3>
      <div className="metrics-grid">
        <div className="metric metric-primary">
          <span className="metric-icon">⚡</span>
          <div className="metric-content">
            <span className="metric-value">{jobData.timeSavedMinutes.toFixed(1)} min</span>
            <span className="metric-label">Time Saved</span>
          </div>
        </div>
        <div className="metric">
          <span className="metric-icon">🎯</span>
          <div className="metric-content">
            <span className="metric-value">{jobData.timeSavedPercent}%</span>
            <span className="metric-label">Efficiency Gain</span>
          </div>
        </div>
        <div className="metric">
          <span className="metric-icon">🚀</span>
          <div className="metric-content">
            <span className="metric-value">{jobData.processingTimeMinutes.toFixed(1)} min</span>
            <span className="metric-label">Processing Time</span>
          </div>
        </div>
        <div className="metric">
          <span className="metric-icon">📊</span>
          <div className="metric-content">
            <span className="metric-value">{jobData.estimatedManualTimeMinutes} min</span>
            <span className="metric-label">Manual Time Estimate</span>
          </div>
        </div>
      </div>
      <p className="metrics-note">
        Automated AI processing saved approximately {jobData.timeSavedMinutes.toFixed(1)} minutes compared to manual editing
      </p>
    </div>
  );
}

function ResultsPage({ results: initialResults, onReset, jobId }) {
  const [results, setResults] = useState(initialResults);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshToken, setRefreshToken] = useState(Date.now());
  const [imageSpecs, setImageSpecs] = useState([]);
  const [psdGenerating, setPsdGenerating] = useState({});

  useEffect(() => {
    setResults(initialResults);
  }, [initialResults]);

  useEffect(() => {
    initPhotopea();
    
    authenticatedFetch(`/api/upload/job/${jobId}`)
      .then(res => res.json())
      .then(data => {
        if (data.job?.imageSpecs) {
          setImageSpecs(data.job.imageSpecs);
        }
      })
      .catch(err => console.error('Failed to load image specs:', err));
  }, [jobId]);

  const handleRefreshImages = async () => {
    setIsRefreshing(true);
    try {
      const response = await authenticatedFetch(`/api/results/poll/${jobId}?t=${Date.now()}`);
      const data = await response.json();
      
      if (data.status === 'completed' && data.results) {
        const newRefreshToken = Date.now();
        setResults({ ...data.results, _refreshTimestamp: newRefreshToken });
        setRefreshToken(newRefreshToken);
      }
    } catch (error) {
      console.error('[ResultsPage] Refresh error:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDownloadAll = async () => {
    try {
      const response = await authenticatedFetch(`/api/results/download/${jobId}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'edited-images.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  const handleDownloadImage = async (editedImageId, name) => {
    try {
      const response = await authenticatedFetch(`/api/images/${editedImageId}?t=${Date.now()}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  const handleDownloadPsd = async (imageIndex, originalName, editedImageId) => {
    if (psdGenerating[imageIndex]) return;
    
    setPsdGenerating(prev => ({ ...prev, [imageIndex]: true }));
    
    try {
      const spec = imageSpecs[imageIndex % imageSpecs.length] || {};
      const imageUrl = `/api/images/${editedImageId}?t=${Date.now()}`;
      const fullImageUrl = `${window.location.origin}${imageUrl}`;
      
      console.log('[PSD] Generating layered PSD with Photopea for:', originalName);
      console.log('[PSD] Image URL:', fullImageUrl);
      console.log('[PSD] Spec:', spec);
      
      const filename = originalName.replace(/\.[^/.]+$/, '');
      
      await generateAndDownloadPSD(fullImageUrl, spec, filename);
      
      console.log('[PSD] Download complete');
    } catch (error) {
      console.error('[PSD] Generation error:', error);
      alert('Failed to generate PSD. Please try again.');
    } finally {
      setPsdGenerating(prev => ({ ...prev, [imageIndex]: false }));
    }
  };

  return (
    <div className="results-page">
      <ChatWidget jobId={jobId} onImageUpdated={handleRefreshImages} />
      <div className="container">
        <header className="results-header">
          <h1>Your Images Are Ready!</h1>
          <p>
            {results?.images?.length || 0} images processed successfully
            {isRefreshing && <span style={{ marginLeft: '10px', color: '#ffa500' }}>⚡ Refreshing...</span>}
          </p>
          <TimeMetricsPanel jobId={jobId} />
          <div className="header-actions">
            <button className="button button-primary" onClick={handleDownloadAll}>
              Download All as ZIP
            </button>
            <button className="button button-secondary" onClick={onReset}>
              Start New Project
            </button>
          </div>
        </header>

        <div className="results-grid">
          {results?.images?.map((image, idx) => (
            <div key={`${image.editedImageId || image.id}-${idx}`} className="result-card">
              {image.originalImageId && image.editedImageId ? (
                <BeforeAfterSlider 
                  key={`slider-${image.editedImageId}-${refreshToken}`}
                  beforeImageId={image.originalImageId}
                  afterImageId={image.editedImageId}
                  name={image.name}
                  refreshToken={refreshToken}
                />
              ) : (
                <div className="image-container">
                  <ImagePreview 
                    key={`preview-${image.editedImageId || image.id}-${refreshToken}`}
                    imageId={image.editedImageId || image.id}
                    alt={image.name}
                    className="result-image"
                    refreshToken={refreshToken}
                  />
                </div>
              )}
              <div className="card-info">
                <h3>{image.name}</h3>
                <div className="download-buttons">
                  <button 
                    className="button button-primary download-btn"
                    onClick={() => handleDownloadImage(image.editedImageId || image.id, image.name)}
                  >
                    Download JPG
                  </button>
                  <button 
                    className="button button-secondary download-btn"
                    onClick={() => handleDownloadPsd(idx, image.originalName, image.editedImageId)}
                    disabled={psdGenerating[idx]}
                  >
                    {psdGenerating[idx] ? 'Generating...' : 'Download PSD'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <WorkflowViewer workflowSteps={results.workflowSteps || []} />

        <FeedbackWidget jobId={jobId} />
      </div>
    </div>
  );
}

export default ResultsPage;