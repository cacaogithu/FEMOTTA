import express from 'express';
import { downloadPsd, getPsdInfo, SUPPORTS_TEXT_LAYERS } from '../controllers/psdController.js';
import { brandContextMiddleware } from '../middleware/brandContext.js';

const router = express.Router();

// Apply brand context to all PSD routes
router.use(brandContextMiddleware);

// GET /api/psd/capabilities - Get PSD generation capabilities
router.get('/capabilities', (req, res) => {
  res.json({
    supportsTextLayers: SUPPORTS_TEXT_LAYERS,
    supportedFonts: ['Montserrat-ExtraBold', 'Montserrat-Regular'],
    features: [
      'Editable text layers (Title, Subtitle)',
      'Original image layer',
      'AI Edited reference layer',
      'Difference highlight layer'
    ],
    notes: 'Text layers are fully editable in Adobe Photoshop. Click "Update" when prompted to render text.'
  });
});

// GET /api/psd/info/:jobId/:imageIndex - Get PSD metadata without downloading
router.get('/info/:jobId/:imageIndex', getPsdInfo);

// GET /api/psd/:jobId/:imageIndex - Download PSD file with editable text layers
router.get('/:jobId/:imageIndex', downloadPsd);

export default router;
