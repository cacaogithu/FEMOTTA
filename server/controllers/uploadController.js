import { uploadFileToDrive, makeFilePublic, getPublicImageUrl } from '../utils/googleDrive.js';
import { createJob, getJob, updateJob, addWorkflowStep } from '../utils/jobStore.js';
import { archiveBatchToStorage } from '../services/historyService.js';
import { editMultipleImagesWithGemini, analyzeImageForParameters } from '../services/geminiImage.js';
import { shouldUseImprovedPrompt } from '../services/mlLearning.js';
import { getBrandApiKeys } from '../utils/brandLoader.js';
import { getCompleteOverlayGuidelines } from '../services/sairaReference.js';
import { generateAdaptivePrompt } from '../services/promptTemplates.js';
import { Readable } from 'stream';
import fetch from 'node-fetch';
import OpenAI from 'openai';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import mammoth from 'mammoth';
import sharp from 'sharp';

async function editImageUnified(imageUrl, prompt, options = {}) {
  // Inject curated Saira typography and image preservation guidelines
  const sairaGuidelines = getCompleteOverlayGuidelines();
  const enhancedPrompt = `${sairaGuidelines}\n\nSPECIFIC IMAGE INSTRUCTIONS:\n${prompt}`;

  try {
    const result = await editMultipleImagesWithGemini([imageUrl], enhancedPrompt, {
      geminiApiKey: options.geminiApiKey,
      retries: 3,
      imageIndex: options.imageIndex || 0
    });

    return result[0];
  } catch (error) {
    console.error('[GEMINI] ❌ Edit failed:', error.message);
    throw error;
  }
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

    // Resize logo to be proportional (max 15% of image width)
    const maxLogoWidth = Math.floor(width * 0.15);
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

// Helper to get brand-specific OpenAI client
function getBrandOpenAI(brand) {
  return new OpenAI({
    apiKey: brand.openaiApiKey || process.env.OPENAI_API_KEY
  });
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

    // Extract images from DOCX using mammoth's convertImage callback
    const extractedImages = [];

    console.log('[DOCX Extraction] Converting DOCX to HTML to extract images...');

    // Convert DOCX to HTML with custom image handler to capture embedded images
    const result = await mammoth.convertToHtml({
      buffer: docxBuffer
    }, {
      convertImage: mammoth.images.imgElement(function(image) {
        // image.read() returns a Promise that resolves to the image buffer
        return image.read("base64").then(function(imageBuffer) {
          // Convert base64 string to Buffer
          const buffer = Buffer.from(imageBuffer, 'base64');

          console.log('[DOCX Extraction] Found embedded image:', buffer.length, 'bytes, type:', image.contentType);

          // Store the image for later upload to Drive
          extractedImages.push({
            buffer: buffer,
            contentType: image.contentType
          });

          // Return the image as a data URI for the HTML output
          return {
            src: "data:" + image.contentType + ";base64," + imageBuffer
          };
        });
      })
    });

    console.log('[DOCX Extraction] HTML conversion complete');
    console.log('[DOCX Extraction] Found', extractedImages.length, 'embedded images');

    if (!docxText || docxText.trim().length < 10) {
      throw new Error('Could not extract text from DOCX - file may be empty or corrupted');
    }

    console.log('[DOCX Extraction] Sending to OpenAI to extract image specifications...');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an AI creative assistant specialized in extracting marketing image specifications from document briefs.

Your task is to carefully READ the document layout and extract ALL image specifications into structured JSON format.

CRITICAL INSTRUCTIONS:
1. Extract EVERY image variant mentioned in the brief(IMAGE 1: METAL DARK, IMAGE 1: WOOD DARK, IMAGE 2: METAL DARK, etc.)
2. If a brief mentions BOTH "Metal Dark" AND "Wood Dark" variants, create SEPARATE specifications for EACH variant
3. Create one JSON object per variant, even if they share the same image number
4. The total number of specifications should match the total number of product variant images described

TITLE AND SUBTITLE EXTRACTION RULES:
- ANALYZE the visual/textual layout of each image specification in the document
- TITLE: Extract the main HEADLINE text - usually larger, bold, or emphasized text at the top of each spec
- SUBTITLE: Extract the descriptive COPY text - usually smaller text below the headline
- Extract titles and subtitles EXACTLY as written in the document
- DO NOT add variant names (like "- METAL DARK") to titles unless they are already part of the written title in the document
- DO NOT invent or modify titles - read what is actually written
- If no subtitle exists, use empty string ""

For each image specification, extract:
- image_number: The sequential number from the brief (1, 2, 3, etc.)
- variant: The variant name if specified (e.g., "METAL DARK", "WOOD DARK", or null if not applicable)
- title: The HEADLINE text EXACTLY as written (convert to uppercase). Do NOT append variant names unless already in the document.
- subtitle: The COPY text EXACTLY as written (keep original case). IMPORTANT: If a logo annotation like "(Logo)" appears, extract the subtitle WITHOUT the "(Logo)" text - the logo will be overlaid separately.
- asset: The ASSET filename (if mentioned)
- logo_requested: true/false - Set to true if the specification explicitly requests a brand logo overlay (look for phrases like "(Logo)", "Intel Logo", "AMD Logo", "NVIDIA Logo", "add logo", etc.)
- logo_name: If logo_requested is true, extract the brand/logo name (e.g., "Intel Core", "AMD Ryzen", "NVIDIA GeForce"). Set to null if no logo requested.

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

Example for document with variants and logo requests:
[
  {
    "image_number": 1,
    "variant": "METAL DARK",
    "title": "CORSAIR ONE I600",
    "subtitle": "Premium Small Form Factor Gaming PC",
    "asset": "CORSAIR_ONE_i600_DARK_METAL_RENDER_01",
    "logo_requested": false,
    "logo_name": null,
    "ai_prompt": "Add a dark gradient overlay..."
  },
  {
    "image_number": 2,
    "variant": null,
    "title": "INTEL CORE",
    "subtitle": "Intel Core Ultra 9 processor",
    "asset": "PC_INTERIOR_SHOT_01",
    "logo_requested": true,
    "logo_name": "Intel Core",
    "ai_prompt": "Add a dark gradient overlay..."
  },
  {
    "image_number": 3,
    "variant": null,
    "title": "AMD RYZEN",
    "subtitle": "AMD Ryzen 9000-series processor",
    "asset": "PC_AMD_VARIANT_01",
    "logo_requested": true,
    "logo_name": "AMD Ryzen",
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
console.log('[DOCX Extraction] Extracted', extractedImages.length, 'embedded images');

    // Separate logos from product images based on size
    // Logos are typically smaller (under 50KB), product images are larger
    const LOGO_SIZE_THRESHOLD = 50000; // 50KB threshold

    const logoImages = [];
    const productImages = [];

    for (const img of extractedImages) {
      if (img.buffer.length < LOGO_SIZE_THRESHOLD) {
        // Convert logo to base64 for later use
        const base64Data = img.buffer.toString('base64');
        logoImages.push({
          buffer: img.buffer,
          contentType: img.contentType,
          base64: `data:${img.contentType};base64,${base64Data}`,
          size: img.buffer.length
        });
        console.log(`[DOCX Extraction] Detected logo image: ${img.buffer.length} bytes`);
      } else {
        productImages.push(img);
      }
    }

    console.log(`[DOCX Extraction] Separated: ${productImages.length} product images, ${logoImages.length} logo images`);

    // Only take the number of product images we need for the specs
    const imagesToProcess = productImages.slice(0, imageSpecs.length);

    console.log(`[DOCX Extraction] Final image count: ${imagesToProcess.length} (matching ${imageSpecs.length} specs)`);

    if (imagesToProcess.length < imageSpecs.length) {
      console.warn(`[DOCX Extraction] Warning: Found ${imagesToProcess.length} product images but need ${imageSpecs.length}. Some specs may not have matching images.`);
    }

    // Attach logos to specs that request them (using AI-extracted logo_requested field)
    if (logoImages.length > 0) {
      let logoIndex = 0;
      for (const spec of imageSpecs) {
        // Check if this spec explicitly requested a logo (from AI extraction)
        if (spec.logo_requested === true) {
          // Assign logos in order - if multiple logos available, try to match by index
          const logoToUse = logoImages[Math.min(logoIndex, logoImages.length - 1)];
          spec.logoBase64 = logoToUse.base64;
          spec.logoContentType = logoToUse.contentType;
          console.log(`[DOCX Extraction] Attached logo to spec: "${spec.title}" (logo: ${spec.logo_name || 'unknown'})`);
          logoIndex++;
        }
      }
      console.log(`[DOCX Extraction] Attached logos to ${logoIndex} image specifications`);
    } else {
      // Check for logo requests without available logo images
      const specsNeedingLogos = imageSpecs.filter(s => s.logo_requested === true);
      if (specsNeedingLogos.length > 0) {
        console.warn(`[DOCX Extraction] Warning: ${specsNeedingLogos.length} specs request logos but no logo images found in document`);
      }
    }

    return {
      imageSpecs,
      extractedImages: imagesToProcess,
      logoImages: logoImages
    };

if (imagesToProcess.length < imageSpecs.length) {
  console.warn(`[DOCX Extraction] Warning: Found ${imagesToProcess.length} product images but need ${imageSpecs.length}. Some specs may not have matching images.`);
}

if (extractedImages.length > imagesToProcess.length) {
  console.log(`[DOCX Extraction] Filtered out ${extractedImages.length - imagesToProcess.length} images (likely logos/icons)`);
}

return {
  imageSpecs,
  extractedImages: imagesToProcess
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

    createJob({
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

    console.log('[Upload Brief] Job created:', jobId);

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

    const job = getJob(jobId);
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
  const job = getJob(jobId);

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

  console.log('Image URLs to process:', imageUrls);

  await updateJob(jobId, {
    status: 'processing',
    processingStep: 'Editing images with AI (individual prompts per image)'
  });

  addWorkflowStep(jobId, {
    name: 'AI Processing Started',
    status: 'in_progress',
    description: `Processing ${imageUrls.length} images with unique prompts`,
    details: {
      totalImages: imageUrls.length,
      batchSize: 15,
      uniquePrompts: true,
      code: `// Each image processed with its own prompt\nconst batchSize = 15;\nfor (let i = 0; i < images.length; i += batchSize) {\n  const batch = images.slice(i, i + batchSize);\n  const results = await Promise.all(\n    batch.map((img, idx) => editWithAI(img, prompts[i + idx]))\n  );\n}`
    }
  });

  console.log('Calling Gemini API with individual prompts per image...');

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
        console.log(`[Batch ${batchNumber}] First result structure:`, JSON.stringify(batchResults[0], null, 2).substring(0, 500));
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
    description: `Successfully edited ${results.length} images`,
    details: {
      totalProcessed: results.length,
      apiResponse: 'Received edited images from Gemini API'
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

    // Handle both formats: result.outputs (direct API response) or result.data.outputs (wrapped)
    const outputs = result.outputs || (result.data && result.data.outputs);

    // Validate outputs exist and have content - reject malformed success responses
    if (!outputs || !Array.isArray(outputs) || outputs.length === 0) {
      console.error(`❌ [Save] Image ${i + 1} - Invalid or missing outputs from AI processing`);
      console.error(`   Result keys: ${Object.keys(result).join(', ')}`);
      if (result.data) console.error(`   Data keys: ${Object.keys(result.data).join(', ')}`);
      return null;
    }

    if (outputs[0] && typeof outputs[0] === 'string' && outputs[0].length > 0) {
      const editedImageUrl = outputs[0];
      const imageDataSize = Math.round(editedImageUrl.length / 1024);
      console.log(`[Save] Image data received: ${imageDataSize}KB`);

      const imageResponse = await fetch(editedImageUrl);
      let imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

      // Check if this spec requires a logo overlay
      if (spec && spec.logoBase64 && spec.logo_requested === true) {
        console.log(`[Logo] Applying ${spec.logo_name || 'brand'} logo to image ${i + 1}`);
        imageBuffer = await overlayLogoOnImage(imageBuffer, spec.logoBase64, 'bottom-left');
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
        logoApplied: spec?.logo_requested === true && spec?.logoBase64 ? true : false
      };
    } else {
      console.error(`❌ [Save] No edited image in result ${i + 1} - Missing outputs`);
      console.error(`   Available keys:`, Object.keys(result || {}));
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

  const finalJob = getJob(jobId);
  archiveBatchToStorage(jobId, {
    ...finalJob,
    editedImages
  }).catch(err => {
    console.error('[History Archive] Non-blocking archive error:', err.message);
  });
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
    createJob({
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

export function getJobInfo(req, res) {
  const { jobId } = req.params;
  const job = getJob(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  res.json(job);
}