/**
 * Curated Saira Font Reference System
 * 
 * This module provides canonical descriptions of Saira typography
 * to ensure consistent font rendering across all AI image edits.
 * 
 * Saira is a geometric sans-serif font family with:
 * - Sharp, angular terminals
 * - Consistent stroke widths
 * - Modern, technical aesthetic
 * - Clear letterforms perfect for marketing imagery
 */

export const SAIRA_REFERENCE = {
  fontFamily: 'Saira',
  style: 'geometric sans-serif with sharp angular terminals',
  
  title: {
    weight: 'Bold (700)',
    case: 'UPPERCASE',
    color: 'pure white (#FFFFFF)',
    position: 'top-left, with comfortable margin from edges',
    shadow: 'subtle drop shadow for readability over any background',
    examples: [
      'MILLENNIUM',
      'CORSAIR ONE', 
      'POWER SUPPLY',
      'GAMING HEADSET',
      'INTEL CORE'
    ],
    description: 'Bold, uppercase white text with clean geometric letterforms. ' +
      'Each letter has sharp, angular terminals and consistent stroke widths. ' +
      'The font has a modern, technical aesthetic typical of gaming and tech brands.'
  },
  
  subtitle: {
    weight: 'Regular (400)',
    case: 'Sentence case or lowercase',
    color: 'white or light gray',
    position: 'directly below title, smaller size',
    shadow: 'subtle drop shadow matching title',
    examples: [
      'Premium Gaming Peripherals',
      'Next-Generation Performance',
      'Professional Quality Audio',
      'Ultra-Quiet Power Delivery',
      'Intel Core Ultra 9 processor'
    ],
    description: 'Regular weight, smaller than title, same geometric Saira family. ' +
      'Maintains the clean, modern aesthetic while being secondary to the title.'
  },
  
  overlay: {
    gradient: 'Very subtle dark gradient at top edge only (approximately 10-15% of image height)',
    gradientOpacity: 'Just enough for text readability, not a heavy overlay',
    background: 'NEVER add solid backgrounds or boxes behind text'
  }
};

/**
 * Generate a strongly-typed prompt snippet for Saira typography
 * This should be injected into the AI prompt to ensure font consistency
 * 
 * CRITICAL: This text contains STYLING INSTRUCTIONS ONLY - none of these words
 * should appear in the final image. The AI must understand these are directions,
 * not content to render.
 */
export function getSairaPromptSnippet() {
  return `
=== STYLING INSTRUCTIONS (DO NOT RENDER ANY OF THIS TEXT) ===

The following are INSTRUCTIONS for HOW to style text, NOT text to display:

FONT STYLE GUIDANCE:
- Use a bold geometric sans-serif font for titles
- Use a regular weight geometric sans-serif font for subtitles
- Title should be UPPERCASE, white color
- Subtitle should be sentence case, white or light gray
- Both should have subtle drop shadow for readability

FORBIDDEN WORDS IN OUTPUT IMAGE:
Never write these words in the image: "Saira", "Bold", "Regular", "px", "percent", 
"opacity", "gradient", "font", "geometric", "sans-serif", "UPPERCASE", "sentence case",
"drop shadow", any numbers followed by "px" or "%"

These are styling instructions, NOT content. Only render the actual title and subtitle 
text that the user provides.

=== END OF STYLING INSTRUCTIONS ===
`;
}

/**
 * Generate the complete image preservation prompt snippet
 */
export function getImagePreservationSnippet() {
  return `
IMAGE PRESERVATION REQUIREMENTS (CRITICAL - MUST FOLLOW EXACTLY):

1. DO NOT modify, replace, regenerate, or alter the original image in ANY way
2. The product, background, colors, lighting, shadows, and all visual elements MUST remain 100% unchanged
3. ONLY add these overlay elements on top of the existing image:
   - A very subtle dark gradient at the top edge (10-15% of image height, barely visible)
   - Title text overlay
   - Subtitle text overlay

The original image is SACRED and must not be touched. You are ONLY adding text overlays.
If you change ANYTHING about the original product image, you have FAILED.
`;
}

/**
 * Combine both snippets for injection into prompts
 */
export function getCompleteOverlayGuidelines() {
  return getSairaPromptSnippet() + '\n' + getImagePreservationSnippet();
}

export default {
  SAIRA_REFERENCE,
  getSairaPromptSnippet,
  getImagePreservationSnippet,
  getCompleteOverlayGuidelines
};
