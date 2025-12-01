
import fetch from 'node-fetch';
import { NanoBananaProService } from './nanoBananaService.js';

/**
 * Edit multiple images using Nano Banana Pro API
 * @param {Array<string>} imageUrls - Array of public image URLs
 * @param {string} prompt - The editing prompt
 * @param {Object} options - Configuration options
 */
export async function editMultipleImagesWithNanoBananaPro(imageUrls, prompt, options = {}) {
  const { retries = 3 } = options;
  
  const apiKey = process.env.WAVESPEED_API_KEY;
  if (!apiKey) {
    throw new Error('WAVESPEED_API_KEY not configured in environment variables');
  }

  const nanoBananaService = new NanoBananaProService(apiKey);
  const results = [];

  console.log(`[Nano Banana Pro] Processing ${imageUrls.length} images`);

  for (let i = 0; i < imageUrls.length; i++) {
    const imageUrl = imageUrls[i];
    console.log(`[Nano Banana Pro] Processing image ${i + 1}/${imageUrls.length}: ${imageUrl}`);

    let attempt = 0;
    let success = false;
    let result = null;

    while (attempt < retries && !success) {
      try {
        attempt++;
        console.log(`[Nano Banana Pro] Attempt ${attempt}/${retries} for image ${i + 1}`);

        // Call Nano Banana Pro API in sync mode
        const outputImages = await nanoBananaService.editImage(imageUrl, prompt, {
          enableBase64Output: false,
          enableSyncMode: true,
          outputFormat: 'jpeg',
          numberOfImages: 1
        });

        if (outputImages && outputImages.length > 0) {
          result = {
            images: outputImages.map(url => ({ url })),
            text: `Successfully edited image ${i + 1}`
          };
          success = true;
          console.log(`[Nano Banana Pro] ✓ Image ${i + 1} processed successfully`);
        } else {
          throw new Error('No output images returned');
        }
      } catch (error) {
        console.error(`[Nano Banana Pro] ✗ Attempt ${attempt} failed:`, error.message);
        
        if (attempt >= retries) {
          result = {
            images: [],
            text: `Failed to edit image ${i + 1} after ${retries} attempts`,
            error: error.message
          };
        } else {
          // Wait before retry (exponential backoff)
          const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          console.log(`[Nano Banana Pro] Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    results.push(result);
  }

  const successCount = results.filter(r => r.images && r.images.length > 0).length;
  console.log(`[Nano Banana Pro] Batch complete: ${successCount}/${imageUrls.length} successful`);

  return results;
}
