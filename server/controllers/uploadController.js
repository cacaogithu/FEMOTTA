import { uploadFileToDrive, makeFilePublic, getPublicImageUrl } from '../utils/googleDrive.js';
import { createJob, getJob, updateJob, addWorkflowStep } from '../utils/jobStore.js';
import { editMultipleImages, editImageWithNanoBanana } from '../services/nanoBanana.js';
import { shouldUseImprovedPrompt } from '../services/mlLearning.js';
import { Readable } from 'stream';
import fetch from 'node-fetch';
import OpenAI from 'openai';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import mammoth from 'mammoth';

const PDF_FOLDER_ID = '1oBX3lAfZQq9gt4fMhBe7JBh7aKo-k697';
const IMAGES_FOLDER_ID = '1_WUvTwPrw8DNpns9wB36cxQ13RamCvAS';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function extractPromptFromDOCX(docxBuffer) {
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
          content: `You are an AI creative assistant specialized in extracting marketing image specifications from briefs.

Your task is to read the provided document brief and extract ALL image specifications into structured JSON format.

CRITICAL INSTRUCTIONS:
1. Extract EVERY image variant mentioned in the brief (IMAGE 1: METAL DARK, IMAGE 1: WOOD DARK, IMAGE 2: METAL DARK, etc.)
2. If a brief mentions BOTH "Metal Dark" AND "Wood Dark" variants, create SEPARATE specifications for EACH variant
3. Create one JSON object per variant, even if they share the same image number
4. The total number of specifications should match the total number of product variant images described

For each image specification, extract:
- image_number: The sequential number from the brief (1, 2, 3, etc.)
- variant: The variant name if specified (e.g., "METAL DARK", "WOOD DARK", or null if not applicable)
- title: The HEADLINE text (convert to uppercase)
- subtitle: The COPY text (keep as written)
- asset: The ASSET filename (if mentioned)

For the ai_prompt field, generate a plain text instruction (no markdown, no line breaks) using this template:

"Add a VERY SUBTLE dark gradient overlay ONLY at the top 20-25% of the image, fading from semi-transparent dark gray (30-40% opacity) to fully transparent. Keep the gradient extremely light to preserve all original image details, colors, and textures - the product and background must remain clearly visible and unchanged. The gradient should only provide a subtle backdrop for text readability. Place the following text at the top portion: {title} in white Montserrat Extra Bold font (all caps, approximately 44-56px, adjust size based on image dimensions). Below the title, add {subtitle} in white Montserrat Regular font (approximately 16-22px). Apply a very subtle drop shadow to text only (1-2px offset, 20-30% opacity black) for readability. CRITICAL: Preserve ALL original image details, sharpness, colors, and product features - this should look like a minimal, professional overlay, not heavy editing. Output as high-resolution image."

Replace {title} and {subtitle} with the actual extracted values for EACH image variant.

Return ONLY a valid JSON array with ALL image variant specifications, no additional text.

Example for document with variants:
[
  {
    "image_number": 1,
    "variant": "METAL DARK",
    "title": "CORSAIR ONE I600",
    "subtitle": "A Compact PC...",
    "asset": "CORSAIR_ONE_i600_DARK_METAL_12",
    "ai_prompt": "Add a dark gradient overlay..."
  },
  {
    "image_number": 1,
    "variant": "WOOD DARK",
    "title": "CORSAIR ONE I600",
    "subtitle": "A Compact PC...",
    "asset": "CORSAIR_ONE_i600_WOOD_DARK_PHOTO_17",
    "ai_prompt": "Add a dark gradient overlay..."
  },
  {
    "image_number": 2,
    "variant": "METAL DARK",
    "title": "DUAL 240MM LIQUID COOLING",
    "subtitle": "Modern liquid cooling...",
    "asset": "CORSAIR_ONE_i600_DARK_METAL_17",
    "ai_prompt": "Add a dark gradient overlay..."
  }
]`
        },
        {
          role: 'user',
          content: `Extract ALL image specifications from this document brief. 

IMPORTANT: If the brief describes multiple variants (like "Metal Dark" and "Wood Dark") for the same image number, create SEPARATE specifications for EACH variant. Count all variants to ensure the specification count matches the number of product images described.

Document Content:
${docxText}`
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
    jsonText = jsonText.replace(/^```json\s*/im, '');
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

    // Filter out logos and non-product images
    // Strategy: Remove small images (logos are typically smaller) and only keep images needed for specs
    const MIN_IMAGE_SIZE = 50000; // 50KB minimum - logos are usually much smaller
    
    // First, filter by size to remove obvious logos/icons
    const productImages = extractedImages.filter(img => img.buffer.length >= MIN_IMAGE_SIZE);
    console.log(`[DOCX Extraction] After size filtering (>=${MIN_IMAGE_SIZE} bytes): ${productImages.length} images`);
    
    // Second, only take the number of images we need for the specs
    const imagesToProcess = productImages.slice(0, imageSpecs.length);
    
    console.log(`[DOCX Extraction] Final image count: ${imagesToProcess.length} (matching ${imageSpecs.length} specs)`);
    
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

async function extractPromptFromPDF(pdfBuffer) {
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

For the ai_prompt field, generate a plain text instruction (no markdown, no line breaks) using this template:

"Add a VERY SUBTLE dark gradient overlay ONLY at the top 20-25% of the image, fading from semi-transparent dark gray (30-40% opacity) to fully transparent. Keep the gradient extremely light to preserve all original image details, colors, and textures - the product and background must remain clearly visible and unchanged. The gradient should only provide a subtle backdrop for text readability. Place the following text at the top portion: {title} in white Montserrat Extra Bold font (all caps, approximately 44-56px, adjust size based on image dimensions). Below the title, add {subtitle} in white Montserrat Regular font (approximately 16-22px). Apply a very subtle drop shadow to text only (1-2px offset, 20-30% opacity black) for readability. CRITICAL: Preserve ALL original image details, sharpness, colors, and product features - this should look like a minimal, professional overlay, not heavy editing. Output as high-resolution image."

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
      PDF_FOLDER_ID
    );
    console.log('[Upload Brief] Uploaded to Drive, ID:', result.id);

    console.log(`[Upload Brief] Extracting image specifications from ${fileType.toUpperCase()}...`);
    let imageSpecs, extractedImages;

    if (isPDF) {
      imageSpecs = await extractPromptFromPDF(req.file.buffer);
      extractedImages = [];
    } else {
      const docxResult = await extractPromptFromDOCX(req.file.buffer);
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
          IMAGES_FOLDER_ID
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
    createJob({
      id: jobId,
      pdfId: result.id,
      pdfName: result.name,
      imageSpecs: imageSpecs,
      images: uploadedImages,
      status: uploadedImages.length > 0 ? 'processing' : 'pdf_uploaded',
      createdAt: startTime,
      startTime: startTime,
      imageCount: uploadedImages.length
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
      processImagesWithNanoBanana(jobId).catch(err => {
        console.error('Background processing error:', err);
        updateJob(jobId, { 
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
        IMAGES_FOLDER_ID
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

    updateJob(jobId, {
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

    processImagesWithNanoBanana(jobId).catch(err => {
      console.error('Background processing error:', err);
      updateJob(jobId, { 
        status: 'failed',
        error: err.message
      });
    });

  } catch (error) {
    console.error('Images upload error:', error);
    res.status(500).json({ error: 'Failed to upload images', details: error.message });
  }
}

async function processImagesWithNanoBanana(jobId) {
  const job = getJob(jobId);

  if (!job) {
    throw new Error('Job not found');
  }

  console.log(`Processing job ${jobId} - Images count: ${job.images?.length || 0}`);

  if (!job.imageSpecs || job.imageSpecs.length === 0) {
    console.error('No image specifications found for job:', jobId);
    updateJob(jobId, { 
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

  // Match images to specifications
  // If we have more images than specs, intelligently cycle through specs
  // This handles cases like logo images or product variant images
  const imagePrompts = job.images.map((img, idx) => {
    // Use modulo to cycle through specs if we have more images than specs
    const specIndex = idx % job.imageSpecs.length;
    const spec = job.imageSpecs[specIndex];
    console.log(`Image ${idx + 1}: ${img.originalName} -> "${spec?.title || 'FALLBACK'}" (spec ${specIndex + 1}/${job.imageSpecs.length})`);
    return spec?.ai_prompt || job.imageSpecs[0].ai_prompt;
  });

  console.log(`[Matching Strategy] ${job.images.length} images mapped to ${job.imageSpecs.length} specifications using ${job.images.length > job.imageSpecs.length ? 'cyclic' : 'direct'} matching`);

  addWorkflowStep(jobId, {
    name: 'Prepare Processing',
    status: 'completed',
    description: 'Preparing images with individual prompts for each image',
    details: {
      imageCount: job.images.length,
      specsCount: job.imageSpecs.length,
      matchingStrategy: job.images.length > job.imageSpecs.length ? 'cyclic (images > specs)' : 'direct (1:1)',
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

  updateJob(jobId, { 
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
      api: 'Wavespeed Nano Banana',
      endpoint: '/api/v3/google/nano-banana/edit',
      parameters: {
        enable_sync_mode: true,
        output_format: 'jpeg',
        num_images: 1,
        batch_size: 5
      }
    }
  });

  const imageUrls = job.images.map(img => img.publicUrl);
  console.log('Image URLs to process:', imageUrls);

  updateJob(jobId, { 
    status: 'processing',
    processingStep: 'Editing images with AI (individual prompts per image)'
  });

  addWorkflowStep(jobId, {
    name: 'AI Processing Started',
    status: 'in_progress',
    description: `Processing ${imageUrls.length} images with unique prompts`,
    details: {
      totalImages: imageUrls.length,
      batchSize: 5,
      uniquePrompts: true,
      code: `// Each image processed with its own prompt\nconst batchSize = 5;\nfor (let i = 0; i < images.length; i += batchSize) {\n  const batch = images.slice(i, i + batchSize);\n  const results = await Promise.all(\n    batch.map((img, idx) => editWithAI(img, prompts[i + idx]))\n  );\n}`
    }
  });

  console.log('Calling Nano Banana API with individual prompts per image...');

  // Process images with their individual prompts
  const results = [];
  const batchSize = 5;

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
      const specTitle = job.imageSpecs[specIndex]?.title || 'N/A';
      console.log(`  Image ${imageIndex + 1}: Using prompt for "${specTitle}"`);

      return editImageWithNanoBanana(url, prompt, {
        enableSyncMode: true,
        outputFormat: 'jpeg',
        numImages: 1
      }).then(result => {
        updateJob(jobId, {
          processingStep: `AI editing: ${imageIndex + 1} of ${imageUrls.length} images`,
          progress: Math.round(((imageIndex + 1) / imageUrls.length) * 100),
          currentImageIndex: imageIndex
        });
        return result;
      });
    });

    const batchResults = await Promise.all(batchPromises);
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
      apiResponse: 'Received edited images from Wavespeed API'
    }
  });

  const editedImages = [];
  const EDITED_IMAGES_FOLDER = '17NE_igWpmMIbyB9H7G8DZ8ZVdzNBMHoB';

  console.log(`Saving ${results.length} edited images to Drive...`);

  updateJob(jobId, { 
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

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const originalImage = job.images[i];

    console.log(`Processing result ${i + 1}/${results.length}:`, result);

    if (result.data && result.data.outputs && result.data.outputs.length > 0) {
      const editedImageUrl = result.data.outputs[0];
      console.log(`Downloading edited image from: ${editedImageUrl}`);

      const imageResponse = await fetch(editedImageUrl);
      const imageBuffer = await imageResponse.arrayBuffer();

      const originalNameWithoutExt = originalImage.originalName.replace(/\.[^/.]+$/, '');
      const editedFileName = `${originalNameWithoutExt}_edited.jpg`;

      console.log(`Uploading ${editedFileName} to Drive...`);
      const uploadedFile = await uploadFileToDrive(
        Buffer.from(imageBuffer),
        editedFileName,
        'image/jpeg',
        EDITED_IMAGES_FOLDER
      );

      await makeFilePublic(uploadedFile.id);

      editedImages.push({
        id: uploadedFile.id,
        name: editedFileName,
        editedImageId: uploadedFile.id,
        originalImageId: originalImage.driveId,
        originalName: originalImage.originalName,
        url: getPublicImageUrl(uploadedFile.id)
      });
      console.log(`Saved edited image ${i + 1}/${results.length}: ${editedFileName}`);

      updateJob(jobId, {
        processingStep: `Saved ${i + 1} of ${results.length} images`,
        progress: Math.round(((i + 1) / results.length) * 100)
      });
    } else {
      console.error(`No edited image in result ${i + 1} - Missing data.outputs`);
    }
  }

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
  updateJob(jobId, { 
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
}

export async function uploadTextPrompt(req, res) {
  try {
    const { prompt } = req.body;

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
      PDF_FOLDER_ID
    );

    const startTime = new Date();
    createJob({
      id: jobId,
      promptId: result.id,
      promptText: prompt,
      images: [],
      status: 'prompt_uploaded',
      createdAt: startTime,
      startTime: startTime,
      imageCount: 0
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