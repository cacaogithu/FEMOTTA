import express from 'express';
import jwt from 'jsonwebtoken';

const router = express.Router();

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

export default router;
