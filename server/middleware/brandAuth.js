import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'jwt-secret-change-in-production';

/**
 * Middleware to verify brand-scoped JWT tokens
 * Extracts and validates brand authentication tokens
 * Attaches brandId to request for downstream authorization
 */
export function verifyBrandToken(req, res, next) {
  const token = req.headers['authorization']?.replace('Bearer ', '') || 
                req.headers['x-brand-token'];
  
  if (!token) {
    return res.status(401).json({ error: 'No authentication token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (decoded.role !== 'brand') {
      return res.status(403).json({ error: 'Invalid token type - brand token required' });
    }

    // Attach brand information to request
    req.brandAuth = {
      brandId: decoded.brandId,
      brandSlug: decoded.brandSlug,
      brandName: decoded.brandName
    };
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', expired: true });
    }
    return res.status(403).json({ error: 'Invalid token' });
  }
}

/**
 * Middleware to accept either admin or brand tokens
 * Useful for routes that both admins and brand users can access
 */
export function verifyAdminOrBrandToken(req, res, next) {
  const adminToken = req.headers['x-admin-key'];
  const brandToken = req.headers['authorization']?.replace('Bearer ', '') || 
                     req.headers['x-brand-token'];
  
  const token = adminToken || brandToken;
  
  if (!token) {
    return res.status(401).json({ error: 'No authentication token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (decoded.role === 'admin') {
      req.isAdmin = true;
      req.admin = decoded;
    } else if (decoded.role === 'brand') {
      req.isBrand = true;
      req.brandAuth = {
        brandId: decoded.brandId,
        brandSlug: decoded.brandSlug,
        brandName: decoded.brandName
      };
    } else {
      return res.status(403).json({ error: 'Invalid token role' });
    }
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', expired: true });
    }
    return res.status(403).json({ error: 'Invalid token' });
  }
}

/**
 * Middleware to enforce brand data isolation
 * Ensures brand users can only access their own brand's data
 * Admins can access all data
 */
export function enforceBrandIsolation(req, res, next) {
  // If admin, allow access to all brands
  if (req.isAdmin) {
    return next();
  }

  // If brand user, ensure they're accessing their own brand's data
  if (req.isBrand) {
    const requestedBrandId = parseInt(req.params.brandId || req.body.brandId || req.query.brandId);
    
    if (requestedBrandId && requestedBrandId !== req.brandAuth.brandId) {
      return res.status(403).json({ 
        error: 'Access denied - you can only access your own brand data' 
      });
    }
    
    return next();
  }

  return res.status(403).json({ error: 'Unauthorized' });
}
