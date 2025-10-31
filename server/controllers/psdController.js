import { getJobWithFallback } from '../utils/jobStore.js';
import { downloadFileFromDrive } from '../utils/googleDrive.js';
import 'ag-psd/initialize-canvas.js';
import { writePsdBuffer } from 'ag-psd';
import { createCanvas, Image } from 'canvas';
import logger, { logError, logJobError } from '../utils/logger.js';

/**
 * Validates buffer data
 * @param {Buffer} buffer - The buffer to validate
 * @param {string} name - Name for logging purposes
 * @returns {boolean} True if valid
 */
const validateBuffer = (buffer, name) => {
  if (!buffer) {
    throw new Error(`${name} buffer is null or undefined`);
  }
  if (!Buffer.isBuffer(buffer)) {
    throw new Error(`${name} is not a valid Buffer`);
  }
  if (buffer.length === 0) {
    throw new Error(`${name} buffer is empty`);
  }
  return true;
};

/**
 * Loads an image from buffer with proper error handling
 * @param {Buffer} buffer - Image buffer
 * @param {string} name - Image name for logging
 * @returns {Promise<Image>} Loaded image
 */
const loadImageFromBuffer = (buffer, name) => {
  return new Promise((resolve, reject) => {
    try {
      validateBuffer(buffer, name);
      
      const img = new Image();
      
      img.onload = () => {
        if (!img.width || !img.height) {
          reject(new Error(`${name}: Invalid image dimensions (${img.width}x${img.height})`));
          return;
        }
        logger.debug({
          name,
          width: img.width,
          height: img.height
        }, 'Image loaded successfully');
        resolve(img);
      };
      
      img.onerror = (err) => {
        logger.error({
          name,
          error: err
        }, 'Failed to load image into canvas');
        reject(new Error(`${name}: Failed to decode image buffer. The file may be corrupted or in an unsupported format.`));
      };
      
      // node-canvas can load directly from Buffer
      img.src = buffer;
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Creates a canvas with an image drawn on it
 * @param {Image} img - The image to draw
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {string} pixelFormat - Pixel format (RGB24 or RGBA32)
 * @returns {Canvas} Canvas with image
 */
const createImageCanvas = (img, width, height, pixelFormat = 'RGB24') => {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d', { pixelFormat });
  
  // Fill with white background first
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, width, height);
  
  // Draw image
  ctx.drawImage(img, 0, 0);
  
  return canvas;
};

/**
 * Downloads and generates a PSD file with original and edited image layers
 * @route GET /api/psd/:jobId/:imageIndex
 */
export async function downloadPsd(req, res) {
  const startTime = Date.now();
  const { jobId, imageIndex } = req.params;
  
  try {
    logger.info({
      jobId,
      imageIndex
    }, 'Starting PSD download');
    
    // Validate parameters
    if (!jobId || !imageIndex) {
      return res.status(400).json({
        error: 'Missing required parameters',
        details: 'Both jobId and imageIndex are required'
      });
    }
    
    const index = parseInt(imageIndex);
    if (isNaN(index) || index < 0) {
      return res.status(400).json({
        error: 'Invalid image index',
        details: 'Image index must be a non-negative integer'
      });
    }
    
    // Retrieve job with fallback to database
    const job = await getJobWithFallback(jobId);
    if (!job) {
      logger.warn({ jobId }, 'Job not found');
      return res.status(404).json({
        error: 'Job not found',
        details: `No job found with ID: ${jobId}. The job may have expired or been deleted.`
      });
    }
    
    // Validate job has edited images
    if (!job.editedImages || job.editedImages.length === 0) {
      return res.status(404).json({
        error: 'No edited images found',
        details: 'This job has no edited images. Please process images first.'
      });
    }
    
    // Validate image index
    if (index >= job.editedImages.length) {
      return res.status(400).json({
        error: 'Invalid image index',
        details: `Image index ${index} is out of range. This job has ${job.editedImages.length} images (0-${job.editedImages.length - 1}).`
      });
    }
    
    const imageData = job.editedImages[index];
    
    // Validate image data
    if (!imageData.originalImageId || !imageData.editedImageId) {
      logger.error({
        jobId,
        imageIndex,
        imageData
      }, 'Missing image IDs in job data');
      return res.status(500).json({
        error: 'Invalid job data',
        details: 'Image IDs are missing from the job data. This may indicate a data corruption issue.'
      });
    }
    
    logger.info({
      jobId,
      originalImageId: imageData.originalImageId,
      editedImageId: imageData.editedImageId
    }, 'Downloading images from Google Drive');
    
    // Download both images from Google Drive with timeout
    let originalBuffer, editedBuffer;
    try {
      [originalBuffer, editedBuffer] = await Promise.all([
        downloadFileFromDrive(imageData.originalImageId),
        downloadFileFromDrive(imageData.editedImageId)
      ]);
    } catch (driveError) {
      logger.error({
        jobId,
        error: driveError.message,
        originalImageId: imageData.originalImageId,
        editedImageId: imageData.editedImageId
      }, 'Failed to download images from Google Drive');
      
      return res.status(500).json({
        error: 'Failed to download images from Google Drive',
        details: driveError.message.includes('credentials')
          ? 'Google Drive authentication failed. Please reconnect your Google Drive account.'
          : driveError.message.includes('not found')
          ? 'One or more images could not be found in Google Drive. They may have been deleted.'
          : 'Unable to access Google Drive. Please try again later.',
        technicalDetails: process.env.NODE_ENV === 'development' ? driveError.message : undefined
      });
    }
    
    // Validate buffers
    try {
      validateBuffer(originalBuffer, 'Original image');
      validateBuffer(editedBuffer, 'Edited image');
    } catch (validationError) {
      logger.error({
        jobId,
        error: validationError.message
      }, 'Buffer validation failed');
      
      return res.status(500).json({
        error: 'Invalid image data',
        details: validationError.message
      });
    }
    
    logger.info({ jobId }, 'Images downloaded successfully, loading into canvas');
    
    // Load images with proper error handling
    let originalImg, editedImg;
    try {
      [originalImg, editedImg] = await Promise.all([
        loadImageFromBuffer(originalBuffer, 'Original image'),
        loadImageFromBuffer(editedBuffer, 'Edited image')
      ]);
    } catch (loadError) {
      logger.error({
        jobId,
        error: loadError.message
      }, 'Failed to load images');
      
      return res.status(500).json({
        error: 'Failed to process images',
        details: loadError.message
      });
    }
    
    // Use maximum dimensions to prevent cropping
    const width = Math.max(originalImg.width, editedImg.width);
    const height = Math.max(originalImg.height, editedImg.height);
    
    logger.info({
      jobId,
      originalDimensions: `${originalImg.width}x${originalImg.height}`,
      editedDimensions: `${editedImg.width}x${editedImg.height}`,
      psdDimensions: `${width}x${height}`
    }, 'Creating PSD file');
    
    // Create canvases
    const originalCanvas = createImageCanvas(originalImg, width, height);
    const editedCanvas = createImageCanvas(editedImg, width, height);
    
    // Create PSD document with 2 layers (RGB mode)
    const psd = {
      width,
      height,
      channels: 3, // RGB channels
      bitsPerChannel: 8,
      colorMode: 3, // RGB mode
      children: [
        {
          name: 'Original Image',
          top: 0,
          left: 0,
          bottom: height,
          right: width,
          blendMode: 'normal',
          opacity: 255,
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
          opacity: 255,
          canvas: editedCanvas,
          channels: [
            { channelId: 0 }, // Red
            { channelId: 1 }, // Green
            { channelId: 2 }  // Blue
          ]
        }
      ]
    };
    
    // Generate PSD buffer
    let psdArrayBuffer;
    try {
      psdArrayBuffer = writePsdBuffer(psd);
    } catch (psdError) {
      logger.error({
        jobId,
        error: psdError.message
      }, 'Failed to generate PSD');
      
      return res.status(500).json({
        error: 'Failed to generate PSD file',
        details: 'An error occurred while creating the PSD file. Please try again.',
        technicalDetails: process.env.NODE_ENV === 'development' ? psdError.message : undefined
      });
    }
    
    // Convert ArrayBuffer to Node.js Buffer
    const psdBuffer = Buffer.from(psdArrayBuffer);
    
    const duration = Date.now() - startTime;
    logger.info({
      jobId,
      imageIndex,
      psdSize: psdBuffer.length,
      duration
    }, 'PSD created successfully');
    
    // Send as downloadable file
    const fileName = `${imageData.originalName.replace(/\.[^/.]+$/, '')}.psd`;
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', psdBuffer.length);
    res.send(psdBuffer);
    
  } catch (error) {
    const duration = Date.now() - startTime;
    logJobError(jobId, error, {
      imageIndex,
      duration
    });
    
    res.status(500).json({
      error: 'Failed to generate PSD file',
      details: 'An unexpected error occurred. Please try again or contact support if the problem persists.',
      technicalDetails: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
