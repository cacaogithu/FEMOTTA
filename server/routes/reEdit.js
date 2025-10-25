import express from 'express';
import { reEditImages } from '../controllers/reEditController.js';
import { brandContextMiddleware } from '../middleware/brandContext.js';

const router = express.Router();

// Apply brand context to all re-edit routes
router.use(brandContextMiddleware);

router.post('/', express.json(), reEditImages);

export default router;
