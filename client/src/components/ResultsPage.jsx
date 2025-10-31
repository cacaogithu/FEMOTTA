import { useState, useEffect } from 'react';
import { authenticatedFetch } from '../utils/api';
import BeforeAfterSlider from './BeforeAfterSlider';
import ImagePreview from './ImagePreview';
import ChatWidget from './ChatWidget';
import FeedbackWidget from './FeedbackWidget';
import WorkflowViewer from './WorkflowViewer';
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

function ResultsPage({ results, onReset, jobId }) {
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
      const response = await authenticatedFetch(`/api/images/${editedImageId}`);
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

  const handleDownloadPsd = (imageIndex, originalName) => {
    // Open PSD download in new tab to bypass iframe download restrictions
    const url = `/api/psd/${jobId}/${imageIndex}`;
    
    // Opening in new window works better in iframe environments (Replit webview)
    // The Content-Disposition header will trigger download automatically
    const downloadWindow = window.open(url, '_blank');
    
    // Fallback: if popup blocked, use fetch + blob approach
    if (!downloadWindow) {
      handleDownloadPsdFallback(imageIndex, originalName);
    }
  };

  const handleDownloadPsdFallback = async (imageIndex, originalName) => {
    try {
      console.log('Using fallback PSD download method...');
      const response = await authenticatedFetch(`/api/psd/${jobId}/${imageIndex}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        if (errorData) {
          console.error('PSD download error:', errorData);
          if (errorData.jobStatus === 'processing') {
            alert('⏳ Images are still processing. Please wait for processing to complete before downloading PSD files.');
          } else if (errorData.details) {
            alert(`❌ ${errorData.error}\n\n${errorData.details}`);
          } else {
            alert(`❌ ${errorData.error || 'Failed to download PSD'}`);
          }
        } else {
          alert('❌ Failed to download PSD file. Please try again.');
        }
        return;
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${originalName.replace(/\.[^/.]+$/, '')}.psd`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('PSD download error:', error);
      alert('❌ Failed to download PSD file. Please try again.');
    }
  };

  return (
    <div className="results-page">
      <ChatWidget jobId={jobId} />
      <div className="container">
        <header className="results-header">
          <h1>Your Images Are Ready!</h1>
          <p>{results.images?.length || 0} images processed successfully</p>
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
          {results.images?.map((image, idx) => (
            <div key={idx} className="result-card">
              {image.originalImageId && image.editedImageId ? (
                <BeforeAfterSlider 
                  beforeImageId={image.originalImageId}
                  afterImageId={image.editedImageId}
                  name={image.name}
                />
              ) : (
                <div className="image-container">
                  <ImagePreview 
                    imageId={image.editedImageId || image.id}
                    alt={image.name}
                    className="result-image"
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
                    onClick={() => handleDownloadPsd(idx, image.originalName)}
                  >
                    Download PSD
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