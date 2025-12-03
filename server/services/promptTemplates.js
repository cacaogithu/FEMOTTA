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
 * Generate AI analysis prompt for image-specific parameters with detailed product detection
 */
export function generateImageAnalysisPrompt(imageContext = {}) {
  return `Analyze this product image and determine optimal overlay parameters for text and gradient placement.

CRITICAL: You must detect the exact location of the product in the image to ensure text and gradients don't cover it.

Respond with ONLY a valid JSON object in this exact format:
{
  "productPosition": "top-third" | "middle" | "bottom-third",
  "productBounds": {
    "topPercent": 0-100,
    "bottomPercent": 0-100,
    "leftPercent": 0-100,
    "rightPercent": 0-100
  },
  "imageComplexity": "simple" | "moderate" | "complex",
  "recommendedGradientCoverage": 15-28,
  "gradientSafeZone": {
    "maxCoveragePercent": 15-28,
    "canExtendToBottom": true | false
  },
  "recommendedTitleSize": 36-72,
  "recommendedMarginTop": 3-8,
  "recommendedMarginLeft": 3-6,
  "textAlignment": "left" | "center" | "right",
  "textSafeZone": {
    "topMarginPercent": 3-10,
    "sideMarginPercent": 3-8
  },
  "reasoning": "brief explanation of product location and safe zones"
}

ANALYSIS REQUIREMENTS:
1. Product Detection:
   - Identify the main product's exact position (percentage from top/bottom/left/right)
   - Determine if product is in top-third, middle, or bottom-third of frame
   - Calculate safe zones where text/gradient won't obscure the product

2. Gradient Placement:
   - If product is in bottom 70% of image, gradient can cover top 20-28%
   - If product is in top 30% of image, gradient should only cover top 12-18%
   - Gradient must fade to transparent before touching product

3. Text Positioning:
   - Calculate optimal margins to avoid product overlap
   - Recommend text alignment (left/center/right) based on composition
   - Ensure text size is readable but doesn't dominate the product

4. Background Analysis:
   - Assess background complexity (simple/moderate/complex)
   - Determine if gradient needs higher opacity for text readability

Return ONLY the JSON object, no additional text or markdown formatting.`;
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
    recommendedMarginLeft: 4,
    textAlignment: 'left' // default to left alignment
  };

  // Sanitize and provide defaults for title/subtitle to prevent crashes
  const safeTitle = (title || 'PRODUCT').toString().replace(/"/g, "'");
  const safeSubtitle = (subtitle || '').toString().replace(/"/g, "'");

  // Calculate exact metrics based on analyzed parameters
  const gradientCoverage = params.recommendedGradientCoverage || 20;
  const gradientOpacity = 0.35; // Fixed at 35% opacity for dark gradient
  const titleFontSize = params.recommendedTitleSize || 52;
  const subtitleFontSize = Math.round(titleFontSize * 0.35); // Subtitle is 35% of title size
  const marginTop = params.recommendedMarginTop || 5;
  const marginLeft = params.recommendedMarginLeft || 4;
  const textAlignment = params.textAlignment || 'left';

  // Text shadow specification
  const shadowOffsetY = 1.5;
  const shadowBlur = 3;
  const shadowOpacity = 0.25;

  // Line spacing
  const titleLineHeight = 1.1;
  const subtitleLineHeight = 1.3;
  const subtitleMarginTop = 8; // pixels below title

  // Generate alignment-specific positioning instructions
  let positioningInstructions = '';
  if (textAlignment === 'center') {
    positioningInstructions = `Position title text horizontally centered at ${marginTop}% from top edge. Position subtitle horizontally centered ${subtitleMarginTop}px below title.`;
  } else if (textAlignment === 'right') {
    positioningInstructions = `Position title text ${marginLeft}% from right edge, ${marginTop}% from top edge. Position subtitle aligned to right edge, ${subtitleMarginTop}px below title.`;
  } else {
    // default: left alignment
    positioningInstructions = `Position title text ${marginLeft}% from left edge, ${marginTop}% from top edge. Position subtitle aligned to left edge, ${subtitleMarginTop}px below title.`;
  }

  // Hyper-specific prompt with exact metrics for Nano Banana Pro
  return `Edit this product image by adding text overlay with precise specifications.

CRITICAL TEXT ACCURACY REQUIREMENT:
You MUST render the text EXACTLY as provided - character for character, letter for letter.
Do NOT change, rephrase, or misspell any words. Copy the text EXACTLY as written below.

GRADIENT OVERLAY:
- Apply linear gradient starting from top edge
- Coverage: top ${gradientCoverage}% of image height
- Color: dark gray (rgb(20, 20, 20))
- Opacity: ${gradientOpacity} at top, fading to 0 (fully transparent) at bottom edge of gradient
- Transition: smooth linear fade

EXACT TEXT TO RENDER (copy character-for-character):
Title: "${safeTitle.toUpperCase()}"
Subtitle: "${safeSubtitle}"

IMPORTANT: The title and subtitle text above must be rendered EXACTLY as shown - do not change spelling, do not add or remove letters.

TITLE SPECIFICATIONS:
- Font: Saira Bold (geometric sans-serif, sharp angular terminals)
- Size: ${titleFontSize}px
- Case: UPPERCASE
- Color: white (#FFFFFF)
- Line height: ${titleLineHeight}
- Max width: 85% of image width
- Text shadow: ${shadowOffsetY}px vertical offset, ${shadowBlur}px blur, rgba(0, 0, 0, ${shadowOpacity})

SUBTITLE SPECIFICATIONS:
- Font: Saira Regular (same geometric family, lighter weight)
- Size: ${subtitleFontSize}px
- Case: as provided (do not modify)
- Color: white (#FFFFFF)
- Line height: ${subtitleLineHeight}
- Max width: 85% of image width
- Text shadow: ${shadowOffsetY}px vertical offset, ${shadowBlur}px blur, rgba(0, 0, 0, ${shadowOpacity})

TEXT POSITIONING:
${positioningInstructions}

CRITICAL PRESERVATION RULES:
- Original image dimensions: preserve 100% (do not change aspect ratio or add borders)
- Original product details: preserve 100% (colors, textures, materials, lighting)
- Background: preserve 100% (no modifications to backdrop, environment, or context)
- Product composition: preserve 100% (no cropping, resizing, or repositioning)
- Only additions: gradient overlay + title text + subtitle text
- Do NOT regenerate, redraw, or modify any part of the original image
- Do NOT add white backgrounds or borders

Output the edited image with text overlay applied using these exact specifications.`;
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