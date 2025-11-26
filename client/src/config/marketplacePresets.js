const marketplacePresets = {
  default: {
    id: 'default',
    name: 'Default',
    description: 'Standard output settings',
    aspectRatio: null,
    maxWidth: 2000,
    maxHeight: 2000,
    marginRules: {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0
    },
    backgroundPadding: 0,
    acceptedFormats: ['image/jpeg', 'image/png', 'image/webp'],
    outputFormat: 'jpeg',
    outputQuality: 90
  },
  amazon: {
    id: 'amazon',
    name: 'Amazon',
    description: 'Amazon product listing requirements',
    aspectRatio: '1:1',
    maxWidth: 2000,
    maxHeight: 2000,
    marginRules: {
      top: 85,
      right: 85,
      bottom: 85,
      left: 85
    },
    backgroundPadding: 5,
    acceptedFormats: ['image/jpeg', 'image/png'],
    outputFormat: 'jpeg',
    outputQuality: 100,
    notes: 'Pure white background (#FFFFFF) required. Product must fill 85% of frame.'
  },
  alibaba: {
    id: 'alibaba',
    name: 'Alibaba',
    description: 'Alibaba/AliExpress product requirements',
    aspectRatio: '1:1',
    maxWidth: 800,
    maxHeight: 800,
    marginRules: {
      top: 80,
      right: 80,
      bottom: 80,
      left: 80
    },
    backgroundPadding: 10,
    acceptedFormats: ['image/jpeg', 'image/png'],
    outputFormat: 'jpeg',
    outputQuality: 85,
    notes: 'White or light background preferred. Minimum 800x800 pixels.'
  },
  website: {
    id: 'website',
    name: 'Website',
    description: 'General website/e-commerce use',
    aspectRatio: '4:3',
    maxWidth: 1920,
    maxHeight: 1440,
    marginRules: {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0
    },
    backgroundPadding: 0,
    acceptedFormats: ['image/jpeg', 'image/png', 'image/webp'],
    outputFormat: 'webp',
    outputQuality: 85,
    notes: 'Optimized for web performance with WebP format.'
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

export default marketplacePresets;
