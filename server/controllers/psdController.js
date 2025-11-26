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

      // Load both images properly with promises to ensure they're fully loaded
      const loadImage = (buffer) => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = (err) => reject(new Error('Failed to load image into canvas'));
          img.src = buffer;
        });
      };

      const [originalImg, editedImg] = await Promise.all([
        loadImage(originalBuffer),
        loadImage(editedBuffer)
      ]);

      // Use the maximum dimensions from both images to prevent cropping
      const width = Math.max(originalImg.width, editedImg.width);
      const height = Math.max(originalImg.height, editedImg.height);

      // Helper to create canvas and draw image
      const createLayerCanvas = (img) => {
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d', { pixelFormat: 'RGB24' });
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0);
        return canvas;
      };

      const originalCanvas = createLayerCanvas(originalImg);
      const editedCanvas = createLayerCanvas(editedImg);

      // Create Difference Layer (visualize changes)
      const diffCanvas = createCanvas(width, height);
      const diffCtx = diffCanvas.getContext('2d');
      diffCtx.drawImage(originalCanvas, 0, 0);
      diffCtx.globalCompositeOperation = 'difference';
      diffCtx.drawImage(editedCanvas, 0, 0);
      // Invert to make it easier to see (black = no change, white = max change) -> maybe better as is?
      // Standard difference is usually black for no change. Let's keep it standard.

      console.log('[PSD Download] Creating layered PSD...');

      // Create PSD document with organized layers
      const psd = {
        width,
        height,
        channels: 3,
        bitsPerChannel: 8,
        colorMode: 3,
        children: [
          {
            name: 'Comparison',
            children: [
              {
                name: 'Difference Highlight',
                visible: false, // Hidden by default
                canvas: diffCanvas,
                blendMode: 'normal',
                opacity: 255
              },
              {
                name: 'AI Edited',
                canvas: editedCanvas,
                blendMode: 'normal',
                opacity: 255
              },
              {
                name: 'Original',
                canvas: originalCanvas,
                blendMode: 'normal',
                opacity: 255
              }
            ]
          }
        ]
      };

      // Generate PSD buffer
      const psdArrayBuffer = writePsdBuffer(psd);
      const psdBuffer = Buffer.from(psdArrayBuffer);

      console.log('[PSD Download] PSD created successfully, size:', psdBuffer.length, 'bytes');

      // Send as downloadable file
      const fileName = `${imageData.originalName.replace(/\.[^/.]+$/, '')}_edited.psd`;
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

