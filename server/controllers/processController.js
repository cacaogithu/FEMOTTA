import { editMultipleImages } from '../services/nanoBanana.js';
import { getJob, updateJob } from '../utils/jobStore.js';
import { uploadFileToDrive, getPublicImageUrl } from '../utils/googleDrive.js';
import { Readable } from 'stream';
import fetch from 'node-fetch';

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

    updateJob(jobId, { status: 'processing', processingStep: 'Getting image URLs' });

    const imageUrls = job.images.map(img => getPublicImageUrl(img.driveId));

    updateJob(jobId, { 
      status: 'processing', 
      processingStep: 'Editing images with Nano Banana AI',
      imageUrls 
    });

    const results = await editMultipleImages(imageUrls, job.promptText, {
      enableSyncMode: true,
      outputFormat: 'jpeg',
      numImages: 1
    });

    updateJob(jobId, { 
      status: 'processing', 
      processingStep: 'Saving edited images to Google Drive'
    });

    const EDITED_IMAGES_FOLDER = '17NE_igWpmMIbyB9H7G8DZ8ZVdzNBMHoB';
    
    const editedImages = [];
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const originalImage = job.images[i];
      
      if (result.images && result.images.length > 0) {
        const editedImageUrl = result.images[0].url;
        
        const imageResponse = await fetch(editedImageUrl);
        const imageBuffer = await imageResponse.arrayBuffer();
        
        const originalNameWithoutExt = originalImage.originalName.replace(/\.[^/.]+$/, '');
        const editedFileName = `${originalNameWithoutExt}_edited.jpg`;
        
        const stream = Readable.from(Buffer.from(imageBuffer));
        
        const uploadedFile = await uploadFileToDrive(
          stream,
          editedFileName,
          'image/jpeg',
          EDITED_IMAGES_FOLDER
        );

        editedImages.push({
          id: uploadedFile.id,
          name: editedFileName,
          editedImageId: uploadedFile.id,
          originalImageId: originalImage.driveId,
          originalName: originalImage.originalName,
          url: editedImageUrl
        });
      }
    }

    updateJob(jobId, { 
      status: 'completed',
      editedImages,
      processingStep: 'Complete'
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
      updateJob(jobId, { 
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
