import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET;

export function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: '24h' });
}

/**
 * Verifies JWT from Authorization header.
 * Returns { ok: true, user } or { ok: false, status, message }.
 */
export function verifyRequest(req) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return { ok: false, status: 401, message: 'Missing token' };
  try {
    const user = jwt.verify(token, SECRET);
    return { ok: true, user };
  } catch {
    return { ok: false, status: 401, message: 'Invalid or expired token' };
  }
}
