import { useState, useEffect } from 'react';
import './ProcessingPage.css';

const steps = [
  'Uploading files to cloud storage...',
  'AI parsing your creative brief...',
  'Matching images to specifications...',
  'Editing images with AI...',
  'Preparing results...'
];

function ProcessingPage({ jobId, onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let pollInterval;
    let stepInterval;

    const poll = async () => {
      try {
        const response = await fetch(`/api/results/poll/${jobId}`);
        const data = await response.json();

        if (data.status === 'completed') {
          clearInterval(pollInterval);
          clearInterval(stepInterval);
          setProgress(100);
          setCurrentStep(4);
          setTimeout(() => onComplete(data), 500);
        } else if (data.status === 'processing') {
          // Update progress from job data
          if (data.progress !== undefined) {
            setProgress(data.progress);
          }
          setCurrentStep(3); // Editing images step
        } else if (data.step) {
          setCurrentStep(data.step - 1);
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    };

    stepInterval = setInterval(() => {
      setCurrentStep(prev => Math.min(prev + 1, 3));
      setProgress(prev => Math.min(prev + 20, 80));
    }, 3000);

    pollInterval = setInterval(poll, 5000);
    poll();

    return () => {
      clearInterval(pollInterval);
      clearInterval(stepInterval);
    };
  }, [jobId, onComplete]);

  return (
    <div className="processing-page">
      <div className="container">
        <div className="processing-content">
          <div className="spinner-large"></div>
          <h1>Processing Your Images...</h1>
          
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>

          <div className="steps">
            {steps.map((step, idx) => (
              <div 
                key={idx} 
                className={`step ${idx <= currentStep ? 'active' : ''} ${idx < currentStep ? 'completed' : ''}`}
              >
                <div className="step-number">{idx + 1}</div>
                <div className="step-text">{step}</div>
              </div>
            ))}
          </div>

          {progress > 0 && progress < 100 && (
            <p className="progress-text">{progress}% complete</p>
          )}

          <p className="estimate">Estimated time: 2-3 minutes</p>
        </div>
      </div>
    </div>
  );
}

export default ProcessingPage;
