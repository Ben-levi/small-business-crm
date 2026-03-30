# Setup & Deployment Steps

## 1. Install dependencies
```bash
npm install
```

## 2. Create Neon database
1. Go to [neon.tech](https://neon.tech) and create a free account
2. Create a new project
3. Open the **SQL Editor** and run the contents of `schema.sql`
4. Copy the **connection string** (it looks like `postgresql://user:pass@host/dbname?sslmode=require`)

## 3. Configure environment variables
Edit `.env` and fill in your values:
```
DATABASE_URL=your_neon_connection_string_here
JWT_SECRET=any_long_random_string_here
```
To generate a strong JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 4. Test locally
```bash
npx vercel dev
```
Then open http://localhost:3000

## 5. Configure third-party services (optional but recommended)

### Resend (email)
1. Sign up at [resend.com](https://resend.com)
2. Create an API key → copy it to `RESEND_API_KEY`
3. Add and verify your sending domain → set `FROM_EMAIL` to a verified address
4. Set `ADMIN_EMAIL` to the inbox that receives contact-form notifications
> **Testing without a domain:** use `onboarding@resend.dev` as `FROM_EMAIL` and your own address as `ADMIN_EMAIL` — works immediately on Resend's free tier.

### Cloudflare Turnstile (spam protection)
1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Turnstile** → Add site
2. Copy the **Site Key** → replace `YOUR_TURNSTILE_SITE_KEY` in `public/contact.html` (line with `data-sitekey`)
3. Copy the **Secret Key** → set as `TURNSTILE_SECRET_KEY` in Vercel env vars

### Sentry (error tracking)
1. Sign up at [sentry.io](https://sentry.io) → create a new **JavaScript** project
2. Copy the DSN → set as `SENTRY_DSN` in Vercel env vars
3. In each HTML file, paste the same DSN into the `_sentryDsn` variable

### Vercel Analytics (page metrics)
No setup needed — automatically enabled when deployed on Vercel. View data in your Vercel project dashboard.

## 6. Deploy to Vercel
1. Push the project to a GitHub repository
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import your repo
3. In Vercel project settings → **Environment Variables**, add:
   - `DATABASE_URL` — your Neon connection string
   - `JWT_SECRET` — your secret string
   - `RESEND_API_KEY` — from resend.com (optional)
   - `FROM_EMAIL` — verified sender address (optional)
   - `ADMIN_EMAIL` — where to receive notifications (optional)
   - `TURNSTILE_SECRET_KEY` — from Cloudflare Turnstile (optional)
   - `SENTRY_DSN` — from sentry.io (optional)
4. Click **Deploy** — Vercel auto-deploys on every push to main

## 6. Connect Neon to Vercel (optional shortcut)
In Vercel → Settings → Integrations → search **Neon** → Connect.
This auto-injects `DATABASE_URL` into your Vercel environment.

## 7. Change the default admin password
The default admin seeded in `schema.sql` is:
- Email: `admin@example.com`
- Password: `admin123`

Generate a new bcrypt hash and update it:
```bash
node -e "const b=require('bcryptjs'); b.hash('yourNewPassword',10).then(console.log)"
```
Then run in Neon SQL editor:
```sql
UPDATE admins SET password_hash = '<paste hash here>' WHERE email = 'admin@example.com';
```

## URLs after deployment
| Page | URL |
|------|-----|
| Home | `https://your-domain.vercel.app/` |
| Contact | `https://your-domain.vercel.app/contact.html` |
| CRM Login | `https://your-domain.vercel.app/crm/login.html` |
| CRM Customers | `https://your-domain.vercel.app/crm/customers.html` |
| CRM Orders | `https://your-domain.vercel.app/crm/orders.html` |
