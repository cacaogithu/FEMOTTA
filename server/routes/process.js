import express from 'express';
import { processImages } from '../controllers/processController.js';

const router = express.Router();

router.post('/start', express.json(), processImages);

export default router;
