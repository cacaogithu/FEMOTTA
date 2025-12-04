import express from 'express';
import { downloadPsd, getPsdInfo, generatePsdSignedUrl, downloadPsdWithToken, SUPPORTS_TEXT_LAYERS } from '../controllers/psdController.js';
import { brandContextMiddleware } from '../middleware/brandContext.js';

const router = express.Router();

// GET /api/psd/file/:token - Token-based download (NO AUTH REQUIRED - token is the auth)
// This must be BEFORE the brandContextMiddleware to bypass auth
router.get('/file/:token', downloadPsdWithToken);

// Apply brand context to remaining PSD routes
router.use(brandContextMiddleware);

// GET /api/psd/capabilities - Get PSD generation capabilities
router.get('/capabilities', (req, res) => {
  res.json({
    supportsTextLayers: SUPPORTS_TEXT_LAYERS,
    supportedFonts: ['Saira-Bold', 'Saira-Regular'],
    features: [
      'Editable text layers (Title, Subtitle) using Saira font',
      'AI Edited background layer',
      'Optimized file size with RLE compression'
    ],
    notes: 'Text layers are fully editable in Adobe Photoshop. Saira font family should be installed for best results.'
  });
});

// POST /api/psd/signed-url/:jobId/:imageIndex - Get a signed download URL (bypasses browser fetch/blob issues)
router.post('/signed-url/:jobId/:imageIndex', generatePsdSignedUrl);

// GET /api/psd/info/:jobId/:imageIndex - Get PSD metadata without downloading
router.get('/info/:jobId/:imageIndex', getPsdInfo);

// GET /api/psd/:jobId/:imageIndex - Download PSD file with editable text layers (legacy, uses fetch/blob)
router.get('/:jobId/:imageIndex', downloadPsd);

export default router;
