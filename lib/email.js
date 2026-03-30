import { Resend } from 'resend';

// Requires: RESEND_API_KEY, FROM_EMAIL, ADMIN_EMAIL in Vercel environment variables.
// Sign up at resend.com → API Keys → Create Key
// Verify your sending domain at resend.com → Domains (or use onboarding@resend.dev for testing)

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM   = process.env.FROM_EMAIL  || 'noreply@yourdomain.com';
const ADMIN  = process.env.ADMIN_EMAIL || '';

/**
 * Send a Hebrew confirmation email to the person who filled the contact form.
 */
export async function sendContactConfirmation({ name, email, message }) {
  if (!process.env.RESEND_API_KEY || !email) return;
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: 'קיבלנו את הפנייה שלך — העסק שלי',
    html: `
      <div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1e293b;">
        <h2 style="color:#2563eb;">תודה, ${esc(name)}!</h2>
        <p>קיבלנו את הפנייה שלך ונחזור אליך תוך יום עסקים אחד.</p>
        ${message ? `
        <blockquote style="background:#f8fafc;padding:1rem;border-radius:8px;border-right:4px solid #2563eb;margin:1rem 0;">
          ${esc(message)}
        </blockquote>` : ''}
        <p style="margin-top:2rem;color:#64748b;font-size:.9rem;">העסק שלי</p>
      </div>
    `,
  });
}

/**
 * Send an English notification email to the admin when a contact form is submitted.
 */
export async function sendAdminNotification({ name, email, phone, message }) {
  if (!process.env.RESEND_API_KEY || !ADMIN) return;
  await resend.emails.send({
    from: FROM,
    to: ADMIN,
    subject: `New contact: ${name}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;color:#1e293b;">
        <h2>New contact form submission</h2>
        <table style="border-collapse:collapse;width:100%;font-size:.95rem;">
          <tr style="background:#f8fafc;">
            <td style="padding:.6rem 1rem;font-weight:600;width:100px;">Name</td>
            <td style="padding:.6rem 1rem;">${esc(name)}</td>
          </tr>
          <tr>
            <td style="padding:.6rem 1rem;font-weight:600;">Email</td>
            <td style="padding:.6rem 1rem;">${esc(email || '—')}</td>
          </tr>
          <tr style="background:#f8fafc;">
            <td style="padding:.6rem 1rem;font-weight:600;">Phone</td>
            <td style="padding:.6rem 1rem;">${esc(phone || '—')}</td>
          </tr>
          <tr>
            <td style="padding:.6rem 1rem;font-weight:600;vertical-align:top;">Message</td>
            <td style="padding:.6rem 1rem;">${esc(message || '—')}</td>
          </tr>
        </table>
      </div>
    `,
  });
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
