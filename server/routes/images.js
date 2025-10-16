import express from 'express';
import { downloadImage } from '../controllers/imageController.js';

const router = express.Router();

router.get('/:fileId', downloadImage);

export default router;
