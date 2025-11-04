import { editImageWithNanoBanana } from '../services/nanoBanana.js';
import { getJobWithFallback, updateJob } from '../utils/jobStore.js';
import { uploadFileToDrive, makeFilePublic, getPublicImageUrl, downloadFileFromDrive } from '../utils/googleDrive.js';
import { getBrandApiKeys } from '../utils/brandLoader.js';
import fetch from 'node-fetch';

export async function reEditImages(req, res) {
  try {
    const { jobId, newPrompt, imageIds } = req.body;

    if (!newPrompt || !newPrompt.trim()) {
      return res.status(400).json({ error: 'New prompt is required' });
    }

    const job = await getJobWithFallback(jobId);
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
      console.log(`[Re-edit] Processing image: ${image.name} (editedImageId: ${image.editedImageId})`);
      
      // Download the ORIGINAL image from Google Drive (not the edited one)
      // This ensures we start from the source image for best quality
      const originalImageId = image.originalImageId;
      
      if (!originalImageId) {
        console.error(`[Re-edit] No original image ID found for ${image.name}`);
        reEditedResults.push({
          error: true,
          name: image.name,
          message: 'Original image ID not found - cannot re-edit'
        });
        continue;
      }
      
      console.log(`[Re-edit] Downloading ORIGINAL image: ${originalImageId} (not edited version)`);
      
      let originalImageBuffer;
      try {
        originalImageBuffer = await downloadFileFromDrive(originalImageId);
      } catch (downloadError) {
        console.error(`[Re-edit] Failed to download original image ${originalImageId}:`, downloadError.message);
        reEditedResults.push({
          error: true,
          name: image.name,
          message: `Failed to download original image: ${downloadError.message}`
        });
        continue;
      }
      
      if (!originalImageBuffer || originalImageBuffer.length < 1000) {
        console.error(`[Re-edit] Downloaded original image is invalid or too small: ${originalImageId}`);
        reEditedResults.push({
          error: true,
          name: image.name,
          message: 'Downloaded original image file is invalid or corrupted'
        });
        continue;
      }
      
      // Convert buffer to base64 for Wavespeed API
      const base64Image = `data:image/jpeg;base64,${originalImageBuffer.toString('base64')}`;
      const imageSizeKB = Math.round(base64Image.length / 1024);
      console.log(`[Re-edit] Converted ORIGINAL image to base64: ${imageSizeKB} KB`);
      
      // Send base64 image + new prompt to Wavespeed API
      const result = await editImageWithNanoBanana(base64Image, newPrompt, {
        enableSyncMode: true,
        outputFormat: 'jpeg',
        wavespeedApiKey: brandConfig.wavespeedApiKey,
        isBase64: true  // Flag to indicate we're sending base64
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
