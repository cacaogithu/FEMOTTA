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
    const editPromises = imageUrls.map(imageUrl => 
      editImageWithNanoBanana(imageUrl, prompt, options)
    );

    const results = await Promise.all(editPromises);
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
