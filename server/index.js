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
import batchRoutes from './routes/batch.js';
import feedbackRoutes from './routes/feedback.js';
import mlStatsRoutes from './routes/mlStats.js';
import psdRoutes from './routes/psd.js';
import brandRoutes from './routes/brand.js';
import adminRoutes from './routes/admin.js';
import subaccountsRoutes from './routes/subaccounts.js';
import mlRoutes from './routes/ml.js';
import userRoutes from './routes/users.js';
import historyRoutes from './routes/history.js';
import canvasTestRoutes from './routes/canvasTest.js';
import { setupAuth, isAuthenticated } from './replitAuth.js';
import { storage } from './storage.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

async function initializeAuth() {
  try {
    if (process.env.SESSION_SECRET && process.env.REPL_ID) {
      await setupAuth(app);
      console.log('[Auth] Replit Auth initialized successfully');
      
      app.get('/api/auth/user', isAuthenticated, async (req, res) => {
        try {
          const userId = req.user.claims.sub;
          const user = await storage.getUserByReplitId(userId);
          if (!user) {
            return res.status(404).json({ message: "User not found" });
          }
          res.json({
            id: user.id,
            email: user.email,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            profileImageUrl: user.profileImageUrl,
            role: user.role,
            brandId: user.brandId,
          });
        } catch (error) {
          console.error("Error fetching user:", error);
          res.status(500).json({ message: "Failed to fetch user" });
        }
      });
    } else {
      console.log('[Auth] Replit Auth not configured, using JWT-only authentication');
    }
  } catch (error) {
    console.error('[Auth] Failed to initialize Replit Auth:', error.message);
  }
}

initializeAuth();

// Brand routes (no auth required for config/list)
app.use('/api/brand', brandRoutes);

// Admin routes
app.use('/api/admin', adminRoutes);

// User routes
app.use('/api/users', userRoutes);

// Subaccounts CRM routes
app.use('/api/subaccounts', subaccountsRoutes);

// ML Analysis routes
app.use('/api/ml', mlRoutes);
app.use('/api/ml-stats', mlStatsRoutes);

// Gemini Batch API routes
app.use('/api/batch', batchRoutes);

app.use('/api/upload', uploadRoutes);
app.use('/api/results', resultsRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/re-edit', reEditRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/psd', psdRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/psd', psdRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/canvas-test', canvasTestRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Serve frontend build files in production only
if (process.env.NODE_ENV === 'production') {
  const clientBuildPath = path.join(__dirname, '../client/dist');
  app.use(express.static(clientBuildPath));

  // Serve index.html for all non-API routes (SPA routing)
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});