import bcrypt from 'bcryptjs';
import sql from '../../lib/db.js';
import { signToken } from '../../lib/auth.js';
import { captureException } from '../../lib/sentry.js';

// In-memory rate limiter (per serverless instance).
// For persistent cross-instance limiting use @upstash/ratelimit with Redis.
const loginAttempts = new Map(); // ip -> { count, windowStart }
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function isRateLimited(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record || now - record.windowStart > WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, windowStart: now });
    return false;
  }
  record.count += 1;
  return record.count > MAX_ATTEMPTS;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
  if (isRateLimited(ip)) {
    return res.status(429).json({ message: 'Too many login attempts. Try again in 15 minutes.' });
  }

  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

  try {
    const rows = await sql`SELECT * FROM admins WHERE email = ${email} LIMIT 1`;
    const admin = rows[0];
    if (!admin) return res.status(401).json({ message: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) return res.status(401).json({ message: 'Invalid credentials' });

    const token = signToken({ id: admin.id, email: admin.email });
    res.status(200).json({ token });
  } catch (err) {
    await captureException(err, { handler: 'login' });
    res.status(500).json({ message: 'Internal server error' });
  }
}
