import express from 'express';
import multer from 'multer';
import { uploadPDF, uploadImages, uploadTextPrompt, getJobInfo } from '../controllers/uploadController.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and DOCX files are allowed'));
    }
  }
});

router.post('/pdf', upload.single('pdf'), uploadPDF);
router.post('/text-prompt', express.json(), uploadTextPrompt);
router.post('/images', upload.array('images', 20), uploadImages);
router.get('/job/:jobId', getJobInfo);

export default router;
