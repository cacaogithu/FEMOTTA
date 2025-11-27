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
 */
export function getSairaPromptSnippet() {
  return `
TYPOGRAPHY REQUIREMENTS (CRITICAL - MUST FOLLOW EXACTLY):

Use ONLY the Saira font family for ALL text:

TITLE TEXT:
- Font: Saira Bold (geometric sans-serif with sharp angular terminals)
- Style: UPPERCASE, white, clean geometric letterforms
- Examples of correct style: "MILLENNIUM", "CORSAIR ONE", "POWER SUPPLY"
- Position: Top-left with subtle drop shadow for readability

SUBTITLE TEXT:
- Font: Saira Regular (same geometric family, lighter weight)
- Style: Sentence case, white or light gray, smaller than title
- Examples of correct style: "Premium Gaming Peripherals", "Next-Generation Performance"
- Position: Below title with matching subtle shadow

DO NOT USE any other font. The Saira font has distinctive characteristics:
- Sharp, angular letter terminals
- Consistent stroke widths throughout
- Modern, technical aesthetic
- Clean geometric forms

The typography should look like professional gaming/tech marketing materials.
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
