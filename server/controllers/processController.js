import { editMultipleImagesWithNanoBananaPro } from '../services/nanoBananaImage.js';
import { getJob, updateJob } from '../utils/jobStore.js';
import { uploadFileToDrive, getPublicImageUrl } from '../utils/googleDrive.js';
import { Readable } from 'stream';
import fetch from 'node-fetch';
import { analyzeResultQuality } from '../services/mlLearning.js';
import { archiveBatchToStorage } from '../services/historyService.js';

export async function processImages(req, res) {
  try {
    const { jobId } = req.body;

    const job = getJob(jobId);
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
      console.log(`[Process] Using custom drive destination: ${targetFolderId}`);
    }
    
    if (job.marketplacePreset) {
      console.log(`[Process] Marketplace preset applied: ${job.marketplacePreset.id}`);
    }

    const editedImages = [];
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
            console.log(`[Active Learning] Image ${i + 1} quality score: ${qualityData.score}/10`);
            if (qualityData.issues.length > 0) {
              console.log('[Active Learning] Issues found:', qualityData.issues);
            }
            // Here you can store qualityData in jobStore or a dedicated feedback store
            // For now, just logging
          }
        }).catch(err => {
          console.error('[Active Learning] Quality analysis error (non-blocking):', err);
        });

        // Get title/subtitle from imageSpecs if available (for PSD text layers)
        const imageSpec = job.imageSpecs && job.imageSpecs[i] ? job.imageSpecs[i] : null;
        
        editedImages.push({
          id: uploadedFile.id,
          name: editedFileName,
          editedImageId: uploadedFile.id,
          originalImageId: originalImage.driveId,
          originalName: originalImage.originalName,
          url: publicEditedUrl,
          title: imageSpec?.title || null,
          subtitle: imageSpec?.subtitle || null,
          promptUsed: job.promptText || null
        });
      }
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
    
    console.log(`[Time Tracking] Job ${jobId} completed in ${processingTimeMinutes} minutes`);
    console.log(`[Time Tracking] Estimated manual time: ${estimatedManualTimeMinutes} minutes`);
    console.log(`[Time Tracking] Time saved: ${timeSavedMinutes.toFixed(1)} minutes (${timeSavedPercent}%)`);
    
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
      console.error('[History Archive] Non-blocking archive error:', err.message);
    });

    res.json({
      success: true,
      jobId,
      editedImages,
      message: `Successfully processed ${editedImages.length} images`
    });

  } catch (error) {
    console.error('Process images error:', error);

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