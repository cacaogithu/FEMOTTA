import { uploadFileToDrive, makeFilePublic, getPublicImageUrl, downloadFileFromDrive } from '../utils/googleDrive.js';
import { createJob, getJob, updateJob, addWorkflowStep } from '../utils/jobStore.js';
import { archiveBatchToStorage } from '../services/historyService.js';
import { editMultipleImagesWithGemini, analyzeImageForParameters } from '../services/geminiImage.js';
import { NanoBananaProService } from '../services/nanoBananaService.js';
import { overlayTextOnImage } from '../services/canvasTextOverlay.js';
import { shouldUseImprovedPrompt } from '../services/mlLearning.js';
import { getBrandApiKeys } from '../utils/brandLoader.js';
import { getCompleteOverlayGuidelines } from '../services/sairaReference.js';
import { generateAdaptivePrompt } from '../services/promptTemplates.js';
import { findLogoByName, detectLogosInText, getLogoData } from '../services/partnerLogos.js';
import { saveLogoFromBase64 } from '../services/logoStorage.js';
import { analyzeLogoPlacement, mergeLogoPlansIntoSpecs } from '../services/logoPlacementAnalyzer.js';
import { analyzeImagesWithVision, mergeVisionPlansIntoSpecs } from '../services/visionLogoAnalyzer.js';
import { validateStructuredBrief, validatePDFWithImages, sanitizeInput, generateDefaultPrompt } from '../utils/briefValidation.js';
import { Readable } from 'stream';
import fetch from 'node-fetch';
import OpenAI from 'openai';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import mammoth from 'mammoth';
import sharp from 'sharp';

/**
 * Expands multi-logo strings into individual logo names
 * "Hydro X & iCUE Link" -> ["Hydro X", "iCUE Link"]
 * "NVIDIA and AMD" -> ["NVIDIA", "AMD"]
 * Note: Only splits on "&" and " and " - not commas (to preserve names like "GE, Inc.")
 */
function expandLogoNames(logoNames) {
  if (!logoNames || !Array.isArray(logoNames)) return [];
  
  const expanded = [];
  // Only split on & or " and " (case insensitive) - NOT commas to avoid splitting corporate names
  const delimiters = /\s*&\s*|\s+and\s+/i;
  
  for (const name of logoNames) {
    if (!name || typeof name !== 'string') continue;
    
    // Check if this contains multiple logos
    const parts = name.split(delimiters).map(p => p.trim()).filter(p => p.length > 0);
    
    if (parts.length > 1) {
      console.log(`[Logo Expand] Split "${name}" into ${parts.length} logos: ${parts.join(', ')}`);
      expanded.push(...parts);
    } else {
      expanded.push(name.trim());
    }
  }
  
  return expanded;
}

async function editImageUnified(imageUrl, prompt, options = {}) {
  const sairaGuidelines = getCompleteOverlayGuidelines();
  const enhancedPrompt = `${sairaGuidelines}\n\nSPECIFIC IMAGE INSTRUCTIONS:\n${prompt}`;

  try {
    const nanoBanana = new NanoBananaProService(options.geminiApiKey);
    console.log('[NanoBananaPro] Using service with dimension preservation');
    
    const result = await nanoBanana.editImage(imageUrl, enhancedPrompt, {
      imageIndex: options.imageIndex || 0
    });

    return result[0];
  } catch (error) {
    console.error('[NanoBananaPro] ❌ Edit failed:', error.message);
    throw error;
  }
}

// Helper function to calculate adaptive logo size based on aspect ratio
function calculateAdaptiveLogoSize(imageWidth, logoWidth, logoHeight) {
  const aspectRatio = logoWidth / logoHeight;
  
  // Base size: 10% of image width for normal logos (was 15%)
  let basePercentage = 0.10;
  
  // Adaptive sizing for wide banners:
  // - Normal logos (aspect 1:1 to 2:1): 10% width
  // - Wide logos (aspect 2:1 to 3:1): 8% width  
  // - Very wide banners (aspect > 3:1): 6% width (these are marketing banners)
  if (aspectRatio > 3) {
    basePercentage = 0.06;
    console.log(`[Logo Sizing] Detected wide banner (aspect ${aspectRatio.toFixed(1)}:1) - using 6% width`);
  } else if (aspectRatio > 2) {
    basePercentage = 0.08;
    console.log(`[Logo Sizing] Detected wide logo (aspect ${aspectRatio.toFixed(1)}:1) - using 8% width`);
  }
  
  return Math.floor(imageWidth * basePercentage);
}

// Helper function to overlay a logo on an edited image
async function overlayLogoOnImage(imageBuffer, logoBase64, position = 'bottom-left') {
  try {
    // Extract base64 data from data URL
    const base64Data = logoBase64.replace(/^data:image\/\w+;base64,/, '');
    const logoBuffer = Buffer.from(base64Data, 'base64');

    // Get image metadata
    const imageMetadata = await sharp(imageBuffer).metadata();
    const { width, height } = imageMetadata;
    
    // Get original logo dimensions for adaptive sizing
    const originalLogoMeta = await sharp(logoBuffer).metadata();
    
    // Calculate adaptive max width based on logo aspect ratio
    const maxLogoWidth = calculateAdaptiveLogoSize(width, originalLogoMeta.width, originalLogoMeta.height);
    const resizedLogo = await sharp(logoBuffer)
      .resize(maxLogoWidth, null, { fit: 'inside', withoutEnlargement: true })
      .toBuffer();

    const logoMetadata = await sharp(resizedLogo).metadata();

    // Calculate position based on option
    let left, top;
    const margin = Math.floor(width * 0.03); // 3% margin

    switch (position) {
      case 'top-left':
        left = margin;
        top = margin;
        break;
      case 'top-right':
        left = width - logoMetadata.width - margin;
        top = margin;
        break;
      case 'bottom-right':
        left = width - logoMetadata.width - margin;
        top = height - logoMetadata.height - margin;
        break;
      case 'bottom-left':
      default:
        left = margin;
        top = height - logoMetadata.height - margin;
        break;
    }

    // Composite the logo onto the image
    const resultBuffer = await sharp(imageBuffer)
      .composite([{
        input: resizedLogo,
        left: Math.round(left),
        top: Math.round(top)
      }])
      .jpeg({ quality: 95 })
      .toBuffer();

    console.log(`[Logo Overlay] Successfully overlaid logo at ${position} (${logoMetadata.width}x${logoMetadata.height})`);
    return resultBuffer;
  } catch (error) {
    console.error('[Logo Overlay] Failed to overlay logo:', error.message);
    // Return original image if overlay fails
    return imageBuffer;
  }
}

// Helper function to overlay multiple logos on an image
// Supports AI-provided placement via logo_plan parameter
async function overlayMultipleLogos(imageBuffer, logoBase64Array, logoPlan = null) {
  try {
    if (!logoBase64Array || logoBase64Array.length === 0) {
      return imageBuffer;
    }

    console.log(`[Logo Overlay] Applying ${logoBase64Array.length} logo(s) to image`);
    if (logoPlan && logoPlan.analyzedByAI) {
      console.log(`[Logo Overlay] Using AI-analyzed placement with ${logoPlan.logos?.length || 0} configured logos`);
    }

    // Get image metadata
    const imageMetadata = await sharp(imageBuffer).metadata();
    const { width, height } = imageMetadata;
    const margin = Math.floor(width * 0.03); // 3% margin

    // Extended positions for more than 4 logos - cycles through corners with offsets
    const getPositionForIndex = (index) => {
      const basePositions = ['bottom-left', 'bottom-right', 'top-left', 'top-right'];
      return basePositions[index % basePositions.length];
    };

    // Prepare all logos for composite (no arbitrary limit)
    const compositeInputs = [];
    const maxLogos = Math.min(logoBase64Array.length, 8); // Reasonable max for image clarity

    for (let i = 0; i < maxLogos; i++) {
      const logoData = logoBase64Array[i];
      
      // Get AI-provided placement if available, otherwise use dynamic positioning
      let position = getPositionForIndex(i);
      let sizePercent = null; // null means use adaptive sizing
      
      if (logoPlan && logoPlan.logos && logoPlan.logos.length > 0) {
        // Try to match this logo to an AI-analyzed logo by name
        const aiLogo = logoPlan.logos.find(l => 
          l.displayName?.toLowerCase() === logoData.name?.toLowerCase() ||
          l.canonicalKey === logoData.canonicalKey
        );
        
        if (aiLogo) {
          position = aiLogo.position || position;
          sizePercent = aiLogo.sizePercent || null;
          console.log(`  [AI] Found placement for "${logoData.name}": ${position}, ${sizePercent || 'adaptive'}%`);
        }
      }

      try {
        // Extract base64 data from data URL
        const base64Data = logoData.base64.replace(/^data:image\/\w+;base64,/, '');
        const logoBuffer = Buffer.from(base64Data, 'base64');

        // Get original logo dimensions for sizing
        const originalLogoMeta = await sharp(logoBuffer).metadata();
        
        // Calculate max width - use AI-provided size or adaptive sizing
        let maxLogoWidth;
        if (sizePercent) {
          // AI-provided size as percentage of image width
          maxLogoWidth = Math.floor(width * (sizePercent / 100));
          console.log(`  [AI] Using AI-specified size: ${sizePercent}% = ${maxLogoWidth}px`);
        } else {
          // Fall back to adaptive sizing based on logo aspect ratio
          maxLogoWidth = calculateAdaptiveLogoSize(width, originalLogoMeta.width, originalLogoMeta.height);
        }
        
        const resizedLogo = await sharp(logoBuffer)
          .resize(maxLogoWidth, null, { fit: 'inside', withoutEnlargement: true })
          .toBuffer();

        const logoMetadata = await sharp(resizedLogo).metadata();

        // Calculate position coordinates
        let left, top;

        switch (position) {
          case 'top-left':
            left = margin;
            top = margin;
            break;
          case 'top-right':
            left = width - logoMetadata.width - margin;
            top = margin;
            break;
          case 'bottom-right':
            left = width - logoMetadata.width - margin;
            top = height - logoMetadata.height - margin;
            break;
          case 'bottom-left':
          default:
            left = margin;
            top = height - logoMetadata.height - margin;
            break;
        }

        compositeInputs.push({
          input: resizedLogo,
          left: Math.round(left),
          top: Math.round(top)
        });

        console.log(`  ✓ Logo ${i + 1} "${logoData.name}" positioned at ${position} (${logoMetadata.width}x${logoMetadata.height})`);

      } catch (logoError) {
        console.error(`  ✗ Failed to process logo ${i + 1} "${logoData.name}":`, logoError.message);
      }
    }

    if (compositeInputs.length === 0) {
      console.warn('[Logo Overlay] No logos could be processed');
      return imageBuffer;
    }

    // Apply all logos in a single composite operation
    const resultBuffer = await sharp(imageBuffer)
      .composite(compositeInputs)
      .jpeg({ quality: 95 })
      .toBuffer();

    console.log(`[Logo Overlay] Successfully applied ${compositeInputs.length} logo(s)`);
    return resultBuffer;

  } catch (error) {
    console.error('[Logo Overlay] Failed to overlay multiple logos:', error.message);
    // Return original image if overlay fails
    return imageBuffer;
  }
}

// Helper to get brand-specific OpenAI client
function getBrandOpenAI(brand) {
  return new OpenAI({
    apiKey: brand.openaiApiKey || process.env.OPENAI_API_KEY
  });
}

// Helper function to call OpenAI with retry logic
async function callOpenAIWithRetry(openai, params, maxRetries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[DOCX Extraction] OpenAI call attempt ${attempt}/${maxRetries}...`);
      return await openai.chat.completions.create(params);
    } catch (error) {
      lastError = error;
      console.warn(`[DOCX Extraction] Attempt ${attempt} failed: ${error.message}`);

      if (attempt < maxRetries) {
        const backoffMs = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        console.log(`[DOCX Extraction] Retrying in ${backoffMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }
  }

  throw new Error(`OpenAI API failed after ${maxRetries} attempts: ${lastError.message}`);
}

// Helper function to validate image spec structure
function validateImageSpec(spec, index) {
  const errors = [];

  if (typeof spec.image_number !== 'number') {
    errors.push(`image_number must be a number`);
  }

  if (spec.variant !== null && typeof spec.variant !== 'string') {
    errors.push(`variant must be string or null`);
  }

  if (typeof spec.title !== 'string') {
    errors.push(`title must be a string`);
  }

  if (typeof spec.subtitle !== 'string') {
    errors.push(`subtitle must be a string`);
  }

  if (typeof spec.asset !== 'string') {
    errors.push(`asset must be a string`);
  }

  if (typeof spec.logo_requested !== 'boolean') {
    errors.push(`logo_requested must be a boolean`);
  }

  if (!Array.isArray(spec.logo_names)) {
    errors.push(`logo_names must be an array`);
  }

  if (typeof spec.ai_prompt !== 'string') {
    errors.push(`ai_prompt must be a string`);
  }

  if (errors.length > 0) {
    return `Spec #${index + 1} ("${spec.title || 'unknown'}"): ${errors.join(', ')}`;
  }

  return null;
}

async function extractPromptFromDOCX(docxBuffer, brand) {
  const openai = getBrandOpenAI(brand);
  try {
    console.log('[DOCX Extraction] Starting DOCX text extraction...');
    console.log('[DOCX Extraction] Buffer size:', docxBuffer.length, 'bytes');

    // Extract text from DOCX
    const textResult = await mammoth.extractRawText({ buffer: docxBuffer });
    const docxText = textResult.value;

    console.log('[DOCX Extraction] Extracted text length:', docxText.length);
    console.log('[DOCX Extraction] First 500 chars:', docxText.substring(0, 500));

    // Extract ALL images from DOCX - keep them in order as they appear in the document
    const extractedImages = [];

    console.log('[DOCX Extraction] Converting DOCX to HTML to extract images...');

    // Convert DOCX to HTML with custom image handler to capture embedded images
    const result = await mammoth.convertToHtml({
      buffer: docxBuffer
    }, {
      convertImage: mammoth.images.imgElement(function (image) {
        // image.read() returns a Promise that resolves to the image buffer
        return image.read("base64").then(function (imageBuffer) {
          // Convert base64 string to Buffer
          const buffer = Buffer.from(imageBuffer, 'base64');

          console.log('[DOCX Extraction] Found embedded image:', buffer.length, 'bytes, type:', image.contentType);

          // Store ALL images in order (product images AND logos)
          extractedImages.push({
            buffer: buffer,
            contentType: image.contentType,
            size: buffer.length,
            index: extractedImages.length // Track position in document
          });

          // Return the image as a data URI for the HTML output
          return {
            src: "data:" + image.contentType + ";base64," + imageBuffer
          };
        });
      })
    });

    console.log('[DOCX Extraction] HTML conversion complete');
    console.log('[DOCX Extraction] Found', extractedImages.length, 'embedded images (product images + logos)');

    if (!docxText || docxText.trim().length < 10) {
      throw new Error('Could not extract text from DOCX - file may be empty or corrupted');
    }

    console.log('[DOCX Extraction] Sending to OpenAI to extract image specifications...');

    const completion = await callOpenAIWithRetry(openai, {
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an AI creative assistant specialized in extracting marketing image specifications from document briefs.

Your task is to carefully READ the document layout and extract ALL image specifications into structured JSON format.

CRITICAL: TABLE-BASED BRIEF PARSING
Many marketing briefs use TABLE STRUCTURES with columns like:
- ASSET (image filename)
- HEADLINE/TITLE (main text)
- COPY (subtitle/description text)
- NOTES (may contain logo requirements like "Include Intel Core logo")
- LOGOS (may list which logos to include)

When parsing tables:
1. Each TABLE ROW typically represents ONE image specification
2. Look for IMAGE 1, IMAGE 2, etc. as row headers or section markers
3. Extract the ASSET column for the image filename
4. Extract HEADLINE/TITLE column for the main text
5. Extract COPY column for the subtitle text
6. Check NOTES and LOGOS columns for logo requirements
7. Images are in ORDER - the first spec gets the first product image, second spec gets second product image, etc.

CRITICAL INSTRUCTIONS:
1. Extract EVERY image variant mentioned in the brief (IMAGE 1: METAL DARK, IMAGE 1: WOOD DARK, IMAGE 2: METAL DARK, etc.)
2. If a brief mentions BOTH "Metal Dark" AND "Wood Dark" variants, create SEPARATE specifications for EACH variant
3. Create one JSON object per variant, even if they share the same image number
4. The total number of specifications should match the total number of product variant images described

TITLE AND SUBTITLE EXTRACTION RULES:
- ANALYZE the visual/textual layout of each image specification in the document
- TITLE: Extract the main HEADLINE text - usually in a "HEADLINE" or "TITLE" column/field
- SUBTITLE: Extract the descriptive COPY text - usually in a "COPY" or "DESCRIPTION" column/field
- Extract titles and subtitles EXACTLY as written in the document
- DO NOT add variant names (like "- METAL DARK") to titles unless they are already part of the written title in the document
- DO NOT invent or modify titles - read what is actually written
- If no subtitle exists, use empty string ""

LOGO DETECTION - CRITICAL (MULTIPLE LOGOS SUPPORTED):
Each image specification can have ZERO, ONE, or MULTIPLE logos. Look for logo requirements in these locations:
1. ASSET field: Check if asset filename contains "logo" (e.g., "intel_logo.png", "amd-logo.jpg")
2. NOTES column: "Include Intel Core logo", "Add AMD Ryzen logo", "NVIDIA 50 Series logo required"
3. LOGOS column: May list multiple logos like "Intel Core, NVIDIA 50 Series"
4. COPY field: If copy text ends with "(Logo)" like "Powered by Intel Core (Logo)"
5. Explicit mentions: "Intel Logo", "AMD Logo", "NVIDIA Logo", "Hydro X logo", "iCUE Link logo"
6. Partner mentions in notes: "Hydro X & iCUE Link logo", "Intel Core Ultra logo"
7. Multiple logos in same spec: "Include Intel Core and NVIDIA logos"

LOGO NAME EXTRACTION (SUPPORT MULTIPLE LOGOS):
Extract ALL logo names mentioned for each image specification into an ARRAY:
- If "Intel Core and NVIDIA 50 Series" are mentioned → ["Intel Core", "NVIDIA 50 Series"]
- If "Hydro X & iCUE Link logo" is mentioned → ["Hydro X & iCUE Link"]
- If no logos → []
- Be specific about variants:
  * "Intel Core" vs "Intel Core Ultra" - these are DIFFERENT logos
  * "NVIDIA" vs "NVIDIA 50 Series" - these are DIFFERENT logos
  * "Hydro X" vs "Hydro X & iCUE Link" - extract as written
  * "AMD Ryzen" - for AMD processor images

For each image specification, extract:
- image_number: The sequential number from the brief (1, 2, 3, etc.)
- variant: The variant name if specified (e.g., "METAL DARK", "WOOD DARK", or null if not applicable)
- title: The HEADLINE text EXACTLY as written (convert to uppercase). Do NOT append variant names unless already in the document.
- subtitle: The COPY text EXACTLY as written (keep original case). IMPORTANT: If a logo annotation like "(Logo)" appears, extract the subtitle WITHOUT the "(Logo)" text - the logo will be overlaid separately.
- asset: The ASSET filename (if mentioned)
- logo_requested: true/false - Set to true if ANY logos are requested for this specification
- logo_names: ARRAY of logo names (e.g., ["Intel Core"], ["AMD Ryzen", "NVIDIA"], or [] if none). ALWAYS use an array, even for single logo.

For the ai_prompt field, generate a plain text instruction using ONLY natural language (NO pixel values, NO CSS):

"CRITICAL: DO NOT modify, replace, or regenerate the original image content. The product, background, colors, lighting, and all visual elements MUST remain 100% unchanged. ONLY add text overlays on top of the existing image.

Add a very subtle dark gradient at the top edge only (approximately top 15% of image) that fades to fully transparent. This gradient should be barely visible - just enough to improve text readability.

Overlay the title '{title}' using the Saira Bold font (geometric sans-serif with sharp, modern letterforms). The title must be:
- UPPERCASE white letters
- Positioned near the top left corner
- Bold weight
- Example style: 'MILLENNIUM' or 'CORSAIR ONE' - clean geometric letters

Below the title, add the subtitle '{subtitle}' using Saira Regular font (same geometric sans-serif family, lighter weight). The subtitle must be:
- Smaller than the title
- White text with subtle drop shadow for readability
- Same geometric Saira font family as title

ABSOLUTE REQUIREMENTS:
1. The original product image MUST remain completely untouched - no modifications to colors, lighting, composition, or any visual elements
2. ONLY add: subtle top gradient + title text + subtitle text
3. Use ONLY Saira font family (geometric sans-serif with distinctive angular terminals)
4. All text must be white with subtle shadow
5. Professional marketing aesthetic - minimal and clean"

CRITICAL PROMPT RULES:
- Use ONLY natural language descriptions - NO technical specs
- ALWAYS specify Saira font family by name (Saira Bold for titles, Saira Regular for subtitles)
- EMPHASIZE that the original image must NOT be modified - only add overlays
- NEVER include font names like 'Montserrat' or 'Arial' - ONLY Saira
- NEVER include pixel values like '52px' or '18px'
- NEVER include CSS values like 'rgba()' or '#FFFFFF'
- NEVER include measurements like '22%' or '32px from top'
- Describe the VISUAL RESULT, not technical implementation
- Replace {title} and {subtitle} with the actual extracted values

Return ONLY a valid JSON array with ALL image variant specifications, no additional text.

Example for document with variants and multiple logo requests:
[
  {
    "image_number": 1,
    "variant": "METAL DARK",
    "title": "CORSAIR ONE I600",
    "subtitle": "Premium Small Form Factor Gaming PC",
    "asset": "CORSAIR_ONE_i600_DARK_METAL_RENDER_01",
    "logo_requested": false,
    "logo_names": [],
    "ai_prompt": "Add a dark gradient overlay..."
  },
  {
    "image_number": 2,
    "variant": null,
    "title": "CUSTOM COOLING",
    "subtitle": "Precision-engineered liquid cooling",
    "asset": "PC_COOLING_SHOT_01",
    "logo_requested": true,
    "logo_names": ["Hydro X & iCUE Link"],
    "ai_prompt": "Add a dark gradient overlay..."
  },
  {
    "image_number": 3,
    "variant": null,
    "title": "ULTIMATE PERFORMANCE",
    "subtitle": "Intel Core Ultra 9 with NVIDIA RTX graphics",
    "asset": "PC_INTERIOR_SHOT_01",
    "logo_requested": true,
    "logo_names": ["Intel Core Ultra", "NVIDIA 50 Series"],
    "ai_prompt": "Add a dark gradient overlay..."
  },
  {
    "image_number": 4,
    "variant": null,
    "title": "AMD POWER",
    "subtitle": "AMD Ryzen 9000-series processor",
    "asset": "PC_AMD_VARIANT_01",
    "logo_requested": true,
    "logo_names": ["AMD Ryzen"],
    "ai_prompt": "Add a dark gradient overlay..."
  }
]`
        },
        {
          role: 'user',
          content: `Extract ALL image specifications from this document brief.

  IMPORTANT: If the brief describes multiple variants(like "Metal Dark" and "Wood Dark") for the same image number, create SEPARATE specifications for EACH variant.Count all variants to ensure the specification count matches the number of product images described.

Document Content:
${ docxText } `
        }
      ],
      temperature: 0.3,
      max_tokens: 8000
    });

    const responseText = completion.choices[0].message.content.trim();

    console.log('[DOCX Extraction] AI response received, parsing JSON...');
    console.log('[DOCX Extraction] Response (first 300 chars):', responseText.substring(0, 300));

    // Clean up response - extract just the JSON array
    let jsonText = responseText.trim();

    console.log('[DOCX Extraction] Extracting JSON from response...');
    jsonText = jsonText.replace(/^```json\s */im, '');
jsonText = jsonText.replace(/\s*```\s*$/m, '');
jsonText = jsonText.trim();

console.log('[DOCX Extraction] After markdown removal, length:', jsonText.length);
console.log('[DOCX Extraction] After markdown removal (first 200 chars):', jsonText.substring(0, 200));

// Find the first [ and last ] to extract just the JSON array
const startMarker = jsonText.indexOf('[');
const endMarker = jsonText.lastIndexOf(']');

console.log('[DOCX Extraction] Array markers - start:', startMarker, 'end:', endMarker);

if (startMarker === -1 || endMarker === -1 || endMarker <= startMarker) {
  console.error('[DOCX Extraction] Full response text:', responseText);
  throw new Error('No valid JSON array found in AI response');
}

// Extract only the JSON array content
jsonText = jsonText.substring(startMarker, endMarker + 1);

console.log('[DOCX Extraction] Cleaned JSON length:', jsonText.length);
console.log('[DOCX Extraction] Cleaned JSON (first 500 chars):', jsonText.substring(0, 500));
console.log('[DOCX Extraction] Cleaned JSON (last 500 chars):', jsonText.substring(Math.max(0, jsonText.length - 500)));

// Parse the JSON array of image specifications
let imageSpecs;
try {
  imageSpecs = JSON.parse(jsonText);
} catch (parseError) {
  console.error('[DOCX Extraction] JSON parse error:', parseError.message);
  console.error('[DOCX Extraction] Problematic JSON around position', parseError.message.match(/\d+/)?.[0] || 'unknown');

  // Log the area around the error for debugging
  const errorPos = parseInt(parseError.message.match(/\d+/)?.[0] || '0');
  if (errorPos > 0) {
    const start = Math.max(0, errorPos - 100);
    const end = Math.min(jsonText.length, errorPos + 100);
    console.error('[DOCX Extraction] Context around error:', jsonText.substring(start, end));
  }

  throw new Error('Failed to parse AI response - the response may contain invalid characters');
}

if (!Array.isArray(imageSpecs) || imageSpecs.length === 0) {
  throw new Error('Invalid image specifications - expected array with at least one image');
}

console.log('[DOCX Extraction] Successfully extracted', imageSpecs.length, 'image specifications');
console.log('[DOCX Extraction] Extracted', extractedImages.length, 'embedded images (product images + logos)');

    // Validate each image specification
    console.log('[DOCX Extraction] Validating image specifications...');
    const validationErrors = [];
    imageSpecs.forEach((spec, index) => {
      const error = validateImageSpec(spec, index);
      if (error) {
        validationErrors.push(error);
      }
    });

    if (validationErrors.length > 0) {
      console.error('[DOCX Extraction] Validation errors:');
      validationErrors.forEach(err => console.error(`  - ${err}`));
      throw new Error(`Image specification validation failed:\n${validationErrors.join('\n')}`);
    }

    console.log('[DOCX Extraction] ✓ All specs validated successfully');

    // MULTI-FACTOR IMAGE CLASSIFICATION using dimensions + size + pixel count
    // Product images: high resolution (1000px+ width/height), high pixel count
    // Logos: smaller dimensions, often square/wide aspect ratios
    console.log('[DOCX Extraction] Classifying images using multi-factor analysis...');
    
    const classifiedImages = [];
    
    for (let idx = 0; idx < extractedImages.length; idx++) {
      const img = extractedImages[idx];
      const sizeKB = Math.round(img.size / 1024);
      
      let metadata = { width: 0, height: 0 };
      try {
        metadata = await sharp(img.buffer).metadata();
      } catch (e) {
        console.warn(`  Image ${idx + 1}: Could not read metadata, using size-only classification`);
      }
      
      const width = metadata.width || 0;
      const height = metadata.height || 0;
      const pixelCount = width * height;
      const aspectRatio = width > 0 && height > 0 ? Math.max(width/height, height/width) : 1;
      
      // Calculate product likelihood score (higher = more likely product image)
      let productScore = 0;
      
      // Dimension scoring: larger images are more likely products
      if (width >= 1000 || height >= 1000) productScore += 40;
      else if (width >= 500 || height >= 500) productScore += 20;
      else if (width < 300 && height < 300) productScore -= 30; // Small = likely logo
      
      // Pixel count scoring: high pixel count = product
      if (pixelCount >= 1000000) productScore += 30; // 1MP+
      else if (pixelCount >= 250000) productScore += 15; // 500x500+
      else if (pixelCount < 100000) productScore -= 20; // Very small
      
      // File size scoring
      if (img.size >= 500000) productScore += 20; // 500KB+
      else if (img.size >= 100000) productScore += 10; // 100KB+
      else if (img.size < 30000) productScore -= 15; // <30KB likely logo
      
      // Aspect ratio scoring: extreme ratios often indicate logos/banners
      if (aspectRatio > 3) productScore -= 15; // Very wide/tall = likely logo/banner
      
      const isProduct = productScore >= 20;
      
      classifiedImages.push({
        ...img,
        originalIndex: idx,
        width,
        height,
        pixelCount,
        aspectRatio: aspectRatio.toFixed(2),
        productScore,
        isProduct
      });
      
      console.log(`  Image ${idx + 1}: ${width}x${height} (${sizeKB}KB) score=${productScore} → ${isProduct ? 'PRODUCT' : 'LOGO'}`);
    }
    
    // Separate into product and logo arrays
    const productImages = classifiedImages.filter(img => img.isProduct);
    const logoImages = classifiedImages.filter(img => !img.isProduct);
    
    console.log(`[DOCX Extraction] Classification result: ${productImages.length} product images, ${logoImages.length} logos`);
    
    // Fallback: if we have fewer product images than specs, reclassify top-scoring logos as products
    if (productImages.length < imageSpecs.length) {
      const needed = imageSpecs.length - productImages.length;
      console.warn(`[DOCX Extraction] ⚠ Need ${needed} more product images, reclassifying top-scoring logos...`);
      
      // Sort logos by score descending and move top ones to products
      logoImages.sort((a, b) => b.productScore - a.productScore);
      for (let i = 0; i < needed && logoImages.length > 0; i++) {
        const reclassified = logoImages.shift();
        reclassified.isProduct = true;
        productImages.push(reclassified);
        console.log(`    Reclassified image ${reclassified.originalIndex + 1} as product (score: ${reclassified.productScore})`);
      }
      
      // Re-sort product images by original index to maintain document order
      productImages.sort((a, b) => a.originalIndex - b.originalIndex);
    }
    
    // Convert logoImages to the format expected by intelligent matching
    logoImages.forEach((logo, idx) => {
      const base64Data = logo.buffer.toString('base64');
      logo.base64 = `data:${logo.contentType};base64,${base64Data}`;
      logo.index = idx;
    });
    
    // Store all classified logos for fallback matching
    // These will be used when partner registry logos don't have Drive IDs configured
    const classifiedLogos = logoImages.map((logo, idx) => ({
      base64: logo.base64,
      contentType: logo.contentType,
      width: logo.width,
      height: logo.height,
      size: logo.size,
      index: idx
    }));
    
    console.log(`[DOCX Extraction] ✓ Image classification complete`);
    console.log(`[DOCX Extraction] Final: ${productImages.length} product images, ${logoImages.length} logos (available as fallback)`)

    // INTELLIGENT LOGO MATCHING - Support multiple logos per spec
    console.log('[DOCX Extraction] Starting intelligent logo matching (supports multiple logos per image)...');

    let totalLogosRequested = 0;
    let totalLogosMatched = 0;
    const unmatchedLogoNames = [];

    // Track which classified logos have been used (for fallback assignment)
    let usedClassifiedLogoIndices = new Set();
    
    for (let specIndex = 0; specIndex < imageSpecs.length; specIndex++) {
      const spec = imageSpecs[specIndex];

      // Initialize matched logos array for this spec
      spec.matchedPartnerLogos = [];
      spec.logoBase64Array = []; // Support multiple logos

      if (spec.logo_requested === true && spec.logo_names && spec.logo_names.length > 0) {
        // CRITICAL: Expand multi-logo strings like "Hydro X & iCUE Link" into separate entries
        const expandedLogoNames = expandLogoNames(spec.logo_names);
        console.log(`[DOCX Extraction] Processing ${expandedLogoNames.length} logo(s) for "${spec.title}":`, expandedLogoNames);

        for (let logoIdx = 0; logoIdx < expandedLogoNames.length; logoIdx++) {
          const logoName = expandedLogoNames[logoIdx];
          totalLogosRequested++;
          console.log(`  - Looking for logo: "${logoName}"`);

          const matchedLogo = findLogoByName(logoName);
          let logoAdded = false;

          if (matchedLogo) {
            spec.matchedPartnerLogos.push({
              key: matchedLogo.key,
              name: matchedLogo.name,
              driveId: matchedLogo.driveId,
              localPath: matchedLogo.localPath,
              matchScore: matchedLogo.matchScore
            });
            console.log(`    ✓ Matched "${logoName}" to "${matchedLogo.name}" (score: ${matchedLogo.matchScore})`);
            totalLogosMatched++;

            // PRIORITY 1: Try local storage first (fastest, no API calls)
            const localLogoData = await getLogoData(matchedLogo);
            if (localLogoData) {
              spec.logoBase64Array.push({
                base64: localLogoData.base64,
                contentType: 'image/png',
                name: localLogoData.name,
                source: 'local'
              });
              console.log(`    ✓ Loaded logo from local storage: ${matchedLogo.localPath}`);
              logoAdded = true;
            }
            
            // PRIORITY 2: Download from Drive if available and local not found
            if (!logoAdded && matchedLogo.driveId) {
              try {
                const logoBuffer = await downloadFileFromDrive(matchedLogo.driveId);
                const base64Data = logoBuffer.toString('base64');
                const contentType = 'image/png';
                spec.logoBase64Array.push({
                  base64: `data:${contentType};base64,${base64Data}`,
                  contentType: contentType,
                  name: matchedLogo.name,
                  source: 'drive'
                });
                console.log(`    ✓ Downloaded logo from Drive: ${matchedLogo.driveId}`);
                logoAdded = true;
              } catch (driveErr) {
                console.warn(`    ⚠ Could not download logo from Drive: ${driveErr.message}`);
              }
            }
          }

          // If no match found or local/Drive not available, use classified logos from DOCX as fallback
          if (!logoAdded && classifiedLogos.length > 0) {
            // Find the next unused classified logo
            for (let i = 0; i < classifiedLogos.length; i++) {
              if (!usedClassifiedLogoIndices.has(i)) {
                const fallbackLogo = classifiedLogos[i];
                spec.logoBase64Array.push({
                  base64: fallbackLogo.base64,
                  contentType: fallbackLogo.contentType,
                  name: logoName,
                  source: 'docx-embedded'
                });
                usedClassifiedLogoIndices.add(i);
                console.log(`    ✓ Using classified DOCX logo #${i + 1} (${fallbackLogo.width}x${fallbackLogo.height}) as fallback for "${logoName}"`);
                logoAdded = true;
                
                // AUTO-SAVE: Save extracted logo locally for future use
                try {
                  const savedInfo = await saveLogoFromBase64(fallbackLogo.base64, logoName);
                  if (savedInfo) {
                    console.log(`    ✓ Auto-saved logo to local storage: ${savedInfo.localPath} (${savedInfo.dimensions.width}x${savedInfo.dimensions.height}, aspect ${savedInfo.aspectRatio.toFixed(1)}:1)`);
                  }
                } catch (saveErr) {
                  console.warn(`    ⚠ Could not auto-save logo: ${saveErr.message}`);
                }
                
                break;
              }
            }
          }

          if (!logoAdded) {
            console.warn(`    ⚠ No logo available for: "${logoName}" (no Drive ID configured and no DOCX logos remaining)`);
            unmatchedLogoNames.push({ specIndex, spec: spec.title, logoName });

            const detectedLogos = detectLogosInText(logoName);
            if (detectedLogos.length > 0) {
              console.log(`    Possible alternatives:`, detectedLogos.map(l => l.name).join(', '));
            }
          }
        }
      } else if (spec.logo_requested === true && (!spec.logo_names || spec.logo_names.length === 0)) {
        console.warn(`[DOCX Extraction] ⚠ Logo requested but no logo_names provided for: "${spec.title}"`);
      }
    }

    console.log(`[DOCX Extraction] Logo matching complete: ${totalLogosMatched}/${totalLogosRequested} logos matched from registry`);

    if (unmatchedLogoNames.length > 0) {
      console.warn(`[DOCX Extraction] ⚠ Unmatched logos (${unmatchedLogoNames.length}):`);
      unmatchedLogoNames.forEach(({ spec, logoName }) => {
        console.warn(`  - "${logoName}" for "${spec}"`);
      });
    }

    // Log final logo assignment summary
    console.log('[DOCX Extraction] Final logo assignment:');
    imageSpecs.forEach((spec, idx) => {
      if (spec.logo_requested && spec.logoBase64Array.length > 0) {
        const logoSummary = spec.logoBase64Array.map(l => `${l.name} (${l.source})`).join(', ');
        console.log(`  Spec #${idx + 1} "${spec.title}": ${spec.logoBase64Array.length} logo(s) - ${logoSummary}`);
      } else if (spec.logo_requested) {
        console.warn(`  Spec #${idx + 1} "${spec.title}": Logo requested but none assigned!`);
      }
    });

    return {
      imageSpecs,
      extractedImages: productImages,
      logoImages: classifiedLogos, // All classified logos for backwards compatibility
      briefText: docxText // Include brief text for AI logo analysis
    };

  } catch (error) {
  console.error('[DOCX Extraction] Error:', error.message);

  if (error.message.includes('OpenAI') || error.message.includes('API')) {
    throw new Error('AI service temporarily unavailable - please try again');
  }

  throw new Error(`DOCX processing failed: ${error.message}`);
}
}

async function extractPromptFromPDF(pdfBuffer, brand) {
  const openai = getBrandOpenAI(brand);
  try {
    console.log('[PDF Extraction] Starting PDF text extraction...');
    console.log('[PDF Extraction] Buffer size:', pdfBuffer.length, 'bytes');

    // Convert Buffer to Uint8Array for pdfjs-dist compatibility
    const uint8Array = new Uint8Array(pdfBuffer);
    console.log('[PDF Extraction] Converted to Uint8Array, length:', uint8Array.length);

    // Extract text from PDF using pdfjs-dist
    const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
    const pdfDocument = await loadingTask.promise;

    console.log('[PDF Extraction] PDF loaded successfully, pages:', pdfDocument.numPages);

    let pdfText = '';
    for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
      console.log(`[PDF Extraction] Processing page ${pageNum}/${pdfDocument.numPages}`);
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();

      // Improved text extraction with better spacing
      const pageText = textContent.items
        .map(item => item.str)
        .filter(str => str.trim().length > 0)
        .join(' ');

      pdfText += pageText + '\n\n';
    }

    // Clean up extra whitespace
    pdfText = pdfText.replace(/\s+/g, ' ').trim();

    console.log('[PDF Extraction] Extracted text length:', pdfText.length);
    console.log('[PDF Extraction] First 500 chars:', pdfText.substring(0, 500));

    if (!pdfText || pdfText.trim().length < 10) {
      throw new Error('Could not extract text from PDF - file may be image-based, empty, or encrypted');
    }

    console.log('[PDF Extraction] Sending to OpenAI to extract image specifications...');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an AI creative assistant specialized in extracting marketing image specifications from briefs.

Your task is to read the provided PDF brief and extract ALL image specifications into structured JSON format.

Extract ALL images mentioned in the brief (IMAGE 1, IMAGE 2, IMAGE 3, etc.). For each image, extract:
- image_number: The sequential number
- title: The HEADLINE text (convert to uppercase)
- subtitle: The COPY text (keep as written)
- asset: The ASSET filename (if mentioned)

For the ai_prompt field, generate a plain text instruction using ONLY natural language (NO pixel values, NO CSS):

"Edit this product image by adding a subtle dark gradient at the top that fades to transparent. Overlay the title '{title}' in a clean, modern, geometric sans-serif font style (like Saira), bold white uppercase letters near the top left. Below the title, add the subtitle '{subtitle}' in the same geometric sans-serif font, smaller white text. Both texts should have a subtle shadow for readability. Keep all original product details, colors, and image quality intact. This should look like a professional marketing image with modern geometric typography."

CRITICAL: Use ONLY natural language - NO pixel values, NO CSS colors, NO technical measurements. Request Saira-style geometric sans-serif font for all text.

Replace {title} and {subtitle} with the actual extracted values for EACH image.

Return ONLY a valid JSON array with ALL image specifications, no additional text.

Example output format:
[
  {
    "image_number": 1,
    "title": "PRODUCT NAME",
    "subtitle": "Product description text",
    "asset": "filename.jpg",
    "ai_prompt": "Add a dark gradient overlay..."
  },
  {
    "image_number": 2,
    "title": "ANOTHER PRODUCT",
    "subtitle": "Different description",
    "asset": "another_file.jpg",
    "ai_prompt": "Add a dark gradient overlay..."
  }
]`
        },
        {
          role: 'user',
          content: `Extract ALL image specifications from this PDF brief and generate individual prompts for each image.

PDF Content:
${pdfText}`
        }
      ],
      temperature: 0.3,
      max_tokens: 4000
    });

    const responseText = completion.choices[0].message.content.trim();

    console.log('[PDF Extraction] AI response received, parsing JSON...');
    console.log('[PDF Extraction] Response (first 300 chars):', responseText.substring(0, 300));

    // Clean up response - extract just the JSON array
    let jsonText = responseText.trim();

    console.log('[PDF Extraction] Extracting JSON from response...');
    jsonText = jsonText.replace(/^```json\s*/im, '');
    jsonText = jsonText.replace(/\s*```\s*$/m, '');
    jsonText = jsonText.trim();

    // Find the first [ and last ] to extract just the JSON array
    const startMarker = jsonText.indexOf('[');
    const endMarker = jsonText.lastIndexOf(']');

    if (startMarker === -1 || endMarker === -1 || endMarker <= startMarker) {
      throw new Error('No valid JSON array found in AI response');
    }

    // Extract only the JSON array content
    jsonText = jsonText.substring(startMarker, endMarker + 1);

    console.log('[PDF Extraction] Cleaned JSON (first 500 chars):', jsonText.substring(0, 500));
    console.log('[PDF Extraction] Cleaned JSON (last 500 chars):', jsonText.substring(Math.max(0, jsonText.length - 500)));

    // Parse the JSON array of image specifications
    let imageSpecs;
    try {
      imageSpecs = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('[PDF Extraction] JSON parse error:', parseError.message);
      console.error('[PDF Extraction] Problematic JSON around position', parseError.message.match(/\d+/)?.[0] || 'unknown');

      // Log the area around the error for debugging
      const errorPos = parseInt(parseError.message.match(/\d+/)?.[0] || '0');
      if (errorPos > 0) {
        const start = Math.max(0, errorPos - 100);
        const end = Math.min(jsonText.length, errorPos + 100);
        console.error('[PDF Extraction] Context around error:', jsonText.substring(start, end));
      }

      throw new Error('Failed to parse AI response - the response may contain invalid characters');
    }

    if (!Array.isArray(imageSpecs) || imageSpecs.length === 0) {
      throw new Error('Invalid image specifications - expected array with at least one image');
    }

    console.log('[PDF Extraction] Successfully extracted', imageSpecs.length, 'image specifications');

    // Return the array of image specifications
    return imageSpecs;

  } catch (error) {
    console.error('[PDF Extraction] Error:', error.message);

    // Provide user-friendly error messages
    if (error.message.includes('Uint8Array')) {
      throw new Error('PDF format error - please ensure the file is a valid PDF');
    } else if (error.message.includes('image-based') || error.message.includes('encrypted')) {
      throw new Error('Cannot read PDF text - file may be image-based or password-protected');
    } else if (error.message.includes('OpenAI') || error.message.includes('API')) {
      throw new Error('AI service temporarily unavailable - please try again');
    } else if (error.code === 'ENOENT' || error.code === 'EACCES') {
      throw new Error('File access error - please try uploading again');
    }

    throw new Error(`PDF processing failed: ${error.message}`);
  }
}

export async function uploadPDF(req, res) {
  try {
    console.log('[Upload Brief] Request received');

    if (!req.file) {
      console.log('[Upload Brief] No file in request');
      return res.status(400).json({ error: 'No brief file uploaded' });
    }

    // Check file type by MIME type and file extension
    const isPDF = req.file.mimetype === 'application/pdf' ||
      req.file.originalname.toLowerCase().endsWith('.pdf');
    const isDOCX = req.file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      (req.file.mimetype === 'application/octet-stream' && req.file.originalname.toLowerCase().endsWith('.docx')) ||
      req.file.originalname.toLowerCase().endsWith('.docx');

    if (!isPDF && !isDOCX) {
      console.log('[Upload Brief] Invalid file type:', req.file.mimetype, 'for file:', req.file.originalname);
      return res.status(400).json({ error: 'File must be a PDF or DOCX' });
    }

    console.log(`[Upload Brief] File type detected: ${isPDF ? 'PDF' : 'DOCX'} (MIME: ${req.file.mimetype}, Name: ${req.file.originalname})`);

    const fileType = isPDF ? 'pdf' : 'docx';
    console.log(`[Upload Brief] ${fileType.toUpperCase()} file received:`, req.file.originalname, 'Size:', req.file.size, 'bytes');

    const jobId = `job_${Date.now()}`;
    const fileName = `brief-${Date.now()}.${fileType}`;

    console.log('[Upload Brief] Uploading to Google Drive...');
    const result = await uploadFileToDrive(
      req.file.buffer,
      fileName,
      req.file.mimetype,
      req.brand.briefFolderId
    );
    console.log('[Upload Brief] Uploaded to Drive, ID:', result.id);

    console.log(`[Upload Brief] Extracting image specifications from ${fileType.toUpperCase()}...`);
    let imageSpecs, extractedImages;

    if (isPDF) {
      imageSpecs = await extractPromptFromPDF(req.file.buffer, req.brand);
      extractedImages = [];
    } else {
      const docxResult = await extractPromptFromDOCX(req.file.buffer, req.brand);
      imageSpecs = docxResult.imageSpecs;
      extractedImages = docxResult.extractedImages;
      
      // Note: Vision-based logo analysis will happen AFTER images are uploaded to Drive
      // This is because we need public URLs to analyze with GPT-4o Vision
      console.log(`[Upload Brief] DOCX extracted ${imageSpecs.length} specs, ${extractedImages.length} images`);
    }

    console.log('[Upload Brief] Extracted', imageSpecs.length, 'image specifications');
    console.log('[Upload Brief] Extracted', extractedImages.length, 'embedded images');

    // If DOCX has embedded images, upload them to Drive immediately
    const uploadedImages = [];
    if (extractedImages.length > 0) {
      console.log('[Upload Brief] Uploading', extractedImages.length, 'embedded images to Drive...');

      for (let i = 0; i < extractedImages.length; i++) {
        const img = extractedImages[i];
        const fileName = `docx_image_${i + 1}.${img.contentType.split('/')[1]}`;

        const uploadResult = await uploadFileToDrive(
          img.buffer,
          fileName,
          img.contentType,
          req.brand.productImagesFolderId
        );

        console.log(`Uploaded ${fileName} to Drive, making public...`);
        await makeFilePublic(uploadResult.id);
        const publicUrl = getPublicImageUrl(uploadResult.id);

        uploadedImages.push({
          id: uploadResult.id,
          name: fileName,
          originalName: fileName,
          driveId: uploadResult.id,
          publicUrl: publicUrl
        });
      }

      console.log('[Upload Brief] All embedded images uploaded and made public');
      
      // VISION-BASED LOGO ANALYSIS: Now that images are public, analyze them with GPT-4o Vision
      // This analyzes the actual image content to determine optimal logo placement
      if (uploadedImages.length > 0 && imageSpecs.length > 0) {
        console.log('[Upload Brief] Starting vision-based logo placement analysis...');
        try {
          const visionPlans = await analyzeImagesWithVision(
            uploadedImages,
            imageSpecs,
            { openaiApiKey: req.brand.openaiApiKey || process.env.OPENAI_API_KEY }
          );
          
          // Merge vision-analyzed placement plans into image specs
          if (visionPlans && visionPlans.length > 0) {
            imageSpecs = mergeVisionPlansIntoSpecs(imageSpecs, visionPlans);
            console.log('[Upload Brief] Vision logo analysis complete - specs updated with placement data');
          }
        } catch (visionErr) {
          console.warn('[Upload Brief] Vision analysis failed, using fallback detection:', visionErr.message);
        }
      }
    }

    const startTime = new Date();

    let marketplacePreset = null;
    let driveDestinationFolderId = null;

    try {
      if (req.body && req.body.marketplacePreset) {
        marketplacePreset = typeof req.body.marketplacePreset === 'string' 
          ? JSON.parse(req.body.marketplacePreset) 
          : req.body.marketplacePreset;
        console.log('[Upload Brief] Marketplace preset:', marketplacePreset.id);
      }
      if (req.body && req.body.driveDestinationFolderId) {
        driveDestinationFolderId = req.body.driveDestinationFolderId;
        console.log('[Upload Brief] Custom drive destination:', driveDestinationFolderId);
      }
    } catch (parseErr) {
      console.warn('[Upload Brief] Could not parse preset/folder settings:', parseErr.message);
    }

    await createJob({
      id: jobId,
      brandId: req.brand.id,
      brandSlug: req.brand.slug,
      pdfId: result.id,
      pdfName: result.name,
      imageSpecs: imageSpecs,
      images: uploadedImages,
      status: uploadedImages.length > 0 ? 'processing' : 'pdf_uploaded',
      createdAt: startTime,
      startTime: startTime,
      imageCount: uploadedImages.length,
      marketplacePreset: marketplacePreset,
      driveDestinationFolderId: driveDestinationFolderId
    });

    console.log('[Upload Brief] Job created and persisted:', jobId);

    // If we have images from DOCX, start processing immediately
    if (uploadedImages.length > 0) {
      console.log('[Upload Brief] Starting automatic processing with embedded images...');

      res.json({
        success: true,
        jobId,
        fileId: result.id,
        fileName: result.name,
        imageCount: imageSpecs.length,
        embeddedImageCount: uploadedImages.length,
        message: `Brief uploaded with ${uploadedImages.length} embedded images. Processing started automatically.`
      });

      // Start processing in the background
      processImagesWithGemini(jobId).catch(async err => {
        console.error('Background processing error:', err);
        console.error('Error stack:', err.stack);
        await updateJob(jobId, { 
          status: 'failed',
          error: err.message
        });
      });
    } else {
      res.json({
        success: true,
        jobId,
        fileId: result.id,
        fileName: result.name,
        imageCount: imageSpecs.length,
        message: `Brief uploaded and ${imageSpecs.length} image specifications extracted successfully`
      });
    }

  } catch (error) {
    console.error('[Upload Brief] Error:', error.message);

    // Return user-friendly error messages
    const statusCode = error.message.includes('No brief') ? 400 : 500;
    res.status(statusCode).json({
      error: 'Brief upload failed',
      details: error.message
    });
  }
}

export async function uploadImages(req, res) {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No images uploaded' });
    }

    const { jobId } = req.body;

    const job = await getJob(jobId);
    if (!jobId || !job) {
      return res.status(400).json({ error: 'Invalid job ID' });
    }

    const uploadedImages = [];

    for (const file of req.files) {
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
      if (!validTypes.includes(file.mimetype)) {
        continue;
      }

      const result = await uploadFileToDrive(
        file.buffer,
        file.originalname,
        file.mimetype,
        req.brand.productImagesFolderId
      );

      console.log(`Uploaded ${file.originalname} to Drive, making public...`);
      await makeFilePublic(result.id);
      const publicUrl = getPublicImageUrl(result.id);
      console.log(`Image public URL: ${publicUrl}`);

      uploadedImages.push({
        id: result.id,
        name: file.originalname,
        originalName: file.originalname,
        driveId: result.id,
        publicUrl: publicUrl
      });
    }

    console.log(`Uploaded ${uploadedImages.length} images, starting processing...`);

    await updateJob(jobId, {
      images: uploadedImages,
      status: 'processing',
      imageCount: uploadedImages.length
    });

    res.json({
      success: true,
      count: uploadedImages.length,
      images: uploadedImages,
      message: 'Images uploaded successfully, processing started'
    });

    processImagesWithGemini(jobId).catch(async err => {
      console.error('Background processing error:', err);
      console.error('Error stack:', err.stack);
      await updateJob(jobId, { 
        status: 'failed',
        error: err.message
      });
    });

  } catch (error) {
    console.error('Images upload error:', error);
    res.status(500).json({ error: 'Failed to upload images', details: error.message });
  }
}

async function processImagesWithGemini(jobId) {
  const job = await getJob(jobId);

  if (!job) {
    throw new Error('Job not found');
  }

  // Load brand-specific configuration (API keys, folders)
  const brandConfig = await getBrandApiKeys(job);

  console.log(`Processing job ${jobId} - Images count: ${job.images?.length || 0}`);

  if (!job.imageSpecs || job.imageSpecs.length === 0) {
    console.error('No image specifications found for job:', jobId);
    await updateJob(jobId, { 
      status: 'waiting_for_prompt',
      processingStep: 'Waiting for image specifications from PDF brief'
    });
    return;
  }

  if (!job.images || job.images.length === 0) {
    console.error('No images found for job:', jobId);
    throw new Error('No images found for job');
  }

  console.log(`Processing ${job.images.length} images with ${job.imageSpecs.length} specifications`);

  const presetModifier = job.marketplacePreset?.promptModifier || null;
  const presetMode = job.marketplacePreset?.aiMode || 'balanced';
  const presetId = job.marketplacePreset?.id || 'default';

  if (presetModifier && typeof presetModifier === 'string' && presetModifier.trim()) {
    console.log(`[Marketplace Preset] Applying ${presetId} mode (${presetMode})`);
    console.log(`[Marketplace Preset] Prompt modifier length: ${presetModifier.length} chars`);
  } else {
    console.log(`[Marketplace Preset] Using ${presetId} mode (no prompt modifications)`);
  }

  // Analyze images for parameters before generating prompts
  console.log(`[Parameter Analysis] Analyzing ${job.images.length} images for AI parameters...`);
  const imageUrls = job.images.map(img => img.publicUrl);
  let imageAnalyses = [];
  try {
    imageAnalyses = await Promise.all(
      imageUrls.map(url => analyzeImageForParameters(url, { geminiApiKey: brandConfig.geminiApiKey }))
    );
    console.log(`[Parameter Analysis] Successfully analyzed ${imageAnalyses.length} images.`);
  } catch (analysisError) {
    console.error('[Parameter Analysis] Failed to analyze images:', analysisError.message);
    // Decide how to handle this: fail job, or continue with default prompts?
    // For now, we'll log and continue, hoping generateAdaptivePrompt can handle undefined analysis
    // or we might fall back to generatePrompt if analysis is critical.
    // For this example, we will proceed assuming analysis might be partial or missing.
    imageAnalyses = new Array(job.images.length).fill(null); // Fill with null to indicate failure
  }

  // Match images to specifications and generate prompts using AI-analyzed parameters
  const imagePrompts = job.images.map((img, i) => {
    const specIndex = i % job.imageSpecs.length;
    const spec = job.imageSpecs[specIndex];
    const analysis = imageAnalyses[i]; // Use the analysis for this image

    // Build logo info from spec if available
    const logoInfo = spec.logo_requested ? {
      logoRequested: true,
      logoName: spec.logo_name || 'Brand logo'
    } : null;

    // Generate adaptive prompt using AI-analyzed parameters
    let finalPrompt = generateAdaptivePrompt(
      spec.title,
      spec.subtitle,
      analysis, // Pass the AI-analyzed parameters
      job.marketplacePreset?.id || 'website',
      logoInfo // Pass logo information
    );

    if (presetModifier && typeof presetModifier === 'string' && presetModifier.trim()) {
      finalPrompt = `${finalPrompt}\n\nADDITIONAL REQUIREMENTS:\n${presetModifier}`;
    }

    return finalPrompt;
  });

  console.log(`[Matching Strategy] ${job.images.length} images mapped to ${job.imageSpecs.length} specifications using ${job.images.length > job.imageSpecs.length ? 'cyclic' : 'direct'} matching`);

  const hasActiveModifier = presetModifier && typeof presetModifier === 'string' && presetModifier.trim();

  addWorkflowStep(jobId, {
    name: 'Prepare Processing',
    status: 'completed',
    description: hasActiveModifier
      ? `Preparing images with ${job.marketplacePreset?.name || presetId} preset (${presetMode} mode)`
      : 'Preparing images with individual prompts for each image',
    details: {
      imageCount: job.images.length,
      specsCount: job.imageSpecs.length,
      matchingStrategy: job.images.length > job.imageSpecs.length ? 'cyclic (images > specs)' : 'direct (1:1)',
      marketplacePreset: job.marketplacePreset?.id || 'default',
      aiMode: presetMode,
      imagePrompts: imagePrompts.map((p, i) => {
        const specIndex = i % job.imageSpecs.length;
        return {
          image: job.images[i].originalName,
          specUsed: `${specIndex + 1}/${job.imageSpecs.length}`,
          title: job.imageSpecs[specIndex]?.title || 'N/A',
          subtitle: job.imageSpecs[specIndex]?.subtitle || 'N/A'
        };
      }),
      code: `// Images uploaded to Google Drive\n// Making images publicly accessible\nconst imageUrls = images.map(img => makePublic(img.driveId));\n// Each image gets its own prompt with unique title/subtitle\n// Using ${job.images.length > job.imageSpecs.length ? 'cyclic matching' : 'direct 1:1 matching'}`
    }
  });

  await updateJob(jobId, {
    status: 'processing',
    processingStep: 'Processing images with individual prompts'
  });

  addWorkflowStep(jobId, {
    name: 'Individual Prompts Ready',
    status: 'completed',
    description: `${imagePrompts.length} unique prompts extracted from PDF brief`,
    details: {
      prompts: imagePrompts.map((p, i) => {
        const specIndex = i % job.imageSpecs.length;
        return {
          image: i + 1,
          title: job.imageSpecs[specIndex]?.title || 'N/A',
          preview: p.substring(0, 100) + '...'
        };
      }),
      api: 'Google Gemini',
      endpoint: 'gemini-3-pro-image-preview',
      parameters: {
        imageSize: '2K',
        outputFormat: 'png',
        batch_size: 15
      }
    }
  });

  console.log(`Image URLs to process: ${imageUrls.length} URLs`);

  await updateJob(jobId, {
    status: 'processing',
    processingStep: 'Editing images with AI (individual prompts per image)'
  });

  addWorkflowStep(jobId, {
    name: 'AI Processing Started',
    status: 'in_progress',
    description: `Processing ${imageUrls.length} images with Nano Banana Pro (gemini-3-pro-image-preview)`,
    details: {
      totalImages: imageUrls.length,
      batchSize: 15,
      model: 'gemini-3-pro-image-preview',
      preserveDimensions: true,
      code: `// Each image processed with Nano Banana Pro\n// Preserves original dimensions with empty aspectRatio/imageSize\nconst batchSize = 15;\nfor (let i = 0; i < images.length; i += batchSize) {\n  const batch = images.slice(i, i + batchSize);\n  const results = await Promise.all(\n    batch.map((img, idx) => editWithAI(img, prompts[i + idx]))\n  );\n}`
    }
  });

  console.log('Processing images with Nano Banana Pro (gemini-3-pro-image-preview)...');

  // Process images with their individual prompts
  const results = [];
  const batchSize = 15;

  for (let i = 0; i < imageUrls.length; i += batchSize) {
    const batchUrls = imageUrls.slice(i, i + batchSize);
    const batchPrompts = imagePrompts.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(imageUrls.length / batchSize);

    console.log(`Processing batch ${batchNumber}/${totalBatches} (${batchUrls.length} images)`);

    addWorkflowStep(jobId, {
      name: `Batch ${batchNumber}/${totalBatches}`,
      status: 'in_progress',
      description: `Processing ${batchUrls.length} images with unique prompts`,
      details: {
        batchNumber,
        totalBatches,
        imagesInBatch: batchUrls.length,
        prompts: batchPrompts.map((p, idx) => {
          const imageIndex = i + idx;
          const specIndex = imageIndex % job.imageSpecs.length;
          return {
            image: job.images[imageIndex].originalName,
            title: job.imageSpecs[specIndex]?.title || 'N/A'
          };
        })
      }
    });

    const batchPromises = batchUrls.map((url, idx) => {
      const imageIndex = i + idx;
      const specIndex = imageIndex % job.imageSpecs.length;
      const prompt = batchPrompts[idx];
      const spec = job.imageSpecs[specIndex];
      const specTitle = spec?.title || 'N/A';
      const specSubtitle = spec?.subtitle || 'N/A';

      console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
      console.log(`║ PROCESSING IMAGE ${imageIndex + 1}/${imageUrls.length}`);
      console.log(`╠════════════════════════════════════════════════════════════════╣`);
      console.log(`║ Title: ${specTitle}`);
      console.log(`║ Subtitle: ${specSubtitle.substring(0, 50)}${specSubtitle.length > 50 ? '...' : ''}`);
      console.log(`║ Using spec: ${specIndex + 1}/${job.imageSpecs.length}`);
      console.log(`╚════════════════════════════════════════════════════════════════╝\n`);

      return editImageUnified(url, prompt, {
        geminiApiKey: brandConfig.geminiApiKey,
        imageIndex
      }).then(async result => {
        console.log(`\n✅ SUCCESS - Image ${imageIndex + 1}/${imageUrls.length}: "${specTitle}"`);
        try {
          await updateJob(jobId, {
            processingStep: `AI editing: ${imageIndex + 1} of ${imageUrls.length} images`,
            progress: Math.round(((imageIndex + 1) / imageUrls.length) * 100),
            currentImageIndex: imageIndex
          });
        } catch (updateErr) {
          console.error(`[Batch] Error updating job progress:`, updateErr.message);
        }
        return result;
      }).catch(err => {
        console.error(`\n❌ FAILED - Image ${imageIndex + 1}/${imageUrls.length}: "${specTitle}"`);
        console.error(`   Error: ${err.message}`);
        return { error: err.message, imageIndex };
      });
    });

    console.log(`[Batch ${batchNumber}] Waiting for ${batchPromises.length} promises...`);
    let batchResults;
    try {
      batchResults = await Promise.all(batchPromises);
      console.log(`[Batch ${batchNumber}] All promises resolved. Results count: ${batchResults.length}`);
      if (batchResults[0]) {
        const firstResultType = typeof batchResults[0] === 'string' ? 'dataUrl' : 'object';
        console.log(`[Batch ${batchNumber}] First result type: ${firstResultType}`);
      }
    } catch (batchErr) {
      console.error(`[Batch ${batchNumber}] Promise.all failed:`, batchErr.message);
      console.error(`[Batch ${batchNumber}] Error stack:`, batchErr.stack);
      throw batchErr;
    }
    results.push(...batchResults);

    addWorkflowStep(jobId, {
      name: `Batch ${batchNumber} Complete`,
      status: 'completed',
      description: `Completed ${i + batchUrls.length} of ${imageUrls.length} images`,
      details: {
        totalProcessed: i + batchUrls.length,
        totalImages: imageUrls.length
      }
    });
  }

  console.log(`Received ${results.length} results from API`);

  // Continue with existing result processing (remove old editMultipleImages call)
  const unusedProgressCallback = (progressInfo) => {
    // This callback is no longer used
  };

  addWorkflowStep(jobId, {
    name: 'AI Processing Complete',
    status: 'completed',
    description: `Successfully edited ${results.length} images with Nano Banana Pro`,
    details: {
      totalProcessed: results.length,
      model: 'gemini-3-pro-image-preview',
      features: ['Preserved dimensions', 'Dark gradient overlay', 'Saira font styling']
    }
  });

  const editedImages = [];
  const DEFAULT_EDITED_IMAGES_FOLDER = brandConfig.editedResultsFolderId;
  const EDITED_IMAGES_FOLDER = job.driveDestinationFolderId || DEFAULT_EDITED_IMAGES_FOLDER;

  if (job.driveDestinationFolderId) {
    console.log(`[Gemini] Using custom drive destination: ${EDITED_IMAGES_FOLDER}`);
  }
  if (job.marketplacePreset) {
    console.log(`[Gemini] Marketplace preset applied: ${job.marketplacePreset.id}`);
  }

  console.log(`Saving ${results.length} edited images to Drive (brand: ${job.brandSlug})...`);

  await updateJob(jobId, {
    processingStep: 'Saving edited images to cloud storage'
  });

  addWorkflowStep(jobId, {
    name: 'Saving Results',
    status: 'in_progress',
    description: 'Downloading and saving edited images to Google Drive',
    details: {
      destination: 'Google Drive (Corsair folder)',
      folderId: EDITED_IMAGES_FOLDER,
      code: `// Download and save each edited image\nfor (const result of apiResults) {\n  const imageBuffer = await fetch(result.url).then(r => r.arrayBuffer());\n  await uploadToDrive(imageBuffer, fileName, folderId);\n  await makeFilePublic(fileId);\n}`
    }
  });

  const saveImagePromises = results.map(async (result, i) => {
    const originalImage = job.images[i];
    const specIndex = i % job.imageSpecs.length;
    const spec = job.imageSpecs[specIndex];

    console.log(`\n[Save] Processing result ${i + 1}/${results.length} - "${spec?.title || 'N/A'}"`);

    // Validate result exists and is not an error
    if (!result) {
      console.error(`❌ [Save] Image ${i + 1} - No result returned from AI processing`);
      return null;
    }

    // Check for explicit error results from Gemini
    if (result.error) {
      console.error(`❌ [Save] Image ${i + 1} failed during AI processing: ${result.error}`);
      return null;
    }

    // Handle multiple result formats:
    // 1. Plain string (data URL from editImageUnified)
    // 2. {outputs: [...]} format
    // 3. {data: {outputs: [...]}} wrapped format
    let editedImageUrl;
    
    if (typeof result === 'string' && result.startsWith('data:')) {
      // Direct data URL string from editImageUnified
      editedImageUrl = result;
    } else {
      // Object format with outputs array
      const outputs = result.outputs || (result.data && result.data.outputs);
      
      if (!outputs || !Array.isArray(outputs) || outputs.length === 0) {
        console.error(`❌ [Save] Image ${i + 1} - Invalid or missing outputs from AI processing`);
        console.error(`   Result type: ${typeof result}`);
        if (typeof result === 'object') console.error(`   Result keys: ${Object.keys(result).join(', ')}`);
        return null;
      }
      editedImageUrl = outputs[0];
    }

    if (editedImageUrl && typeof editedImageUrl === 'string' && editedImageUrl.length > 0) {
      const imageDataSize = Math.round(editedImageUrl.length / 1024);
      console.log(`[Save] Image data received: ${imageDataSize}KB`);

      let imageBuffer;
      
      // Handle data URLs directly (Node fetch doesn't support data: protocol)
      if (editedImageUrl.startsWith('data:')) {
        const matches = editedImageUrl.match(/^data:[^;]+;base64,(.+)$/);
        if (matches && matches[1]) {
          imageBuffer = Buffer.from(matches[1], 'base64');
          console.log(`[Save] Decoded base64 data: ${Math.round(imageBuffer.length / 1024)}KB`);
        } else {
          console.error(`❌ [Save] Image ${i + 1} - Invalid data URL format`);
          return null;
        }
      } else {
        // Fetch from regular URL
        const imageResponse = await fetch(editedImageUrl);
        imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
      }

      // Check if this spec requires logo overlay(s)
      if (spec && spec.logo_requested === true && spec.logoBase64Array && spec.logoBase64Array.length > 0) {
        const logoNames = spec.logoBase64Array.map(l => l.name).join(', ');
        console.log(`[Logo] Applying ${spec.logoBase64Array.length} logo(s) to image ${i + 1}: ${logoNames}`);
        // Pass AI-analyzed logo_plan if available for intelligent positioning
        imageBuffer = await overlayMultipleLogos(imageBuffer, spec.logoBase64Array, spec.logo_plan || null);
      }

      const originalNameWithoutExt = originalImage.originalName.replace(/\.[^/.]+$/, '');
      const editedFileName = `${originalNameWithoutExt}_edited.jpg`;

      console.log(`[Drive] Uploading ${editedFileName}...`);
      const uploadedFile = await uploadFileToDrive(
        imageBuffer,
        editedFileName,
        'image/jpeg',
        EDITED_IMAGES_FOLDER
      );

      await makeFilePublic(uploadedFile.id);

      console.log(`✅ [Save] Image ${i + 1}/${results.length} saved: ${editedFileName}`);

      return {
        id: uploadedFile.id,
        name: editedFileName,
        editedImageId: uploadedFile.id,
        originalImageId: originalImage.driveId,
        originalName: originalImage.originalName,
        url: getPublicImageUrl(uploadedFile.id),
        logoApplied: spec?.logo_requested === true && spec?.logoBase64 ? true : false,
        title: spec?.title || null,
        subtitle: spec?.subtitle || null,
        logoRequested: spec?.logo_requested || false,
        logoName: spec?.logo_name || null,
        logoBase64: spec?.logoBase64 || null
      };
    } else {
      console.error(`❌ [Save] No valid image URL in result ${i + 1}`);
      return null;
    }
  });

  const savedImages = await Promise.all(saveImagePromises);
  const editedImagesResult = savedImages.filter(img => img !== null);
  editedImages.push(...editedImagesResult);

  await updateJob(jobId, {
    processingStep: `Exported ${editedImages.length} images`,
    progress: 95
  });

  addWorkflowStep(jobId, {
    name: 'Saving Complete',
    status: 'completed',
    description: `All ${editedImages.length} edited images saved successfully`,
    details: {
      totalSaved: editedImages.length,
      location: 'Google Drive - Corsair folder',
      publicAccess: true
    }
  });

  console.log(`Successfully processed ${editedImages.length} images`);
  await updateJob(jobId, {
    status: 'completed',
    editedImages,
    processingStep: 'Complete',
    progress: 100
  });

  addWorkflowStep(jobId, {
    name: 'Job Complete',
    status: 'completed',
    description: 'All processing complete - results ready',
    details: {
      totalImages: editedImages.length,
      jobId: jobId,
      completedAt: new Date().toISOString()
    }
  });

  const finalJob = await getJob(jobId);
  archiveBatchToStorage(jobId, {
    ...finalJob,
    editedImages
  }).catch(err => {
    console.error('[History Archive] Non-blocking archive error:', err.message);
  });
}

/**
 * Upload Structured Brief - handles the structured form submission
 * Users fill out a form with image specs directly (no PDF parsing needed)
 */
export async function uploadStructuredBrief(req, res) {
  try {
    console.log('[Structured Brief] Starting upload...');
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No images uploaded' });
    }
    
    // Parse imageSpecs from JSON
    let imageSpecs;
    try {
      imageSpecs = JSON.parse(req.body.imageSpecs);
    } catch (parseError) {
      return res.status(400).json({ error: 'Invalid image specifications format' });
    }
    
    const projectName = sanitizeInput(req.body.projectName) || 'Untitled Project';
    
    // Validate the submission
    const validation = validateStructuredBrief(imageSpecs, req.files);
    if (!validation.valid) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validation.errors.join('; ')
      });
    }
    
    console.log(`[Structured Brief] Validated ${req.files.length} images with specs`);
    
    // Upload images to Google Drive
    const uploadedImages = [];
    
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const spec = imageSpecs[i];
      
      const result = await uploadFileToDrive(
        file.buffer,
        file.originalname,
        file.mimetype,
        req.brand.productImagesFolderId
      );
      
      console.log(`[Structured Brief] Uploaded ${file.originalname} to Drive`);
      await makeFilePublic(result.id);
      const publicUrl = getPublicImageUrl(result.id);
      
      uploadedImages.push({
        id: result.id,
        name: file.originalname,
        originalName: file.originalname,
        driveId: result.id,
        publicUrl: publicUrl
      });
    }
    
    // Generate prompts for each image (use custom or default)
    // Ensure all fields expected by processImagesWithGemini are present
    const processedSpecs = imageSpecs.map((spec, i) => {
      const sanitizedTitle = sanitizeInput(spec.title);
      const sanitizedSubtitle = sanitizeInput(spec.subtitle);
      
      // Use custom prompt if provided and not using default, otherwise generate
      const aiPrompt = !spec.useDefaultPrompt && spec.customPrompt
        ? sanitizeInput(spec.customPrompt)
        : generateDefaultPrompt(sanitizedTitle, sanitizedSubtitle);
      
      // Get the first logo name for compatibility with existing processImagesWithGemini
      const logoNamesArray = Array.isArray(spec.logoNames) ? spec.logoNames.filter(n => n && n.trim()) : [];
      const primaryLogoName = logoNamesArray.length > 0 ? logoNamesArray[0] : '';
      // Only set logo_requested to true if we actually have a valid logo name
      const hasValidLogo = primaryLogoName.length > 0;
      
      return {
        image_number: i + 1,
        title: sanitizedTitle,
        subtitle: sanitizedSubtitle,
        asset: sanitizeInput(spec.asset || ''),
        variant: sanitizeInput(spec.variant || null),
        ai_prompt: aiPrompt,
        logo_requested: hasValidLogo,
        logo_name: primaryLogoName,
        logo_names: logoNamesArray,
        customPromptUsed: !spec.useDefaultPrompt && !!spec.customPrompt
      };
    });
    
    // Generate a structured promptText for downstream services (bounded, JSON-serialized)
    const promptSummary = processedSpecs.map((spec, i) => ({
      imageIndex: i + 1,
      title: spec.title,
      subtitle: spec.subtitle
    }));
    const combinedPromptText = JSON.stringify(promptSummary);
    
    // Create job
    const jobId = `job_${Date.now()}`;
    const startTime = new Date();
    
    // Build submission metadata (includes full prompt details)
    const submissionMetadata = {
      method: 'structured_form',
      projectName: projectName,
      hasCustomPrompts: processedSpecs.some(s => s.customPromptUsed),
      hasVariants: processedSpecs.some(s => s.variant),
      hasAssetNames: processedSpecs.some(s => s.asset),
      imageCount: uploadedImages.length,
      promptDetails: processedSpecs.map((s, i) => ({
        imageIndex: i + 1,
        title: s.title,
        promptPreview: s.ai_prompt.substring(0, 200) + '...'
      }))
    };
    
    await createJob({
      id: jobId,
      brandId: req.brand.id,
      brandSlug: req.brand.slug,
      briefFileId: null,
      briefType: 'structured_form',
      projectName: projectName,
      promptText: combinedPromptText,
      submissionMetadata: submissionMetadata,
      imageSpecs: processedSpecs,
      images: uploadedImages,
      status: 'processing',
      createdAt: startTime,
      startTime: startTime,
      imageCount: uploadedImages.length
    });
    
    console.log(`[Structured Brief] Job created: ${jobId}`);
    
    res.json({
      success: true,
      jobId,
      imageCount: uploadedImages.length,
      projectName: projectName,
      message: `Structured brief created with ${uploadedImages.length} images. Processing started.`
    });
    
    // Start processing in the background
    processImagesWithGemini(jobId).catch(async err => {
      console.error('[Structured Brief] Background processing error:', err);
      await updateJob(jobId, { 
        status: 'failed',
        error: err.message
      });
    });
    
  } catch (error) {
    console.error('[Structured Brief] Error:', error);
    res.status(500).json({ error: 'Failed to process structured brief', details: error.message });
  }
}

/**
 * Upload PDF with separate Images
 * Users upload a PDF brief and separate high-res images
 */
export async function uploadPDFWithImages(req, res) {
  try {
    console.log('[PDF+Images] Starting upload...');
    
    // Check for PDF file
    if (!req.files.pdf || req.files.pdf.length === 0) {
      return res.status(400).json({ error: 'PDF file is required' });
    }
    
    // Check for images
    if (!req.files.images || req.files.images.length === 0) {
      return res.status(400).json({ error: 'At least one image is required' });
    }
    
    const pdfFile = req.files.pdf[0];
    const imageFiles = req.files.images;
    
    console.log(`[PDF+Images] PDF: ${pdfFile.originalname}, Images: ${imageFiles.length}`);
    
    // Validate files
    const validation = validatePDFWithImages(pdfFile, imageFiles);
    if (!validation.valid) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validation.errors.join('; ')
      });
    }
    
    // Upload PDF to Drive
    const pdfResult = await uploadFileToDrive(
      pdfFile.buffer,
      pdfFile.originalname,
      pdfFile.mimetype,
      req.brand.briefFolderId
    );
    console.log(`[PDF+Images] PDF uploaded to Drive: ${pdfResult.id}`);
    
    // Extract specs from PDF using existing logic
    let imageSpecs = [];
    try {
      const loadingTask = pdfjsLib.getDocument({ data: pdfFile.buffer });
      const pdfDocument = await loadingTask.promise;
      
      let pdfText = '';
      for (let i = 1; i <= pdfDocument.numPages; i++) {
        const page = await pdfDocument.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        pdfText += pageText + '\n';
      }
      
      // Simple extraction logic - look for Title/Subtitle patterns
      const lines = pdfText.split('\n').filter(line => line.trim());
      const extractedSpecs = [];
      let specIndex = 0;
      
      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i].trim();
        const nextLine = lines[i + 1]?.trim();
        
        // Basic heuristic: short line followed by longer line could be title/subtitle
        if (line.length > 0 && line.length < 60 && nextLine && nextLine.length > line.length) {
          specIndex++;
          extractedSpecs.push({
            image_number: specIndex,
            title: line,
            subtitle: nextLine,
            asset: '',
            variant: null,
            ai_prompt: generateDefaultPrompt(line, nextLine),
            logo_requested: false,
            logo_name: '',
            logo_names: []
          });
          i++; // Skip next line since we used it as subtitle
        }
      }
      
      // If we couldn't extract structured specs, create one per image
      if (extractedSpecs.length === 0) {
        for (let i = 0; i < imageFiles.length; i++) {
          const title = `Image ${i + 1}`;
          const subtitle = 'Enhance this image with professional styling';
          extractedSpecs.push({
            image_number: i + 1,
            title: title,
            subtitle: subtitle,
            asset: '',
            variant: null,
            ai_prompt: generateDefaultPrompt(title, subtitle),
            logo_requested: false,
            logo_name: '',
            logo_names: []
          });
        }
      }
      
      imageSpecs = extractedSpecs;
      console.log(`[PDF+Images] Extracted ${imageSpecs.length} specs from PDF`);
      
    } catch (pdfError) {
      console.error('[PDF+Images] PDF extraction error:', pdfError);
      // Create default specs for each image
      for (let i = 0; i < imageFiles.length; i++) {
        const title = `Image ${i + 1}`;
        const subtitle = 'Enhance this image with professional styling';
        imageSpecs.push({
          image_number: i + 1,
          title: title,
          subtitle: subtitle,
          asset: '',
          variant: null,
          ai_prompt: generateDefaultPrompt(title, subtitle),
          logo_requested: false,
          logo_name: '',
          logo_names: []
        });
      }
    }
    
    // Upload images to Drive
    const uploadedImages = [];
    
    for (const file of imageFiles) {
      const result = await uploadFileToDrive(
        file.buffer,
        file.originalname,
        file.mimetype,
        req.brand.productImagesFolderId
      );
      
      console.log(`[PDF+Images] Uploaded ${file.originalname} to Drive`);
      await makeFilePublic(result.id);
      const publicUrl = getPublicImageUrl(result.id);
      
      uploadedImages.push({
        id: result.id,
        name: file.originalname,
        originalName: file.originalname,
        driveId: result.id,
        publicUrl: publicUrl
      });
    }
    
    // Create job
    const jobId = `job_${Date.now()}`;
    const startTime = new Date();
    
    // Generate a structured promptText for downstream services (bounded, JSON-serialized)
    const promptSummary = imageSpecs.map((spec, i) => ({
      imageIndex: i + 1,
      title: spec.title,
      subtitle: spec.subtitle
    }));
    const combinedPromptText = JSON.stringify(promptSummary);
    
    // Build submission metadata (includes full prompt details)
    const submissionMetadata = {
      method: 'pdf_with_images',
      pdfFileName: pdfFile.originalname,
      matchingStrategy: 'order_based',
      extractedSpecCount: imageSpecs.length,
      imageCount: uploadedImages.length,
      promptDetails: imageSpecs.map((s, i) => ({
        imageIndex: i + 1,
        title: s.title,
        promptPreview: s.ai_prompt.substring(0, 200) + '...'
      }))
    };
    
    await createJob({
      id: jobId,
      brandId: req.brand.id,
      brandSlug: req.brand.slug,
      briefFileId: pdfResult.id,
      briefType: 'pdf_with_images',
      promptText: combinedPromptText,
      submissionMetadata: submissionMetadata,
      imageSpecs: imageSpecs,
      images: uploadedImages,
      status: 'processing',
      createdAt: startTime,
      startTime: startTime,
      imageCount: uploadedImages.length
    });
    
    console.log(`[PDF+Images] Job created: ${jobId}`);
    
    res.json({
      success: true,
      jobId,
      pdfFileId: pdfResult.id,
      pdfFileName: pdfFile.originalname,
      imageCount: uploadedImages.length,
      extractedSpecs: imageSpecs.length,
      message: `PDF brief uploaded with ${uploadedImages.length} separate images. Processing started.`
    });
    
    // Start processing in the background
    processImagesWithGemini(jobId).catch(async err => {
      console.error('[PDF+Images] Background processing error:', err);
      await updateJob(jobId, { 
        status: 'failed',
        error: err.message
      });
    });
    
  } catch (error) {
    console.error('[PDF+Images] Error:', error);
    res.status(500).json({ error: 'Failed to process PDF with images', details: error.message });
  }
}

export async function uploadTextPrompt(req, res) {
  try {
    const { prompt, marketplacePreset, driveDestinationFolderId } = req.body;

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const jobId = `job_${Date.now()}`;
    const fileName = `prompt-${Date.now()}.txt`;

    const promptBuffer = Buffer.from(prompt, 'utf-8');

    const result = await uploadFileToDrive(
      promptBuffer,
      fileName,
      'text/plain',
      req.brand.briefFolderId
    );

    if (marketplacePreset) {
      console.log('[Text Prompt] Marketplace preset:', marketplacePreset.id);
    }
    if (driveDestinationFolderId) {
      console.log('[Text Prompt] Custom drive destination:', driveDestinationFolderId);
    }

    const startTime = new Date();
    await createJob({
      id: jobId,
      brandId: req.brand.id,
      brandSlug: req.brand.slug,
      promptId: result.id,
      promptText: prompt,
      images: [],
      status: 'prompt_uploaded',
      createdAt: startTime,
      startTime: startTime,
      imageCount: 0,
      marketplacePreset: marketplacePreset || null,
      driveDestinationFolderId: driveDestinationFolderId || null
    });

    res.json({
      success: true,
      jobId,
      fileId: result.id,
      fileName: result.name,
      message: 'Prompt uploaded successfully'
    });
  } catch (error) {
    console.error('Prompt upload error:', error);
    res.status(500).json({ error: 'Failed to upload prompt', details: error.message });
  }
}

export async function getJobInfo(req, res) {
  const { jobId } = req.params;
  const job = await getJob(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  res.json(job);
}