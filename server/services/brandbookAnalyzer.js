import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');
import OpenAI from 'openai';
import axios from 'axios';

/**
 * Analyzes a brandbook PDF and extracts brand guidelines
 * @param {string} pdfUrl - URL to the brandbook PDF (from Google Drive)
 * @param {string} openaiApiKey - OpenAI API key for analysis
 * @returns {Promise<Object>} Brand guidelines including colors, prompts, and style guide
 */
export async function analyzeBrandbook(pdfUrl, openaiApiKey) {
  try {
    // Download the PDF
    const response = await axios.get(pdfUrl, {
      responseType: 'arraybuffer',
      timeout: 30000
    });

    const pdfBuffer = Buffer.from(response.data);
    
    // Parse PDF to extract text
    const pdfData = await pdf(pdfBuffer);
    const brandbookText = pdfData.text;

    if (!brandbookText || brandbookText.length < 100) {
      throw new Error('Could not extract meaningful text from brandbook PDF');
    }

    // Use OpenAI to analyze the brandbook
    const openai = new OpenAI({ apiKey: openaiApiKey });
    
    const analysisPrompt = `Analyze this brand guideline document and extract key information for AI image generation:

BRANDBOOK TEXT:
${brandbookText.slice(0, 8000)}

Extract the following information:
1. Primary Brand Color (hex code)
2. Secondary Brand Color (hex code)
3. Brand Visual Style (professional, playful, minimalist, bold, etc.)
4. Key Brand Values and Messaging
5. Default Image Prompt Template (for AI image generation that matches brand style)
6. Image Style Guidelines (what types of images fit the brand)

Consider the brand's:
- Color palette and how to use it
- Typography style (modern, classic, bold, etc.)
- Image style preferences (photography vs illustration, color vs black & white)
- Target audience
- Brand personality

Create a default prompt template that would generate images matching this brand's style.

Respond in JSON format:
{
  "primaryColor": "#RRGGBB",
  "secondaryColor": "#RRGGBB",
  "visualStyle": "description of visual style",
  "brandValues": ["value1", "value2"],
  "defaultPromptTemplate": "A prompt template with {PRODUCT_NAME} placeholder that matches brand style",
  "imageStyleGuidelines": "Guidelines for what images should look like",
  "estimatedManualTimePerImageMinutes": 5
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a brand design expert specializing in visual identity and AI image generation. Extract brand guidelines and return valid JSON only.'
        },
        {
          role: 'user',
          content: analysisPrompt
        }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    const brandGuidelines = JSON.parse(completion.choices[0].message.content);

    return {
      success: true,
      guidelines: brandGuidelines
    };

  } catch (error) {
    console.error('Brandbook analysis error:', error);
    return {
      success: false,
      error: error.message,
      guidelines: null
    };
  }
}
