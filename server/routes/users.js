import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { db } from '../db.js';
import { users } from '../../shared/schema.js';
import { eq } from 'drizzle-orm';

const router = express.Router();

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required for user authentication');
}

const JWT_SECRET = process.env.JWT_SECRET;
const USER_TOKEN_EXPIRY = '7d';

// Test mode endpoint - allows bypassing authentication during testing
router.get('/test-mode', (req, res) => {
  const testMode = process.env.TEST_MODE === 'true';
  res.json({ testMode });
});

// Test mode auto-login - provides a test token without credentials
router.post('/test-login', async (req, res) => {
  try {
    // Only allow this endpoint if TEST_MODE is enabled
    if (process.env.TEST_MODE !== 'true') {
      return res.status(403).json({ error: 'Test mode is not enabled' });
    }

    // Get the first active user as the test user
    const [user] = await db.select().from(users).where(eq(users.active, true)).limit(1);
    
    if (!user) {
      return res.status(500).json({ error: 'No active users found for test mode' });
    }

    const token = jwt.sign(
      {
        role: 'user',
        userId: user.id,
        email: user.email,
        username: user.username,
        brandId: user.brandId,
        testMode: true,
        timestamp: Date.now()
      },
      JWT_SECRET,
      { expiresIn: USER_TOKEN_EXPIRY }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        brandId: user.brandId
      },
      message: 'Test mode login successful',
      expiresIn: USER_TOKEN_EXPIRY,
      testMode: true
    });
  } catch (error) {
    console.error('Test mode login error:', error);
    res.status(500).json({ error: 'Test login failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!user.active) {
      return res.status(403).json({ error: 'Account is not active' });
    }

    if (!user.passwordHash) {
      return res.status(500).json({ error: 'Account not properly configured' });
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    
    if (!passwordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    await db.update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id));

    const token = jwt.sign(
      {
        role: 'user',
        userId: user.id,
        email: user.email,
        username: user.username,
        brandId: user.brandId,
        timestamp: Date.now()
      },
      JWT_SECRET,
      { expiresIn: USER_TOKEN_EXPIRY }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        brandId: user.brandId
      },
      message: 'Login successful',
      expiresIn: USER_TOKEN_EXPIRY
    });
  } catch (error) {
    console.error('User login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/verify', verifyUserToken, (req, res) => {
  res.json({ 
    valid: true,
    user: req.userAuth
  });
});

export function verifyUserToken(req, res, next) {
  const token = req.headers['authorization']?.replace('Bearer ', '') || 
                req.headers['x-user-token'];
  
  if (!token) {
    return res.status(401).json({ error: 'No authentication token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (decoded.role !== 'user') {
      return res.status(403).json({ error: 'Invalid token type - user token required' });
    }

    req.userAuth = {
      userId: decoded.userId,
      email: decoded.email,
      username: decoded.username,
      brandId: decoded.brandId,
      role: decoded.role
    };
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', expired: true });
    }
    return res.status(403).json({ error: 'Invalid token' });
  }
}

export default router;
