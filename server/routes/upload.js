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
    console.log(`[Upload] File detected: ${file.originalname}, MIME type: ${file.mimetype}`);
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/octet-stream' // Sometimes DOCX is detected as this
    ];
    
    // Also check by file extension as a backup
    const allowedExtensions = ['.pdf', '.docx'];
    const hasAllowedExtension = allowedExtensions.some(ext => file.originalname.toLowerCase().endsWith(ext));
    
    if (allowedTypes.includes(file.mimetype) || hasAllowedExtension) {
      cb(null, true);
    } else {
      console.log(`[Upload] Rejected file: ${file.originalname} with MIME: ${file.mimetype}`);
      cb(new Error('Only PDF and DOCX files are allowed'));
    }
  }
});

router.post('/pdf', upload.single('pdf'), uploadPDF);
router.post('/text-prompt', express.json(), uploadTextPrompt);
router.post('/images', upload.array('images', 20), uploadImages);
router.get('/job/:jobId', getJobInfo);

export default router;
