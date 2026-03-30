import sql from '../lib/db.js';
import { sendContactConfirmation, sendAdminNotification } from '../lib/email.js';
import { captureException } from '../lib/sentry.js';

// Verify Cloudflare Turnstile token.
// Set TURNSTILE_SECRET_KEY in Vercel environment variables (from dash.cloudflare.com/turnstile).
async function verifyTurnstile(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // skip if not configured yet
  if (!token) return false;

  const form = new URLSearchParams({ secret, response: token, remoteip: ip || '' });
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: form,
  });
  const data = await r.json();
  return data.success === true;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  const { name, email, phone, message, turnstileToken } = req.body;
  if (!name) return res.status(400).json({ message: 'Name is required' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || '';
  const humanVerified = await verifyTurnstile(turnstileToken, ip);
  if (!humanVerified) return res.status(403).json({ message: 'אימות נכשל. נסה שוב.' });

  try {
    await sql`
      INSERT INTO customers (name, email, phone, notes, source)
      VALUES (${name}, ${email || null}, ${phone || null}, ${message || null}, 'contact_form')
      ON CONFLICT (email) DO UPDATE SET
        phone  = EXCLUDED.phone,
        notes  = EXCLUDED.notes,
        source = 'contact_form'
    `;
  } catch (err) {
    await captureException(err, { handler: 'contact', name, email });
    return res.status(500).json({ message: 'אירעה שגיאה. נסה שוב מאוחר יותר.' });
  }

  // Fire-and-forget emails — don't let email failure block the response
  Promise.all([
    sendContactConfirmation({ name, email, message }),
    sendAdminNotification({ name, email, phone, message }),
  ]).catch(() => {});

  res.status(200).json({ message: 'Message received. We will be in touch!' });
}
