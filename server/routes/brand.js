import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { brandService } from '../services/brandService.js';
import { getBrandConfig, brandContextMiddleware } from '../middleware/brandContext.js';
import { verifyAdminToken } from './admin.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'jwt-secret-change-in-production';
const BRAND_TOKEN_EXPIRY = '24h';

// Brand-specific login endpoint
router.post('/:slug/login', async (req, res) => {
  try {
    const { password } = req.body;
    const { slug } = req.params;

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    // Get brand by slug
    const brand = await brandService.getBrandBySlug(slug);
    
    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' });
    }

    if (!brand.authPassword) {
      return res.status(403).json({ error: 'Brand authentication not configured' });
    }

    // Verify password
    const passwordValid = await bcrypt.compare(password, brand.authPassword);
    
    if (!passwordValid) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Generate brand-scoped JWT token
    const token = jwt.sign(
      {
        role: 'brand',
        brandId: brand.id,
        brandSlug: brand.slug,
        brandName: brand.name,
        timestamp: Date.now()
      },
      JWT_SECRET,
      { expiresIn: BRAND_TOKEN_EXPIRY }
    );

    res.json({
      success: true,
      token,
      brand: {
        id: brand.id,
        name: brand.name,
        displayName: brand.displayName,
        slug: brand.slug,
        logoUrl: brand.logoUrl,
        primaryColor: brand.primaryColor,
        secondaryColor: brand.secondaryColor
      },
      message: 'Login successful',
      expiresIn: BRAND_TOKEN_EXPIRY
    });
  } catch (error) {
    console.error('Brand login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current brand configuration (public data only)
router.get('/config', brandContextMiddleware, getBrandConfig);

// List all active brands
router.get('/list', async (req, res) => {
  try {
    const brands = await brandService.getAllActiveBrands();
    
    // Return only public information
    res.json({
      brands: brands.map(brand => ({
        id: brand.id,
        name: brand.name,
        displayName: brand.displayName,
        slug: brand.slug,
        logoUrl: brand.logoUrl,
        websiteUrl: brand.websiteUrl,
        brandbookUrl: brand.brandbookUrl,
        primaryColor: brand.primaryColor,
        secondaryColor: brand.secondaryColor,
        parentBrandId: brand.parentBrandId,
        brandType: brand.brandType,
        googleDriveBriefFolderId: brand.briefFolderId,
        googleDriveProductImagesFolderId: brand.productImagesFolderId,
        googleDriveEditedResultsFolderId: brand.editedResultsFolderId,
        defaultPrompt: brand.defaultPromptTemplate,
        batchSize: brand.batchSize || 15,
        estimatedManualTimePerImageMinutes: brand.estimatedManualTimePerImageMinutes || 5
      }))
    });
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
