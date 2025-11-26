// FEMOTTA - Standardized Image Editing Prompts
// Version: 2.0
// Last Updated: 2025-11-26
// Purpose: Fixed prompts with consistent parameters and smart adaptability

/**
 * OPTION A: MAXIMUM STANDARDIZATION
 * Use this for: Product catalogs, strict brand consistency
 * Characteristics: Nearly identical results, minimal variance
 */
export const PROMPT_TEMPLATE_FIXED = `CRITICAL: Do NOT render any font names, sizes, CSS values, or technical parameters as visible text on the image. These are styling instructions only.

Apply a linear gradient overlay at the top 22% of the image, transitioning from dark semi-transparent to fully transparent. Position and render ONLY these text elements:

Title: '{title}' (large, bold, uppercase, white)
Subtitle: '{subtitle}' (smaller, regular weight, white, positioned below title)

Use clean, professional typography with subtle drop shadow for readability. Preserve all original image details and product features. Output as high-resolution JPEG.`;

/**
 * OPTION B: SMART ADAPTIVE STANDARDIZATION  
 * Use this for: Mixed content, varied aspect ratios, complex layouts
 * Characteristics: Consistent style with intelligent adaptation
 */
export const PROMPT_TEMPLATE_ADAPTIVE = `CRITICAL: Do NOT render any font names, sizes, pixel values, CSS parameters, or technical specifications as visible text on the image. These are styling instructions only.

Apply a subtle dark gradient overlay at the top portion of the image. Position and render ONLY these text elements:

Title: '{title}' (large, bold, uppercase, white, positioned at top)
Subtitle: '{subtitle}' (smaller, regular weight, white, positioned below title)

Adapt text size and positioning based on image dimensions while maintaining professional appearance. Use clean typography with subtle drop shadow. Preserve all original image details and product features. Output as high-resolution JPEG.`;

/**
 * DEPRECATED: OLD TEMPLATE WITH EXCESSIVE RANGES
 * DO NOT USE - Kept for reference only
 * Problem: Too many variable ranges causing inconsistent results
 */
export const PROMPT_TEMPLATE_OLD_DEPRECATED = `Add a VERY SUBTLE dark gradient overlay ONLY at the top 20-25% of the image, fading from semi-transparent dark gray (30-40% opacity) to fully transparent. Keep the gradient extremely light to preserve all original image details, colors, and textures - the product and background must remain clearly visible and unchanged. The gradient should only provide a subtle backdrop for text readability. Place the following text at the top portion: {title} in white Montserrat Extra Bold font (all caps, approximately 44-56px, adjust size based on image dimensions). Below the title, add {subtitle} in white Montserrat Regular font (approximately 16-22px). Apply a very subtle drop shadow to text only (1-2px offset, 20-30% opacity black) for readability. CRITICAL: Preserve ALL original image details, sharpness, colors, and product features - this should look like a minimal, professional overlay, not heavy editing. Output as high-resolution image.`;

/**
 * DESIGN PARAMETERS (for reference and ML learning)
 */
export const DESIGN_PARAMETERS = {
  // FIXED PARAMETERS - Never change these
  FIXED: {
    titleFont: "Montserrat Extra Bold",
    titleCase: "UPPERCASE",
    titleSizeStandard: "52px",
    titleColor: "#FFFFFF",
    titleLineHeight: "1.1",
    
    subtitleFont: "Montserrat Regular",
    subtitleSizeStandard: "18px",
    subtitleColor: "#FFFFFF", 
    subtitleLineHeight: "1.3",
    subtitleSpacing: "8px",
    
    gradientColor1: "rgba(20, 20, 20, 0.35)",
    gradientColor2: "rgba(20, 20, 20, 0)",
    gradientHeightStandard: "22%",
    gradientStyle: "linear",
    
    shadowOffsetX: "0px",
    shadowOffsetY: "1.5px",
    shadowBlur: "3px",
    shadowColor: "rgba(0, 0, 0, 0.25)",
    
    textPositionTopStandard: "32px",
    textPositionLeftStandard: "40px",
    textMaxWidth: "85%",
    textAlign: "left"
  },
  
  // ADAPTIVE PARAMETERS - Adjust based on image characteristics
  ADAPTIVE: {
    // Font size based on image width
    titleSize: {
      small: { maxWidth: 1000, size: "48px" },
      medium: { minWidth: 1000, maxWidth: 2000, size: "52px" },
      large: { minWidth: 2000, size: "58px" }
    },
    
    // Subtitle maintains ratio to title
    subtitleSizeRatio: 0.346, // 18/52 = 0.346
    
    // Position based on aspect ratio
    positioning: {
      portrait: { 
        aspectRatio: { max: 0.75 }, 
        top: "40px", 
        align: "center" 
      },
      landscape: { 
        aspectRatio: { min: 1.5 }, 
        top: "32px", 
        left: "60px" 
      },
      standard: { 
        aspectRatio: { min: 0.75, max: 1.5 }, 
        top: "32px", 
        left: "40px" 
      }
    },
    
    // Gradient position based on product detection
    gradientAdaptive: {
      productInTopThird: "12%",
      productElsewhere: "22%"
    }
  },
  
  // VALIDATION CRITERIA
  VALIDATION: {
    maxFontSizeVariance: "5%", // Across same aspect ratio
    maxGradientOpacityVariance: "2%",
    maxPositionVariance: "10px",
    shadowMustMatch: "exactly",
    targetUserSatisfaction: ">90%"
  }
};

/**
 * Helper function to select appropriate prompt based on image characteristics
 * @param {Object} imageMetadata - Image dimensions and characteristics
 * @param {string} templateType - 'fixed' or 'adaptive'
 * @returns {string} Prompt template with placeholders
 */
export function getPromptTemplate(imageMetadata = {}, templateType = 'fixed') {
  if (templateType === 'adaptive') {
    return PROMPT_TEMPLATE_ADAPTIVE;
  }
  return PROMPT_TEMPLATE_FIXED;
}

/**
 * Generate final prompt by replacing placeholders
 * @param {string} title - Title text to overlay
 * @param {string} subtitle - Subtitle text to overlay  
 * @param {string} templateType - 'fixed' or 'adaptive'
 * @returns {string} Complete prompt ready for AI
 */
export function generatePrompt(title, subtitle, templateType = 'fixed') {
  const template = getPromptTemplate({}, templateType);
  return template
    .replace('{title}', title)
    .replace('{subtitle}', subtitle);
}

/**
 * Validation function to check if generated images meet consistency standards
 * @param {Array} images - Array of processed image results
 * @returns {Object} Validation results with pass/fail and metrics
 */
export function validateConsistency(images) {
  // TODO: Implement image analysis to measure:
  // - Font size variance
  // - Position variance  
  // - Gradient opacity variance
  // - Shadow consistency
  
  return {
    passed: true,
    metrics: {
      fontSizeVariance: "N/A",
      positionVariance: "N/A",
      gradientVariance: "N/A",
      consistencyScore: "N/A"
    },
    recommendations: []
  };
}

// Export for use in uploadController.js
export default {
  PROMPT_TEMPLATE_FIXED,
  PROMPT_TEMPLATE_ADAPTIVE,
  DESIGN_PARAMETERS,
  getPromptTemplate,
  generatePrompt,
  validateConsistency
};
