import express from 'express';
import { submitFeedback, getFeedbackStats } from '../controllers/feedbackController.js';
import { brandContextMiddleware } from '../middleware/brandContext.js';

const router = express.Router();

// Apply brand context to all feedback routes
router.use(brandContextMiddleware);

router.post('/', submitFeedback);
router.get('/stats', getFeedbackStats);

export default router;
