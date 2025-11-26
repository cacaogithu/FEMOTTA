// FEMOTTA - Standardized Image Editing Prompts
// Version: 2.0
// Last Updated: 2025-11-26
// Purpose: Fixed prompts with consistent parameters and smart adaptability

/**
 * OPTION A: MAXIMUM STANDARDIZATION
 * Use this for: Product catalogs, strict brand consistency
 * Characteristics: Nearly identical results, minimal variance
 */
export const PROMPT_TEMPLATE_FIXED = `Apply a linear gradient overlay at the top 22% of the image, transitioning from rgba(20,20,20,0.35) at the top edge to fully transparent. Position text 32px from the top edge and 40px from the left edge. Render the title text '{title}' using Montserrat Extra Bold font at exactly 52px, uppercase, white color (#FFFFFF), with line-height 1.1 and max-width 85% of image width. Position subtitle text '{subtitle}' exactly 8px below the title, using Montserrat Regular font at exactly 18px, white color, line-height 1.3. Apply text shadow to both texts: 0px 1.5px 3px rgba(0,0,0,0.25). Preserve all original image details and product features. Output as high-resolution JPEG.`;

/**
 * OPTION B: SMART ADAPTIVE STANDARDIZATION  
 * Use this for: Mixed content, varied aspect ratios, complex layouts
 * Characteristics: Consistent style with intelligent adaptation
 */
export const PROMPT_TEMPLATE_ADAPTIVE = `Apply a linear gradient overlay at the top 22% of the image (or top 12% if product is detected in the upper third), transitioning from rgba(20,20,20,0.35) to fully transparent. Position text based on image aspect ratio: for portrait images (width/height < 0.75) place 40px from top and centered horizontally; for landscape images (width/height > 1.5) place 32px from top and 60px from left; for standard images place 32px from top and 40px from left. Render title '{title}' in Montserrat Extra Bold, uppercase, white (#FFFFFF) - for images under 1000px wide use 48px, for 1000-2000px wide use 52px, for over 2000px wide use 58px. Render subtitle '{subtitle}' 8px below title in Montserrat Regular, white, at 34.6% of the title font size (maintains 2.89:1 ratio). Apply text shadow: 0px 1.5px 3px rgba(0,0,0,0.25) to all text. Preserve all original image details. Output as high-resolution JPEG.`;

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
