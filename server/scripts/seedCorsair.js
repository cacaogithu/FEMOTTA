import { brandService } from '../services/brandService.js';

async function seedCorsairBrand() {
  try {
    console.log('Seeding Corsair as first brand...');

    // Check if Corsair already exists
    const existing = await brandService.getBrandBySlug('corsair');
    if (existing) {
      console.log('Corsair brand already exists:', existing);
      return existing;
    }

    // Create Corsair brand with existing configuration
    const corsairBrand = await brandService.createBrand({
      name: 'corsair',
      displayName: 'CORSAIR',
      slug: 'corsair',
      
      // Branding
      logoUrl: '/attached_assets/image_1760917218883.png',
      primaryColor: '#FFC107',
      secondaryColor: '#FF6F00',
      
      // Google Drive folders (existing configuration)
      briefFolderId: '1oBX3lAfZQq9gt4fMhBe7JBh7aKo-k697', // Instructions2 folder
      productImagesFolderId: '1_WUvTwPrw8DNpns9wB36cxQ13RamCvAS', // Product Images folder
      editedResultsFolderId: '17NE_igWpmMIbyB9H7G8DZ8ZVdzNBMHoB', // Corsair folder
      
      // Default prompt template (professional, subtle edits)
      defaultPromptTemplate: 'Add a VERY SUBTLE enhancement to this product image. Preserve all original details, colors, and textures - the product must remain clearly visible and unchanged.',
      
      // AI settings
      aiSettings: {
        batchSize: 15,
        enablePsdDownload: true,
        estimatedManualTimePerImage: 15 // minutes
      },
      
      // API keys from environment
      wavespeedApiKey: process.env.WAVESPEED_API_KEY,
      openaiApiKey: process.env.OPENAI_API_KEY,
      
      active: true
    });

    console.log('✅ Corsair brand created successfully:', corsairBrand);
    return corsairBrand;
    
  } catch (error) {
    console.error('Error seeding Corsair brand:', error);
    throw error;
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedCorsairBrand()
    .then(() => {
      console.log('Seed completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seed failed:', error);
      process.exit(1);
    });
}

export { seedCorsairBrand };
