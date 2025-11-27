import { editImageWithGemini } from '../services/geminiImage.js';
import { getJobWithFallback, updateJob, getJob } from '../utils/jobStore.js';
import { uploadFileToDrive, makeFilePublic, getPublicImageUrl, downloadFileFromDrive } from '../utils/googleDrive.js';
import { getBrandApiKeys } from '../utils/brandLoader.js';
import { getCompleteOverlayGuidelines } from '../services/sairaReference.js';
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

      // Convert buffer to base64 for Gemini API
      const base64Image = `data:image/jpeg;base64,${editedImageBuffer.toString('base64')}`;
      const imageSizeKB = Math.round(base64Image.length / 1024);
      console.log(`[Re-edit] Converted EDITED image to base64: ${imageSizeKB} KB`);
      
      // Send base64 image + new prompt to Gemini API
      // Inject Saira typography and image preservation guidelines for consistency
      const sairaGuidelines = getCompleteOverlayGuidelines();
      const enhancedPrompt = `${sairaGuidelines}\n\nUSER RE-EDIT REQUEST:\n${newPrompt}`;
      
      console.log(`[Re-edit] Calling Gemini API with enhanced prompt (includes Saira guidelines)`);
      console.log(`[Re-edit] This may take 60-120 seconds for complex edits...`);
      
      let result;
      try {
        result = await editImageWithGemini(base64Image, enhancedPrompt, {
          geminiApiKey: brandConfig.geminiApiKey,
          retries: 3
        });
        console.log(`[Re-edit] Gemini API completed successfully`);
      } catch (geminiError) {
        console.error(`[Re-edit] Gemini API error:`, geminiError.message);
        reEditedResults.push({
          error: true,
          name: image.name,
          message: `Gemini API failed: ${geminiError.message}`
        });
        continue;
      }

      if (result.data && result.data.outputs && result.data.outputs.length > 0) {
        console.log(`[Re-edit] Received result from Gemini, downloading edited image...`);
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
        console.error(`[Re-edit] No images returned from Gemini API`);
        reEditedResults.push({
          error: true,
          name: image.name,
          message: 'Gemini API returned no edited images'
        });
      }
    }

    // When editing specific images: keep others unchanged, replace only the edited ones
    // When editing all images: replace entire array with new results
    console.log('[Re-edit] BEFORE UPDATE:');
    console.log('[Re-edit] - imageIds requested:', imageIds);
    console.log('[Re-edit] - job.editedImages count:', job.editedImages.length);
    console.log('[Re-edit] - reEditedResults count:', reEditedResults.length);
    console.log('[Re-edit] - Re-edited originalImageIds:', reEditedResults.map(r => ({ name: r.name, originalImageId: r.originalImageId })));
    
    // Build set of originalImageIds being re-edited for efficient lookup
    const reEditedOriginalIds = new Set(reEditedResults.map(r => r.originalImageId).filter(Boolean));
    
    const updatedEditedImages = imageIds && imageIds.length > 0
      ? [
          ...job.editedImages.filter(img => {
            // Match by originalImageId (the stable reference to the source image)
            // Fall back to editedImageId/id for backwards compatibility
            const matchesOriginalId = img.originalImageId && reEditedOriginalIds.has(img.originalImageId);
            const matchesEditedId = imageIds.includes(img.editedImageId) || imageIds.includes(img.id);
            const shouldKeep = !matchesOriginalId && !matchesEditedId;
            
            if (!shouldKeep) {
              console.log(`[Re-edit] REPLACING old version: ${img.name} (originalImageId: ${img.originalImageId})`);
            }
            return shouldKeep;
          }),
          ...reEditedResults
        ]
      : reEditedResults;

    console.log('[Re-edit] AFTER MERGE:');
    console.log('[Re-edit] - updatedEditedImages count:', updatedEditedImages.length);
    console.log('[Re-edit] - Image 13 details:', updatedEditedImages.find(img => img.name && img.name.includes('13')));

    await updateJob(jobId, {
      editedImages: updatedEditedImages,
      results: {
        ...job.results,
        images: updatedEditedImages
      }
    });
    
    console.log('[Re-edit] Job updated successfully. Verifying...');
    const verifyJob = getJob(jobId);
    console.log('[Re-edit] Verified job.editedImages count:', verifyJob.editedImages.length);
    console.log('[Re-edit] Verified Image 13:', verifyJob.editedImages.find(img => img.name && img.name.includes('13')));

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
