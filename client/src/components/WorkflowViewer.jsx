import { useState } from 'react';
import './WorkflowViewer.css';

function WorkflowViewer({ workflowSteps = [] }) {
  const [expandedStep, setExpandedStep] = useState(null);

  const toggleStep = (index) => {
    setExpandedStep(expandedStep === index ? null : index);
  };

  if (workflowSteps.length === 0) {
    return null;
  }

  return (
    <div className="workflow-viewer">
      <h3>🔧 Live Processing Workflow</h3>
      <p className="workflow-subtitle">Watch your images being processed in real-time</p>
      
      <div className="workflow-steps">
        {workflowSteps.map((step, index) => (
          <div 
            key={index} 
            className={`workflow-step ${step.status}`}
            onClick={() => toggleStep(index)}
          >
            <div className="workflow-step-header">
              <div className="workflow-step-status">
                {step.status === 'completed' && <span className="status-icon">✓</span>}
                {step.status === 'in_progress' && <span className="status-icon spinner-small">⟳</span>}
                {step.status === 'pending' && <span className="status-icon">○</span>}
              </div>
              <div className="workflow-step-info">
                <div className="workflow-step-name">{step.name}</div>
                <div className="workflow-step-description">{step.description}</div>
                <div className="workflow-step-time">
                  {new Date(step.timestamp).toLocaleTimeString()}
                </div>
              </div>
              <div className="workflow-expand-icon">
                {expandedStep === index ? '▼' : '▶'}
              </div>
            </div>
            
            {expandedStep === index && step.details && (
              <div className="workflow-step-details">
                {step.details.prompt && (
                  <div className="detail-section">
                    <strong>AI Prompt:</strong>
                    <pre className="code-block">{step.details.prompt}</pre>
                  </div>
                )}
                
                {step.details.code && (
                  <div className="detail-section">
                    <strong>Code:</strong>
                    <pre className="code-block">{step.details.code}</pre>
                  </div>
                )}
                
                {step.details.api && (
                  <div className="detail-section">
                    <strong>API:</strong> {step.details.api}
                    <br />
                    <strong>Endpoint:</strong> <code>{step.details.endpoint}</code>
                  </div>
                )}
                
                {step.details.parameters && (
                  <div className="detail-section">
                    <strong>Parameters:</strong>
                    <pre className="code-block">
                      {JSON.stringify(step.details.parameters, null, 2)}
                    </pre>
                  </div>
                )}
                
                {step.details.batchNumber && (
                  <div className="detail-section">
                    <strong>Batch:</strong> {step.details.batchNumber} of {step.details.totalBatches}
                    {step.details.imagesInBatch && (
                      <> ({step.details.imagesInBatch} images processing in parallel)</>
                    )}
                  </div>
                )}
                
                {step.details.parallelProcessing && (
                  <div className="detail-section parallel-badge">
                    ⚡ Parallel Processing Enabled
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default WorkflowViewer;
