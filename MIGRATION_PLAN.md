# Website → CRM Migration & Integration Plan

> How to connect an existing website to AVI CRM's back-office database,
> or migrate existing website data into it.
> Created: **2026-03-25**

---

## Overview

You have an existing website (or a website you're about to build) and you want it to **share data** with this CRM. There are three distinct goals — you may need one, two, or all three:

| Goal | What it means |
|---|---|
| **A. Lead capture** | Contact forms / sign-up forms on any website automatically create customers in the CRM |
| **B. Data migration** | Import existing customer/order data from your old website, spreadsheet, or other system into the CRM database |
| **C. Live sync** | The existing website reads/writes customer or order data from the CRM database in real time |

---

## Scenario A — Lead Capture from External Website

**Use case:** Your business already has a WordPress, Wix, Squarespace, or custom website with a contact form. You want every submission to land in the CRM automatically.

### How it works

```
Visitor fills form on existing website
        ↓
Website sends a POST request to /api/contact
        ↓
CRM API validates, runs Turnstile check, saves to DB
        ↓
Confirmation email → visitor
Notification email → admin
```

### Implementation steps

**Step 1 — Expose the API publicly**
The `/api/contact` endpoint is already live. It accepts:
```json
POST https://your-crm.vercel.app/api/contact
Content-Type: application/json

{
  "name": "Israel Israeli",
  "email": "israel@example.com",
  "phone": "050-000-0000",
  "message": "I'm interested in your services"
}
```

**Step 2 — Handle CORS**
Add CORS headers to `api/contact.js` so the external website's domain is allowed:

```javascript
// In api/contact.js — add at the top of the handler
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',');
const origin = req.headers.origin || '';
if (ALLOWED_ORIGINS.includes(origin)) {
  res.setHeader('Access-Control-Allow-Origin', origin);
}
if (req.method === 'OPTIONS') {
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  return res.status(204).end();
}
```

Add `ALLOWED_ORIGINS=https://your-existing-site.com` to Vercel env vars.

**Step 3 — Connect from the external website**

*WordPress:* Use a plugin like **WPForms** or **Contact Form 7** with a webhook add-on, or add a custom JS snippet to the theme's `functions.php`:

```javascript
// Add to your existing form's submit handler
fetch('https://your-crm.vercel.app/api/contact', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name, email, phone, message }),
});
```

*Custom site:* Replace the existing `fetch('/api/contact', ...)` call with the full URL.

*Wix/Squarespace:* Use their "Custom Code" or "Webhook" feature to POST form data to the CRM API.

**Step 4 — Add Cloudflare Turnstile to the external site**
Add the same Turnstile widget used on the CRM contact form. Otherwise set `TURNSTILE_SECRET_KEY` to empty to skip verification for external requests.

**Result:** Every lead from every website you own ends up in one unified customer list in the CRM.

---

## Scenario B — One-Time Data Migration

**Use case:** You have existing customers/orders in another system (old CRM, spreadsheet, WordPress WooCommerce, etc.) and you want to import them into this CRM's database.

### Sub-scenario B1 — Import from CSV/Spreadsheet

**Step 1 — Prepare your CSV**

Export your existing data and match these columns:

```
name, email, phone, address, notes, source
```

Example:
```csv
name,email,phone,address,notes,source
"David Cohen","david@example.com","052-111-2222","Tel Aviv","VIP customer","old_crm"
"Sara Levi","sara@example.com","054-333-4444","Haifa","","spreadsheet"
```

**Step 2 — Run the import script**

Create `import-customers.js`:

```javascript
import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';

process.loadEnvFile();
const sql = neon(process.env.DATABASE_URL);

// Simple CSV parser (or use a library like csv-parse)
const lines = readFileSync('customers.csv', 'utf-8').trim().split('\n');
const headers = lines[0].split(',').map(h => h.replace(/"/g,'').trim());

let inserted = 0, skipped = 0;

for (const line of lines.slice(1)) {
  const values = line.match(/(".*?"|[^,]+)/g)
    ?.map(v => v.replace(/^"|"$/g,'').trim()) ?? [];
  const row = Object.fromEntries(headers.map((h, i) => [h, values[i] || null]));

  try {
    await sql`
      INSERT INTO customers (name, email, phone, address, notes, source)
      VALUES (${row.name}, ${row.email}, ${row.phone}, ${row.address}, ${row.notes}, ${row.source || 'import'})
      ON CONFLICT (email) DO NOTHING
    `;
    console.log(`  ✅  ${row.name}`);
    inserted++;
  } catch (err) {
    console.log(`  ⚠️  Skipped ${row.name}: ${err.message}`);
    skipped++;
  }
}

console.log(`\nDone: ${inserted} inserted, ${skipped} skipped.`);
```

Run: `node import-customers.js`

### Sub-scenario B2 — Import from WordPress / WooCommerce

WordPress stores data in MySQL. Export it to CSV using phpMyAdmin, then use the CSV importer above.

**WooCommerce customer → CRM customer mapping:**

| WooCommerce field | CRM field |
|---|---|
| `billing_first_name` + `billing_last_name` | `name` |
| `user_email` | `email` |
| `billing_phone` | `phone` |
| `billing_address_1` + `billing_city` | `address` |
| — | `source` = `'woocommerce'` |

**WooCommerce order → CRM order mapping:**

| WooCommerce field | CRM field |
|---|---|
| `order_total` | `total` |
| `post_status` | `status` (map: `wc-completed` → `delivered`, etc.) |
| `post_date` | `created_at` |
| Line items (JSON) | `items` (JSONB) |

### Sub-scenario B3 — Import from Another CRM (HubSpot, Pipedrive, Salesforce)

All major CRMs support CSV export. Export from the old CRM → clean the CSV to match the schema above → run the importer.

**HubSpot:** Contacts → Export → CSV → map fields
**Pipedrive:** Contacts → Export → CSV → map fields
**Salesforce:** Reports → Contacts → Export → CSV → map fields

---

## Scenario C — Live Integration (Shared Database)

**Use case:** Your existing website needs to read or write the same customer/order data as the CRM — in real time.

### Option C1 — Existing website calls CRM API (recommended)

The cleanest approach: the existing website calls the same REST API that the CRM admin uses.

**For public read-only data** (e.g., showing order status to a logged-in customer):

Add a new public endpoint:
```javascript
// api/orders/status.js — public, no admin token required
// Customer provides their email to look up their orders
export default async function handler(req, res) {
  const { email } = req.query;
  if (!email) return res.status(400).json({ message: 'Email required' });

  const customer = await sql`SELECT id FROM customers WHERE email = ${email} LIMIT 1`;
  if (!customer[0]) return res.status(404).json({ message: 'Not found' });

  const orders = await sql`
    SELECT id, status, total, created_at FROM orders
    WHERE customer_id = ${customer[0].id}
    ORDER BY created_at DESC
  `;
  res.status(200).json({ orders });
}
```

**For admin/authenticated write operations:** use the existing CRM API with a service JWT token:

```javascript
// Generate a long-lived service token for server-to-server use
// node -e "const jwt=require('jsonwebtoken'); console.log(jwt.sign({service:'website'},process.env.JWT_SECRET,{expiresIn:'365d'}))"
```

### Option C2 — Direct database connection (advanced)

If the existing website is also a Node.js / Next.js / Python app, it can connect directly to the Neon PostgreSQL database using the same `DATABASE_URL`.

```javascript
// In your existing website's server code
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL); // same DB as CRM
```

**Caution:** both applications then share the same database. Schema changes in one affect the other. Use this only if both are maintained together.

---

## Migration Checklist

### Before you start
- [ ] Identify which scenario(s) apply (A, B, C)
- [ ] Export your existing data to CSV and count rows
- [ ] Make a backup of the existing website's database
- [ ] Set up the CRM in production (Vercel + Neon) before migrating

### Lead capture (Scenario A)
- [ ] Add `ALLOWED_ORIGINS` env var in Vercel
- [ ] Add CORS handling to `api/contact.js`
- [ ] Update external website form to POST to CRM API
- [ ] Test a form submission end-to-end
- [ ] Verify customer appears in CRM admin

### Data import (Scenario B)
- [ ] Export existing data to CSV
- [ ] Map fields to CRM schema
- [ ] Run importer in **test mode** first (add `LIMIT 5` to the SQL)
- [ ] Check imported records in CRM admin
- [ ] Run full import
- [ ] Verify count matches

### Live sync (Scenario C)
- [ ] Choose API approach vs direct DB connection
- [ ] Generate service token (API) or share DATABASE_URL (direct)
- [ ] Add new public endpoints if needed
- [ ] Test read and write operations
- [ ] Monitor Sentry for errors post-launch

---

## Recommended Migration Order

```
Week 1:  Set up CRM in production (Vercel + Neon)
Week 1:  Run one-time data import from existing system (Scenario B)
Week 2:  Connect existing website's contact form to CRM API (Scenario A)
Week 2:  Test all flows end-to-end
Week 3+: Implement live sync features as needed (Scenario C)
```

---

## Questions to Answer Before Starting

To give a more specific technical plan, answer these:

1. **What platform is your existing website on?**
   (WordPress, Wix, Squarespace, custom Node.js, other)

2. **What data do you want to migrate?**
   (customers only, orders too, something else)

3. **How much data?**
   (approximate number of customers and orders)

4. **Do you need the websites to stay in sync going forward,**
   or is this a one-time migration?

5. **Does your existing website have a database?**
   (MySQL, SQLite, other PostgreSQL, no DB / static site)

Once these are answered, the plan can be made concrete with exact code and SQL queries tailored to your setup.
