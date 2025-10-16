import express from 'express';
import { pollResults, downloadAll } from '../controllers/resultsController.js';

const router = express.Router();

router.get('/poll/:jobId', pollResults);
router.get('/download/:jobId', downloadAll);

export default router;
