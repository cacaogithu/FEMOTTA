import { useState, useEffect } from 'react';
import { authenticatedFetch } from '../utils/api';
import { generateAndDownloadPSD, initPhotopea } from '../services/photopeaService';
import BeforeAfterSlider from './BeforeAfterSlider';
import ImagePreview from './ImagePreview';
import ChatWidget from './ChatWidget';
import FeedbackWidget from './FeedbackWidget';
import WorkflowViewer from './WorkflowViewer';
import './HistoryPanel.css';
import './ResultsPage.css';

function TimeMetricsPanel({ batchData }) {
  if (!batchData?.timeSavedMinutes) return null;

  return (
    <div className="time-metrics-panel">
      <h3>Time & Efficiency Metrics</h3>
      <div className="metrics-grid">
        <div className="metric metric-primary">
          <span className="metric-icon">⚡</span>
          <div className="metric-content">
            <span className="metric-value">{batchData.timeSavedMinutes?.toFixed(1) || '0'} min</span>
            <span className="metric-label">Time Saved</span>
          </div>
        </div>
        <div className="metric">
          <span className="metric-icon">🎯</span>
          <div className="metric-content">
            <span className="metric-value">{batchData.timeSavedPercent || '95'}%</span>
            <span className="metric-label">Efficiency Gain</span>
          </div>
        </div>
        <div className="metric">
          <span className="metric-icon">🚀</span>
          <div className="metric-content">
            <span className="metric-value">{batchData.processingTimeMinutes?.toFixed(1) || '0'} min</span>
            <span className="metric-label">Processing Time</span>
          </div>
        </div>
        <div className="metric">
          <span className="metric-icon">📊</span>
          <div className="metric-content">
            <span className="metric-value">{batchData.estimatedManualTimeMinutes || '0'} min</span>
            <span className="metric-label">Manual Time Estimate</span>
          </div>
        </div>
      </div>
      <p className="metrics-note">
        Automated AI processing saved approximately {batchData.timeSavedMinutes?.toFixed(1) || '0'} minutes compared to manual editing
      </p>
    </div>
  );
}

function HistoryPanel({ onSelectBatch }) {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [batchDetails, setBatchDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [psdGenerating, setPsdGenerating] = useState({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshToken, setRefreshToken] = useState(Date.now());
  const [imageSpecs, setImageSpecs] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    totalCount: 0,
    totalPages: 0,
    hasMore: false
  });

  useEffect(() => {
    fetchHistory();
    initPhotopea();
  }, [pagination.page]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const response = await authenticatedFetch(
        `/api/history?page=${pagination.page}&limit=${pagination.limit}`
      );
      const data = await response.json();
      
      if (data.success) {
        setBatches(data.items);
        setPagination(prev => ({
          ...prev,
          ...data.pagination
        }));
      } else {
        setError(data.error || 'Failed to load history');
      }
    } catch (err) {
      setError('Failed to load history: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchBatchDetails = async (batchId) => {
    setDetailsLoading(true);
    try {
      const response = await authenticatedFetch(`/api/history/${batchId}`);
      const data = await response.json();
      
      if (data.success) {
        setBatchDetails(data.batch);
        if (data.batch?.imageSpecs) {
          setImageSpecs(data.batch.imageSpecs);
        }
      } else {
        setError(data.error || 'Failed to load batch details');
      }
    } catch (err) {
      setError('Failed to load batch details: ' + err.message);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleRefreshImages = async () => {
    if (!selectedBatch) return;
    setIsRefreshing(true);
    try {
      const response = await authenticatedFetch(`/api/history/${selectedBatch}?t=${Date.now()}`);
      const data = await response.json();
      if (data.success) {
        setBatchDetails(data.batch);
        setRefreshToken(Date.now());
      }
    } catch (error) {
      console.error('[HistoryPanel] Refresh error:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleBatchClick = (batch) => {
    setSelectedBatch(batch.id);
    fetchBatchDetails(batch.id);
    if (onSelectBatch) {
      onSelectBatch(batch);
    }
  };

  const handleBackToList = () => {
    setSelectedBatch(null);
    setBatchDetails(null);
  };

  const handleDownloadZip = async () => {
    if (!selectedBatch) return;
    
    setDownloadingZip(true);
    try {
      const response = await authenticatedFetch(`/api/history/${selectedBatch}/download?type=zip`);
      
      if (!response.ok) {
        throw new Error('Download failed');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `batch-${selectedBatch}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to download: ' + err.message);
    } finally {
      setDownloadingZip(false);
    }
  };

  const handleDownloadImage = async (imageIndex) => {
    if (!selectedBatch) return;
    
    try {
      const response = await authenticatedFetch(
        `/api/history/${selectedBatch}/download?type=edited&imageIndex=${imageIndex}`
      );
      
      if (!response.ok) {
        throw new Error('Download failed');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const contentDisposition = response.headers.get('Content-Disposition');
      const fileName = contentDisposition?.match(/filename="(.+)"/)?.[1] || `image_${imageIndex}.jpg`;
      a.download = fileName;
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to download image: ' + err.message);
    }
  };

  const handleDownloadPsd = async (imageIndex) => {
    if (!selectedBatch || !batchDetails) return;
    if (psdGenerating[imageIndex]) return;
    
    setPsdGenerating(prev => ({ ...prev, [imageIndex]: true }));
    
    try {
      console.log('[History PSD] Starting Photopea PSD generation...');
      
      const variant = batchDetails.variants[imageIndex];
      if (!variant) {
        throw new Error('Image not found');
      }
      
      const spec = batchDetails.imageSpecs?.[imageIndex] || {
        title: variant.title || '',
        subtitle: variant.subtitle || ''
      };
      
      const imageUrl = variant.editedUrl || `/api/images/${variant.editedDriveId}?t=${Date.now()}`;
      const filename = (variant.editedName || variant.originalName || `image_${imageIndex}`).replace(/\.[^/.]+$/, '') + '_editable.psd';
      
      console.log('[History PSD] Using Photopea for TRUE editable text layers');
      console.log('[History PSD] Spec:', spec);
      console.log('[History PSD] Image URL:', imageUrl);
      
      await generateAndDownloadPSD(imageUrl, spec, filename);
      
      console.log('[History PSD] Photopea PSD generated and downloaded successfully');
      
    } catch (err) {
      setError('Failed to generate PSD: ' + err.message);
    } finally {
      setPsdGenerating(prev => ({ ...prev, [imageIndex]: false }));
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading && batches.length === 0) {
    return (
      <div className="history-panel">
        <div className="history-loading">
          <div className="spinner"></div>
          <p>Loading history...</p>
        </div>
      </div>
    );
  }

  if (selectedBatch && batchDetails) {
    return (
      <div className="history-panel history-results-view">
        <ChatWidget jobId={selectedBatch} onImageUpdated={handleRefreshImages} />
        <div className="results-page">
          <div className="container">
            <header className="results-header">
              <button className="back-to-history-btn" onClick={handleBackToList}>
                ← Back to History
              </button>
              <h1>Your Images Are Ready!</h1>
              <p>
                {batchDetails.variants?.length || 0} images processed successfully
                {isRefreshing && <span style={{ marginLeft: '10px', color: '#ffa500' }}>⚡ Refreshing...</span>}
              </p>
              <TimeMetricsPanel batchData={batchDetails} />
              <div className="header-actions">
                <button className="button button-primary" onClick={handleDownloadZip} disabled={downloadingZip}>
                  {downloadingZip ? 'Preparing...' : 'Download All as ZIP'}
                </button>
                <button className="button button-secondary" onClick={handleBackToList}>
                  Back to History
                </button>
              </div>
            </header>

            <div className="results-grid">
              {batchDetails.variants?.map((variant, idx) => (
                <div key={`${variant.editedDriveId || idx}-${refreshToken}`} className="result-card">
                  {variant.originalImageId && (variant.editedUrl || variant.editedDriveId) ? (
                    <BeforeAfterSlider 
                      key={`slider-${variant.editedDriveId}-${refreshToken}`}
                      beforeImageId={variant.originalImageId}
                      afterImageId={variant.editedDriveId}
                      name={variant.editedName}
                      refreshToken={refreshToken}
                    />
                  ) : (
                    <div className="image-container">
                      <img 
                        src={variant.editedUrl || `/api/images/${variant.editedDriveId}?t=${refreshToken}`} 
                        alt={variant.editedName}
                        className="result-image"
                        onError={(e) => {e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23333"/></svg>';}}
                      />
                    </div>
                  )}
                  <div className="card-info">
                    <h3>{variant.editedName}</h3>
                    <div className="download-buttons">
                      <button 
                        className="button button-primary download-btn"
                        onClick={() => handleDownloadImage(idx)}
                      >
                        Download JPG
                      </button>
                      <button 
                        className="button button-secondary download-btn"
                        onClick={() => handleDownloadPsd(idx)}
                        disabled={psdGenerating[idx]}
                      >
                        {psdGenerating[idx] ? 'Generating...' : 'Download PSD'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {batchDetails.workflowSteps && batchDetails.workflowSteps.length > 0 && (
              <WorkflowViewer workflowSteps={batchDetails.workflowSteps} />
            )}

            <FeedbackWidget jobId={selectedBatch} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="history-panel">
      <div className="history-header">
        <h2>Processing History</h2>
        <p className="history-subtitle">
          {pagination.totalCount} completed batches
        </p>
      </div>

      {error && (
        <div className="history-error">
          {error}
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      <div className="history-grid-view">
        {batches.length === 0 ? (
          <div className="history-empty">
            <p>No processing history yet.</p>
            <p>Completed batches will appear here.</p>
          </div>
        ) : (
          <>
            <div className="history-batch-grid">
              {batches.map((batch) => (
                <div
                  key={batch.id}
                  className="history-batch-card"
                  onClick={() => handleBatchClick(batch)}
                >
                  <div className="batch-thumbnail">
                    {batch.thumbnailUrl ? (
                      <img src={batch.thumbnailUrl} alt="Batch preview" />
                    ) : (
                      <div className="thumbnail-placeholder">
                        <span>{batch.outputCount || 0}</span>
                        <span className="thumbnail-label">images</span>
                      </div>
                    )}
                  </div>
                  <div className="batch-info">
                    <div className="batch-date">{formatDate(batch.createdAt)}</div>
                    <div className="batch-stats">{batch.outputCount} images processed</div>
                    <div className="batch-prompt">{batch.promptSnippet}</div>
                  </div>
                  <div className="batch-arrow">→</div>
                </div>
              ))}
            </div>

            {pagination.hasMore && (
              <button
                className="history-load-more"
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Load More'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default HistoryPanel;
