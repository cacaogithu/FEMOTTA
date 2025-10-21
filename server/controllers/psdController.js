import { getJob } from '../utils/jobStore.js';
import { downloadFileFromDrive } from '../utils/googleDrive.js';
import { writePsdBuffer } from 'ag-psd';
import sharp from 'sharp';
import { createCanvas, loadImage } from 'canvas';

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
    
    // Get image dimensions from the original image
    const originalMetadata = await sharp(Buffer.from(originalBuffer)).metadata();
    const width = originalMetadata.width;
    const height = originalMetadata.height;
    
    console.log('[PSD Download] Image dimensions:', width, 'x', height);
    
    // Create proper canvas objects for both images using node-canvas
    const [originalCanvas, editedCanvas] = await Promise.all([
      createCanvasFromBuffer(Buffer.from(originalBuffer), width, height),
      createCanvasFromBuffer(Buffer.from(editedBuffer), width, height)
    ]);
    
    console.log('[PSD Download] Creating PSD with 2 layers...');
    
    // Create PSD document with 2 layers (bottom to top)
    const psd = {
      width,
      height,
      channels: 4, // RGBA
      bitsPerChannel: 8,
      colorMode: 3, // RGB
      children: [
        {
          name: 'Original Image',
          canvas: originalCanvas,
          opacity: 255,
          blendMode: 'normal'
        },
        {
          name: 'AI Edited',
          canvas: editedCanvas,
          opacity: 255,
          blendMode: 'normal'
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

// Helper function to create a proper canvas from image buffer using node-canvas
async function createCanvasFromBuffer(imageBuffer, width, height) {
  // Create a canvas with the specified dimensions
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // Load the image from buffer
  const img = await loadImage(imageBuffer);
  
  // Draw the image onto the canvas
  ctx.drawImage(img, 0, 0, width, height);
  
  return canvas;
}
