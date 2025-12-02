import fetch from 'node-fetch';

/**
 * Nano Banana Pro Service
 * Uses Gemini Image models for image editing
 * Supports both gemini-2.5-flash-image and gemini-3-pro-image-preview
 */

const AVAILABLE_MODELS = {
  'nano-banana': 'gemini-2.5-flash-image',
  'nano-banana-pro': 'gemini-3-pro-image-preview',
  'imagen-3': 'imagen-3.0-generate-002'
};

const DEFAULT_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';

export class NanoBananaProService {
  constructor(apiKey, modelOverride = null) {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY;
    this.model = modelOverride || DEFAULT_MODEL;
    this.baseUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;
    
    console.log(`[NanoBananaPro] Initialized with model: ${this.model}`);
    console.log(`[NanoBananaPro] API Key present: ${this.apiKey ? 'Yes (length: ' + this.apiKey.length + ')' : 'No'}`);
  }

  async _fetchImageAsBase64(imageUrl) {
    try {
      console.log(`[NanoBananaPro] Fetching image from: ${imageUrl.substring(0, 80)}...`);
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }
      const buffer = await response.buffer();
      const base64 = buffer.toString('base64');
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      console.log(`[NanoBananaPro] Image fetched: ${buffer.length} bytes, type: ${contentType}`);
      return { base64, mimeType: contentType.split(';')[0] };
    } catch (error) {
      console.error('[NanoBananaPro] Error fetching image:', error.message);
      throw error;
    }
  }

  async editImage(imageUrl, prompt, options = {}) {
    const { imageIndex = 0 } = options;

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`[NanoBananaPro] Processing Image #${imageIndex + 1}`);
    console.log(`[NanoBananaPro] Using model: ${this.model}`);
    console.log(`[NanoBananaPro] API URL: ${this.baseUrl}`);
    console.log(`[NanoBananaPro] Image URL: ${imageUrl.substring(0, 80)}...`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    try {
      const imageData = await this._fetchImageAsBase64(imageUrl);

      const payload = {
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: imageData.mimeType,
                  data: imageData.base64
                }
              },
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          responseModalities: ["IMAGE", "TEXT"]
        }
      };

      console.log(`[NanoBananaPro] Sending request to Gemini API...`);
      console.log(`[NanoBananaPro] Prompt length: ${prompt.length} chars`);

      const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      console.log(`[NanoBananaPro] Response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[NanoBananaPro] API error response:`, errorText);
        
        // Parse error for better messaging
        try {
          const errorJson = JSON.parse(errorText);
          const errorMessage = errorJson.error?.message || errorText;
          throw new Error(`Gemini API error: ${response.status} - ${errorMessage}`);
        } catch (parseErr) {
          throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errorText.substring(0, 200)}`);
        }
      }

      const result = await response.json();
      
      // Log response structure for debugging
      console.log(`[NanoBananaPro] Response has candidates: ${!!result.candidates}`);
      if (result.candidates?.[0]?.content?.parts) {
        console.log(`[NanoBananaPro] Response parts count: ${result.candidates[0].content.parts.length}`);
        for (let i = 0; i < result.candidates[0].content.parts.length; i++) {
          const part = result.candidates[0].content.parts[i];
          if (part.inlineData) {
            console.log(`[NanoBananaPro] Part ${i}: inlineData (mimeType: ${part.inlineData.mimeType}, data length: ${part.inlineData.data?.length || 0})`);
          } else if (part.text) {
            console.log(`[NanoBananaPro] Part ${i}: text (length: ${part.text.length})`);
          }
        }
      }

      if (result.candidates && result.candidates[0]?.content?.parts) {
        for (const part of result.candidates[0].content.parts) {
          if (part.inlineData?.data) {
            const mimeType = part.inlineData.mimeType || 'image/png';
            const base64Data = part.inlineData.data;
            const dataUrl = `data:${mimeType};base64,${base64Data}`;
            
            console.log(`✅ [NanoBananaPro] SUCCESS - Image #${imageIndex + 1} edited`);
            console.log(`[NanoBananaPro] Output image size: ~${Math.round(base64Data.length * 0.75 / 1024)}KB`);
            
            return [dataUrl];
          }
        }
      }

      // Log what we got if no image
      console.error(`[NanoBananaPro] No image in response. Full response:`, JSON.stringify(result, null, 2).substring(0, 1000));
      throw new Error('No image data in response from Gemini');

    } catch (error) {
      console.error(`❌ [NanoBananaPro] Error:`, error.message);
      throw error;
    }
  }

  async editMultipleImages(imageUrls, prompts, options = {}) {
    const results = [];

    for (let i = 0; i < imageUrls.length; i++) {
      const imageUrl = imageUrls[i];
      const prompt = Array.isArray(prompts) ? prompts[i] : prompts;

      try {
        const outputImages = await this.editImage(imageUrl, prompt, {
          ...options,
          imageIndex: i
        });
        
        results.push({
          images: outputImages.map(url => ({ url })),
          text: `Successfully edited image ${i + 1}`
        });

        if (options.onProgress) {
          options.onProgress({
            type: 'image_complete',
            imageIndex: i,
            totalImages: imageUrls.length,
            progress: Math.round(((i + 1) / imageUrls.length) * 100)
          });
        }
      } catch (error) {
        console.error(`❌ [NanoBananaPro] Failed to process image ${i + 1}:`, error.message);
        results.push({ 
          images: [],
          error: error.message, 
          imageIndex: i 
        });
      }
    }

    return results;
  }
}

export { AVAILABLE_MODELS, DEFAULT_MODEL };
