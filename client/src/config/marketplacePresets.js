const marketplacePresets = {
  default: {
    id: 'default',
    name: 'Default',
    description: 'Standard output settings - balanced for general use',
    aspectRatio: null,
    aspectRatioOptions: ['1:1', '4:3', '16:9'],
    maxWidth: 2000,
    maxHeight: 2000,
    minDimension: 800,
    marginRules: {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0
    },
    productFill: '85-95%',
    backgroundPadding: 0,
    acceptedFormats: ['image/jpeg', 'image/png', 'image/webp'],
    outputFormat: 'jpeg',
    outputQuality: 90,
    aiMode: 'balanced',
    promptRules: {
      background: 'preserve original or subtle enhancement',
      textOverlays: true,
      shading: 'moderate shadows allowed',
      lighting: 'preserve original lighting',
      colorVibrance: 0,
      badges: false,
      lifestyleContext: false
    }
  },

  amazon: {
    id: 'amazon',
    name: 'Amazon',
    description: 'Amazon product listing - strict compliance mode',
    aspectRatio: '1:1',
    aspectRatioOptions: ['1:1', '5:4'],
    maxWidth: 2000,
    maxHeight: 2000,
    minDimension: 1000,
    marginRules: {
      top: 85,
      right: 85,
      bottom: 85,
      left: 85
    },
    productFill: '90-95%',
    backgroundPadding: 5,
    acceptedFormats: ['image/jpeg', 'image/png'],
    outputFormat: 'jpeg',
    outputQuality: 100,
    aiMode: 'strict',
    promptRules: {
      background: 'pure white (#FFFFFF) - mandatory',
      textOverlays: false,
      shading: 'minimal, neutral shadows only',
      lighting: 'soft white light, neutral, flat',
      colorVibrance: -20,
      badges: false,
      lifestyleContext: false,
      decorativeElements: false,
      cropStyle: 'centered, precise',
      paddingConsistency: 'strict'
    },
    promptModifier: `AMAZON COMPLIANCE MODE: 
- Force pure white background (RGB 255,255,255)
- Center product precisely in frame
- Maintain strict margins with product filling 90-95% of frame
- NO text overlays or decorative elements
- Minimal neutral shadows only
- Clear, flat, soft white lighting
- Consistent padding on all sides
- NO marketing badges or promotional elements
- Clean, professional product photography style`,
    complianceNotes: [
      'Pure white background required',
      'Product must fill 85-95% of frame',
      'Minimum 1000px for zoom functionality',
      'No text, graphics, or watermarks on main image',
      'Consistent cropping across product line'
    ]
  },

  alibaba: {
    id: 'alibaba',
    name: 'Alibaba',
    description: 'Alibaba/AliExpress - marketing-focused, stylized',
    aspectRatio: '1:1',
    aspectRatioOptions: ['1:1', '4:5', '16:9'],
    maxWidth: 1200,
    maxHeight: 1200,
    minDimension: 800,
    marginRules: {
      top: 75,
      right: 75,
      bottom: 75,
      left: 75
    },
    productFill: '75-90%',
    backgroundPadding: 10,
    acceptedFormats: ['image/jpeg', 'image/png'],
    outputFormat: 'jpeg',
    outputQuality: 90,
    aiMode: 'creative',
    promptRules: {
      background: 'gradient or textured backgrounds allowed (brand palette)',
      textOverlays: true,
      shading: 'stylized, dramatic shadows encouraged',
      lighting: 'dramatic, vivid, colorful',
      colorVibrance: 30,
      badges: true,
      lifestyleContext: true,
      decorativeElements: true,
      cropStyle: 'looser, dynamic layouts allowed',
      paddingConsistency: 'flexible'
    },
    promptModifier: `ALIBABA MARKETING MODE:
- Allow creative backgrounds (light gradients, brand colors)
- Add visual depth and dynamic composition
- Increase contrast and color vibrance (+30%)
- Marketing text overlays encouraged
- Dynamic layouts with corner badges allowed
- Stylized shadows for visual impact
- Lifestyle context images can be embedded
- Looser cropping for creative flexibility
- Promotional elements welcome (Top Seller, New Arrival badges)
- High visual density acceptable`,
    suggestedBadges: [
      'Top Seller',
      'New Arrival', 
      'High Quality',
      'Fast Shipping',
      'Best Price',
      'Hot Item'
    ],
    complianceNotes: [
      'Minimum 800x800 pixels',
      'Marketing overlays encouraged',
      'Creative backgrounds allowed',
      'Promotional badges can boost visibility'
    ]
  },

  website: {
    id: 'website',
    name: 'Website',
    description: 'General website/e-commerce - web-optimized',
    aspectRatio: '4:3',
    aspectRatioOptions: ['1:1', '4:3', '16:9', '3:2'],
    maxWidth: 1920,
    maxHeight: 1440,
    minDimension: 600,
    marginRules: {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0
    },
    productFill: '80-90%',
    backgroundPadding: 0,
    acceptedFormats: ['image/jpeg', 'image/png', 'image/webp'],
    outputFormat: 'webp',
    outputQuality: 85,
    aiMode: 'balanced',
    promptRules: {
      background: 'flexible - white, gradient, or contextual',
      textOverlays: true,
      shading: 'natural shadows',
      lighting: 'professional product lighting',
      colorVibrance: 10,
      badges: false,
      lifestyleContext: true,
      decorativeElements: true,
      cropStyle: 'flexible based on composition',
      paddingConsistency: 'moderate'
    },
    promptModifier: `WEBSITE OPTIMIZED MODE:
- Professional product photography style
- Flexible backgrounds (white, gradient, or contextual)
- Natural, appealing shadows
- Brand-consistent text overlays allowed
- Optimize for web performance
- Balance between clean and engaging
- Lifestyle context can enhance appeal
- Professional lighting with slight enhancement`,
    complianceNotes: [
      'WebP format for best web performance',
      'Balance quality and file size',
      'Flexible aspect ratios for different layouts',
      'Professional but engaging style'
    ]
  }
};

export const getPresetById = (presetId) => {
  return marketplacePresets[presetId] || marketplacePresets.default;
};

export const getPresetList = () => {
  return Object.values(marketplacePresets);
};

export const validatePreset = (preset) => {
  const required = ['id', 'name', 'maxWidth', 'maxHeight', 'acceptedFormats'];
  return required.every(field => preset[field] !== undefined);
};

export const getPromptModifier = (presetId) => {
  const preset = getPresetById(presetId);
  return preset.promptModifier || '';
};

export const shouldDisableTextOverlays = (presetId) => {
  const preset = getPresetById(presetId);
  return preset.promptRules?.textOverlays === false;
};

export const getAiMode = (presetId) => {
  const preset = getPresetById(presetId);
  return preset.aiMode || 'balanced';
};

export default marketplacePresets;
