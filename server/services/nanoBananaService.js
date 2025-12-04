import { GoogleGenAI } from "@google/genai";
import fetch from 'node-fetch';

/**
 * Nano Banana Pro Service
 * Uses Google GenAI SDK for image editing
 * Supports gemini-2.5-flash-image (nano banana) and other image models
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
    
    this.ai = new GoogleGenAI({ apiKey: this.apiKey });
    
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
    console.log(`[NanoBananaPro] Image URL: ${imageUrl.substring(0, 80)}...`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    try {
      const imageData = await this._fetchImageAsBase64(imageUrl);

      const contents = [
        { text: prompt },
        {
          inlineData: {
            mimeType: imageData.mimeType,
            data: imageData.base64,
          },
        },
      ];

      console.log(`[NanoBananaPro] Sending request to Gemini API...`);
      console.log(`[NanoBananaPro] Prompt length: ${prompt.length} chars`);

      const response = await this.ai.models.generateContent({
        model: this.model,
        contents: contents,
      });

      console.log(`[NanoBananaPro] Response received`);
      
      if (response.candidates && response.candidates[0]?.content?.parts) {
        console.log(`[NanoBananaPro] Response parts count: ${response.candidates[0].content.parts.length}`);
        
        for (const part of response.candidates[0].content.parts) {
          if (part.text) {
            console.log(`[NanoBananaPro] Text response: ${part.text.substring(0, 200)}...`);
          } else if (part.inlineData) {
            const base64Data = part.inlineData.data;
            const mimeType = part.inlineData.mimeType || 'image/png';
            const dataUrl = `data:${mimeType};base64,${base64Data}`;
            
            console.log(`✅ [NanoBananaPro] SUCCESS - Image #${imageIndex + 1} edited`);
            console.log(`[NanoBananaPro] Output image size: ~${Math.round(base64Data.length * 0.75 / 1024)}KB`);
            
            return [dataUrl];
          }
        }
      }

      console.error(`[NanoBananaPro] No image in response. Response structure:`, 
        JSON.stringify(response, null, 2).substring(0, 500));
      throw new Error('No image data in response from Gemini');

    } catch (error) {
      console.error(`❌ [NanoBananaPro] Error:`, error.message);
      if (error.stack) {
        console.error(`[NanoBananaPro] Stack:`, error.stack.split('\n').slice(0, 3).join('\n'));
      }
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
