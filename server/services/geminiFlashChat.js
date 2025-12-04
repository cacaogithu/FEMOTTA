/**
 * Gemini Flash Chat Service
 * Uses Gemini Flash 1.5 for chat understanding and intent parsing
 * 
 * Architecture:
 * - Gemini Flash 1.5: Fast, efficient chat understanding with vision capabilities
 * - Nano Banana Pro: Image generation (handled by nanoBananaService)
 */

import { GoogleGenAI } from "@google/genai";
import fetch from 'node-fetch';

const CHAT_MODEL = 'gemini-1.5-flash';

export class GeminiFlashChatService {
  constructor(apiKey) {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY;
    this.ai = new GoogleGenAI({ apiKey: this.apiKey });
    console.log(`[GeminiFlashChat] Initialized with model: ${CHAT_MODEL}`);
  }

  async _fetchImageAsBase64(imageUrl) {
    try {
      console.log(`[GeminiFlashChat] Fetching image from: ${imageUrl.substring(0, 80)}...`);
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }
      const buffer = await response.buffer();
      const base64 = buffer.toString('base64');
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      console.log(`[GeminiFlashChat] Image fetched: ${buffer.length} bytes`);
      return { base64, mimeType: contentType.split(';')[0] };
    } catch (error) {
      console.error('[GeminiFlashChat] Error fetching image:', error.message);
      throw error;
    }
  }

  async chat(messages, systemPrompt, options = {}) {
    try {
      const { imageUrls = [], tools = null } = options;

      console.log(`[GeminiFlashChat] Processing chat with ${messages.length} messages`);

      const contents = [];

      if (systemPrompt) {
        contents.push({
          role: 'user',
          parts: [{ text: `SYSTEM: ${systemPrompt}` }]
        });
        contents.push({
          role: 'model',
          parts: [{ text: 'Understood. I will follow these instructions.' }]
        });
      }

      for (const msg of messages) {
        const parts = [];
        
        if (typeof msg.content === 'string') {
          parts.push({ text: msg.content });
        } else if (Array.isArray(msg.content)) {
          for (const part of msg.content) {
            if (part.type === 'text') {
              parts.push({ text: part.text });
            } else if (part.type === 'image_url' && part.image_url?.url) {
              try {
                const imageData = await this._fetchImageAsBase64(part.image_url.url);
                parts.push({
                  inlineData: {
                    mimeType: imageData.mimeType,
                    data: imageData.base64
                  }
                });
              } catch (imgError) {
                console.warn(`[GeminiFlashChat] Could not fetch image: ${imgError.message}`);
              }
            }
          }
        }

        if (parts.length > 0) {
          contents.push({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts
          });
        }
      }

      for (const imageUrl of imageUrls) {
        try {
          const imageData = await this._fetchImageAsBase64(imageUrl);
          if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
            contents[contents.length - 1].parts.push({
              inlineData: {
                mimeType: imageData.mimeType,
                data: imageData.base64
              }
            });
          }
        } catch (imgError) {
          console.warn(`[GeminiFlashChat] Could not fetch additional image: ${imgError.message}`);
        }
      }

      const generationConfig = {
        temperature: 0.7,
        topP: 0.95,
        maxOutputTokens: 2048
      };

      console.log(`[GeminiFlashChat] Sending request to ${CHAT_MODEL}...`);

      let response;
      
      if (tools && tools.length > 0) {
        const geminiTools = this._convertToGeminiTools(tools);
        response = await this.ai.models.generateContent({
          model: CHAT_MODEL,
          contents,
          generationConfig,
          tools: geminiTools
        });
      } else {
        response = await this.ai.models.generateContent({
          model: CHAT_MODEL,
          contents,
          generationConfig
        });
      }

      console.log(`[GeminiFlashChat] Response received`);

      if (response.candidates && response.candidates[0]?.content?.parts) {
        const result = {
          content: null,
          functionCall: null
        };

        for (const part of response.candidates[0].content.parts) {
          if (part.text) {
            result.content = part.text;
          }
          if (part.functionCall) {
            result.functionCall = {
              name: part.functionCall.name,
              arguments: part.functionCall.args
            };
            console.log(`[GeminiFlashChat] Function call detected: ${part.functionCall.name}`);
          }
        }

        return result;
      }

      return { content: 'I apologize, but I could not generate a response.', functionCall: null };

    } catch (error) {
      console.error(`[GeminiFlashChat] Error:`, error.message);
      throw error;
    }
  }

  _convertToGeminiTools(openaiTools) {
    const geminiTools = [];

    for (const tool of openaiTools) {
      if (tool.type === 'function') {
        geminiTools.push({
          functionDeclarations: [{
            name: tool.function.name,
            description: tool.function.description,
            parameters: tool.function.parameters
          }]
        });
      }
    }

    return geminiTools;
  }

  async parseEditIntent(userMessage, imageContext = null) {
    const prompt = `Analyze this user message and determine if they want to edit images.

USER MESSAGE: "${userMessage}"

${imageContext ? `CONTEXT: The user has ${imageContext.imageCount} edited images. Image details: ${JSON.stringify(imageContext.imageList)}` : ''}

Respond with a JSON object:
{
  "wantsEdit": true/false,
  "editType": "parameter_change" | "new_prompt" | "no_edit",
  "targetImages": "all" | [1, 3, 5] (array of image numbers),
  "parameterChanges": {
    "title": { "fontSize": number, "text": "string" },
    "subtitle": { "fontSize": number, "text": "string" },
    "gradient": { "opacity": number, "heightPercent": number },
    "margins": { "topPercent": number, "leftPercent": number }
  } | null,
  "newPrompt": "string" | null,
  "explanation": "brief explanation of intent"
}

Only include parameterChanges if the user is requesting specific parameter adjustments.
Return ONLY the JSON object, no additional text.`;

    try {
      const response = await this.ai.models.generateContent({
        model: CHAT_MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3 }
      });

      if (response.candidates && response.candidates[0]?.content?.parts?.[0]?.text) {
        const text = response.candidates[0].content.parts[0].text;
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }

      return { wantsEdit: false, editType: 'no_edit', explanation: 'Could not parse intent' };

    } catch (error) {
      console.error('[GeminiFlashChat] Intent parsing error:', error.message);
      return { wantsEdit: false, editType: 'no_edit', explanation: 'Error parsing intent' };
    }
  }
}

export async function createGeminiFlashChatService(apiKey) {
  return new GeminiFlashChatService(apiKey);
}

export default GeminiFlashChatService;
