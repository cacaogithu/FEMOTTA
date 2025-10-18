
import express from 'express';
import { getLearningStats, getSuccessfulExamples } from '../services/mlLearning.js';

const router = express.Router();

router.get('/stats', (req, res) => {
  try {
    const stats = getLearningStats();
    res.json(stats);
  } catch (error) {
    console.error('ML stats error:', error);
    res.status(500).json({ error: 'Failed to get ML stats' });
  }
});

router.get('/examples', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const examples = getSuccessfulExamples(limit);
    
    // Don't send full image URLs to client, just metadata
    const sanitized = examples.map(ex => ({
      score: ex.score,
      promptSnippet: ex.prompt.substring(0, 100) + '...',
      timestamp: ex.timestamp,
      issuesFound: ex.analysis.includes('Issues:') ? 'Some' : 'None'
    }));
    
    res.json(sanitized);
  } catch (error) {
    console.error('Get examples error:', error);
    res.status(500).json({ error: 'Failed to get examples' });
  }
});

export default router;
