import { editMultipleImages } from '../services/nanoBanana.js';
import { getJob, updateJob } from '../utils/jobStore.js';
import { uploadFileToDrive, getPublicImageUrl } from '../utils/googleDrive.js';
import { Readable } from 'stream';
import fetch from 'node-fetch';
import { analyzeResultQuality } from '../services/mlLearning.js';
import logger, { logJobStart, logJobComplete, logJobError, logApiCall } from '../utils/logger.js';

/**
 * Retry wrapper for API calls with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {string} operationName - Name for logging
 * @returns {Promise} Result of the function
 */
async function retryWithBackoff(fn, maxRetries = 3, operationName = 'operation') {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const startTime = Date.now();
      const result = await fn();
      const duration = Date.now() - startTime;
      
      logApiCall(operationName, 'success', duration, true);
      return result;
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Max 10s
        logger.warn({
          operationName,
          attempt,
          maxRetries,
          delay,
          error: error.message
        }, `Retry attempt ${attempt}/${maxRetries} after ${delay}ms`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  logApiCall(operationName, 'failed', 0, false);
  throw lastError;
}

/**
 * Validates job data before processing
 * @param {Object} job - Job object
 * @returns {Object} Validation result
 */
function validateJobData(job) {
  const errors = [];
  
  if (!job.promptText || job.promptText.trim().length === 0) {
    errors.push('No prompt text found for this job');
  }
  
  if (!job.images || !Array.isArray(job.images)) {
    errors.push('No images array found in job');
  } else if (job.images.length === 0) {
    errors.push('No images found for this job');
  } else {
    // Validate each image has required fields
    job.images.forEach((img, idx) => {
      if (!img.driveId) {
        errors.push(`Image ${idx} is missing driveId`);
      }
      if (!img.originalName) {
        errors.push(`Image ${idx} is missing originalName`);
      }
    });
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Process images with AI editing
 * @route POST /api/process
 */
export async function processImages(req, res) {
  const startTime = Date.now();
  const { jobId } = req.body;

  try {
    // Validate input
    if (!jobId) {
      return res.status(400).json({
        error: 'Missing required parameter',
        details: 'jobId is required'
      });
    }

    logJobStart(jobId, req.brandId || 'unknown', {
      source: 'processImages'
    });

    // Get job
    const job = getJob(jobId);
    if (!job) {
      logger.warn({ jobId }, 'Job not found');
      return res.status(404).json({
        error: 'Job not found',
        details: `No job found with ID: ${jobId}`
      });
    }

    // Validate job data
    const validation = validateJobData(job);
    if (!validation.valid) {
      logger.error({
        jobId,
        errors: validation.errors
      }, 'Job validation failed');
      
      return res.status(400).json({
        error: 'Invalid job data',
        details: validation.errors.join(', ')
      });
    }

    updateJob(jobId, {
      status: 'processing',
      processingStep: 'Getting image URLs',
      startTime: new Date()
    });

    // Get public URLs for images
    const imageUrls = job.images.map(img => {
      if (!img.driveId) {
        throw new Error(`Image ${img.originalName} is missing driveId`);
      }
      return getPublicImageUrl(img.driveId);
    });

    logger.info({
      jobId,
      imageCount: imageUrls.length
    }, 'Starting AI image editing');

    updateJob(jobId, {
      status: 'processing',
      processingStep: `Editing ${imageUrls.length} images with AI`,
      imageUrls
    });

    // Edit images with retry logic
    let results;
    try {
      results = await retryWithBackoff(
        () => editMultipleImages(imageUrls, job.promptText, {
          enableSyncMode: true,
          outputFormat: 'jpeg',
          numImages: 1,
          onProgress: (progress) => {
            if (progress.type === 'image_complete') {
              updateJob(jobId, {
                processingStep: `Processed ${progress.imageIndex + 1}/${progress.totalImages} images`
              });
            }
          }
        }),
        2, // Max 2 retries for batch operations
        'Wavespeed AI Editing'
      );
    } catch (apiError) {
      logger.error({
        jobId,
        error: apiError.message
      }, 'AI editing failed');
      
      updateJob(jobId, {
        status: 'failed',
        error: apiError.message
      });
      
      return res.status(500).json({
        error: 'AI image editing failed',
        details: apiError.message.includes('INSUFFICIENT_CREDITS')
          ? 'Wavespeed API account needs to be topped up with credits'
          : 'Failed to process images with AI. Please try again.',
        technicalDetails: process.env.NODE_ENV === 'development' ? apiError.message : undefined
      });
    }

    updateJob(jobId, {
      status: 'processing',
      processingStep: 'Saving edited images to Google Drive'
    });

    const EDITED_IMAGES_FOLDER = process.env.GOOGLE_DRIVE_EDITED_FOLDER_ID || '17NE_igWpmMIbyB9H7G8DZ8ZVdzNBMHoB';

    const editedImages = [];
    const failedImages = [];

    // Process results with better error handling
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const originalImage = job.images[i];

      try {
        if (!result.images || result.images.length === 0) {
          throw new Error('No edited image returned from AI');
        }

        const editedImageUrl = result.images[0].url;
        if (!editedImageUrl || !editedImageUrl.startsWith('http')) {
          throw new Error('Invalid edited image URL');
        }

        // Download edited image with retry
        const imageResponse = await retryWithBackoff(
          () => fetch(editedImageUrl),
          3,
          `Download edited image ${i + 1}`
        );

        if (!imageResponse.ok) {
          throw new Error(`Failed to download edited image: ${imageResponse.statusText}`);
        }

        const imageBuffer = await imageResponse.arrayBuffer();
        if (!imageBuffer || imageBuffer.byteLength === 0) {
          throw new Error('Downloaded image is empty');
        }

        const originalNameWithoutExt = originalImage.originalName.replace(/\.[^/.]+$/, '');
        const editedFileName = `${originalNameWithoutExt}_edited.jpg`;

        const stream = Readable.from(Buffer.from(imageBuffer));

        // Upload to Drive with retry
        const uploadedFile = await retryWithBackoff(
          () => uploadFileToDrive(
            stream,
            editedFileName,
            'image/jpeg',
            EDITED_IMAGES_FOLDER
          ),
          3,
          `Upload to Drive ${i + 1}`
        );

        const publicEditedUrl = getPublicImageUrl(uploadedFile.id);

        // Non-blocking quality analysis
        analyzeResultQuality(
          jobId,
          publicEditedUrl,
          job.promptText || '',
          job.briefText || ''
        ).then(qualityData => {
          if (qualityData) {
            logger.info({
              jobId,
              imageIndex: i,
              qualityScore: qualityData.score
            }, 'Quality analysis completed');
          }
        }).catch(err => {
          logger.warn({
            jobId,
            imageIndex: i,
            error: err.message
          }, 'Quality analysis failed (non-blocking)');
        });

        editedImages.push({
          id: uploadedFile.id,
          name: editedFileName,
          editedImageId: uploadedFile.id,
          originalImageId: originalImage.driveId,
          originalName: originalImage.originalName,
          url: publicEditedUrl
        });

        logger.debug({
          jobId,
          imageIndex: i,
          fileName: editedFileName
        }, 'Image processed successfully');

      } catch (imageError) {
        logger.error({
          jobId,
          imageIndex: i,
          imageName: originalImage.originalName,
          error: imageError.message
        }, 'Failed to process individual image');

        failedImages.push({
          index: i,
          name: originalImage.originalName,
          error: imageError.message
        });
      }
    }

    // Check if any images were processed successfully
    if (editedImages.length === 0) {
      updateJob(jobId, {
        status: 'failed',
        error: 'All images failed to process'
      });

      return res.status(500).json({
        error: 'All images failed to process',
        details: 'None of the images could be processed successfully',
        failedImages
      });
    }

    // Calculate time metrics
    const endTime = new Date();
    const startTimeDate = job.startTime ? new Date(job.startTime) : endTime;
    const processingTimeMs = endTime - startTimeDate;
    const processingTimeSeconds = Math.round(processingTimeMs / 1000);
    const processingTimeMinutes = (processingTimeSeconds / 60).toFixed(1);
    
    // Estimate manual time saved (5 minutes per image)
    const MANUAL_TIME_PER_IMAGE_MINUTES = 5;
    const estimatedManualTimeMinutes = editedImages.length * MANUAL_TIME_PER_IMAGE_MINUTES;
    const timeSavedMinutes = Math.max(0, estimatedManualTimeMinutes - parseFloat(processingTimeMinutes));
    const timeSavedPercent = estimatedManualTimeMinutes > 0 
      ? Math.round((timeSavedMinutes / estimatedManualTimeMinutes) * 100)
      : 0;
    
    logJobComplete(jobId, processingTimeMs, {
      imagesProcessed: editedImages.length,
      imagesFailed: failedImages.length,
      timeSavedMinutes
    });
    
    updateJob(jobId, {
      status: 'completed',
      editedImages,
      processingStep: 'Complete',
      endTime: endTime,
      processingTimeSeconds: processingTimeSeconds,
      processingTimeMinutes: parseFloat(processingTimeMinutes),
      estimatedManualTimeMinutes: estimatedManualTimeMinutes,
      timeSavedMinutes: parseFloat(timeSavedMinutes.toFixed(1)),
      timeSavedPercent: timeSavedPercent
    });

    const response = {
      success: true,
      jobId,
      editedImages,
      message: `Successfully processed ${editedImages.length} images`,
      metrics: {
        processingTimeMinutes: parseFloat(processingTimeMinutes),
        timeSavedMinutes: parseFloat(timeSavedMinutes.toFixed(1)),
        timeSavedPercent
      }
    };

    if (failedImages.length > 0) {
      response.warning = `${failedImages.length} images failed to process`;
      response.failedImages = failedImages;
    }

    res.json(response);

  } catch (error) {
    const duration = Date.now() - startTime;
    logJobError(jobId, error, { duration });

    if (jobId) {
      updateJob(jobId, {
        status: 'failed',
        error: error.message
      });
    }

    res.status(500).json({
      error: 'Failed to process images',
      details: 'An unexpected error occurred during image processing',
      technicalDetails: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
