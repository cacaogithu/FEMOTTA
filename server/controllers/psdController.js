import { getJobWithFallback } from '../utils/jobStore.js';
import { downloadFileFromDrive } from '../utils/googleDrive.js';
import 'ag-psd/initialize-canvas.js'; // Required for Node.js
import { writePsdBuffer } from 'ag-psd';
import { createCanvas, Image } from 'canvas';

export async function downloadPsd(req, res) {
  try {
    const { jobId, imageIndex } = req.params;
    
    const job = await getJobWithFallback(jobId);
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
    
    // Load images from buffers with proper onload event handling
    const loadImageFromBuffer = (buffer) => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        
        img.onload = () => {
          console.log('[PSD Download] Image loaded, dimensions:', img.width, 'x', img.height);
          resolve(img);
        };
        
        img.onerror = (err) => {
          console.error('[PSD Download] Image load error:', err);
          reject(new Error('Failed to load image from buffer'));
        };
        
        // node-canvas can load directly from Buffer
        img.src = buffer;
      });
    };
    
    const [originalImg, editedImg] = await Promise.all([
      loadImageFromBuffer(originalBuffer),
      loadImageFromBuffer(editedBuffer)
    ]);
    
    // Use the maximum dimensions from both images to prevent cropping
    const width = Math.max(originalImg.width, editedImg.width);
    const height = Math.max(originalImg.height, editedImg.height);
    
    console.log('[PSD Download] Original image dimensions:', originalImg.width, 'x', originalImg.height);
    console.log('[PSD Download] Edited image dimensions:', editedImg.width, 'x', editedImg.height);
    console.log('[PSD Download] PSD canvas dimensions (max):', width, 'x', height);
    
    // Create canvases with white background and draw images in RGB mode
    const originalCanvas = createCanvas(width, height);
    const originalCtx = originalCanvas.getContext('2d', { pixelFormat: 'RGB24' });
    // Fill with white background first
    originalCtx.fillStyle = 'white';
    originalCtx.fillRect(0, 0, width, height);
    originalCtx.drawImage(originalImg, 0, 0);
    
    const editedCanvas = createCanvas(width, height);
    const editedCtx = editedCanvas.getContext('2d', { pixelFormat: 'RGB24' });
    // Fill with white background first
    editedCtx.fillStyle = 'white';
    editedCtx.fillRect(0, 0, width, height);
    editedCtx.drawImage(editedImg, 0, 0);
    
    console.log('[PSD Download] Canvases created successfully');
    console.log('[PSD Download] Creating PSD with 2 layers...');
    
    // Create PSD document with 2 layers (bottom to top) in RGB mode
    const psd = {
      width,
      height,
      channels: 3, // RGB channels
      bitsPerChannel: 8,
      colorMode: 3, // 3 = RGB mode (not grayscale or bitmap)
      children: [
        {
          name: 'Original Image',
          top: 0,
          left: 0,
          bottom: height,
          right: width,
          blendMode: 'normal',
          opacity: 255, // 0-255 scale
          canvas: originalCanvas,
          channels: [
            { channelId: 0 }, // Red
            { channelId: 1 }, // Green
            { channelId: 2 }  // Blue
          ]
        },
        {
          name: 'AI Edited',
          top: 0,
          left: 0,
          bottom: height,
          right: width,
          blendMode: 'normal',
          opacity: 255, // 0-255 scale
          canvas: editedCanvas,
          channels: [
            { channelId: 0 }, // Red
            { channelId: 1 }, // Green
            { channelId: 2 }  // Blue
          ]
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

