import { GoogleGenerativeAI } from '@google/generative-ai';

export class GeminiService {
  constructor(apiKey) {
    if (!apiKey) {
      console.warn('Gemini API key is missing. Gemini service will not function.');
      this.genAI = null;
    } else {
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
  }

  async generateContent(prompt, modelName = 'gemini-pro') {
    if (!this.genAI) {
      throw new Error('Gemini API key is not configured.');
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: modelName });
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
