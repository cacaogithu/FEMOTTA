import { GoogleGenerativeAI } from '@google/generative-ai';
import fetch from 'node-fetch';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.AI_INTEGRATIONS_GEMINI_API_KEY;

class AILogoPlacementService {
  constructor() {
    if (!GEMINI_API_KEY) {
      console.warn('[AILogoPlacement] Gemini API key is missing');
      this.genAI = null;
    } else {
      this.genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    }
    this.model = 'gemini-2.0-flash-exp';
    console.log('[AILogoPlacement] Service initialized');
  }

  async _fetchImageAsBase64(imageUrl) {
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }
      const buffer = await response.buffer();
      const base64 = buffer.toString('base64');
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      return { base64, mimeType: contentType.split(';')[0] };
    } catch (error) {
      console.error('[AILogoPlacement] Error fetching image:', error.message);
      throw error;
    }
  }

  async placeLogosOnImage(productImageBase64, logoDataArray, options = {}) {
    if (!this.genAI) {
      throw new Error('Gemini API key is not configured');
    }

    if (!logoDataArray || logoDataArray.length === 0) {
      console.log('[AILogoPlacement] No logos to place, returning original image');
      return productImageBase64;
    }

    const {
      imageIndex = 0,
      position = 'bottom-left',
      maxLogoWidthPercent = 15,
      margin = 3
    } = options;

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`[AILogoPlacement] Processing Image #${imageIndex + 1}`);
    console.log(`[AILogoPlacement] Logos to place: ${logoDataArray.length}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    try {
      const productMimeType = productImageBase64.includes('data:') 
        ? productImageBase64.match(/data:([^;]+)/)?.[1] || 'image/jpeg'
        : 'image/jpeg';
      
      const cleanProductBase64 = productImageBase64.replace(/^data:image\/\w+;base64,/, '');

      const prompt = this._buildPlacementPrompt(logoDataArray, position, maxLogoWidthPercent, margin);

      // Build parts array with proper structure
      const parts = [
        { text: prompt },
        {
          inlineData: {
            mimeType: productMimeType,
            data: cleanProductBase64
          }
        }
      ];

      // Validate and add logo data
      for (let i = 0; i < logoDataArray.length; i++) {
        const logo = logoDataArray[i];
        
        // Extract base64 data - handle various input formats from the codebase:
        // 1. Local storage logos: { base64: 'raw base64 string' }
        // 2. Drive logos: { base64: 'data:image/png;base64,...' }
        // 3. DOCX embedded: { base64: 'data:image/png;base64,...' }
        // 4. Plain string (legacy): 'data:image/png;base64,...'
        let logoBase64;
        let logoMimeType = 'image/png';
        
        if (typeof logo === 'string') {
          // Plain string - could be data URL or raw base64
          if (logo.startsWith('data:')) {
            const mimeMatch = logo.match(/^data:([^;]+);base64,/);
            if (mimeMatch) logoMimeType = mimeMatch[1];
            logoBase64 = logo.replace(/^data:[^;]+;base64,/, '');
          } else {
            logoBase64 = logo;
          }
        } else if (logo && typeof logo === 'object') {
          // Object format - check multiple possible field names used across the codebase:
          // - logo.base64: Used by local storage, drive downloads, DOCX embedded
          // - logo.base64Data: Used by saveLogoFromBase64, structured brief uploads
          // - logo.base64String: Used by confirmation flow
          // - logo.dataUrl: Alternative field name
          const rawBase64 = logo.base64 || logo.base64Data || logo.base64String || logo.dataUrl;
          
          if (!rawBase64) {
            console.warn(`[AILogoPlacement] Logo ${i + 1} missing base64 data field, skipping. Keys: ${Object.keys(logo).join(', ')}`);
            continue;
          }
          
          // Extract MIME type from all possible field names used in the codebase:
          // - contentType: Used by logoBase64Array in DOCX extraction
          // - mimeType: Alternative field name
          // - mime: Used by structured brief uploads and confirmation flow
          if (logo.contentType) {
            logoMimeType = logo.contentType;
          } else if (logo.mimeType) {
            logoMimeType = logo.mimeType;
          } else if (logo.mime) {
            logoMimeType = logo.mime;
          }
          
          // Handle data URL or raw base64
          if (rawBase64.startsWith('data:')) {
            // Data URL format - extract MIME from the URL (most accurate)
            const mimeMatch = rawBase64.match(/^data:([^;]+);base64,/);
            if (mimeMatch) logoMimeType = mimeMatch[1];
            logoBase64 = rawBase64.replace(/^data:[^;]+;base64,/, '');
          } else {
            // Raw base64 - use the MIME type we extracted from fields
            logoBase64 = rawBase64;
          }
        } else {
          console.warn(`[AILogoPlacement] Logo ${i + 1} has unsupported format, skipping`);
          continue;
        }
        
        // Validate base64 string (minimum reasonable size for an image)
        if (!logoBase64 || typeof logoBase64 !== 'string' || logoBase64.length < 50) {
          console.warn(`[AILogoPlacement] Logo ${i + 1} has invalid/empty base64 data (length: ${logoBase64?.length || 0}), skipping`);
          continue;
        }
        
        const logoName = (typeof logo === 'object' ? logo.name : null) || `Logo ${i + 1}`;
        
        console.log(`[AILogoPlacement] Adding logo ${i + 1}: ${logoName} (${Math.round(logoBase64.length / 1024)}KB, ${logoMimeType})`);
        
        parts.push({
          inlineData: {
            mimeType: logoMimeType,
            data: logoBase64
          }
        });
      }

      // Check if we have any valid logos to place
      if (parts.length <= 2) {
        console.warn('[AILogoPlacement] No valid logos after validation, returning original image');
        throw new Error('No valid logo data provided');
      }

      console.log(`[AILogoPlacement] Sending ${parts.length} parts to Gemini (1 prompt + 1 product image + ${parts.length - 2} logos)`);

      // Use correct SDK structure with role/parts
      const model = this.genAI.getGenerativeModel({ 
        model: this.model,
        generationConfig: {
          responseModalities: ['IMAGE', 'TEXT']
        }
      });

      const result = await model.generateContent({
        contents: [{ role: 'user', parts }]
      });

      const response = await result.response;
      
      if (response.candidates && response.candidates[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.text) {
            console.log(`[AILogoPlacement] AI feedback: ${part.text.substring(0, 200)}...`);
          } else if (part.inlineData) {
            const outputBase64 = part.inlineData.data;
            const outputMimeType = part.inlineData.mimeType || 'image/png';
            
            console.log(`✅ [AILogoPlacement] SUCCESS - Logos placed on Image #${imageIndex + 1}`);
            console.log(`[AILogoPlacement] Output size: ~${Math.round(outputBase64.length * 0.75 / 1024)}KB`);
            
            return `data:${outputMimeType};base64,${outputBase64}`;
          }
        }
      }

      // No image in response - this is a failure, not silent fallback
      console.error('[AILogoPlacement] Gemini returned no image data - AI placement failed');
      throw new Error('Gemini returned no image in response');

    } catch (error) {
      console.error(`❌ [AILogoPlacement] Error:`, error.message);
      throw error; // Re-throw to trigger fallback in caller
    }
  }

  _buildPlacementPrompt(logoDataArray, position, maxWidthPercent, margin) {
    const logoCount = logoDataArray.length;
    const logoNames = logoDataArray.map(l => l.name || 'partner logo').join(', ');
    
    const positionGuide = {
      'bottom-left': 'bottom-left corner',
      'bottom-right': 'bottom-right corner',
      'top-left': 'top-left corner',
      'top-right': 'top-right corner',
      'bottom-center': 'bottom center'
    };

    const primaryPosition = positionGuide[position] || 'bottom-left corner';

    let multiLogoInstructions = '';
    if (logoCount > 1) {
      multiLogoInstructions = `
- Arrange the ${logoCount} logos horizontally with equal spacing between them
- Keep all logos at the same height/size for visual consistency
- Maintain adequate spacing between logos (at least the width of one logo)`;
    }

    return `You are a professional image compositor. Your task is to place partner logo(s) onto a product marketing image.

TASK: Place the following logo(s) onto the product image: ${logoNames}

IMAGE ORDER:
- Image 1 (first image): The product/marketing image that needs logos added
- Image 2-${logoCount + 1}: The logo(s) to be placed (${logoNames})

PLACEMENT REQUIREMENTS:
- Place the logo(s) in the ${primaryPosition} of the product image
- Each logo should be approximately ${maxWidthPercent}% of the image width (no larger)
- Maintain a ${margin}% margin from the edges
- Preserve the logo's original aspect ratio (do not stretch or distort)
- The logo(s) should be clearly visible but not overwhelm the product
${multiLogoInstructions}

CRITICAL RULES:
1. DO NOT modify the product image in any way - only ADD the logo(s) on top
2. DO NOT change the product, background, colors, text, or any existing elements
3. The logos should blend naturally with proper transparency handling
4. If a logo has a transparent background, preserve that transparency
5. Size logos proportionally - they should be noticeable but professional

OUTPUT: Return ONLY the final composited image with the logo(s) properly placed.`;
  }

  async placeLogosFromUrls(productImageUrl, logoUrls, options = {}) {
    const productData = await this._fetchImageAsBase64(productImageUrl);
    const productBase64 = `data:${productData.mimeType};base64,${productData.base64}`;

    const logoDataArray = [];
    for (const logoUrl of logoUrls) {
      try {
        const logoData = await this._fetchImageAsBase64(logoUrl.url || logoUrl);
        logoDataArray.push({
          base64: logoData.base64,
          mimeType: logoData.mimeType,
          name: logoUrl.name || 'Partner Logo'
        });
      } catch (err) {
        console.warn(`[AILogoPlacement] Failed to fetch logo: ${err.message}`);
      }
    }

    return this.placeLogosOnImage(productBase64, logoDataArray, options);
  }
}

const aiLogoPlacementService = new AILogoPlacementService();

export async function placeLogosWithAI(editedImageDataUrl, logoBase64Array, options = {}) {
  return aiLogoPlacementService.placeLogosOnImage(editedImageDataUrl, logoBase64Array, options);
}

export default aiLogoPlacementService;
