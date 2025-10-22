import { getJob } from '../utils/jobStore.js';
import { downloadFileFromDrive } from '../utils/googleDrive.js';
import { writePsdBuffer } from 'ag-psd';
import { createCanvas, Image } from 'canvas';

export async function downloadPsd(req, res) {
  try {
    const { jobId, imageIndex } = req.params;
    
    const job = getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    if (!job.editedImages || job.editedImages.length === 0) {
      return res.status(404).json({ error: 'No edited images found for this job' });
    }
    
    const index = parseInt(imageIndex);
    if (isNaN(index) || index < 0 || index >= job.editedImages.length) {
      return res.status(400).json({ error: 'Invalid image index' });
    }
    
    const imageData = job.editedImages[index];
    
    console.log('[PSD Download] Fetching images from Google Drive...');
    console.log('[PSD Download] Original ID:', imageData.originalImageId);
    console.log('[PSD Download] Edited ID:', imageData.editedImageId);
    
    // Verify Google Drive credentials before attempting download
    if (!imageData.originalImageId || !imageData.editedImageId) {
      throw new Error('Missing image IDs in job data');
    }
    
    // Download both original and edited images from Google Drive
    const [originalBuffer, editedBuffer] = await Promise.all([
      downloadFileFromDrive(imageData.originalImageId),
      downloadFileFromDrive(imageData.editedImageId)
    ]);
    
    if (!originalBuffer || !editedBuffer) {
      throw new Error('Failed to download images from Google Drive');
    }
    
    console.log('[PSD Download] Images downloaded, processing...');
    
    // Load both images using node-canvas Image
    const originalImg = new Image();
    const editedImg = new Image();
    
    // Load images from buffers (synchronous in node-canvas)
    originalImg.src = Buffer.from(originalBuffer);
    editedImg.src = Buffer.from(editedBuffer);
    
    const width = originalImg.width;
    const height = originalImg.height;
    
    console.log('[PSD Download] Image dimensions:', width, 'x', height);
    
    // Create canvases and draw images
    const originalCanvas = createCanvas(width, height);
    const originalCtx = originalCanvas.getContext('2d');
    originalCtx.drawImage(originalImg, 0, 0);
    
    const editedCanvas = createCanvas(width, height);
    const editedCtx = editedCanvas.getContext('2d');
    editedCtx.drawImage(editedImg, 0, 0);
    
    console.log('[PSD Download] Canvases created, extracting pixel data...');
    
    // Extract image data to verify it's not black
    const originalImageData = originalCtx.getImageData(0, 0, width, height);
    const editedImageData = editedCtx.getImageData(0, 0, width, height);
    
    console.log('[PSD Download] Original pixel sample (first 10 pixels RGB):', 
      Array.from(originalImageData.data.slice(0, 30)));
    console.log('[PSD Download] Edited pixel sample (first 10 pixels RGB):', 
      Array.from(editedImageData.data.slice(0, 30)));
    
    console.log('[PSD Download] Creating PSD with 2 layers...');
    
    // Create PSD document with 2 layers (bottom to top)
    const psd = {
      width,
      height,
      children: [
        {
          name: 'Original Image',
          canvas: originalCanvas
        },
        {
          name: 'AI Edited',
          canvas: editedCanvas
        }
      ]
    };
    
    // Generate PSD buffer (returns ArrayBuffer)
    const psdArrayBuffer = writePsdBuffer(psd);
    
    // Convert ArrayBuffer to Node.js Buffer
    const psdBuffer = Buffer.from(psdArrayBuffer);
    
    console.log('[PSD Download] PSD created successfully, size:', psdBuffer.length, 'bytes');
    
    // Send as downloadable file
    const fileName = `${imageData.originalName.replace(/\.[^/.]+$/, '')}.psd`;
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', psdBuffer.length);
    res.send(psdBuffer);
    
    console.log('[PSD Download] Sent to client:', fileName);
    
  } catch (error) {
    console.error('[PSD Download] Error:', error);
    res.status(500).json({ 
      error: 'Failed to generate PSD file',
      details: error.message 
    });
  }
}

