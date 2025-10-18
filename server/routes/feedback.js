import express from 'express';
import { submitFeedback, getFeedbackStats } from '../controllers/feedbackController.js';

const router = express.Router();

router.post('/', submitFeedback);
router.get('/stats', getFeedbackStats);

export default router;
