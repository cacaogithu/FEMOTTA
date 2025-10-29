import { reEditImage } from '../services/nanoBanana.js';
import { getJob, updateJob } from '../utils/jobStore.js';
import { uploadFileToDrive, makeFilePublic, getPublicImageUrl } from '../utils/googleDrive.js';
import { getBrandApiKeys } from '../utils/brandLoader.js';
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

    // Load brand-specific configuration
    const brandConfig = await getBrandApiKeys(job);

    if (!job.editedImages || job.editedImages.length === 0) {
      return res.status(400).json({ error: 'No edited images found for this job' });
    }

    // Match by editedImageId (Google Drive ID) which is what the AI provides
    const imagesToReEdit = imageIds 
      ? job.editedImages.filter(img => imageIds.includes(img.editedImageId) || imageIds.includes(img.id))
      : job.editedImages;

    // Validate imageIds if provided
    if (imageIds && imageIds.length > 0) {
      const foundEditedIds = imagesToReEdit.map(img => img.editedImageId);
      const foundInternalIds = imagesToReEdit.map(img => img.id);
      const invalidIds = imageIds.filter(id => !foundEditedIds.includes(id) && !foundInternalIds.includes(id));
      
      if (invalidIds.length > 0) {
        console.warn('[Re-edit] Invalid image IDs provided:', invalidIds);
        console.log('[Re-edit] Available editedImageIds:', job.editedImages.map(img => img.editedImageId));
        console.log('[Re-edit] Available internal IDs:', job.editedImages.map(img => img.id));
      }
      
      if (imagesToReEdit.length === 0) {
        return res.status(400).json({ 
          error: 'No valid images found to re-edit',
          invalidIds,
          availableIds: job.editedImages.map(img => ({ 
            id: img.id, 
            editedImageId: img.editedImageId,
            name: img.name 
          }))
        });
      }
      
      console.log(`[Re-edit] Editing ${imagesToReEdit.length} of ${imageIds.length} requested images`);
    } else if (imagesToReEdit.length === 0) {
      return res.status(400).json({ error: 'No edited images found for this job' });
    }

    const reEditedResults = [];

    for (const image of imagesToReEdit) {
      const originalImage = job.images.find(img => img.driveId === image.originalImageId);
      const imageUrl = originalImage?.publicUrl || image.url;

      const result = await reEditImage(imageUrl, null, newPrompt, {
        enableSyncMode: true,
        outputFormat: 'jpeg',
        wavespeedApiKey: brandConfig.wavespeedApiKey
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
          brandConfig.editedResultsFolderId
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

    // When editing specific images: keep others unchanged, replace only the edited ones
    // When editing all images: replace entire array with new results
    const updatedEditedImages = imageIds && imageIds.length > 0
      ? [
          ...job.editedImages.filter(img => !imageIds.includes(img.editedImageId) && !imageIds.includes(img.id)),
          ...reEditedResults
        ]
      : reEditedResults;

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
