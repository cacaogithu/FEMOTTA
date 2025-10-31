import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import logger, { logSecurity } from '../utils/logger.js';

// Rate limiting configuration
export const createRateLimiter = (options = {}) => {
  const {
    windowMs = parseInt(process.env.RATE_LIMIT_WINDOW || 15) * 60 * 1000, // 15 minutes
    max = parseInt(process.env.RATE_LIMIT_MAX || 100), // 100 requests per window
    message = 'Too many requests from this IP, please try again later.',
    skipSuccessfulRequests = false,
    skipFailedRequests = false
  } = options;

  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    skipFailedRequests,
    handler: (req, res) => {
      logSecurity('Rate limit exceeded', {
        ip: req.ip,
        url: req.url,
        method: req.method
      });
      res.status(429).json({
        error: message,
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  });
};

// Strict rate limiter for sensitive endpoints
export const strictRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many attempts, please try again later.'
});

// Standard rate limiter
export const standardRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100
});

// Upload rate limiter
export const uploadRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 uploads per hour
  message: 'Upload limit exceeded, please try again later.'
});

// API rate limiter
export const apiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  skipSuccessfulRequests: true
});

// Helmet security headers
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://api.openai.com', 'https://api.wavespeed.ai'],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
});

// CORS configuration
export const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      process.env.CLIENT_URL || 'http://localhost:5000',
      'http://localhost:3000',
      'http://localhost:5173' // Vite dev server
    ];

    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logSecurity('CORS blocked request', { origin });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Key'],
  maxAge: 86400 // 24 hours
};

// Request sanitization middleware
export const sanitizeRequest = (req, res, next) => {
  // Remove any potential script tags from request body
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = req.body[key]
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .trim();
      }
    });
  }
  next();
};

// IP whitelist middleware (for admin endpoints)
export const ipWhitelist = (allowedIPs = []) => {
  return (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    
    if (allowedIPs.length === 0) {
      return next(); // No whitelist configured, allow all
    }

    if (allowedIPs.includes(clientIP)) {
      next();
    } else {
      logSecurity('IP not whitelisted', { ip: clientIP, url: req.url });
      res.status(403).json({
        error: 'Access denied',
        message: 'Your IP address is not authorized to access this resource'
      });
    }
  };
};

// Request ID middleware for tracking
export const requestId = (req, res, next) => {
  req.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  res.setHeader('X-Request-ID', req.id);
  next();
};

// Security event logger
export const logSecurityEvent = (event, req, additionalData = {}) => {
  logSecurity(event, {
    ip: req.ip,
    url: req.url,
    method: req.method,
    userAgent: req.get('user-agent'),
    requestId: req.id,
    ...additionalData
  });
};

// Prevent parameter pollution
export const preventParameterPollution = (req, res, next) => {
  // Convert array parameters to single values (take first value)
  Object.keys(req.query).forEach(key => {
    if (Array.isArray(req.query[key])) {
      req.query[key] = req.query[key][0];
    }
  });
  next();
};

// Check for required environment variables
export const checkRequiredEnvVars = () => {
  const required = [
    'DATABASE_URL',
    'JWT_SECRET',
    'ADMIN_SECRET'
  ];

  const missing = required.filter(varName => !process.env[varName]);

  if (missing.length > 0) {
    logger.error({
      missing
    }, 'Missing required environment variables');
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Warn about insecure defaults
  const insecureDefaults = [];
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.includes('change-this')) {
    insecureDefaults.push('JWT_SECRET');
  }
  if (process.env.ADMIN_SECRET && process.env.ADMIN_SECRET.includes('change-this')) {
    insecureDefaults.push('ADMIN_SECRET');
  }

  if (insecureDefaults.length > 0) {
    logger.warn({
      insecureDefaults
    }, 'Insecure default values detected in environment variables');
  }
};
