# AVI CRM — Project Backlog & Progress Log

> Full development history, session notes, and pending work.
> Last updated: **2026-04-03** (Phase 4 UI refinements)

---

## Project Overview

| Item | Detail |
|---|---|
| **Name** | AVI CRM — Small Business CRM + Public Website |
| **Purpose** | Hebrew public marketing site + English back-office CRM for managing customers and orders |
| **Architecture** | Serverless (Vercel) + PostgreSQL (Neon) + Vanilla JS frontend |
| **Deployment** | Vercel (auto-deploy on push) |
| **Repository** | `d:\Ben\AVI CRM` |

---

## Tech Stack

### Backend
| Package | Version | Role |
|---|---|---|
| `@neondatabase/serverless` | ^0.9.0 | PostgreSQL (Neon serverless) |
| `bcryptjs` | ^2.4.3 | Password hashing |
| `jsonwebtoken` | ^9.0.2 | JWT authentication |
| `resend` | ^4.0.0 | Transactional email |
| `vercel` (dev) | ^34.0.0 | Deployment + local dev CLI |

### Frontend
- Pure Vanilla JS (ES modules), HTML5, CSS3
- Zero external UI frameworks (no React, Bootstrap, jQuery)
- Custom RTL-ready design system

### Infrastructure
- **Hosting**: Vercel (serverless functions)
- **Database**: Neon (PostgreSQL 16, serverless)
- **Email**: Resend (transactional)
- **Bot protection**: Cloudflare Turnstile
- **Error tracking**: Sentry (browser SDK + minimal HTTP reporter)
- **Analytics**: Vercel Analytics

---

## Database Schema

```
admins     (id, email, password_hash, created_at)
customers  (id, name, email, phone, address, notes, source, created_at)
orders     (id, customer_id, status, items JSONB, total, created_at, updated_at)
```

**Indexes:** full-text search on customer name, email, order status, customer_id, dates.

---

## Development Timeline

---

### Phase 0 — Initial Build *(pre-session, ~2025)*

**What was built:**
- 4-page Hebrew public website (Home, About, Services, Contact)
- CRM admin panel (Login, Customers list, Orders list, Customer detail)
- RESTful API: `/api/auth/login`, `/api/customers`, `/api/orders`, `/api/contact`
- JWT-based authentication (24h expiry, stored in localStorage)
- PostgreSQL schema with seed admin
- Vercel deployment config (`vercel.json`)
- `SETUP.md` deployment guide

**Tech decisions made:**
- Chose Vercel + Neon as zero-config serverless stack
- Kept frontend framework-free (vanilla JS) for minimal complexity
- Used Hebrew for public site, English for CRM admin
- `bcryptjs` for password hashing (10 salt rounds)

**State at end of phase:**
- Functional but no security hardening
- No accessibility attributes
- No email notifications
- No spam protection on contact form
- No error tracking

---

### Phase 1 — Security Hardening *(2026-03-25)*

**Motivation:** audit found no CSP headers, no rate limiting, no spam protection, JWT in localStorage.

**Changes made:**

| File | Change |
|---|---|
| `vercel.json` | Added 6 security headers: CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, HSTS |
| `api/auth/login.js` | Added in-memory rate limiter: 10 attempts / 15 min per IP → 429 |
| `public/contact.html` | Added Cloudflare Turnstile widget (anti-bot) |
| `public/js/contact.js` | Added Turnstile token to POST body |
| `api/contact.js` | Added server-side Turnstile verification via Cloudflare API |
| `.env` | Added `TURNSTILE_SECRET_KEY` placeholder |

**Security posture after phase:**
- ✅ CSP blocks XSS from unknown origins
- ✅ Clickjacking blocked (X-Frame-Options: DENY)
- ✅ HSTS enforces HTTPS
- ✅ Brute-force login blocked after 10 attempts
- ✅ Contact form protected from bot spam
- ⚠️ JWT still in localStorage (httpOnly cookie migration = Phase 4+)
- ⚠️ Rate limiter is in-memory (per serverless instance) — Upstash Redis = future

---

### Phase 2 — Accessibility (WCAG 2.1) *(2026-03-25)*

**Motivation:** audit found zero ARIA attributes, no skip links, non-semantic modals, missing form associations.

**Changes made:**

| File | What changed |
|---|---|
| `public/css/style.css` | Added `.skip-link`, `.visually-hidden`, `:focus-visible` ring, input focus `box-shadow` |
| `public/crm/customers.html` | Skip link, nav/aside ARIA labels, `aria-current="page"`, modal `role="dialog"` + `aria-modal` + focus trap + Escape key, `role="alert"` + `aria-live` on alerts, `scope="col"` on all `<th>`, `for=` on labels, `aria-required`, pagination `<nav>`, descriptive button `aria-label` ("Delete [name]") |
| `public/crm/orders.html` | Same set of fixes as customers.html |
| `public/crm/customer-detail.html` | Skip link, nav ARIA, `scope="col"` on table headers |
| `public/crm/login.html` | `role="alert"` + `aria-live="assertive"` on error div, `aria-required` on inputs |

**Accessibility posture after phase:**
- ✅ Screen reader can navigate all pages
- ✅ Keyboard users get skip navigation
- ✅ Modals trap focus, close on Escape, return focus to opener
- ✅ All form labels properly associated
- ✅ Tables readable by assistive tech
- ✅ Live regions announce alerts dynamically

---

### Phase 3 — Services Integration *(2026-03-25)*

**Motivation:** contact form was storing submissions to DB but sending no emails; no error visibility in production; no page analytics.

**Changes made:**

| File | Change |
|---|---|
| `package.json` | Added `resend ^4.0.0` dependency |
| `lib/email.js` (new) | Resend helper: `sendContactConfirmation()` (Hebrew, to user) + `sendAdminNotification()` (English, to admin) |
| `api/contact.js` | Sends both emails fire-and-forget after DB insert; added Sentry error capture on DB failure |
| `lib/sentry.js` (new) | Minimal Sentry HTTP reporter (no SDK; uses Sentry Store API directly) |
| `api/auth/login.js` | Wrapped DB call in try/catch; sends to Sentry on error |
| `vercel.json` | Updated CSP to allow `browser.sentry-cdn.com` + `*.ingest.sentry.io` |
| All 8 HTML files | Added Sentry browser SDK (CDN) + `_sentryDsn` init block |
| All 8 HTML files | Added Vercel Analytics (`/_vercel/insights/script.js`) |
| `.env` | Added `RESEND_API_KEY`, `FROM_EMAIL`, `ADMIN_EMAIL`, `SENTRY_DSN` placeholders |
| `SETUP.md` | New section 5: setup guide for Resend, Turnstile, Sentry, Vercel Analytics |

**Services posture after phase:**
- ✅ Contact form sends Hebrew confirmation to user
- ✅ Admin receives English email notification for every lead
- ✅ Server errors captured in Sentry
- ✅ Browser JS errors captured in Sentry
- ✅ Page views tracked in Vercel Analytics (GDPR-friendly, cookieless)

---

### Testing Infrastructure *(2026-03-25)*

**Problem:** `vercel dev` requires Vercel CLI authentication; `npx serve` only handles static files, not API routes.

**Solution built:**

| File | Purpose |
|---|---|
| `dev-server.js` (new) | Full-stack local dev server: serves `/public` as static + routes `/api/*` to real handler modules; applies security headers from vercel.json; loads `.env` automatically |
| `test.js` (new) | 39-test automated suite covering: static pages, security headers, method enforcement, input validation, authentication, rate limiting, accessibility HTML, monitoring scripts |
| `lib/db.js` | Fixed: changed from eager `neon(url)` at import to lazy init — prevents crash when `DATABASE_URL` is a placeholder |
| `package.json` | Added `"dev": "node dev-server.js"` and `"test": "node test.js"` scripts |

**Test results:** **39/39 passing** ✅

```
📄  Static Pages         8/8  ✅
🔒  Security Headers     5/5  ✅
🛡️   Method Enforcement   4/4  ✅
✅  Input Validation     3/3  ✅
🔑  Authentication       5/5  ✅
⏱️   Rate Limiting        1/1  ✅
♿  Accessibility        11/11 ✅
📡  Monitoring           2/2  ✅
```

---

## Current File Structure

```
AVI CRM/
├── api/
│   ├── auth/login.js          ← Rate-limited, Sentry-wrapped
│   ├── contact.js             ← Turnstile + email + Sentry
│   ├── customers/
│   │   ├── index.js           ← GET list, POST create
│   │   └── [id].js            ← GET, PUT, DELETE by id
│   └── orders/
│       ├── index.js           ← GET filtered list, POST create
│       └── [id].js            ← GET, PUT by id
├── lib/
│   ├── auth.js                ← JWT sign/verify
│   ├── db.js                  ← Lazy Neon connection
│   ├── email.js               ← Resend helper (NEW)
│   └── sentry.js              ← Minimal error reporter (NEW)
├── public/
│   ├── css/style.css          ← RTL-ready, skip-link, focus rings
│   ├── js/
│   │   ├── contact.js
│   │   └── crm/auth.js
│   ├── crm/
│   │   ├── login.html
│   │   ├── customers.html     ← Full ARIA, modal focus mgmt
│   │   ├── orders.html        ← Full ARIA, modal focus mgmt
│   │   └── customer-detail.html
│   ├── index.html             ← Hebrew, RTL
│   ├── about.html
│   ├── services.html
│   └── contact.html           ← Turnstile widget
├── dev-server.js              ← Local full-stack dev server (NEW)
├── test.js                    ← 39-test automated suite (NEW)
├── schema.sql
├── vercel.json                ← Security headers + rewrites
├── .env                       ← All service keys (gitignored)
├── SETUP.md                   ← Deployment guide
├── BACKLOG.md                 ← This file
└── MIGRATION_PLAN.md          ← Website integration plan
```

---

## Environment Variables Required

| Variable | Service | Status |
|---|---|---|
| `DATABASE_URL` | Neon (PostgreSQL) | Required — project won't work without it |
| `JWT_SECRET` | Auth | Required — use `openssl rand -hex 32` |
| `RESEND_API_KEY` | Resend email | Optional — emails silently skipped if missing |
| `FROM_EMAIL` | Resend email | Optional |
| `ADMIN_EMAIL` | Resend email | Optional |
| `TURNSTILE_SECRET_KEY` | Cloudflare | Optional — contact form open to bots if missing |
| `SENTRY_DSN` | Sentry | Optional — errors silently dropped if missing |

---

---

### Phase 4 — Git, Deployment & Hebrew CRM *(2026-04-03)*

**Motivation:** Project existed only as local files with no version control and no live deployment.

**Changes made:**

| Area | Change |
|---|---|
| **Git** | Initialized repository, created `.gitignore` (node_modules, .env, .vercel), made initial commit |
| **GitHub** | Created private repo `Ben-levi/small-business-crm`, pushed all code |
| **Vercel** | Linked GitHub repo, configured 7 env vars, deployed to `https://project-a35vl.vercel.app` |
| `vercel.json` | Removed invalid `"public": "public"` field that was failing schema validation |
| `schema.sql` | Fixed seed admin password hash — original hash was for `"password"` not `"admin123"` |
| **CRM UI** | Translated all 4 CRM pages to Hebrew (RTL): login, customers, orders, customer-detail |
| `public/css/style.css` | Added RTL fixes: sidebar border flips, table header text-align |
| `public/crm/login.html` | Hebrew: כניסה למערכת, אימייל, סיסמה, כניסה |
| `public/crm/customers.html` | Full Hebrew translation; dates in `he-IL` locale; source labels translated (ידני / טופס יצירת קשר) |
| `public/crm/orders.html` | Full Hebrew translation; ₪ instead of $; status labels in Hebrew; **replaced Customer ID input with customer name dropdown**; error display moved inside modal; try/catch on form submit |
| `public/crm/customer-detail.html` | Full Hebrew translation; status/source labels translated |
| `public/index.html` | Added CRM link in public homepage nav |
| `api/orders/index.js` | Fixed POST to save `status` field (was ignored before); added explicit `::text`/`::int`/`::date` type casts on all WHERE parameters to fix `"could not determine data type of parameter $1"` PostgreSQL error; wrapped GET in try/catch to return DB errors as JSON |

**State after phase:**
- ✅ Live at `https://project-a35vl.vercel.app`
- ✅ Auto-deploys on every `git push` to `main`
- ✅ Entire CRM UI in Hebrew with full RTL layout
- ✅ Orders page loads and saves correctly
- ✅ Add/edit order uses customer name dropdown (no more manual ID entry)

---

### Phase 4 — UI Refinements *(2026-04-03, same day)*

**Motivation:** Improve visual hierarchy and text readability on public pages; ensure consistent button styling.

**Changes made:**

| File | Change |
|---|---|
| `public/about.html` | Changed section heading and lead text color from white to blue (#2563eb); changed background from white to light gray (#f8fafc) for better contrast |
| `public/about.html` | Added new hero image (renamed from `Gemini_Generated_Image_iks28aiks28aiks2 (1).png` to `about-image.png` to fix display) |
| `public/index.html` | Changed contact button on hero banner from outline style (`btn-outline`) to primary blue style (`btn-primary`), matching services button |

**State after mini-phase:**
- ✅ About page text now blue on light gray background (improved readability)
- ✅ Hero banner buttons now consistent (both blue)
- ✅ Image now displays on about page without filename encoding issues

---

## Pending Work — Phase 5

### High Priority
- [ ] **CRM Dashboard** — home page with stats: total customers, orders by status, revenue, recent activity
- [ ] **CSV Export** — download all customers / filtered orders as `.csv`
- [ ] **Token refresh endpoint** — `/api/auth/refresh` so sessions extend without re-login

### Medium Priority
- [ ] **Hebrew/English toggle** in CRM (i18n groundwork)
- [ ] **Improved order form** — line-item support (name, qty, price) using the `items JSONB` column already in schema
- [ ] **Customer notes history** — timestamped notes per customer (requires schema change)

### Low Priority / Future
- [ ] **httpOnly cookie** for JWT instead of localStorage
- [ ] **Upstash Redis** for persistent cross-instance rate limiting
- [ ] **Stripe** integration for order payments
- [ ] **WhatsApp / SMS** notifications (Twilio)
- [ ] **Google OAuth** for admin login
- [ ] **Neon branching** for staging environment

---

## Known Issues & Technical Debt

| Issue | Severity | Notes |
|---|---|---|
| JWT in localStorage | Medium | Accessible to XSS; migrate to httpOnly cookie in Phase 4 |
| In-memory rate limiter | Low | Resets on cold start; acceptable for low-traffic CRM |
| `'unsafe-inline'` in CSP script-src | Low | Required by inline `onclick` handlers in dynamically built table rows; remove when refactoring to event delegation |
| `confirm()` for delete | Low | Not accessible; replace with custom modal in Phase 4 |
| No CSRF token on contact form | Low | Turnstile covers bot spam; CSRF risk is low on a public endpoint |
| Customer email must be unique | Low | `ON CONFLICT (email)` in contact API upserts; intentional but could overwrite notes |
