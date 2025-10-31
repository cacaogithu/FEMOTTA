import { body, param, query, validationResult } from 'express-validator';
import logger from '../utils/logger.js';

// Middleware to handle validation errors
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn({
      url: req.url,
      method: req.method,
      errors: errors.array()
    }, 'Validation failed');
    
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.path,
        message: err.msg,
        value: err.value
      }))
    });
  }
  next();
};

// Job ID validation
export const validateJobId = [
  param('jobId')
    .notEmpty()
    .withMessage('Job ID is required')
    .isString()
    .withMessage('Job ID must be a string')
    .trim(),
  handleValidationErrors
];

// Upload validation
export const validateUpload = [
  body('brandId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Brand ID must be a positive integer'),
  body('briefText')
    .optional()
    .isString()
    .withMessage('Brief text must be a string')
    .isLength({ max: 10000 })
    .withMessage('Brief text must not exceed 10000 characters')
    .trim(),
  handleValidationErrors
];

// Process images validation
export const validateProcessImages = [
  body('jobId')
    .notEmpty()
    .withMessage('Job ID is required')
    .isString()
    .withMessage('Job ID must be a string')
    .trim(),
  handleValidationErrors
];

// Re-edit validation
export const validateReEdit = [
  body('jobId')
    .notEmpty()
    .withMessage('Job ID is required')
    .isString()
    .withMessage('Job ID must be a string')
    .trim(),
  body('newPrompt')
    .notEmpty()
    .withMessage('New prompt is required')
    .isString()
    .withMessage('New prompt must be a string')
    .isLength({ min: 10, max: 2000 })
    .withMessage('New prompt must be between 10 and 2000 characters')
    .trim(),
  body('imageIds')
    .optional()
    .isArray()
    .withMessage('Image IDs must be an array'),
  body('imageIds.*')
    .optional()
    .isString()
    .withMessage('Each image ID must be a string'),
  handleValidationErrors
];

// Feedback validation
export const validateFeedback = [
  body('jobId')
    .notEmpty()
    .withMessage('Job ID is required')
    .isString()
    .withMessage('Job ID must be a string')
    .trim(),
  body('rating')
    .notEmpty()
    .withMessage('Rating is required')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  body('feedbackText')
    .optional()
    .isString()
    .withMessage('Feedback text must be a string')
    .isLength({ max: 5000 })
    .withMessage('Feedback text must not exceed 5000 characters')
    .trim(),
  body('goalAlignment')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Goal alignment must be between 1 and 5'),
  body('creativityScore')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Creativity score must be between 1 and 5'),
  body('technicalQuality')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Technical quality must be between 1 and 5'),
  handleValidationErrors
];

// Brand login validation
export const validateBrandLogin = [
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isString()
    .withMessage('Password must be a string')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  handleValidationErrors
];

// Admin login validation
export const validateAdminLogin = [
  body('adminSecret')
    .notEmpty()
    .withMessage('Admin secret is required')
    .isString()
    .withMessage('Admin secret must be a string'),
  handleValidationErrors
];

// Create brand validation
export const validateCreateBrand = [
  body('name')
    .notEmpty()
    .withMessage('Brand name is required')
    .isString()
    .withMessage('Brand name must be a string')
    .isLength({ min: 2, max: 100 })
    .withMessage('Brand name must be between 2 and 100 characters')
    .trim(),
  body('displayName')
    .notEmpty()
    .withMessage('Display name is required')
    .isString()
    .withMessage('Display name must be a string')
    .trim(),
  body('slug')
    .notEmpty()
    .withMessage('Slug is required')
    .isString()
    .withMessage('Slug must be a string')
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Slug must contain only lowercase letters, numbers, and hyphens')
    .trim(),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isString()
    .withMessage('Password must be a string')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  body('primaryColor')
    .optional()
    .matches(/^#[0-9A-Fa-f]{6}$/)
    .withMessage('Primary color must be a valid hex color'),
  body('secondaryColor')
    .optional()
    .matches(/^#[0-9A-Fa-f]{6}$/)
    .withMessage('Secondary color must be a valid hex color'),
  handleValidationErrors
];

// Pagination validation
export const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  handleValidationErrors
];

// Sanitize input to prevent XSS
export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return input
    .replace(/[<>]/g, '') // Remove < and >
    .trim();
};

// Validate file upload
export const validateFileUpload = (req, res, next) => {
  if (!req.file && !req.files) {
    return res.status(400).json({
      error: 'No file uploaded',
      details: 'Please upload at least one file'
    });
  }

  const maxSize = (process.env.MAX_FILE_SIZE_MB || 50) * 1024 * 1024; // Convert to bytes
  const files = req.files || [req.file];

  for (const file of files) {
    if (file.size > maxSize) {
      return res.status(400).json({
        error: 'File too large',
        details: `File ${file.originalname} exceeds maximum size of ${process.env.MAX_FILE_SIZE_MB || 50}MB`
      });
    }

    // Validate file type
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      return res.status(400).json({
        error: 'Invalid file type',
        details: `File ${file.originalname} has an unsupported type. Allowed types: JPEG, PNG, WEBP, PDF, DOCX`
      });
    }
  }

  next();
};
