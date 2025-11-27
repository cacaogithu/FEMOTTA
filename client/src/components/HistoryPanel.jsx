import { useState, useEffect } from 'react';
import { authenticatedFetch } from '../utils/api';
import './HistoryPanel.css';

function HistoryPanel({ onSelectBatch }) {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [batchDetails, setBatchDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [psdGenerating, setPsdGenerating] = useState({});
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    totalCount: 0,
    totalPages: 0,
    hasMore: false
  });

  useEffect(() => {
    fetchHistory();
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
      } else {
        setError(data.error || 'Failed to load batch details');
      }
    } catch (err) {
      setError('Failed to load batch details: ' + err.message);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleBatchClick = (batch) => {
    setSelectedBatch(batch.id);
    fetchBatchDetails(batch.id);
    if (onSelectBatch) {
      onSelectBatch(batch);
    }
  };

  const handleDownloadZip = async () => {
    if (!selectedBatch) return;
    
    setDownloadingZip(true);
    try {
      const response = await authenticatedFetch(
        `/api/history/${selectedBatch}/download?type=zip`
      );
      
      if (!response.ok) {
        throw new Error('Download failed');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedBatch}_batch.zip`;
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

  const handleDownloadImage = async (imageIndex, type = 'edited') => {
    if (!selectedBatch) return;
    
    try {
      const response = await authenticatedFetch(
        `/api/history/${selectedBatch}/download?type=${type}&imageIndex=${imageIndex}`
      );
      
      if (!response.ok) {
        throw new Error('Download failed');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `image_${imageIndex}_${type}.jpg`;
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
      console.log('[History PSD] Getting signed download URL...');
      
      // Step 1: Get a signed download URL from the server
      const response = await authenticatedFetch(`/api/psd/signed-url/${selectedBatch}/${imageIndex}`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to get download URL');
      }
      
      const data = await response.json();
      
      if (!data.success || !data.downloadUrl) {
        throw new Error('Invalid response from server');
      }
      
      console.log('[History PSD] Got signed URL, initiating browser download...');
      
      // Step 2: Navigate to the signed URL - browser will handle the download directly
      window.location.assign(data.downloadUrl);
      
      // Reset the button state after a short delay
      setTimeout(() => {
        setPsdGenerating(prev => ({ ...prev, [imageIndex]: false }));
      }, 2000);
      
    } catch (err) {
      setError('Failed to generate PSD: ' + err.message);
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

  const formatDuration = (seconds) => {
    if (!seconds) return 'N/A';
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
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

      <div className="history-content">
        <div className="history-list">
          {batches.length === 0 ? (
            <div className="history-empty">
              <p>No processing history yet.</p>
              <p>Completed batches will appear here.</p>
            </div>
          ) : (
            <>
              {batches.map((batch) => (
                <div
                  key={batch.id}
                  className={`history-item ${selectedBatch === batch.id ? 'selected' : ''}`}
                  onClick={() => handleBatchClick(batch)}
                >
                  <div className="history-item-thumbnail">
                    {batch.thumbnailUrl ? (
                      <img src={batch.thumbnailUrl} alt="Batch preview" />
                    ) : (
                      <div className="thumbnail-placeholder">No Preview</div>
                    )}
                  </div>
                  <div className="history-item-info">
                    <div className="history-item-date">
                      {formatDate(batch.createdAt)}
                    </div>
                    <div className="history-item-stats">
                      {batch.outputCount} images
                    </div>
                    <div className="history-item-prompt">
                      {batch.promptSnippet}
                    </div>
                  </div>
                </div>
              ))}

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

        <div className="history-details">
          {!selectedBatch ? (
            <div className="history-details-empty">
              <p>Select a batch to view details</p>
            </div>
          ) : detailsLoading ? (
            <div className="history-details-loading">
              <div className="spinner"></div>
              <p>Loading batch details...</p>
            </div>
          ) : batchDetails ? (
            <>
              <div className="details-header">
                <h3>Batch Details</h3>
                <button
                  className="download-all-btn"
                  onClick={handleDownloadZip}
                  disabled={downloadingZip}
                >
                  {downloadingZip ? 'Preparing...' : 'Download All (ZIP)'}
                </button>
              </div>

              <div className="details-meta">
                <div className="meta-row">
                  <span className="meta-label">Created:</span>
                  <span className="meta-value">{formatDate(batchDetails.timestamps.created)}</span>
                </div>
                <div className="meta-row">
                  <span className="meta-label">Processing Time:</span>
                  <span className="meta-value">{formatDuration(batchDetails.metrics.processingTimeSeconds)}</span>
                </div>
                <div className="meta-row">
                  <span className="meta-label">Time Saved:</span>
                  <span className="meta-value highlight">{batchDetails.metrics.estimatedManualTimeMinutes || 0} minutes</span>
                </div>
                <div className="meta-row">
                  <span className="meta-label">Images:</span>
                  <span className="meta-value">{batchDetails.metrics.outputCount} edited</span>
                </div>
              </div>

              <div className="details-prompt">
                <h4>Prompt Used</h4>
                <p>{batchDetails.promptText || batchDetails.briefText || 'No prompt available'}</p>
              </div>

              <div className="details-images">
                <h4>Edited Images</h4>
                <div className="images-grid">
                  {batchDetails.variants.map((variant, index) => (
                    <div key={index} className="image-card">
                      <div className="image-preview">
                        <img 
                          src={variant.editedUrl} 
                          alt={variant.editedName}
                          onError={(e) => {
                            e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23333"/><text x="50%" y="50%" text-anchor="middle" fill="%23666">Error</text></svg>';
                          }}
                        />
                      </div>
                      <div className="image-info">
                        <span className="image-name">{variant.editedName}</span>
                        {variant.title && (
                          <span className="image-title">{variant.title}</span>
                        )}
                      </div>
                      <div className="image-actions">
                        <button 
                          className="action-btn"
                          onClick={() => handleDownloadImage(index, 'edited')}
                          title="Download edited"
                        >
                          JPG
                        </button>
                        <button 
                          className="action-btn"
                          onClick={() => handleDownloadPsd(index)}
                          disabled={psdGenerating[index]}
                          title="Download PSD"
                        >
                          {psdGenerating[index] ? '...' : 'PSD'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default HistoryPanel;
