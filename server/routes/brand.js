import express from 'express';
import { brandService } from '../services/brandService.js';
import { getBrandConfig, brandContextMiddleware } from '../middleware/brandContext.js';
import { verifyAdminToken } from './admin.js';

const router = express.Router();

// Get current brand configuration (public data only)
router.get('/config', brandContextMiddleware, getBrandConfig);

// List all active brands
router.get('/list', async (req, res) => {
  try {
    const brands = await brandService.getAllActiveBrands();
    
    // Return only public information
    res.json(brands.map(brand => ({
      id: brand.id,
      name: brand.name,
      displayName: brand.displayName,
      slug: brand.slug,
      logoUrl: brand.logoUrl,
      primaryColor: brand.primaryColor,
      secondaryColor: brand.secondaryColor
    })));
  } catch (error) {
    console.error('Error listing brands:', error);
    res.status(500).json({ error: 'Failed to list brands' });
  }
});

// Admin endpoints - SECURED (requires JWT token)
router.post('/admin/create', verifyAdminToken, async (req, res) => {
  try {
    const brand = await brandService.createBrand(req.body);
    
    // Remove sensitive data from response
    const { wavespeedApiKey, openaiApiKey, ...safeBrand } = brand;
    res.json(safeBrand);
  } catch (error) {
    console.error('Error creating brand:', error);
    res.status(500).json({ error: 'Failed to create brand' });
  }
});

router.put('/admin/:id', verifyAdminToken, async (req, res) => {
  try {
    const brand = await brandService.updateBrand(parseInt(req.params.id), req.body);
    
    // Remove sensitive data from response
    const { wavespeedApiKey, openaiApiKey, ...safeBrand } = brand;
    res.json(safeBrand);
  } catch (error) {
    console.error('Error updating brand:', error);
    res.status(500).json({ error: 'Failed to update brand' });
  }
});

export default router;
