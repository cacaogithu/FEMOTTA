import express from 'express';
import multer from 'multer';
import { uploadPDF, uploadImages, getJobInfo } from '../controllers/uploadController.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024
  }
});

router.post('/pdf', upload.single('pdf'), uploadPDF);
router.post('/images', upload.array('images', 20), uploadImages);
router.get('/job/:jobId', getJobInfo);

export default router;
