/**
 * Image Parameters Service
 * Manages structured parameters for AI image editing
 * 
 * Parameters are stored with each edited image to enable:
 * - Consistent PSD layer generation
 * - Parameter editing via chat commands
 * - Version tracking for iterative edits
 */

/**
 * Default parameter values based on image dimensions
 */
export function calculateDefaultParameters(imageWidth, imageHeight, title, subtitle) {
  // Calculate responsive values based on image size
  const titleFontSize = Math.max(36, Math.min(72, Math.floor(imageWidth * 0.045)));
  const subtitleFontSize = Math.round(titleFontSize * 0.35);
  
  const marginTop = Math.floor(imageHeight * 0.08);
  const marginLeft = Math.floor(imageWidth * 0.05);
  
  const gradientHeight = 0.22; // 22% of image height
  const gradientOpacity = 0.35;
  
  return {
    version: 1,
    imageWidth,
    imageHeight,
    title: {
      text: title || '',
      fontSize: titleFontSize,
      fontFamily: 'Saira-Bold',
      fontWeight: 'Bold',
      color: '#FFFFFF',
      case: 'uppercase',
      position: {
        x: marginLeft,
        y: marginTop + titleFontSize,
        alignment: 'left'
      },
      shadow: {
        offsetX: 0,
        offsetY: 1.5,
        blur: 3,
        color: 'rgba(0, 0, 0, 0.25)'
      },
      lineHeight: 1.1,
      maxWidthPercent: 85
    },
    subtitle: {
      text: subtitle || '',
      fontSize: subtitleFontSize,
      fontFamily: 'Saira-Regular',
      fontWeight: 'Regular',
      color: '#FFFFFF',
      case: 'sentence',
      position: {
        x: marginLeft,
        y: marginTop + titleFontSize + Math.floor(titleFontSize * 0.6) + subtitleFontSize,
        alignment: 'left'
      },
      shadow: {
        offsetX: 0,
        offsetY: 1.5,
        blur: 3,
        color: 'rgba(0, 0, 0, 0.25)'
      },
      lineHeight: 1.3,
      maxWidthPercent: 85
    },
    gradient: {
      enabled: true,
      position: 'top',
      heightPercent: gradientHeight * 100,
      stops: [
        { position: 0, color: 'rgba(20, 20, 20, ' + gradientOpacity + ')' },
        { position: 1, color: 'rgba(20, 20, 20, 0)' }
      ],
      opacity: gradientOpacity
    },
    logo: {
      enabled: false,
      fileId: null,
      position: 'bottom-right',
      sizePercent: 15,
      marginPercent: 3
    },
    margins: {
      top: marginTop,
      left: marginLeft,
      topPercent: 8,
      leftPercent: 5
    }
  };
}

/**
 * Calculate parameters from analyzed params (from AI image analysis)
 */
export function calculateParametersFromAnalysis(imageWidth, imageHeight, title, subtitle, analyzedParams) {
  const params = calculateDefaultParameters(imageWidth, imageHeight, title, subtitle);
  
  if (analyzedParams) {
    // Override with analyzed values
    if (analyzedParams.recommendedTitleSize) {
      params.title.fontSize = analyzedParams.recommendedTitleSize;
      params.subtitle.fontSize = Math.round(analyzedParams.recommendedTitleSize * 0.35);
    }
    
    if (analyzedParams.recommendedMarginTop) {
      params.margins.topPercent = analyzedParams.recommendedMarginTop;
      params.margins.top = Math.floor(imageHeight * analyzedParams.recommendedMarginTop / 100);
    }
    
    if (analyzedParams.recommendedMarginLeft) {
      params.margins.leftPercent = analyzedParams.recommendedMarginLeft;
      params.margins.left = Math.floor(imageWidth * analyzedParams.recommendedMarginLeft / 100);
    }
    
    if (analyzedParams.recommendedGradientCoverage) {
      params.gradient.heightPercent = analyzedParams.recommendedGradientCoverage;
    }
    
    if (analyzedParams.textAlignment) {
      params.title.position.alignment = analyzedParams.textAlignment;
      params.subtitle.position.alignment = analyzedParams.textAlignment;
    }
    
    // Recalculate positions based on updated margins
    params.title.position.x = params.margins.left;
    params.title.position.y = params.margins.top + params.title.fontSize;
    params.subtitle.position.x = params.margins.left;
    params.subtitle.position.y = params.title.position.y + Math.floor(params.title.fontSize * 0.6) + params.subtitle.fontSize;
  }
  
  return params;
}

/**
 * Merge parameter updates (from chat commands) with existing parameters
 */
export function mergeParameterUpdates(existingParams, updates) {
  const merged = JSON.parse(JSON.stringify(existingParams)); // Deep clone
  merged.version = (existingParams.version || 1) + 1;
  
  // Apply updates
  if (updates.title) {
    if (updates.title.text !== undefined) merged.title.text = updates.title.text;
    if (updates.title.fontSize !== undefined) {
      merged.title.fontSize = updates.title.fontSize;
      // Auto-adjust subtitle size to maintain ratio
      merged.subtitle.fontSize = Math.round(updates.title.fontSize * 0.35);
    }
    if (updates.title.alignment !== undefined) {
      merged.title.position.alignment = updates.title.alignment;
      merged.subtitle.position.alignment = updates.title.alignment;
    }
  }
  
  if (updates.subtitle) {
    if (updates.subtitle.text !== undefined) merged.subtitle.text = updates.subtitle.text;
    if (updates.subtitle.fontSize !== undefined) merged.subtitle.fontSize = updates.subtitle.fontSize;
  }
  
  if (updates.gradient) {
    if (updates.gradient.heightPercent !== undefined) merged.gradient.heightPercent = updates.gradient.heightPercent;
    if (updates.gradient.opacity !== undefined) {
      merged.gradient.opacity = updates.gradient.opacity;
      merged.gradient.stops[0].color = `rgba(20, 20, 20, ${updates.gradient.opacity})`;
    }
  }
  
  if (updates.margins) {
    if (updates.margins.topPercent !== undefined) {
      merged.margins.topPercent = updates.margins.topPercent;
      merged.margins.top = Math.floor(merged.imageHeight * updates.margins.topPercent / 100);
    }
    if (updates.margins.leftPercent !== undefined) {
      merged.margins.leftPercent = updates.margins.leftPercent;
      merged.margins.left = Math.floor(merged.imageWidth * updates.margins.leftPercent / 100);
    }
  }
  
  // Recalculate text positions after margin changes
  merged.title.position.x = merged.margins.left;
  merged.title.position.y = merged.margins.top + merged.title.fontSize;
  merged.subtitle.position.x = merged.margins.left;
  merged.subtitle.position.y = merged.title.position.y + Math.floor(merged.title.fontSize * 0.6) + merged.subtitle.fontSize;
  
  return merged;
}

/**
 * Generate prompt from parameters (for regeneration with modified params)
 */
export function generatePromptFromParameters(params) {
  const title = params.title.text || 'PRODUCT';
  const subtitle = params.subtitle.text || '';
  
  const gradientCoverage = params.gradient.heightPercent || 22;
  const gradientOpacity = params.gradient.opacity || 0.35;
  const titleFontSize = params.title.fontSize || 52;
  const subtitleFontSize = params.subtitle.fontSize || Math.round(titleFontSize * 0.35);
  const marginTop = params.margins.topPercent || 5;
  const marginLeft = params.margins.leftPercent || 4;
  const textAlignment = params.title.position.alignment || 'left';
  
  // Text shadow specification
  const shadowOffsetY = params.title.shadow?.offsetY || 1.5;
  const shadowBlur = params.title.shadow?.blur || 3;
  const shadowOpacity = 0.25;

  // Generate alignment-specific positioning instructions
  let positioningInstructions = '';
  if (textAlignment === 'center') {
    positioningInstructions = `Position title text horizontally centered at ${marginTop}% from top edge. Position subtitle horizontally centered 8px below title.`;
  } else if (textAlignment === 'right') {
    positioningInstructions = `Position title text ${marginLeft}% from right edge, ${marginTop}% from top edge. Position subtitle aligned to right edge, 8px below title.`;
  } else {
    positioningInstructions = `Position title text ${marginLeft}% from left edge, ${marginTop}% from top edge. Position subtitle aligned to left edge, 8px below title.`;
  }

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
Title: "${title.toUpperCase()}"
Subtitle: "${subtitle}"

IMPORTANT: The title and subtitle text above must be rendered EXACTLY as shown - do not change spelling, do not add or remove letters.

TITLE SPECIFICATIONS:
- Font: Saira Bold, weight 700 (geometric sans-serif with sharp angular terminals)
- CRITICAL: Use exactly weight 700 - not semi-bold (600), not extra-bold (800), exactly 700
- Size: ${titleFontSize}px (consistent across all images)
- Case: UPPERCASE
- Color: pure white (#FFFFFF)
- Letter spacing: normal (0em)
- Line height: 1.1
- Max width: 85% of image width
- Text shadow: ${shadowOffsetY}px vertical offset, ${shadowBlur}px blur, rgba(0, 0, 0, ${shadowOpacity})
- Stroke width: consistent medium-bold weight, uniform across all letterforms

SUBTITLE SPECIFICATIONS:
- Font: Saira Regular, weight 400 (same geometric family, lighter weight)
- CRITICAL: Use exactly weight 400 - consistent light weight for subtitles
- Size: ${subtitleFontSize}px
- Case: as provided (do not modify)
- Color: pure white (#FFFFFF)
- Letter spacing: normal (0em)
- Line height: 1.3
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
 * Parse natural language parameter updates from chat
 */
export function parseParameterUpdatesFromChat(message, currentParams) {
  const updates = {};
  const messageLower = message.toLowerCase();
  
  // Title size adjustments
  if (messageLower.includes('title') || messageLower.includes('headline')) {
    if (messageLower.includes('bigger') || messageLower.includes('larger') || messageLower.includes('increase')) {
      updates.title = { fontSize: Math.min(96, currentParams.title.fontSize + 8) };
    } else if (messageLower.includes('smaller') || messageLower.includes('decrease')) {
      updates.title = { fontSize: Math.max(24, currentParams.title.fontSize - 8) };
    }
  }
  
  // Subtitle size adjustments
  if (messageLower.includes('subtitle') || messageLower.includes('subheading')) {
    if (messageLower.includes('bigger') || messageLower.includes('larger')) {
      updates.subtitle = { fontSize: Math.min(48, currentParams.subtitle.fontSize + 4) };
    } else if (messageLower.includes('smaller')) {
      updates.subtitle = { fontSize: Math.max(12, currentParams.subtitle.fontSize - 4) };
    }
  }
  
  // Gradient adjustments
  if (messageLower.includes('gradient') || messageLower.includes('shading') || messageLower.includes('overlay')) {
    if (messageLower.includes('darker') || messageLower.includes('more') || messageLower.includes('increase')) {
      updates.gradient = { opacity: Math.min(0.6, currentParams.gradient.opacity + 0.1) };
    } else if (messageLower.includes('lighter') || messageLower.includes('less') || messageLower.includes('decrease')) {
      updates.gradient = { opacity: Math.max(0.1, currentParams.gradient.opacity - 0.1) };
    }
    if (messageLower.includes('extend') || messageLower.includes('taller')) {
      updates.gradient = { ...updates.gradient, heightPercent: Math.min(40, currentParams.gradient.heightPercent + 5) };
    } else if (messageLower.includes('shorter') || messageLower.includes('less coverage')) {
      updates.gradient = { ...updates.gradient, heightPercent: Math.max(10, currentParams.gradient.heightPercent - 5) };
    }
  }
  
  // Position adjustments
  if (messageLower.includes('move') || messageLower.includes('position')) {
    if (messageLower.includes('up') || messageLower.includes('higher')) {
      updates.margins = { topPercent: Math.max(2, currentParams.margins.topPercent - 2) };
    } else if (messageLower.includes('down') || messageLower.includes('lower')) {
      updates.margins = { topPercent: Math.min(25, currentParams.margins.topPercent + 2) };
    }
    if (messageLower.includes('left')) {
      updates.margins = { ...updates.margins, leftPercent: Math.max(2, currentParams.margins.leftPercent - 2) };
    } else if (messageLower.includes('right')) {
      updates.margins = { ...updates.margins, leftPercent: Math.min(20, currentParams.margins.leftPercent + 2) };
    }
  }
  
  // Alignment changes
  if (messageLower.includes('center') && (messageLower.includes('text') || messageLower.includes('align'))) {
    updates.title = { ...updates.title, alignment: 'center' };
  } else if (messageLower.includes('right') && messageLower.includes('align')) {
    updates.title = { ...updates.title, alignment: 'right' };
  } else if (messageLower.includes('left') && messageLower.includes('align')) {
    updates.title = { ...updates.title, alignment: 'left' };
  }
  
  return updates;
}

export default {
  calculateDefaultParameters,
  calculateParametersFromAnalysis,
  mergeParameterUpdates,
  generatePromptFromParameters,
  parseParameterUpdatesFromChat
};
