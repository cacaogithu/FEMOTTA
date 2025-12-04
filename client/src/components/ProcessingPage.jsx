import { useState, useEffect } from 'react';
import { authenticatedFetch } from '../utils/api';
import WorkflowViewer from './WorkflowViewer';
import './ProcessingPage.css';

const steps = [
  { label: 'Uploading', description: 'Uploading files to cloud storage' },
  { label: 'Extracting', description: 'AI parsing your creative brief' },
  { label: 'Rendering', description: 'AI editing product images' },
  { label: 'Exporting', description: 'Saving results to storage' },
  { label: 'Complete', description: 'Processing finished' }
];

function ProcessingPage({ jobId, onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [workflowSteps, setWorkflowSteps] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let pollInterval;
    let stepInterval;

    const poll = async () => {
      try {
        // Add timestamp to prevent caching and ensure real-time updates (especially for re-edits)
        const response = await authenticatedFetch(`/api/results/poll/${jobId}?t=${Date.now()}`);
        const data = await response.json();

        if (data.status === 'failed') {
          clearInterval(pollInterval);
          clearInterval(stepInterval);
          setError(data.error || 'Processing failed. Please try again.');
        } else if (data.status === 'completed') {
          clearInterval(pollInterval);
          clearInterval(stepInterval);
          setProgress(100);
          setCurrentStep(4);
          if (data.workflowSteps) {
            setWorkflowSteps(data.workflowSteps);
          }
          setTimeout(() => onComplete(data.results), 500);
        } else if (data.status === 'processing') {
          if (data.progress !== undefined) {
            setProgress(data.progress);
          }
          if (data.workflowSteps) {
            setWorkflowSteps(data.workflowSteps);
          }
          setCurrentStep(3);
        } else if (data.step) {
          setCurrentStep(data.step - 1);
        }
        
        if (data.workflowSteps && data.workflowSteps.length > 0) {
          setWorkflowSteps(data.workflowSteps);
        }
      } catch (error) {
        console.error('Polling error:', error);
        clearInterval(pollInterval);
        clearInterval(stepInterval);
        setError('Network error: Unable to check processing status. Please check your connection and try again.');
      }
    };

    stepInterval = setInterval(() => {
      setCurrentStep(prev => Math.min(prev + 1, 3));
      setProgress(prev => Math.min(prev + 20, 80));
    }, 3000);

    pollInterval = setInterval(poll, 2000);
    poll();

    return () => {
      clearInterval(pollInterval);
      clearInterval(stepInterval);
    };
  }, [jobId, onComplete]);

  const getErrorMessage = (errorText) => {
    if (errorText?.includes('INSUFFICIENT_CREDITS') || errorText?.toLowerCase().includes('insufficient credits')) {
      return {
        title: '⚠️ Insufficient API Credits',
        message: 'The Gemini API account needs to be topped up with credits to continue processing images.',
        details: 'Please add credits to your Google Cloud account and try again.'
      };
    }
    
    if (errorText?.includes('Gemini') || errorText?.includes('generation')) {
      return {
        title: '⚠️ Image Processing Error',
        message: 'There was an error processing your images with the AI service.',
        details: errorText
      };
    }
    
    return {
      title: '❌ Processing Failed',
      message: 'Something went wrong while processing your images.',
      details: errorText || 'Please try again or contact support if the problem persists.'
    };
  };

  if (error) {
    const errorInfo = getErrorMessage(error);
    
    return (
      <div className="processing-page">
        <div className="container">
          <div className="processing-content error-state">
            <div className="error-icon">⚠️</div>
            <h1>{errorInfo.title}</h1>
            <p className="error-message">{errorInfo.message}</p>
            <div className="error-details">
              <p>{errorInfo.details}</p>
            </div>
            <button 
              className="retry-button"
              onClick={() => window.location.href = '/'}
            >
              Start Over
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="processing-page">
      <div className="container">
        <div className="processing-content">
          <div className="processing-header">
            <div className="spinner-modern"></div>
            <h1>Processing Images</h1>
            <p className="subtitle">AI is analyzing and enhancing your product images</p>
          </div>
          
          <div className="progress-section">
            <div className="progress-stats">
              <span className="progress-label">Progress</span>
              <span className="progress-percentage">{progress}%</span>
            </div>
            <div className="progress-bar-modern">
              <div 
                className="progress-fill-modern" 
                style={{ width: `${progress}%` }}
              >
                <div className="progress-glow"></div>
              </div>
            </div>
          </div>

          <div className="steps-modern">
            {steps.map((step, idx) => (
              <div 
                key={idx} 
                className={`step-modern ${idx <= currentStep ? 'active' : ''} ${idx < currentStep ? 'completed' : ''}`}
              >
                <div className="step-indicator">
                  {idx < currentStep ? (
                    <svg className="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  ) : (
                    <span className="step-num">{idx + 1}</span>
                  )}
                </div>
                <div className="step-content">
                  <div className="step-label">{step.label}</div>
                  <div className="step-description">{step.description}</div>
                  {idx === currentStep && idx < steps.length - 1 && (
                    <div className="step-loader">
                      <div className="dot-pulse">
                        <div className="dot"></div>
                        <div className="dot"></div>
                        <div className="dot"></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="estimate-modern">
            <svg className="clock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <span>Estimated time: 2-3 minutes</span>
          </div>
          
          <WorkflowViewer workflowSteps={workflowSteps} />
        </div>
      </div>
    </div>
  );
}

export default ProcessingPage;
