import express from 'express';
import { brandContextMiddleware } from '../middleware/brandContext.js';
import { 
  getHistoryList, 
  getBatchDetails, 
  createBatchZip, 
  downloadSingleImage 
} from '../services/historyService.js';
import { downloadPsd } from '../controllers/psdController.js';
import fs from 'fs';
import path from 'path';

const router = express.Router();

router.use(brandContextMiddleware);

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const brandId = req.brand.id;
    
    const history = await getHistoryList(
      brandId, 
      parseInt(page), 
      parseInt(limit)
    );
    
    res.json({
      success: true,
      ...history
    });
  } catch (error) {
    console.error('[History API] Error fetching history:', error);
    res.status(500).json({ 
      error: 'Failed to fetch history', 
      details: error.message 
    });
  }
});

router.get('/:batchId', async (req, res) => {
  try {
    const { batchId } = req.params;
    const brandId = req.brand.id;
    
    const batchDetails = await getBatchDetails(batchId, brandId);
    
    if (!batchDetails) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    
    res.json({
      success: true,
      batch: batchDetails
    });
  } catch (error) {
    console.error('[History API] Error fetching batch details:', error);
    res.status(500).json({ 
      error: 'Failed to fetch batch details', 
      details: error.message 
    });
  }
});

router.get('/:batchId/download', async (req, res) => {
  try {
    const { batchId } = req.params;
    const { type = 'zip', imageIndex, includeOriginals = 'true' } = req.query;
    const brandId = req.brand.id;
    
    if (type === 'zip') {
      const zipPath = await createBatchZip(
        batchId, 
        brandId, 
        includeOriginals === 'true'
      );
      
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${batchId}_batch.zip"`);
      
      const fileStream = fs.createReadStream(zipPath);
      fileStream.pipe(res);
      
      fileStream.on('end', async () => {
        try {
          await fs.promises.unlink(zipPath);
        } catch (err) {
          console.warn('[History API] Could not clean up ZIP file:', err.message);
        }
      });
      
    } else if ((type === 'image' || type === 'edited') && imageIndex !== undefined) {
      const { buffer, fileName, mimeType } = await downloadSingleImage(
        batchId, 
        brandId, 
        parseInt(imageIndex),
        'edited'
      );
      
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(buffer);
      
    } else if (type === 'original' && imageIndex !== undefined) {
      const { buffer, fileName, mimeType } = await downloadSingleImage(
        batchId, 
        brandId, 
        parseInt(imageIndex),
        'original'
      );
      
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(buffer);
      
    } else {
      res.status(400).json({ 
        error: 'Invalid download type. Use type=zip, type=edited&imageIndex=N, or type=original&imageIndex=N' 
      });
    }
  } catch (error) {
    console.error('[History API] Error downloading batch:', error);
    res.status(500).json({ 
      error: 'Failed to download batch', 
      details: error.message 
    });
  }
});

router.get('/:batchId/psd/:imageIndex', async (req, res) => {
  req.params.jobId = req.params.batchId;
  await downloadPsd(req, res);
});

export default router;
