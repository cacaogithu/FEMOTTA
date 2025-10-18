import BeforeAfterSlider from './BeforeAfterSlider';
import ChatWidget from './ChatWidget';
import FeedbackWidget from './FeedbackWidget';
import WorkflowViewer from './WorkflowViewer';
import './ResultsPage.css';

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
          <h1>⚡ Your Images Are Ready!</h1>
          <p>{results.images?.length || 0} images processed successfully</p>
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
