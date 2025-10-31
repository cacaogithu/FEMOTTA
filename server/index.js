import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import uploadRoutes from './routes/upload.js';
import resultsRoutes from './routes/results.js';
import imageRoutes from './routes/images.js';
import chatRoutes from './routes/chat.js';
import reEditRoutes from './routes/reEdit.js';
import feedbackRoutes from './routes/feedback.js';
import mlStatsRoutes from './routes/mlStats.js';
import psdRoutes from './routes/psd.js';
import brandRoutes from './routes/brand.js';
import adminRoutes from './routes/admin.js';
import subaccountsRoutes from './routes/subaccounts.js';
import mlRoutes from './routes/ml.js';
import processRoutes from './routes/process.js';

// Import security and logging middleware
import logger, { logRequest, logResponse } from './utils/logger.js';
import {
  securityHeaders,
  corsOptions,
  standardRateLimiter,
  sanitizeRequest,
  requestId,
  preventParameterPollution,
  checkRequiredEnvVars
} from './middleware/security.js';

// Load environment variables
dotenv.config();

// Check required environment variables
try {
  checkRequiredEnvVars();
} catch (error) {
  console.error('❌ Configuration Error:', error.message);
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ====================================
// SECURITY MIDDLEWARE
// ====================================

// Security headers (Helmet)
app.use(securityHeaders);

// Request ID for tracking
app.use(requestId);

// CORS with proper configuration
app.use(cors(corsOptions));

// Prevent parameter pollution
app.use(preventParameterPollution);

// ====================================
// BODY PARSERS
// ====================================

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ====================================
// REQUEST SANITIZATION
// ====================================

app.use(sanitizeRequest);

// ====================================
// LOGGING MIDDLEWARE
// ====================================

// Log all incoming requests
app.use((req, res, next) => {
  const startTime = Date.now();
  
  // Log request
  logRequest(req);
  
  // Capture response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logResponse(req, res, duration);
  });
  
  next();
});

// ====================================
// RATE LIMITING
// ====================================

// Apply standard rate limiting to all routes
app.use(standardRateLimiter);

// ====================================
// API ROUTES
// ====================================

// Brand routes (no auth required for config/list)
app.use('/api/brand', brandRoutes);

// Admin routes (with admin authentication)
app.use('/api/admin', adminRoutes);

// Subaccounts CRM routes
app.use('/api/subaccounts', subaccountsRoutes);

// ML Analysis routes
app.use('/api/ml', mlRoutes);

// Core functionality routes
app.use('/api/upload', uploadRoutes);
app.use('/api/process', processRoutes);
app.use('/api/results', resultsRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/re-edit', reEditRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/psd', psdRoutes);

// ====================================
// HEALTH CHECK
// ====================================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Server is running',
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Detailed health check for monitoring
app.get('/api/health/detailed', (req, res) => {
  const memoryUsage = process.memoryUsage();
  
  res.json({
    status: 'ok',
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
      external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`
    },
    node: {
      version: process.version,
      platform: process.platform,
      arch: process.arch
    }
  });
});

// ====================================
// FRONTEND STATIC FILES (Production)
// ====================================

const clientBuildPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientBuildPath));

// Serve index.html for all non-API routes (SPA routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(clientBuildPath, 'index.html'));
});

// ====================================
// ERROR HANDLING MIDDLEWARE
// ====================================

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  logger.warn({
    url: req.url,
    method: req.method
  }, 'API endpoint not found');
  
  res.status(404).json({
    error: 'Endpoint not found',
    message: `The endpoint ${req.method} ${req.url} does not exist`
  });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error({
    err,
    url: req.url,
    method: req.method,
    body: req.body,
    requestId: req.id
  }, 'Unhandled error');
  
  // Don't leak error details in production
  const errorResponse = {
    error: 'Internal server error',
    message: NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
    requestId: req.id
  };
  
  if (NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
  }
  
  res.status(err.status || 500).json(errorResponse);
});

// ====================================
// GRACEFUL SHUTDOWN
// ====================================

const gracefulShutdown = (signal) => {
  logger.info({ signal }, 'Received shutdown signal, closing server gracefully');
  
  server.close(() => {
    logger.info('Server closed successfully');
    process.exit(0);
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ====================================
// START SERVER
// ====================================

const server = app.listen(PORT, '0.0.0.0', () => {
  logger.info({
    port: PORT,
    environment: NODE_ENV,
    nodeVersion: process.version
  }, `🚀 FEMOTTA Server running on port ${PORT}`);
  
  if (NODE_ENV === 'development') {
    logger.info(`📝 API: http://localhost:${PORT}/api`);
    logger.info(`🏥 Health: http://localhost:${PORT}/api/health`);
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error({
    reason,
    promise
  }, 'Unhandled Promise Rejection');
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.fatal({
    err: error
  }, 'Uncaught Exception');
  process.exit(1);
});

export default app;
