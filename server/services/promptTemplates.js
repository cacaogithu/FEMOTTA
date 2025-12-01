
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
 * IMPORTANT: This prompt uses strict separation between:
 * - RENDER_TEXT: The ONLY text that should appear in the image
 * - GUIDANCE: Instructions for HOW to render (never drawn on image)
 * 
 * Logo overlays are handled by post-processing (overlayLogoOnImage), 
 * so we do NOT include logo instructions here to avoid duplication.
 */
export function generateAdaptivePrompt(title, subtitle, analyzedParams, marketplace = 'website', logoInfo = null) {
  const params = analyzedParams || {
    productPosition: 'middle',
    recommendedGradientCoverage: 20,
    recommendedTitleSize: 52,
    recommendedMarginTop: 5,
    recommendedMarginLeft: 4
  };

  // Sanitize and provide defaults for title/subtitle to prevent crashes
  const safeTitle = (title || 'PRODUCT').toString().replace(/"/g, "'");
  const safeSubtitle = (subtitle || '').toString().replace(/"/g, "'");

  // Optimized prompt for Nano Banana Pro - concise and direct
  return `Edit this product image by adding text overlay only.

Add the following text:
- Title: "${safeTitle.toUpperCase()}" (white, bold, Saira font, top-left corner)
- Subtitle: "${safeSubtitle}" (white, regular, Saira font, below title, smaller size)

Add a subtle dark gradient (15-20% opacity) at the top edge for text contrast.

Important:
- Preserve the original product, background, colors, and lighting completely
- Only add the text overlay and minimal gradient
- Use clean, professional typography with subtle drop shadow

Output the edited image with text overlay applied.`;
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
