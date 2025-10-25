import express from 'express';
import { pollResults, downloadAll } from '../controllers/resultsController.js';
import { brandContextMiddleware } from '../middleware/brandContext.js';

const router = express.Router();

// Apply brand context to all results routes
router.use(brandContextMiddleware);

router.get('/poll/:jobId', pollResults);
router.get('/download/:jobId', downloadAll);

export default router;
