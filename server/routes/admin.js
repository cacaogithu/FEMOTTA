import express from 'express';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { scrapeWebsiteForBranding } from '../services/websiteScraper.js';
import { analyzeBrandbook } from '../services/brandbookAnalyzer.js';
import { uploadFileToDrive, makeFilePublic } from '../utils/googleDrive.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'change-this-in-production';
const JWT_SECRET = process.env.JWT_SECRET || 'jwt-secret-change-in-production';
const TOKEN_EXPIRY = '24h';

router.post('/login', (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }

  if (password !== ADMIN_SECRET) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  // Generate a short-lived JWT token instead of sending the raw secret
  const token = jwt.sign(
    { 
      role: 'admin',
      timestamp: Date.now()
    },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );

  res.json({ 
    success: true, 
    token,
    message: 'Login successful',
    expiresIn: TOKEN_EXPIRY
  });
});

// Middleware to verify JWT tokens
export function verifyAdminToken(req, res, next) {
  const token = req.headers['x-admin-key'];
  
  if (!token) {
    return res.status(403).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Invalid token role' });
    }
    req.admin = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', expired: true });
    }
    return res.status(403).json({ error: 'Invalid token' });
  }
}

// Endpoint to verify if token is still valid
router.get('/verify', verifyAdminToken, (req, res) => {
  res.json({ 
    valid: true, 
    admin: req.admin 
  });
});

// Scrape website for branding information
router.post('/scrape-website', verifyAdminToken, async (req, res) => {
  try {
    const { websiteUrl } = req.body;
    
    if (!websiteUrl) {
      return res.status(400).json({ error: 'Website URL is required' });
    }

    // Use default OpenAI key for scraping (from env or first brand)
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    const result = await scrapeWebsiteForBranding(websiteUrl, openaiApiKey);
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result.brandInfo);
  } catch (error) {
    console.error('Scrape website error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload logo file
router.post('/upload-logo', verifyAdminToken, upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Upload to a dedicated "brand-assets" folder in Google Drive
    const assetsFolderId = process.env.GOOGLE_DRIVE_ASSETS_FOLDER_ID || '1oBX3lAfZQq9gt4fMhBe7JBh7aKo-k697';
    
    const result = await uploadFileToDrive(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      assetsFolderId
    );

    // Make file public to get URL
    await makeFilePublic(result.id);
    const publicUrl = `https://drive.google.com/uc?export=view&id=${result.id}`;

    res.json({
      success: true,
      fileId: result.id,
      publicUrl: publicUrl,
      fileName: req.file.originalname
    });
  } catch (error) {
    console.error('Logo upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload brandbook file
router.post('/upload-brandbook', verifyAdminToken, upload.single('brandbook'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({ error: 'Only PDF files are supported for brandbooks' });
    }

    // Upload to Google Drive
    const assetsFolderId = process.env.GOOGLE_DRIVE_ASSETS_FOLDER_ID || '1oBX3lAfZQq9gt4fMhBe7JBh7aKo-k697';
    
    const uploadResult = await uploadFileToDrive(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      assetsFolderId
    );

    // Make file public to get URL
    await makeFilePublic(uploadResult.id);
    const publicUrl = `https://drive.google.com/uc?export=view&id=${uploadResult.id}`;

    // Analyze the brandbook
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return res.json({
        success: true,
        fileId: uploadResult.id,
        publicUrl: publicUrl,
        fileName: req.file.originalname,
        analyzed: false,
        message: 'Uploaded but not analyzed - OpenAI key not configured'
      });
    }

    const analysisResult = await analyzeBrandbook(publicUrl, openaiApiKey);

    res.json({
      success: true,
      fileId: uploadResult.id,
      publicUrl: publicUrl,
      fileName: req.file.originalname,
      analyzed: analysisResult.success,
      guidelines: analysisResult.guidelines,
      analysisError: analysisResult.error
    });
  } catch (error) {
    console.error('Brandbook upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete brand endpoint
router.delete('/brands/:id', verifyAdminToken, async (req, res) => {
  try {
    const { id } = req.params;
    const brandId = parseInt(id);

    if (isNaN(brandId)) {
      return res.status(400).json({ error: 'Invalid brand ID' });
    }

    // Import db and schema
    const { db } = await import('../storage.js');
    const { brands, jobs, images, editedImages, feedback } = await import('../../shared/schema.js');
    const { eq } = await import('drizzle-orm');

    // Check if brand exists
    const brand = await db.select().from(brands).where(eq(brands.id, brandId));
    
    if (!brand || brand.length === 0) {
      return res.status(404).json({ error: 'Brand not found' });
    }

    // Delete all related data in correct order
    // 1. Get all job IDs for this brand first
    const brandJobs = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.brandId, brandId));
    const jobIds = brandJobs.map(j => j.id);
    
    // 2. Delete all related data for each job
    for (const jobId of jobIds) {
      await db.delete(feedback).where(eq(feedback.jobId, jobId));
      await db.delete(editedImages).where(eq(editedImages.jobId, jobId));
      await db.delete(images).where(eq(images.jobId, jobId));
    }
    
    // 3. Delete jobs
    await db.delete(jobs).where(eq(jobs.brandId, brandId));
    
    // 4. Finally delete the brand
    await db.delete(brands).where(eq(brands.id, brandId));

    res.json({ 
      success: true, 
      message: `Brand ${brand[0].name} and all related data deleted successfully` 
    });
  } catch (error) {
    console.error('Delete brand error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
