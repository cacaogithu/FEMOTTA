import express from 'express';
import { downloadPsd } from '../controllers/psdController.js';
import { brandContextMiddleware } from '../middleware/brandContext.js';

const router = express.Router();

// Apply brand context to all PSD routes
router.use(brandContextMiddleware);

// GET /api/psd/:jobId/:imageIndex - Download PSD file with 2 layers
router.get('/:jobId/:imageIndex', downloadPsd);

export default router;
