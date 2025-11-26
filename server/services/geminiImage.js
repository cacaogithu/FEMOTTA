import { GoogleGenAI } from '@google/genai';
import fetch from 'node-fetch';

class GeminiImageService {
  constructor(apiKey) {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY;
    if (!this.apiKey) {
      console.warn('[GeminiImage] API key is missing. Service will not function correctly.');
    }
    this.client = new GoogleGenAI({ apiKey: this.apiKey });
    this.model = 'gemini-2.0-flash-exp-image-generation';
  }

  async editImage(imageUrl, prompt, options = {}) {
    const { retries = 3 } = options;
    
    let lastError;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`[GeminiImage] Edit attempt ${attempt}/${retries}`);
        
        let imageData;
        let mimeType = 'image/jpeg';
        
        if (imageUrl.startsWith('data:')) {
          const matches = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
          if (matches) {
            mimeType = matches[1];
            imageData = matches[2];
          }
        } else {
          const response = await fetch(imageUrl);
          if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.status}`);
          }
          const buffer = await response.buffer();
          imageData = buffer.toString('base64');
          
          const contentType = response.headers.get('content-type');
          if (contentType) {
            mimeType = contentType.split(';')[0];
          }
        }

        const config = {
          responseModalities: ['IMAGE', 'TEXT'],
          imageConfig: {
            imageSize: '1K',
          },
        };

        const contents = [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: mimeType,
                  data: imageData,
                },
              },
              {
                text: prompt,
              },
            ],
          },
        ];

        console.log('[GeminiImage] Sending request to Gemini...');
        
        const response = await this.client.models.generateContent({
          model: this.model,
          config,
          contents,
        });

        if (response.candidates && 
            response.candidates[0]?.content?.parts) {
          for (const part of response.candidates[0].content.parts) {
            if (part.inlineData?.data) {
              console.log('[GeminiImage] Received edited image');
              return {
                code: 200,
                message: 'success',
                data: {
                  outputs: [`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`],
                  status: 'completed',
                  model: this.model,
                }
              };
            }
          }
        }

        throw new Error('No image data in response');
        
      } catch (error) {
        console.error(`[GeminiImage] Attempt ${attempt} failed:`, error.message);
        lastError = error;
        
        if (attempt < retries) {
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`[GeminiImage] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }

  async editMultipleImages(imageUrls, prompts, options = {}) {
    const results = [];
    
    for (let i = 0; i < imageUrls.length; i++) {
      const imageUrl = imageUrls[i];
      const prompt = Array.isArray(prompts) ? prompts[i] : prompts;
      
      try {
        console.log(`[GeminiImage] Processing image ${i + 1}/${imageUrls.length}`);
        const result = await this.editImage(imageUrl, prompt, options);
        results.push(result);
        
        if (options.onProgress) {
          options.onProgress({
            type: 'image_complete',
            imageIndex: i,
            totalImages: imageUrls.length,
            progress: Math.round(((i + 1) / imageUrls.length) * 100)
          });
        }
      } catch (error) {
        console.error(`[GeminiImage] Failed to process image ${i + 1}:`, error.message);
        results.push({ error: error.message, imageIndex: i });
      }
    }
    
    return results;
  }
}

const defaultService = new GeminiImageService();

export async function editImageWithGemini(imageUrl, prompt, options = {}) {
  const service = options.geminiApiKey 
    ? new GeminiImageService(options.geminiApiKey) 
    : defaultService;
  return service.editImage(imageUrl, prompt, options);
}

export async function editMultipleImagesWithGemini(imageUrls, prompts, options = {}) {
  const service = options.geminiApiKey 
    ? new GeminiImageService(options.geminiApiKey) 
    : defaultService;
  return service.editMultipleImages(imageUrls, prompts, options);
}

export { GeminiImageService };
