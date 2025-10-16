import express from 'express';
import { handleChat } from '../controllers/chatController.js';

const router = express.Router();

router.post('/', express.json(), handleChat);

export default router;
