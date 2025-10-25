import express from 'express';
import { handleChat } from '../controllers/chatController.js';
import { brandContextMiddleware } from '../middleware/brandContext.js';

const router = express.Router();

// Apply brand context to all chat routes
router.use(brandContextMiddleware);

router.post('/', express.json(), handleChat);

export default router;
