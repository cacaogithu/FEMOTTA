import { useState } from 'react';
import './FeedbackWidget.css';

function FeedbackWidget({ jobId, onSubmit }) {
  const [rating, setRating] = useState(50);
  const [comments, setComments] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const getRatingLabel = (score) => {
    if (score < 20) return { text: 'Poor', color: '#f44336' };
    if (score < 40) return { text: 'Below Average', color: '#ff9800' };
    if (score < 60) return { text: 'Average', color: '#ffc107' };
    if (score < 80) return { text: 'Good', color: '#8bc34a' };
    if (score < 90) return { text: 'Very Good', color: '#4caf50' };
    return { text: 'Excellent', color: '#00e676' };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setSubmitting(true);

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jobId,
          rating,
          comments
        })
      });

      if (response.ok) {
        setSubmitted(true);
        if (onSubmit) onSubmit();
      } else {
        alert('Failed to submit feedback');
      }
    } catch (error) {
      console.error('Feedback submission error:', error);
      alert('Error submitting feedback');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="feedback-widget submitted">
        <div className="feedback-success">
          <div className="success-icon">✓</div>
          <h3>Thank you for your feedback!</h3>
          <p>Our AI is learning from your input to improve future results.</p>
          <p className="ml-note">
            Machine learning in progress... Your feedback helps us optimize prompts and enhance quality.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="feedback-widget">
      <h3>Rate Your Results</h3>
      <p className="feedback-subtitle">Help us improve with AI-powered learning</p>
      
      <form onSubmit={handleSubmit}>
        <div className="rating-section">
          <label>Rate the overall quality (0-100)</label>
          <div className="slider-container">
            <input
              type="range"
              min="0"
              max="100"
              value={rating}
              onChange={(e) => setRating(parseInt(e.target.value))}
              className="quality-slider"
              style={{
                background: `linear-gradient(to right, ${getRatingLabel(rating).color} 0%, ${getRatingLabel(rating).color} ${rating}%, #333 ${rating}%, #333 100%)`
              }}
            />
            <div className="rating-display">
              <span className="rating-score">{rating}/100</span>
              <span className="rating-text" style={{ color: getRatingLabel(rating).color }}>
                {getRatingLabel(rating).text}
              </span>
            </div>
          </div>
        </div>

        <div className="comments-section">
          <label>
            Additional feedback (optional)
            <span className="help-text">Tell us what you liked or what could be improved</span>
          </label>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="Example: The colors were perfect, but the text placement could be better..."
            rows={4}
          />
        </div>

        <div className="ml-info">
          <div className="ml-icon">AI</div>
          <div className="ml-text">
            <strong>AI Self-Improvement</strong>
            <p>Your feedback trains our machine learning model to automatically improve prompts and code for better results.</p>
          </div>
        </div>

        <button 
          type="submit" 
          className="submit-btn"
          disabled={submitting || rating === 0}
        >
          {submitting ? 'Submitting...' : 'Submit Feedback & Improve AI'}
        </button>
      </form>
    </div>
  );
}

export default FeedbackWidget;
