import { useState } from 'react';
import './FeedbackWidget.css';

function FeedbackWidget({ jobId, onSubmit }) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comments, setComments] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (rating === 0) {
      alert('Please select a rating');
      return;
    }

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
            🤖 Machine learning in progress... Your feedback helps us optimize prompts and enhance quality.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="feedback-widget">
      <h3>📊 Rate Your Results</h3>
      <p className="feedback-subtitle">Help us improve with AI-powered learning</p>
      
      <form onSubmit={handleSubmit}>
        <div className="rating-section">
          <label>How satisfied are you with the edited images?</label>
          <div className="star-rating">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                className={`star ${star <= (hoverRating || rating) ? 'active' : ''}`}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
              >
                ★
              </button>
            ))}
          </div>
          {rating > 0 && (
            <div className="rating-label">
              {rating === 1 && '😞 Poor'}
              {rating === 2 && '😕 Fair'}
              {rating === 3 && '😐 Good'}
              {rating === 4 && '😊 Very Good'}
              {rating === 5 && '🤩 Excellent'}
            </div>
          )}
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
          <div className="ml-icon">🧠</div>
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
