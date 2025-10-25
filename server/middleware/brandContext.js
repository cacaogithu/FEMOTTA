import { brandService } from '../services/brandService.js';

// Middleware to load brand context from subdomain, path, or header
export async function brandContextMiddleware(req, res, next) {
  try {
    let brandSlug = null;

    // Strategy 1: Check for brand in header (for API calls)
    if (req.headers['x-brand-slug']) {
      brandSlug = req.headers['x-brand-slug'];
    }
    
    // Strategy 2: Check for brand in path parameter
    if (req.params.brandSlug) {
      brandSlug = req.params.brandSlug;
    }
    
    // Strategy 3: Check for brand in query parameter
    if (req.query.brand) {
      brandSlug = req.query.brand;
    }
    
    // Strategy 4: Default to 'corsair' for backwards compatibility
    if (!brandSlug) {
      brandSlug = 'corsair';
    }

    // Load brand from database
    const brand = await brandService.getBrandBySlug(brandSlug);
    
    if (!brand) {
      return res.status(404).json({ 
        error: 'Brand not found',
        slug: brandSlug 
      });
    }

    if (!brand.active) {
      return res.status(403).json({ 
        error: 'Brand is not active',
        slug: brandSlug 
      });
    }

    // Attach brand to request for use in controllers
    req.brand = brand;
    req.brandId = brand.id;
    
    next();
  } catch (error) {
    console.error('Brand context middleware error:', error);
    res.status(500).json({ error: 'Failed to load brand context' });
  }
}

// Middleware to get brand configuration (for frontend)
export async function getBrandConfig(req, res) {
  try {
    const brand = req.brand;
    
    // Return only public brand configuration (no API keys)
    res.json({
      id: brand.id,
      name: brand.name,
      displayName: brand.displayName,
      slug: brand.slug,
      logoUrl: brand.logoUrl,
      primaryColor: brand.primaryColor,
      secondaryColor: brand.secondaryColor,
      aiSettings: brand.aiSettings,
      defaultPromptTemplate: brand.defaultPromptTemplate
    });
  } catch (error) {
    console.error('Error getting brand config:', error);
    res.status(500).json({ error: 'Failed to get brand configuration' });
  }
}
