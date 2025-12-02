import fetch from 'node-fetch';

/**
 * Nano Banana Pro Service
 * Uses Gemini 3 Pro Image Preview for image editing
 * This model properly preserves the original image while adding overlays
 */

export class NanoBananaProService {
  constructor(apiKey) {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY;
    this.model = 'gemini-3-pro-image-preview';
    this.baseUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;
  }

  async _fetchImageAsBase64(imageUrl) {
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }
      const buffer = await response.buffer();
      const base64 = buffer.toString('base64');
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      return { base64, mimeType: contentType.split(';')[0] };
    } catch (error) {
      console.error('[NanoBananaPro] Error fetching image:', error);
      throw error;
    }
  }

  async editImage(imageUrl, prompt, options = {}) {
    const { imageIndex = 0 } = options;

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`[NanoBananaPro] Processing Image #${imageIndex + 1}`);
    console.log(`[NanoBananaPro] Using model: ${this.model}`);
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
          responseModalities: ["IMAGE", "TEXT"],
          imageConfig: {
            aspectRatio: "",
            imageSize: ""
          }
        }
      };

      const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[NanoBananaPro] API error response:`, errorText);
        throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      if (result.candidates && result.candidates[0]?.content?.parts) {
        for (const part of result.candidates[0].content.parts) {
          if (part.inlineData?.data) {
            const mimeType = part.inlineData.mimeType || 'image/png';
            const base64Data = part.inlineData.data;
            const dataUrl = `data:${mimeType};base64,${base64Data}`;
            
            console.log(`✅ [NanoBananaPro] SUCCESS - Image #${imageIndex + 1} edited`);
            
            return [dataUrl];
          }
        }
      }

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
