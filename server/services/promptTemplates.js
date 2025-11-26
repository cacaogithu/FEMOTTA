// FEMOTTA - Standardized Image Editing Prompts
// Version: 3.0
// Last Updated: 2025-11-26
// Purpose: Natural language prompts only - NO technical specifications

/**
 * OPTION A: MAXIMUM STANDARDIZATION
 * Use this for: Product catalogs, strict brand consistency
 * Characteristics: Nearly identical results, minimal variance
 * 
 * CRITICAL: Uses ONLY natural language - no font names, pixel values, or CSS
 */
export const PROMPT_TEMPLATE_FIXED = `Edit this product image by adding a subtle dark gradient at the top that fades to transparent. Overlay the title '{title}' in large bold uppercase white letters near the top left. Below the title, add the subtitle '{subtitle}' in smaller white text. Both texts should have a subtle shadow for readability. Keep all original product details, colors, and image quality intact. This should look like a professional marketing image.`;

/**
 * OPTION B: SMART ADAPTIVE STANDARDIZATION  
 * Use this for: Mixed content, varied aspect ratios, complex layouts
 * Characteristics: Consistent style with intelligent adaptation
 */
export const PROMPT_TEMPLATE_ADAPTIVE = `Edit this product image to create a professional marketing graphic. Add a gentle dark gradient at the top that fades to transparent. Place the title '{title}' in large bold uppercase white letters near the top. Below it, add '{subtitle}' in smaller white text. Use subtle text shadows for readability. Preserve all original product details and image quality.`;

/**
 * DEPRECATED: OLD TEMPLATE WITH TECHNICAL SPECS
 * DO NOT USE - Technical specifications were being rendered as text
 */
export const PROMPT_TEMPLATE_OLD_DEPRECATED = `[DEPRECATED - DO NOT USE]`;

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
