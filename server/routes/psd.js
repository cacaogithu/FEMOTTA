import express from 'express';
import { downloadPsd } from '../controllers/psdController.js';

const router = express.Router();

// GET /api/psd/:jobId/:imageIndex - Download PSD file with 2 layers
router.get('/:jobId/:imageIndex', downloadPsd);

export default router;
