import { editMultipleImagesWithNanoBananaPro } from '../services/nanoBananaImage.js';
import { getJob, updateJob } from '../utils/jobStore.js';
import { uploadFileToDrive, getPublicImageUrl } from '../utils/googleDrive.js';
import { Readable } from 'stream';
import fetch from 'node-fetch';
import { analyzeResultQuality } from '../services/mlLearning.js';
import { archiveBatchToStorage } from '../services/historyService.js';
import { calculateDefaultParameters } from '../services/imageParameters.js';
import sharp from 'sharp';

export async function processImages(req, res) {
  try {
    const { jobId } = req.body;

    const job = await getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (!job.promptText) {
      return res.status(400).json({ error: 'No prompt found for this job' });
    }

    if (!job.images || job.images.length === 0) {
      return res.status(400).json({ error: 'No images found for this job' });
    }

    await updateJob(jobId, { status: 'processing', processingStep: 'Getting image URLs' });

    const imageUrls = job.images.map(img => getPublicImageUrl(img.driveId));

    await updateJob(jobId, {
      status: 'processing',
      processingStep: 'Editing images with Nano Banana Pro AI',
      imageUrls
    });

    const results = await editMultipleImagesWithNanoBananaPro(imageUrls, job.promptText, {
      retries: 3
    });

    await updateJob(jobId, {
      status: 'processing',
      processingStep: 'Saving edited images to Google Drive'
    });

    const DEFAULT_EDITED_IMAGES_FOLDER = '17NE_igWpmMIbyB9H7G8DZ8ZVdzNBMHoB';
    const targetFolderId = job.driveDestinationFolderId || DEFAULT_EDITED_IMAGES_FOLDER;

    if (job.driveDestinationFolderId) {
      logger.info(`[Process] Using custom drive destination: ${targetFolderId}`);
    }

    if (job.marketplacePreset) {
      logger.info(`[Process] Marketplace preset applied: ${job.marketplacePreset.id}`);
    }

    const editedImages = [];
    const psdGenerationPromises = []; // Track PSD generation for parallel processing
    
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const originalImage = job.images[i];

      if (result.images && result.images.length > 0) {
        const editedImageUrl = result.images[0].url;

        let imageBuffer;
        let mimeType = 'image/jpeg';
        
        if (editedImageUrl.startsWith('data:')) {
          const matches = editedImageUrl.match(/^data:([^;]+);base64,(.+)$/);
          if (matches) {
            mimeType = matches[1];
            imageBuffer = Buffer.from(matches[2], 'base64');
          } else {
            throw new Error('Invalid data URL format');
          }
        } else {
          const imageResponse = await fetch(editedImageUrl);
          imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
        }

        const originalNameWithoutExt = originalImage.originalName.replace(/\.[^/.]+$/, '');
        const extension = mimeType.includes('png') ? 'png' : 'jpg';
        const editedFileName = `${originalNameWithoutExt}_edited.${extension}`;

        const stream = Readable.from(imageBuffer);

        const uploadedFile = await uploadFileToDrive(
          stream,
          editedFileName,
          mimeType,
          targetFolderId
        );

        // Get the public URL for the uploaded file
        const publicEditedUrl = getPublicImageUrl(uploadedFile.id);

        // Automated quality analysis (non-blocking)
        analyzeResultQuality(
          jobId,
          publicEditedUrl,
          job.promptText || '',
          job.briefText || ''
        ).then(qualityData => {
          if (qualityData) {
            logger.info(`[Active Learning] Image ${i + 1} quality score: ${qualityData.score}/10`);
            if (qualityData.issues.length > 0) {
              logger.info('[Active Learning] Issues found:', { issues: qualityData.issues });
            }
            // Here you can store qualityData in jobStore or a dedicated feedback store
            // For now, just logging
          }
        }).catch(err => {
          logger.error('[Active Learning] Quality analysis error (non-blocking):', err);
        });

        // Get title/subtitle from imageSpecs if available (for PSD text layers)
        const imageSpec = job.imageSpecs && job.imageSpecs[i] ? job.imageSpecs[i] : null;
        
        // Get image dimensions for parameter calculation
        let imageWidth = 1920;
        let imageHeight = 1080;
        try {
          const metadata = await sharp(imageBuffer).metadata();
          imageWidth = metadata.width || 1920;
          imageHeight = metadata.height || 1080;
          console.log(`[Parameters] Image ${i + 1} dimensions: ${imageWidth}x${imageHeight}`);
        } catch (dimError) {
          console.warn(`[Parameters] Could not get image dimensions, using defaults:`, dimError.message);
        }
        
        // Calculate and store parameters for this image
        const parameters = calculateDefaultParameters(
          imageWidth,
          imageHeight,
          imageSpec?.title || null,
          imageSpec?.subtitle || null
        );
        
        const editedImageData = {
          id: uploadedFile.id,
          name: editedFileName,
          editedImageId: uploadedFile.id,
          originalImageId: originalImage.driveId,
          originalName: originalImage.originalName,
          url: publicEditedUrl,
          title: imageSpec?.title || null,
          subtitle: imageSpec?.subtitle || null,
          promptUsed: job.promptText || null,
          parameters: parameters,
          version: 1
        };
        
        editedImages.push(editedImageData);
        
        // Optionally: Start PSD generation in parallel (non-blocking)
        // This prepares PSD files in the background without blocking PNG delivery
        if (options.generatePSD) {
          const psdPromise = generatePSDInBackground(
            jobId, 
            i, 
            originalImage.driveId, 
            uploadedFile.id,
            imageSpec
          ).catch(err => {
            console.error(`[PSD Background] Failed for image ${i}:`, err.message);
          });
          
          psdGenerationPromises.push(psdPromise);
        }
      }
    }
    
    // Wait for all background PSD generation to complete (non-blocking for user)
    if (psdGenerationPromises.length > 0) {
      console.log(`[PSD Background] Generating ${psdGenerationPromises.length} PSDs in parallel...`);
      Promise.all(psdGenerationPromises).then(() => {
        console.log('[PSD Background] All PSDs generated successfully');
      }).catch(err => {
        console.error('[PSD Background] Some PSDs failed:', err.message);
      });
    }

    // Calculate time metrics
    const endTime = new Date();
    const startTime = job.startTime ? new Date(job.startTime) : endTime;
    const processingTimeMs = endTime - startTime;
    const processingTimeSeconds = Math.round(processingTimeMs / 1000);
    const processingTimeMinutes = (processingTimeSeconds / 60).toFixed(1);

    // Estimate manual time saved (5 minutes per image for manual editing)
    const MANUAL_TIME_PER_IMAGE_MINUTES = 5;
    const estimatedManualTimeMinutes = editedImages.length * MANUAL_TIME_PER_IMAGE_MINUTES;
    const timeSavedMinutes = Math.max(0, estimatedManualTimeMinutes - parseFloat(processingTimeMinutes));
    const timeSavedPercent = estimatedManualTimeMinutes > 0
      ? Math.round((timeSavedMinutes / estimatedManualTimeMinutes) * 100)
      : 0;

    logger.info(`[Time Tracking] Job ${jobId} completed in ${processingTimeMinutes} minutes`);
    logger.info(`[Time Tracking] Estimated manual time: ${estimatedManualTimeMinutes} minutes`);
    logger.info(`[Time Tracking] Time saved: ${timeSavedMinutes.toFixed(1)} minutes (${timeSavedPercent}%)`);

    await updateJob(jobId, {
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

    archiveBatchToStorage(jobId, {
      ...job,
      editedImages,
      processingTimeSeconds,
      estimatedManualTimeMinutes,
      timeSavedMinutes: parseFloat(timeSavedMinutes.toFixed(1))
    }).catch(err => {
      logger.error('[History Archive] Non-blocking archive error:', err);
    });

    res.json({
      success: true,
      jobId,
      editedImages,
      message: `Successfully processed ${editedImages.length} images`
    });

  } catch (error) {
    logger.error('Process images error:', error);

    const { jobId } = req.body;
    if (jobId) {
      await updateJob(jobId, {
        status: 'failed',
        error: error.message
      });
    }

    res.status(500).json({
      error: 'Failed to process images',
      details: error.message
    });
  }
}