import { reEditImage } from '../services/nanoBanana.js';
import { getJob, updateJob } from '../utils/jobStore.js';
import { uploadFileToDrive, makeFilePublic, getPublicImageUrl } from '../utils/googleDrive.js';
import fetch from 'node-fetch';

export async function reEditImages(req, res) {
  try {
    const { jobId, newPrompt, imageIds } = req.body;

    if (!newPrompt || !newPrompt.trim()) {
      return res.status(400).json({ error: 'New prompt is required' });
    }

    const job = getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (!job.editedImages || job.editedImages.length === 0) {
      return res.status(400).json({ error: 'No edited images found for this job' });
    }

    const imagesToReEdit = imageIds 
      ? job.editedImages.filter(img => imageIds.includes(img.id))
      : job.editedImages;

    if (imagesToReEdit.length === 0) {
      return res.status(400).json({ error: 'No valid images to re-edit' });
    }

    const reEditedResults = [];

    for (const image of imagesToReEdit) {
      const originalImage = job.images.find(img => img.driveId === image.originalImageId);
      const imageUrl = originalImage?.publicUrl || image.url;

      const result = await reEditImage(imageUrl, null, newPrompt, {
        enableSyncMode: true,
        outputFormat: 'jpeg'
      });

      if (result.images && result.images.length > 0) {
        const reEditedImageUrl = result.images[0].url;
        
        const imageResponse = await fetch(reEditedImageUrl);
        const imageBuffer = await imageResponse.arrayBuffer();
        
        const timestamp = Date.now();
        const reEditedFileName = `${image.name.replace('_edited.jpg', '')}_reedited_${timestamp}.jpg`;
        
        const uploadedFile = await uploadFileToDrive(
          Buffer.from(imageBuffer),
          reEditedFileName,
          'image/jpeg',
          '17NE_igWpmMIbyB9H7G8DZ8ZVdzNBMHoB'
        );

        await makeFilePublic(uploadedFile.id);

        reEditedResults.push({
          id: uploadedFile.id,
          name: reEditedFileName,
          editedImageId: uploadedFile.id,
          originalImageId: image.originalImageId,
          originalName: image.originalName,
          url: getPublicImageUrl(uploadedFile.id)
        });
      }
    }

    const updatedEditedImages = [
      ...job.editedImages.filter(img => !imageIds || !imageIds.includes(img.id)),
      ...reEditedResults
    ];

    updateJob(jobId, {
      editedImages: updatedEditedImages
    });

    res.json({
      success: true,
      message: `Successfully re-edited ${reEditedResults.length} images`,
      images: reEditedResults
    });

  } catch (error) {
    console.error('Re-edit error:', error);
    res.status(500).json({ 
      error: 'Failed to re-edit images', 
      details: error.message 
    });
  }
}
