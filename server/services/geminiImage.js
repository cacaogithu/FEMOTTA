import { GoogleGenAI } from '@google/genai';
import fetch from 'node-fetch';
import { NanoBananaProService } from '../services/nanoBananaService.js';

class GeminiImageService {
  constructor(apiKey) {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY;
    if (!this.apiKey) {
      console.warn('[GeminiImage] API key is missing. Service will not function correctly.');
    }
    this.client = new GoogleGenAI({ apiKey: this.apiKey });
    this.model = 'gemini-3-pro-image-preview';
    this.genAI = new GoogleGenAI({ apiKey: this.apiKey }); // Added for access to genAI instance
  }

  async _inputToPart(imageUrl) {
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
    return { inlineData: { mimeType: mimeType, data: imageData } };
  }

  async editImage(imageUrl, prompt, options = {}) {
    const { retries = 3, imageIndex = 0 } = options;

    // Log prompt details (truncated for readability)
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`[GeminiImage] Processing Image #${imageIndex + 1}`);
    console.log(`[GeminiImage] Image URL: ${imageUrl.substring(0, 80)}...`);
    console.log(`[GeminiImage] Prompt Preview (first 200 chars):`);
    console.log(`  ${prompt.substring(0, 200)}...`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    let lastError;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`[GeminiImage] Attempt ${attempt}/${retries} - Sending to Gemini API...`);

        const imagePart = await this._inputToPart(imageUrl);

        const config = {
          responseModalities: ['IMAGE', 'TEXT'],
          imageConfig: {
            imageSize: '2K',
          },
        };

        const contents = [
          {
            role: 'user',
            parts: [
              imagePart,
              {
                text: prompt,
              },
            ],
          },
        ];

        const response = await this.client.models.generateContent({
          model: this.model,
          config,
          contents,
        });

        if (response.candidates && 
            response.candidates[0]?.content?.parts) {
          for (const part of response.candidates[0].content.parts) {
            if (part.inlineData?.data) {
              const imageSize = Math.round(part.inlineData.data.length / 1024);
              console.log(`✅ [GeminiImage] SUCCESS - Image #${imageIndex + 1} edited (${imageSize}KB)`);
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
        console.error(`❌ [GeminiImage] Attempt ${attempt}/${retries} FAILED:`, error.message);
        lastError = error;

        if (attempt < retries) {
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`⏳ [GeminiImage] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    console.error(`❌ [GeminiImage] ALL RETRIES FAILED for Image #${imageIndex + 1}`);
    throw lastError;
  }

  async editMultipleImages(imageUrls, prompts, options = {}) {
    const results = [];

    for (let i = 0; i < imageUrls.length; i++) {
      const imageUrl = imageUrls[i];
      const prompt = Array.isArray(prompts) ? prompts[i] : prompts;

      try {
        const result = await this.editImage(imageUrl, prompt, {
          ...options,
          imageIndex: options.imageIndex !== undefined ? options.imageIndex : i
        });
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
        console.error(`❌ [GeminiImage] Failed to process image ${i + 1}:`, error.message);
        results.push({ error: error.message, imageIndex: i });
      }
    }

    return results;
  }
}

const defaultGeminiService = new GeminiImageService();
const defaultNanoBananaService = new NanoBananaProService();

export async function analyzeImageForParameters(imageUrl, apiKey) {
  try {
    const analysisPrompt = `Analyze this product image and determine optimal overlay parameters.

Respond with ONLY a JSON object in this exact format:
{
  "productPosition": "top-third" | "middle" | "bottom-third",
  "imageComplexity": "simple" | "moderate" | "complex",
  "recommendedGradientCoverage": 15-28,
  "recommendedTitleSize": 36-72,
  "recommendedMarginTop": 3-8,
  "recommendedMarginLeft": 3-6,
  "reasoning": "brief explanation"
}

Consider:
- Where is the main product located in the frame?
- How much visual space is available at the top for text?
- Is the background busy or simple?
- What gradient coverage will preserve product visibility while supporting text?`;

    // Use OpenAI GPT-4o for image analysis (more reliable API key)
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Fetch image and convert to base64
    let imageBase64;
    let mimeType = 'image/jpeg';
    
    if (imageUrl.startsWith('data:')) {
      const matches = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (matches) {
        mimeType = matches[1];
        imageBase64 = matches[2];
      }
    } else {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }
      const buffer = await response.buffer();
      imageBase64 = buffer.toString('base64');
      const contentType = response.headers.get('content-type');
      if (contentType) {
        mimeType = contentType.split(';')[0];
      }
    }

    const result = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: analysisPrompt },
          { 
            type: 'image_url', 
            image_url: { 
              url: `data:${mimeType};base64,${imageBase64}`,
              detail: 'low'
            } 
          }
        ]
      }],
      max_tokens: 500
    });

    const text = result.choices[0]?.message?.content || '';

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    // Fallback to default parameters
    return {
      productPosition: 'middle',
      recommendedGradientCoverage: 20,
      recommendedTitleSize: 52,
      recommendedMarginTop: 5,
      recommendedMarginLeft: 4,
      reasoning: 'Using default parameters (analysis failed)'
    };
  } catch (error) {
    console.error('Image analysis error:', error);
    // Return safe defaults on error
    return {
      productPosition: 'middle',
      recommendedGradientCoverage: 20,
      recommendedTitleSize: 52,
      recommendedMarginTop: 5,
      recommendedMarginLeft: 4,
      reasoning: 'Using default parameters (analysis error)'
    };
  }
}


export async function editImageWithGemini(imageUrl, prompt, apiKey, options = {}) {
  const service = apiKey 
    ? new GeminiImageService(apiKey) 
    : defaultGeminiService;

  let analysisResult = {};
  if (options.analyzeImage) {
    analysisResult = await analyzeImageForParameters(imageUrl, apiKey);
  }

  // Use the prompt as-is - analysis parameters are already incorporated 
  // via generateAdaptivePrompt in the calling code
  // DO NOT append raw parameters here as they will be rendered as text in the image
  const finalPrompt = prompt;

  try {
    const result = await service.editImage(imageUrl, finalPrompt, options);

    if (!result.data || !result.data.outputs || result.data.outputs.length === 0) {
      throw new Error('No images returned from Gemini');
    }

    const outputUrl = result.data.outputs[0];
    const matches = outputUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (matches) {
      return {
        base64: matches[2],
        mimeType: matches[1]
      };
    } else {
      throw new Error("Invalid output format from Gemini");
    }
  } catch (error) {
    console.error('Gemini edit error:', error);
    throw error;
  }
}

export async function editImageWithNanoBanana(imageUrl, prompt, options = {}) {
  const service = options.nanoBananaApiKey 
    ? new NanoBananaProService(options.nanoBananaApiKey) 
    : defaultNanoBananaService;

  let analysisResult = {};
  if (options.analyzeImage) {
    analysisResult = await analyzeImageForParameters(imageUrl, options.geminiApiKey); // Assuming analyzeImageForParameters still uses Gemini
  }

  const finalPrompt = prompt; // Assuming prompt already incorporates adaptive elements

  try {
    const result = await service.editImage(imageUrl, finalPrompt, options);

    if (!result || !result.data || !result.data.outputs || result.data.outputs.length === 0) {
      throw new Error('No images returned from Nano Banana Pro');
    }

    const outputUrl = result.data.outputs[0];
    const matches = outputUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (matches) {
      return {
        base64: matches[2],
        mimeType: matches[1]
      };
    } else {
      throw new Error("Invalid output format from Nano Banana Pro");
    }
  } catch (error) {
    console.error('Nano Banana Pro edit error:', error);
    throw error;
  }
}


export async function editMultipleImagesWithGemini(imageUrls, prompts, options = {}) {
  const service = options.geminiApiKey 
    ? new GeminiImageService(options.geminiApiKey) 
    : defaultGeminiService;
  return service.editMultipleImages(imageUrls, prompts, options);
}

export async function editMultipleImagesWithNanoBanana(imageUrls, prompts, options = {}) {
  const service = options.nanoBananaApiKey 
    ? new NanoBananaProService(options.nanoBananaApiKey) 
    : defaultNanoBananaService;
  
  // Assuming NanoBananaProService has a similar editMultipleImages method
  // or requires individual calls handled here.
  // For simplicity, let's assume a similar method signature for now.
  return service.editMultipleImages(imageUrls, prompts, options);
}


export { GeminiImageService };