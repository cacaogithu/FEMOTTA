
// FEMOTTA - AI-Driven Adaptive Image Editing
// Version: 5.0
// Last Updated: 2025-01-29
// Purpose: Dynamic prompt generation based on image analysis

/**
 * MARKETPLACE RESIZE SPECIFICATIONS
 * Define platform-specific image dimensions and requirements
 */
export const MARKETPLACE_SPECS = {
  amazon: {
    name: 'Amazon',
    mainImage: { width: 2000, height: 2000, minWidth: 1000 },
    additionalImages: { width: 1600, height: 1600, minWidth: 500 },
    format: 'JPG',
    maxFileSize: '10MB',
    aspectRatio: '1:1'
  },
  alibaba: {
    name: 'Alibaba',
    mainImage: { width: 800, height: 800, minWidth: 800 },
    additionalImages: { width: 800, height: 800, minWidth: 640 },
    format: 'JPG',
    maxFileSize: '5MB',
    aspectRatio: '1:1'
  },
  shopify: {
    name: 'Shopify',
    mainImage: { width: 2048, height: 2048 },
    additionalImages: { width: 2048, height: 2048 },
    format: 'JPG/PNG',
    maxFileSize: '20MB',
    aspectRatio: 'flexible'
  },
  website: {
    name: 'Website/Generic',
    mainImage: { width: 1920, height: 1080 },
    additionalImages: { width: 1920, height: 1080 },
    format: 'JPG/PNG',
    maxFileSize: '5MB',
    aspectRatio: 'flexible'
  }
};

/**
 * CORE EDITING PARAMETERS (consistent across all platforms)
 * These define the visual editing style regardless of marketplace
 */
export const EDITING_PARAMETERS = {
  gradient: {
    position: 'top',
    coverage: { min: 15, max: 25, unit: '%' },
    opacity: { min: 0.3, max: 0.4 },
    fadeType: 'linear-to-transparent',
    color: 'dark-gray'
  },
  text: {
    titleFont: 'Saira-Bold',
    titleCase: 'UPPERCASE',
    titleColor: '#FFFFFF',
    subtitleFont: 'Saira-Regular',
    subtitleColor: '#FFFFFF',
    shadow: {
      offsetX: 0,
      offsetY: 1.5,
      blur: 3,
      color: 'rgba(0, 0, 0, 0.25)'
    }
  },
  preservation: {
    productDetails: 'preserve 100%',
    colors: 'preserve original',
    lighting: 'preserve original',
    background: 'preserve original'
  }
};

/**
 * ADAPTIVE PARAMETER RANGES
 * AI will analyze the image and select values within these ranges
 */
export const ADAPTIVE_RANGES = {
  gradientCoverage: {
    productInTopThird: { min: 12, max: 18 },
    productInMiddle: { min: 20, max: 25 },
    productInBottom: { min: 22, max: 28 }
  },
  textSize: {
    title: {
      smallImage: { maxWidth: 1000, min: 36, max: 48 },
      mediumImage: { minWidth: 1000, maxWidth: 2000, min: 48, max: 60 },
      largeImage: { minWidth: 2000, min: 60, max: 72 }
    },
    subtitle: {
      ratio: 0.4 // subtitle is 40% of title size
    }
  },
  margins: {
    top: { min: 3, max: 8, unit: '%' },
    left: { min: 3, max: 6, unit: '%' }
  }
};

/**
 * Generate AI analysis prompt for image-specific parameters
 */
export function generateImageAnalysisPrompt(imageContext = {}) {
  return `Analyze this product image and determine optimal overlay parameters.

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
}

/**
 * Generate final editing prompt based on AI-analyzed parameters
 * 
 * IMPORTANT: This prompt is carefully structured to prevent the AI from 
 * rendering any guidance text or parameters into the image. Only the 
 * explicit TITLE and SUBTITLE content should appear in the final image.
 */
export function generateAdaptivePrompt(title, subtitle, analyzedParams, marketplace = 'website', logoInfo = null) {
  const params = analyzedParams || {
    productPosition: 'middle',
    recommendedGradientCoverage: 20,
    recommendedTitleSize: 52,
    recommendedMarginTop: 5,
    recommendedMarginLeft: 4
  };

  // Build the prompt with clear separation between what to render and what is guidance
  let prompt = `You are adding text overlays to a product image. 

===== WHAT TO RENDER ON THE IMAGE =====

ONLY render these THREE things on the image:

1. TITLE TEXT: ${title.toUpperCase()}
   - White uppercase text
   - Saira Bold font (geometric sans-serif)
   - Position: top-left corner with margin
   - Add subtle drop shadow for readability

2. SUBTITLE TEXT: ${subtitle}
   - White text, sentence case
   - Saira Regular font (same family, lighter)
   - Position: directly below the title
   - Smaller than title (about 40% of title size)

3. SHADING: Subtle dark gradient
   - Only at the top edge of image
   - Semi-transparent, fading to transparent
   - Just enough to make text readable
   - Do NOT cover the product`;

  // Add logo instructions if logo is requested
  if (logoInfo && logoInfo.logoRequested) {
    prompt += `

4. LOGO: ${logoInfo.logoName || 'Brand logo'}
   - Position: top-right corner with margin
   - Size: proportional, not too large
   - Maintain logo clarity and colors`;
  }

  prompt += `

===== DO NOT RENDER =====

DO NOT put any of these on the image:
- Numbers, percentages, or measurements
- Technical terms like "gradient", "opacity", "px"
- Instructions or parameters
- Any text other than the title and subtitle above

===== IMAGE PRESERVATION (CRITICAL) =====

The original product image MUST stay exactly as-is:
- Do NOT modify the product
- Do NOT change colors or lighting
- Do NOT alter the background
- Do NOT regenerate or replace anything
- ONLY add the text overlays on top

Output the edited image.`;

  return prompt;
}

/**
 * Get marketplace resize configuration
 */
export function getMarketplaceSpec(marketplaceId = 'website') {
  return MARKETPLACE_SPECS[marketplaceId] || MARKETPLACE_SPECS.website;
}

export default {
  MARKETPLACE_SPECS,
  EDITING_PARAMETERS,
  ADAPTIVE_RANGES,
  generateImageAnalysisPrompt,
  generateAdaptivePrompt,
  getMarketplaceSpec
};
