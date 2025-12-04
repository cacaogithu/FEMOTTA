import { getJob, saveFeedback, getAllFeedback } from '../utils/jobStore.js';
import { improvePromptWithFeedback } from '../services/mlLearning.js';

export async function submitFeedback(req, res) {
  try {
    const { jobId, rating, comments, imageRatings } = req.body;

    if (!jobId || rating === undefined) {
      return res.status(400).json({ error: 'Job ID and rating are required' });
    }

    const job = await getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const feedbackData = {
      jobId,
      rating,
      comments,
      imageRatings,
      originalPrompt: job.promptText,
      imageCount: job.images?.length || 0,
      createdAt: new Date().toISOString()
    };

    const feedbackId = saveFeedback(jobId, feedbackData);

    res.json({
      success: true,
      feedbackId,
      message: 'Feedback submitted successfully. AI is analyzing to improve future results.'
    });

    improvePromptWithFeedback(jobId, feedbackData).catch(err => {
      console.error('ML learning error (non-blocking):', err);
    });

  } catch (error) {
    console.error('Submit feedback error:', error);
    res.status(500).json({ error: 'Failed to submit feedback', details: error.message });
  }
}

export async function getFeedbackStats(req, res) {
  try {
    const allFeedback = getAllFeedback();

    const stats = {
      totalFeedback: allFeedback.length,
      averageRating: allFeedback.length > 0
        ? (allFeedback.reduce((sum, f) => sum + f.rating, 0) / allFeedback.length).toFixed(1)
        : 0,
      ratingDistribution: {
        poor: allFeedback.filter(f => f.rating < 40).length,
        belowAverage: allFeedback.filter(f => f.rating >= 40 && f.rating < 60).length,
        average: allFeedback.filter(f => f.rating >= 60 && f.rating < 75).length,
        good: allFeedback.filter(f => f.rating >= 75 && f.rating < 90).length,
        excellent: allFeedback.filter(f => f.rating >= 90).length
      },
      recentFeedback: allFeedback.slice(-10).reverse()
    };

    res.json(stats);
  } catch (error) {
    console.error('Get feedback stats error:', error);
    res.status(500).json({ error: 'Failed to get feedback stats' });
  }
}
