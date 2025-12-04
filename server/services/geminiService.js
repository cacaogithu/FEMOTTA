import { GoogleGenerativeAI } from '@google/generative-ai';
import fetch from 'node-fetch'; // Assuming node-fetch is available for server-side fetching

export class GeminiService {
  constructor(apiKey) {
    if (!apiKey) {
      console.warn('Gemini API key is missing. Gemini service will not function.');
      this.genAI = null;
    } else {
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
    this.flashModel = 'gemini-pro-vision'; // Default model for vision
  }

  async generateContent(prompt, options = {}) {
    if (!this.genAI) {
      throw new Error('Gemini API key is not configured.');
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: options.model || 'gemini-pro' });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Gemini generateContent error:', error);
      throw error;
    }
  }

  async analyzeImage(prompt, imageParts, modelName = 'gemini-pro-vision') {
    if (!this.genAI) {
      throw new Error('Gemini API key is not configured.');
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent([prompt, ...imageParts]);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Gemini analyzeImage error:', error);
      throw error;
    }
  }

  /**
   * Generate content with image input for vision analysis
   * @param {string} prompt - Text prompt for analysis
   * @param {string} imageUrl - URL of the image to analyze
   * @param {Object} options - Generation options
   */
  async generateContentWithImage(prompt, imageUrl, options = {}) {
    if (!this.genAI) {
      throw new Error('Gemini API key is not configured.');
    }

    try {
      const model = this.genAI.getGenerativeModel({
        model: options.model || this.flashModel
      });

      // Fetch image and convert to base64
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image from ${imageUrl}: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const base64Image = Buffer.from(arrayBuffer).toString('base64');
      const mimeType = response.headers.get('content-type') || 'image/jpeg'; // Default to jpeg if not found

      const parts = [
        { text: prompt },
        {
          inlineData: {
            mimeType,
            data: base64Image
          }
        }
      ];

      const result = await model.generateContent({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature: options.temperature || 0.7,
          topK: options.topK || 40,
          topP: options.topP || 0.95,
          maxOutputTokens: options.maxOutputTokens || 2048
        }
      });

      const responseText = result.response.text();
      return responseText;
    } catch (error) {
      console.error('[Gemini Vision] Error:', error);
      throw error;
    }
  }

  // Helper to format image for Gemini
  static fileToGenerativePart(buffer, mimeType) {
    return {
      inlineData: {
        data: buffer.toString('base64'),
        mimeType
      },
    };
  }
}

export { GeminiImageService } from './geminiImageService.js';