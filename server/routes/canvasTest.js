import express from 'express';
import { overlayTextOnImage } from '../services/canvasTextOverlay.js';
import { analyzeImageForParameters } from '../services/geminiImage.js';
import { uploadFileToDrive, makeFilePublic, getPublicImageUrl } from '../utils/googleDrive.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

const testModeEnabled = process.env.CANVAS_TEST_ENABLED === 'true';
const JWT_SECRET = process.env.JWT_SECRET;

function authMiddleware(req, res, next) {
  if (!testModeEnabled) {
    return res.status(403).json({ error: 'Canvas test routes are disabled' });
  }

  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Authentication required for test routes' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

router.post('/overlay-test', authMiddleware, express.json(), async (req, res) => {
  try {
    const { imageUrl, title, subtitle, analyzeFirst = true } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ error: 'imageUrl is required' });
    }

    console.log('[Canvas Test] Starting test with:', { imageUrl: imageUrl.substring(0, 50) + '...', title, subtitle });

    let analysisParams = null;
    if (analyzeFirst) {
      console.log('[Canvas Test] Analyzing image for optimal parameters...');
      try {
        analysisParams = await analyzeImageForParameters(imageUrl);
        console.log('[Canvas Test] Analysis result:', analysisParams);
      } catch (err) {
        console.error('[Canvas Test] Analysis failed, using defaults:', err.message);
      }
    }

    const result = await overlayTextOnImage(imageUrl, {
      title: title || 'TEST TITLE',
      subtitle: subtitle || 'Test subtitle text',
      marginTop: analysisParams?.recommendedMarginTop || 5,
      marginLeft: analysisParams?.recommendedMarginLeft || 4,
      gradientCoverage: analysisParams?.recommendedGradientCoverage || 20,
      gradientOpacity: 0.35,
      titleFontSize: analysisParams?.recommendedTitleSize || null,
      textAlignment: analysisParams?.textAlignment || 'left'
    });

    console.log('[Canvas Test] Overlay complete:', { width: result.width, height: result.height });

    res.json({
      success: true,
      message: 'Canvas overlay test completed',
      result: {
        width: result.width,
        height: result.height,
        dataUrl: result.dataUrl,
        analysisParams
      }
    });

  } catch (error) {
    console.error('[Canvas Test] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/overlay-and-save', authMiddleware, express.json(), async (req, res) => {
  try {
    const { imageUrl, title, subtitle, folderId } = req.body;

    if (!imageUrl || !folderId) {
      return res.status(400).json({ error: 'imageUrl and folderId are required' });
    }

    console.log('[Canvas Test] Analyzing and overlaying...');

    let analysisParams = null;
    try {
      analysisParams = await analyzeImageForParameters(imageUrl);
    } catch (err) {
      console.error('[Canvas Test] Analysis failed, using defaults');
    }

    const result = await overlayTextOnImage(imageUrl, {
      title: title || 'TEST TITLE',
      subtitle: subtitle || '',
      marginTop: analysisParams?.recommendedMarginTop || 5,
      marginLeft: analysisParams?.recommendedMarginLeft || 4,
      gradientCoverage: analysisParams?.recommendedGradientCoverage || 20,
      gradientOpacity: 0.35,
      titleFontSize: analysisParams?.recommendedTitleSize || null,
      textAlignment: analysisParams?.textAlignment || 'left'
    });

    const imageBuffer = Buffer.from(result.base64, 'base64');
    const fileName = `canvas_test_${Date.now()}.jpg`;

    console.log('[Canvas Test] Uploading to Drive...');
    const uploadedFile = await uploadFileToDrive(
      imageBuffer,
      fileName,
      'image/jpeg',
      folderId
    );

    await makeFilePublic(uploadedFile.id);
    const publicUrl = getPublicImageUrl(uploadedFile.id);

    console.log('[Canvas Test] Saved to Drive:', publicUrl);

    res.json({
      success: true,
      message: 'Canvas overlay saved to Drive',
      result: {
        fileId: uploadedFile.id,
        fileName,
        publicUrl,
        width: result.width,
        height: result.height
      }
    });

  } catch (error) {
    console.error('[Canvas Test] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
