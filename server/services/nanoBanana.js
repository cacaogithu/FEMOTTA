import fetch from 'node-fetch';

const NANO_BANANA_EDIT_URL = 'https://api.wavespeed.ai/api/v3/google/nano-banana/edit';
const NANO_BANANA_RESULT_URL = 'https://api.wavespeed.ai/api/v3/predictions';

export async function editImageWithNanoBanana(imageUrl, prompt, options = {}) {
  try {
    const {
      enableSyncMode = true,
      outputFormat = 'jpeg',
      enableBase64Output = false,
      numImages = 1,
      wavespeedApiKey = process.env.WAVESPEED_API_KEY
    } = options;

    const payload = {
      enable_base64_output: enableBase64Output,
      enable_sync_mode: enableSyncMode,
      images: [imageUrl],
      output_format: outputFormat,
      prompt: prompt,
      num_images: numImages
    };

    const response = await fetch(NANO_BANANA_EDIT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${wavespeedApiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Nano Banana API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    if (enableSyncMode) {
      return result;
    } else {
      return { requestId: result.requestId };
    }
  } catch (error) {
    console.error('Nano Banana edit error:', error);
    
    // Check for specific error messages
    if (error.message.includes('Insufficient credits')) {
      throw new Error('INSUFFICIENT_CREDITS: The Wavespeed API account needs to be topped up with credits.');
    }
    
    throw error;
  }
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
