import fetch from 'node-fetch';

const NANO_BANANA_EDIT_URL = 'https://api.wavespeed.ai/api/v3/google/nano-banana/edit';
const NANO_BANANA_RESULT_URL = 'https://api.wavespeed.ai/api/v3/predictions';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function editImageWithNanoBanana(imageUrlOrBase64, prompt, options = {}) {
  const {
    enableSyncMode = true,
    outputFormat = 'jpeg',
    enableBase64Output = false,
    numImages = 1,
    wavespeedApiKey = process.env.WAVESPEED_API_KEY,
    isBase64 = false,
    maxRetries = 2,
    retryDelay = 3000
  } = options;

  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`Retry attempt ${attempt}/${maxRetries} for Nano Banana API...`);
        await sleep(retryDelay * attempt);
      }

      const imageInput = isBase64 ? imageUrlOrBase64 : imageUrlOrBase64;

      const payload = {
        enable_base64_output: enableBase64Output,
        enable_sync_mode: enableSyncMode,
        images: [imageInput],
        output_format: outputFormat,
        prompt: prompt,
        num_images: numImages
      };

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);

      const response = await fetch(NANO_BANANA_EDIT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${wavespeedApiKey}`
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        
        if (response.status === 504 || response.status === 503 || response.status === 502) {
          throw new Error(`GATEWAY_TIMEOUT: The image editing service is temporarily unavailable. Please try again in a moment.`);
        }
        
        throw new Error(`Nano Banana API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

      if (enableSyncMode) {
        return result;
      } else {
        return { requestId: result.requestId };
      }
    } catch (error) {
      console.error(`Nano Banana edit error (attempt ${attempt + 1}/${maxRetries + 1}):`, error);
      lastError = error;
      
      if (error.message.includes('Insufficient credits')) {
        throw new Error('INSUFFICIENT_CREDITS: The Wavespeed API account needs to be topped up with credits.');
      }
      
      if (error.name === 'AbortError') {
        lastError = new Error('REQUEST_TIMEOUT: The image editing request took too long. Please try again with a simpler prompt or smaller image.');
      }
      
      if (attempt === maxRetries) {
        if (error.message.includes('504') || error.message.includes('503') || error.message.includes('502') || error.message.includes('GATEWAY_TIMEOUT')) {
          throw new Error('GATEWAY_TIMEOUT: The image editing service is temporarily unavailable after multiple attempts. Please try again in a few minutes.');
        }
        throw lastError;
      }
    }
  }
  
  throw lastError;
}

export async function editMultipleImages(imageUrls, prompt, options = {}) {
  try {
    const batchSize = options.batchSize || 10; // Process 10 images at a time
    const progressCallback = options.onProgress || (() => {});
    const wavespeedApiKey = options.wavespeedApiKey || process.env.WAVESPEED_API_KEY;
    const results = [];
    
    const totalImages = imageUrls.length;
    const totalBatches = Math.ceil(totalImages / batchSize);
    
    // Process in batches to avoid overwhelming the API
    for (let i = 0; i < imageUrls.length; i += batchSize) {
      const batch = imageUrls.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      
      console.log(`Processing batch ${batchNumber} of ${totalBatches} (${batch.length} images)`);
      
      progressCallback({
        type: 'batch_start',
        batchNumber,
        totalBatches,
        imagesInBatch: batch.length,
        totalProcessed: i,
        totalImages
      });
      
      const batchPromises = batch.map((imageUrl, idx) => 
        editImageWithNanoBanana(imageUrl, prompt, { ...options, wavespeedApiKey }).then(result => {
          const imageIndex = i + idx;
          progressCallback({
            type: 'image_complete',
            imageIndex,
            totalImages,
            imageName: `Image ${imageIndex + 1}`,
            progress: Math.round(((imageIndex + 1) / totalImages) * 100)
          });
          return result;
        })
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      progressCallback({
        type: 'batch_complete',
        batchNumber,
        totalBatches,
        totalProcessed: i + batch.length,
        totalImages
      });
      
      console.log(`Batch ${batchNumber} completed`);
    }

    return results;
  } catch (error) {
    console.error('Batch edit error:', error);
    throw error;
  }
}

export async function pollNanoBananaResult(requestId) {
  try {
    const response = await fetch(`${NANO_BANANA_RESULT_URL}/${requestId}/result`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.WAVESPEED_API_KEY}`
      }
    });

    if (!response.ok) {
      if (response.status === 404 || response.status === 202) {
        return { status: 'processing' };
      }
      throw new Error(`Failed to get result: ${response.status}`);
    }

    const result = await response.json();
    return { status: 'completed', data: result };
  } catch (error) {
    console.error('Poll result error:', error);
    throw error;
  }
}

export async function reEditImage(originalImageUrl, editedImageUrl, newPrompt, options = {}) {
  return editImageWithNanoBanana(editedImageUrl || originalImageUrl, newPrompt, options);
}
