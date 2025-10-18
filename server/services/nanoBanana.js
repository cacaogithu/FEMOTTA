import fetch from 'node-fetch';

const NANO_BANANA_EDIT_URL = 'https://api.wavespeed.ai/api/v3/google/nano-banana/edit';
const NANO_BANANA_RESULT_URL = 'https://api.wavespeed.ai/api/v3/predictions';

export async function editImageWithNanoBanana(imageUrl, prompt, options = {}) {
  try {
    const {
      enableSyncMode = true,
      outputFormat = 'jpeg',
      enableBase64Output = false,
      numImages = 1
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
        'Authorization': `Bearer ${process.env.WAVESPEED_API_KEY}`
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
    throw error;
  }
}

export async function editMultipleImages(imageUrls, prompt, options = {}) {
  try {
    const batchSize = options.batchSize || 5; // Process 5 images at a time
    const results = [];
    
    // Process in batches to avoid overwhelming the API
    for (let i = 0; i < imageUrls.length; i += batchSize) {
      const batch = imageUrls.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(imageUrls.length / batchSize)} (${batch.length} images)`);
      
      const batchPromises = batch.map(imageUrl => 
        editImageWithNanoBanana(imageUrl, prompt, options)
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      console.log(`Batch ${Math.floor(i / batchSize) + 1} completed`);
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
