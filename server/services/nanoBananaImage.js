import fetch from 'node-fetch';
import { NanoBananaProService } from './nanoBananaService.js';
import { GeminiService } from './geminiService.js';
import { generateAdaptivePrompt, generateImageAnalysisPrompt } from './promptTemplates.js';

const DEFAULT_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image-preview';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

/**
 * Analyze a single image to determine optimal overlay parameters
 * Uses Gemini Flash for fast, cost-effective analysis
 */
async function analyzeImageForOverlay(imageUrl, imageIndex) {
  try {
    console.log(`\n[Image Analysis] Analyzing image #${imageIndex + 1} for optimal parameters...`);

    const geminiService = new GeminiService(GEMINI_API_KEY);
    const analysisPrompt = generateImageAnalysisPrompt();

    // Use generateContent with image input for vision analysis
    const response = await geminiService.generateContentWithImage(
      analysisPrompt,
      imageUrl,
      { temperature: 0.1 } // Low temperature for consistent structured output
    );

    // Parse JSON response
    let analysisData;
    try {
      // Extract JSON from response (may be wrapped in markdown code blocks)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in analysis response');
      }
      analysisData = JSON.parse(jsonMatch[0]);

      console.log(`[Image Analysis] Image #${imageIndex + 1} analysis:`, {
        productPosition: analysisData.productPosition,
        gradientCoverage: analysisData.recommendedGradientCoverage,
        textAlignment: analysisData.textAlignment
      });

      return analysisData;
    } catch (parseError) {
      console.error(`[Image Analysis] Failed to parse JSON for image #${imageIndex + 1}:`, parseError.message);
      console.error('[Image Analysis] Raw response:', response);

      // Return safe defaults if parsing fails
      return {
        productPosition: 'middle',
        recommendedGradientCoverage: 20,
        recommendedTitleSize: 52,
        recommendedMarginTop: 5,
        recommendedMarginLeft: 4,
        textAlignment: 'left',
        reasoning: 'Failed to analyze, using safe defaults'
      };
    }
  } catch (error) {
    console.error(`[Image Analysis] Error analyzing image #${imageIndex + 1}:`, error.message);

    // Return safe defaults on error
    return {
      productPosition: 'middle',
      recommendedGradientCoverage: 20,
      recommendedTitleSize: 52,
      recommendedMarginTop: 5,
      recommendedMarginLeft: 4,
      textAlignment: 'left',
      reasoning: 'Analysis failed, using safe defaults'
    };
  }
}

/**
 * Edit multiple images using Gemini 3 Pro Image Preview (Nano Banana Pro)
 * @param {Array<string>} imageUrls - Array of public image URLs
 * @param {string} briefText - The brief text to include in the prompt
 * @param {Object} options - Configuration options
 */
export async function editMultipleImagesWithNanoBananaPro(imageUrls, briefText, options = {}) {
  const { retries = 3 } = options;

  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured in environment variables');
  }

  // Assuming imageSpecs are derived from briefText or another source,
  // and aligned with imageUrls. For this example, we'll create dummy specs.
  // In a real scenario, you'd parse briefText or fetch these specs.
  const imageSpecs = Array(imageUrls.length).fill(null).map(() => ({
    title: 'PRODUCT', // Placeholder title
    subtitle: ''      // Placeholder subtitle
  }));


  const nanoBananaService = new NanoBananaProService(GEMINI_API_KEY);
  const results = [];

  console.log(`[Nano Banana Pro] Processing ${imageUrls.length} images`);
  console.log(`[Batch Processing] Processing ${imageUrls.length} images with ${imageSpecs.length} specifications`);
  console.log(`[Batch Processing] Marketplace Preset:`, options.marketplacePreset ? options.marketplacePreset.id : 'None');

  const results = [];

  for (let i = 0; i < imageUrls.length; i++) {
    const imageUrl = imageUrls[i];
    const spec = imageSpecs[i] || { title: 'PRODUCT', subtitle: '' };

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`[Batch] Processing Image ${i + 1}/${imageUrls.length}`);
    console.log(`[Batch] Title: "${spec.title}"`);
    console.log(`[Batch] Subtitle: "${spec.subtitle}"`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    try {
      // Step 1: Analyze image for optimal overlay parameters
      const analysisData = await analyzeImageForOverlay(imageUrl, i);

      // Step 2: Generate adaptive prompt based on analysis + marketplace
      const adaptivePrompt = generateAdaptivePrompt(
        spec.title,
        spec.subtitle,
        analysisData, // Use AI-analyzed parameters
        options.marketplacePreset?.id || 'website'
      );

      console.log(`[Nano Banana Pro] Generated adaptive prompt for image ${i + 1}:`, adaptivePrompt);

      let attempt = 0;
      let success = false;
      let result = null;

      while (attempt < retries && !success) {
        try {
          attempt++;
          console.log(`[Nano Banana Pro] Attempt ${attempt}/${retries} for image ${i + 1}`);

          // Call Gemini 3 Pro Image Preview for image editing
          const outputImages = await nanoBananaService.editImage(imageUrl, adaptivePrompt, {
            imageIndex: i
          });

          if (outputImages && outputImages.length > 0) {
            result = {
              images: outputImages.map(url => ({ url })),
              text: `Successfully edited image ${i + 1}`
            };
            success = true;
            console.log(`[Nano Banana Pro] ✓ Image ${i + 1} processed successfully`);
          } else {
            throw new Error('No output images returned');
          }
        } catch (error) {
          console.error(`[Nano Banana Pro] ✗ Attempt ${attempt} failed:`, error.message);

          if (attempt >= retries) {
            result = {
              images: [],
              text: `Failed to edit image ${i + 1} after ${retries} attempts`,
              error: error.message
            };
          } else {
            // Wait before retry (exponential backoff)
            const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
            console.log(`[Nano Banana Pro] Waiting ${waitTime}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }
      }

      results.push(result);
    } catch (batchError) {
      console.error(`[Batch] Error processing image ${i + 1}:`, batchError.message);
      results.push({
        images: [],
        text: `Failed to process image ${i + 1} due to batch error`,
        error: batchError.message
      });
    }
  }

  const successCount = results.filter(r => r.images && r.images.length > 0).length;
  console.log(`[Nano Banana Pro] Batch complete: ${successCount}/${imageUrls.length} successful`);

  return results;
}