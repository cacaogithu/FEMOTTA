import express from 'express';
import batchController from '../controllers/batchController.js';
import { brandContextMiddleware } from '../middleware/brandContext.js';

const router = express.Router();

router.use(brandContextMiddleware);

router.post('/brief-analysis', batchController.submitBriefAnalysisBatch);

router.post('/quality-check', batchController.submitQualityCheckBatch);

router.post('/prompt-optimization', batchController.submitPromptOptimizationBatch);

router.get('/status/:batchJobName', batchController.getBatchJobStatus);

router.get('/results/:batchJobName', batchController.getBatchJobResults);

export default router;
