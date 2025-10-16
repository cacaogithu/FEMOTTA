import express from 'express';
import multer from 'multer';
import { uploadPDF, uploadImages } from '../controllers/uploadController.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

router.post('/pdf', upload.single('pdf'), uploadPDF);
router.post('/images', upload.array('images', 20), uploadImages);

export default router;
