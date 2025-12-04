import express from 'express';
import multer from 'multer';
import { uploadPDF, uploadImages, uploadTextPrompt, getJobInfo, uploadStructuredBrief, uploadPDFWithImages, confirmLogos } from '../controllers/uploadController.js';
import { brandContextMiddleware } from '../middleware/brandContext.js';

const router = express.Router();

// Apply brand context to all upload routes
router.use(brandContextMiddleware);

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

// Multer configuration for image uploads (used by structured form and PDF+images)
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB per image
  },
  fileFilter: (req, file, cb) => {
    console.log(`[Image Upload] File detected: ${file.originalname}, MIME type: ${file.mimetype}`);
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      console.log(`[Image Upload] Rejected file: ${file.originalname} with MIME: ${file.mimetype}`);
      cb(new Error('Only JPG and PNG images are allowed'));
    }
  }
});

// Multer configuration for PDF+images uploads (accepts both PDFs and images)
const pdfWithImagesUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max
  },
  fileFilter: (req, file, cb) => {
    console.log(`[PDF+Images Upload] File detected: ${file.originalname}, MIME type: ${file.mimetype}, field: ${file.fieldname}`);
    
    // Accept PDFs for the 'pdf' field
    if (file.fieldname === 'pdf') {
      if (file.mimetype === 'application/pdf') {
        cb(null, true);
      } else {
        console.log(`[PDF+Images Upload] Rejected PDF: ${file.originalname} with MIME: ${file.mimetype}`);
        cb(new Error('Only PDF files are allowed for the brief'));
      }
    }
    // Accept images for the 'images' field
    else if (file.fieldname === 'images') {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        console.log(`[PDF+Images Upload] Rejected image: ${file.originalname} with MIME: ${file.mimetype}`);
        cb(new Error('Only JPG and PNG images are allowed'));
      }
    } else {
      cb(new Error('Unexpected field: ' + file.fieldname));
    }
  }
});

// Original routes
router.post('/pdf', upload.single('pdf'), uploadPDF);
router.post('/text-prompt', express.json(), uploadTextPrompt);
router.post('/images', imageUpload.array('images', 20), uploadImages);

// New routes for multi-method submission
router.post('/structured-brief', imageUpload.array('images', 20), uploadStructuredBrief);
router.post('/pdf-with-images',
  pdfWithImagesUpload.fields([
    { name: 'pdf', maxCount: 1 },
    { name: 'images', maxCount: 20 }
  ]),
  uploadPDFWithImages
);

router.get('/job/:jobId', getJobInfo);

// Logo confirmation endpoint
router.post('/confirm-logos', express.json(), confirmLogos);

export default router;

