import { useState, useEffect } from 'react';
import BeforeAfterSlider from './BeforeAfterSlider';
import ChatWidget from './ChatWidget';
import FeedbackWidget from './FeedbackWidget';
import WorkflowViewer from './WorkflowViewer';
import './ResultsPage.css';

function TimeMetricsPanel({ jobId }) {
  const [jobData, setJobData] = useState(null);

  useEffect(() => {
    fetch(`/api/upload/job/${jobId}`)
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
      const response = await fetch(`/api/results/download/${jobId}`);
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
      const response = await fetch(`/api/images/${editedImageId}`);
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
                  <img 
                    src={`/api/images/${image.editedImageId || image.id}`}
                    alt={image.name}
                    className="result-image"
                  />
                </div>
              )}
              <div className="card-info">
                <h3>{image.name}</h3>
                <button 
                  className="button button-primary download-btn"
                  onClick={() => handleDownloadImage(image.editedImageId || image.id, image.name)}
                >
                  Download
                </button>
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