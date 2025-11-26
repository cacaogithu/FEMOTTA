import express from 'express';
import { createBatchJob, getBatchStatus, getBatchResults } from '../controllers/batchController.js';
import { requireBrandAuth } from '../middleware/brandAuth.js';

const router = express.Router();

// All batch routes require brand authentication
router.use(requireBrandAuth);

router.post('/create', createBatchJob);
router.get('/:jobName/status', getBatchStatus);
router.get('/results', getBatchResults);

export default router;
