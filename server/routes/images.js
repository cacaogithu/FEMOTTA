import express from 'express';
import { downloadImage } from '../controllers/imageController.js';
import { brandContextMiddleware } from '../middleware/brandContext.js';

const router = express.Router();

// Apply brand context to all image routes
router.use(brandContextMiddleware);

router.get('/:fileId', downloadImage);

export default router;
