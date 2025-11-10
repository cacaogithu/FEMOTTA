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
      
      // Download the EDITED image from Google Drive to build on previous work
      // This enables iterative refinement - each re-edit builds on top of the last
      const editedImageId = image.editedImageId;
      
      if (!editedImageId) {
        console.error(`[Re-edit] No edited image ID found for ${image.name}`);
        reEditedResults.push({
          error: true,
          name: image.name,
          message: 'Edited image ID not found - cannot re-edit'
        });
        continue;
      }
      
      console.log(`[Re-edit] Downloading EDITED image: ${editedImageId} (preserving previous edits)`);
      
      let editedImageBuffer;
      try {
        editedImageBuffer = await downloadFileFromDrive(editedImageId);
      } catch (downloadError) {
        console.error(`[Re-edit] Failed to download edited image ${editedImageId}:`, downloadError.message);
        reEditedResults.push({
          error: true,
          name: image.name,
          message: `Failed to download edited image: ${downloadError.message}`
        });
        continue;
      }
      
      if (!editedImageBuffer || editedImageBuffer.length < 1000) {
        console.error(`[Re-edit] Downloaded edited image is invalid or too small: ${editedImageId}`);
        reEditedResults.push({
          error: true,
          name: image.name,
          message: 'Downloaded edited image file is invalid or corrupted'
        });
        continue;
      }
      
      // Convert buffer to base64 for Wavespeed API
      const base64Image = `data:image/jpeg;base64,${editedImageBuffer.toString('base64')}`;
      const imageSizeKB = Math.round(base64Image.length / 1024);
      console.log(`[Re-edit] Converted EDITED image to base64: ${imageSizeKB} KB`);
      
      // Send base64 image + new prompt to Wavespeed API
      console.log(`[Re-edit] Calling Wavespeed API with prompt: "${newPrompt}"`);
      console.log(`[Re-edit] This may take 60-120 seconds for complex edits...`);
      
      let result;
      try {
        result = await editImageWithNanoBanana(base64Image, newPrompt, {
          enableSyncMode: true,
          outputFormat: 'jpeg',
          wavespeedApiKey: brandConfig.wavespeedApiKey,
          isBase64: true  // Flag to indicate we're sending base64
        });
        console.log(`[Re-edit] Wavespeed API completed successfully`);
      } catch (wavespeedError) {
        console.error(`[Re-edit] Wavespeed API error:`, wavespeedError.message);
        reEditedResults.push({
          error: true,
          name: image.name,
          message: `Wavespeed API failed: ${wavespeedError.message}`
        });
        continue;
      }

      if (result.data && result.data.outputs && result.data.outputs.length > 0) {
        console.log(`[Re-edit] Received result from Wavespeed, downloading edited image...`);
        const reEditedImageUrl = result.data.outputs[0];
        
        const imageResponse = await fetch(reEditedImageUrl);
        const imageBuffer = await imageResponse.arrayBuffer();
        console.log(`[Re-edit] Downloaded edited image: ${Math.round(imageBuffer.byteLength / 1024)} KB`);
        
        const timestamp = Date.now();
        const reEditedFileName = `${image.name.replace('_edited.jpg', '')}_reedited_${timestamp}.jpg`;
        
        // Create clean display name from original name
        const baseDisplayName = (image.originalName || image.name)
          .replace(/\.(jpg|jpeg|png)$/i, '')
          .replace(/_/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase());
        const displayName = `${baseDisplayName} (Re-edited)`;
        
        console.log(`[Re-edit] Uploading to Drive as: ${reEditedFileName}`);
        const uploadedFile = await uploadFileToDrive(
          Buffer.from(imageBuffer),
          reEditedFileName,
          'image/jpeg',
          brandConfig.editedResultsFolderId
        );

        await makeFilePublic(uploadedFile.id);
        console.log(`[Re-edit] Upload complete! File ID: ${uploadedFile.id}`);

        reEditedResults.push({
          id: uploadedFile.id,
          name: displayName,
          fileName: reEditedFileName,
          editedImageId: uploadedFile.id,
          originalImageId: image.originalImageId,
          originalName: image.originalName,
          url: getPublicImageUrl(uploadedFile.id)
        });
      } else {
        console.error(`[Re-edit] No images returned from Wavespeed API`);
        reEditedResults.push({
          error: true,
          name: image.name,
          message: 'Wavespeed API returned no edited images'
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
