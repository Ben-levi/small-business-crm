#!/usr/bin/env node
/**
 * AVI CRM — Full System Test
 * Requires: vercel dev running on http://localhost:3000
 * Run:      npm test
 */

const BASE = process.env.TEST_BASE ?? 'http://localhost:3000';
let passed = 0, failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅  ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌  ${name}`);
    console.log(`       → ${err.message}`);
    failed++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg ?? 'Assertion failed');
}
function assertStatus(res, expected) {
  assert(res.status === expected, `Expected HTTP ${expected}, got ${res.status}`);
}
function assertHeader(headers, key, contains) {
  const val = headers.get(key.toLowerCase()) ?? '';
  assert(val.toLowerCase().includes(contains.toLowerCase()),
    `Header "${key}": expected "${contains}", got "${val}"`);
}

async function main() {
  console.log(`\n${'═'.repeat(52)}`);
  console.log(`  🧪  AVI CRM — Full System Test`);
  console.log(`  🌐  ${BASE}`);
  console.log(`  🕐  ${new Date().toLocaleString('he-IL')}`);
  console.log(`${'═'.repeat(52)}\n`);

  // ── 1. Static Pages ──────────────────────────────────────
  console.log('📄  Static Pages');

  const pages = [
    ['/', 'he', 'rtl', 'העסק שלי'],
    ['/about.html', 'he', 'rtl', 'אודות'],
    ['/services.html', 'he', 'rtl', 'שירותים'],
    ['/contact.html', 'he', 'rtl', 'צור קשר'],
    ['/crm/login.html', 'en', null, 'CRM Login'],
    ['/crm/customers.html', 'en', null, 'Customers'],
    ['/crm/orders.html', 'en', null, 'Orders'],
    ['/crm/customer-detail.html', 'en', null, 'CRM'],
  ];

  for (const [path, lang, dir, content] of pages) {
    await test(path, async () => {
      const res = await fetch(`${BASE}${path}`);
      assertStatus(res, 200);
      const html = await res.text();
      assert(html.includes('<!DOCTYPE html>'), 'Missing DOCTYPE');
      assert(html.includes(`lang="${lang}"`), `Missing lang="${lang}"`);
      if (dir) assert(html.includes(`dir="${dir}"`), `Missing dir="${dir}"`);
      assert(html.includes(content), `Missing expected text: "${content}"`);
    });
  }

  // ── 2. Security Headers ──────────────────────────────────
  console.log('\n🔒  Security Headers');

  const homeRes = await fetch(`${BASE}/`);
  const h = homeRes.headers;

  await test('X-Content-Type-Options: nosniff',  () => assertHeader(h, 'x-content-type-options', 'nosniff'));
  await test('X-Frame-Options: DENY',             () => assertHeader(h, 'x-frame-options', 'deny'));
  await test('Referrer-Policy present',           () => assert(h.get('referrer-policy'), 'Missing header'));
  await test('Permissions-Policy present',        () => assert(h.get('permissions-policy'), 'Missing header'));
  await test('Content-Security-Policy set', () => {
    const csp = h.get('content-security-policy') ?? '';
    assert(csp.includes("default-src 'self'"), `CSP missing default-src: ${csp}`);
  });

  // ── 3. API — HTTP Method Enforcement ────────────────────
  console.log('\n🛡️   API — Method Enforcement');

  await test('GET  /api/auth/login → 405',   async () => assertStatus(await fetch(`${BASE}/api/auth/login`), 405));
  await test('GET  /api/contact → 405',       async () => assertStatus(await fetch(`${BASE}/api/contact`), 405));
  // Auth-protected routes: auth check runs before method check → 401 (not 405) for unauthenticated requests
  await test('DELETE /api/customers (no token) → 401', async () => assertStatus(await fetch(`${BASE}/api/customers`, { method: 'DELETE' }), 401));
  await test('PATCH /api/orders (no token) → 401',     async () => assertStatus(await fetch(`${BASE}/api/orders`,    { method: 'PATCH'  }), 401));

  // ── 4. API — Input Validation ────────────────────────────
  console.log('\n✅  API — Input Validation');

  await test('Login: empty body → 400', async () => {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assertStatus(res, 400);
    const data = await res.json();
    assert(data.message, 'Expected error message in JSON body');
  });

  await test('Login: email only, no password → 400', async () => {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com' }),
    });
    assertStatus(res, 400);
  });

  await test('Contact: missing name → 400', async () => {
    const res = await fetch(`${BASE}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'someone@test.com', message: 'hello' }),
    });
    assertStatus(res, 400);
  });

  // ── 5. API — Authentication ──────────────────────────────
  console.log('\n🔑  API — Authentication');

  await test('GET /api/customers — no token → 401', async () =>
    assertStatus(await fetch(`${BASE}/api/customers`), 401));

  await test('GET /api/customers — bad token → 401', async () =>
    assertStatus(await fetch(`${BASE}/api/customers`, {
      headers: { Authorization: 'Bearer not_a_real_token_at_all' },
    }), 401));

  await test('GET /api/orders — no token → 401', async () =>
    assertStatus(await fetch(`${BASE}/api/orders`), 401));

  await test('GET /api/customers/1 — no token → 401', async () =>
    assertStatus(await fetch(`${BASE}/api/customers/1`), 401));

  await test('DELETE /api/customers/1 — no token → 401', async () =>
    assertStatus(await fetch(`${BASE}/api/customers/1`, { method: 'DELETE' }), 401));

  // ── 6. Rate Limiting ─────────────────────────────────────
  console.log('\n⏱️   Rate Limiting');

  await test('11 login attempts from same IP → at least one 429', async () => {
    // Use a dedicated RFC-5737 test IP so this never pollutes the
    // rate-limit bucket for localhost (::1), keeping other tests clean.
    const reqs = Array.from({ length: 11 }, () =>
      fetch(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': '192.0.2.99',
        },
        body: JSON.stringify({ email: 'ratelimit@test.com', password: 'wrongpass' }),
      })
    );
    const responses = await Promise.all(reqs);
    const statuses = responses.map(r => r.status);
    assert(statuses.includes(429), `No 429 found. Got: [${statuses.join(', ')}]`);
  });

  // ── 7. Accessibility HTML Structure ──────────────────────
  console.log('\n♿  Accessibility');

  const [custHtml, loginHtml, ordersHtml, contactHtml] = await Promise.all([
    fetch(`${BASE}/crm/customers.html`).then(r => r.text()),
    fetch(`${BASE}/crm/login.html`).then(r => r.text()),
    fetch(`${BASE}/crm/orders.html`).then(r => r.text()),
    fetch(`${BASE}/contact.html`).then(r => r.text()),
  ]);

  await test('Skip navigation link in CRM pages', () =>
    assert(custHtml.includes('class="skip-link"'), 'Missing .skip-link'));

  await test('Modal has role="dialog" + aria-modal', () => {
    assert(custHtml.includes('role="dialog"'), 'Missing role="dialog"');
    assert(custHtml.includes('aria-modal="true"'), 'Missing aria-modal="true"');
  });

  await test('Modal aria-labelledby points to title', () =>
    assert(custHtml.includes('aria-labelledby="modalTitle"'), 'Missing aria-labelledby'));

  await test('Alert divs have role="alert" + aria-live', () => {
    assert(custHtml.includes('role="alert"'), 'customers.html missing role="alert"');
    assert(loginHtml.includes('aria-live="assertive"'), 'login.html missing aria-live');
  });

  await test('Table headers have scope="col" (customers + orders)', () => {
    assert(custHtml.includes('scope="col"'), 'customers.html missing scope="col"');
    assert(ordersHtml.includes('scope="col"'), 'orders.html missing scope="col"');
  });

  await test('Form labels linked with for= attributes', () => {
    assert(custHtml.includes('for="cName"'), 'Missing for="cName"');
    assert(ordersHtml.includes('for="oCustomerId"'), 'Missing for="oCustomerId"');
  });

  await test('Required inputs have aria-required="true"', () => {
    assert(custHtml.includes('aria-required="true"'), 'customers.html missing aria-required');
    assert(loginHtml.includes('aria-required="true"'), 'login.html missing aria-required');
  });

  await test('Pagination wrapped in <nav> with aria-label', () =>
    assert(custHtml.includes('<nav class="pagination"'), 'Pagination not in <nav>'));

  await test('Sidebar has aria-label="CRM navigation"', () =>
    assert(custHtml.includes('aria-label="CRM navigation"'), 'Sidebar missing aria-label'));

  await test('Active sidebar link has aria-current="page"', () =>
    assert(custHtml.includes('aria-current="page"'), 'Missing aria-current="page"'));

  await test('Contact form has Cloudflare Turnstile widget', () =>
    assert(contactHtml.includes('cf-turnstile'), 'Missing Turnstile widget'));

  // ── 8. Sentry + Analytics ────────────────────────────────
  console.log('\n📡  Monitoring Scripts');

  const allPages = await Promise.all(
    ['/', '/crm/customers.html', '/crm/login.html'].map(p =>
      fetch(`${BASE}${p}`).then(r => r.text())
    )
  );

  await test('Sentry SDK included on all checked pages', () => {
    for (const [i, html] of allPages.entries()) {
      assert(html.includes('sentry-cdn.com'), `Page ${i} missing Sentry SDK`);
    }
  });

  await test('Vercel Analytics script included on public pages', () => {
    assert(allPages[0].includes('/_vercel/insights/script.js'),
      'Home page missing Vercel Analytics');
  });

  // ── Summary ───────────────────────────────────────────────
  const total = passed + failed;
  console.log(`\n${'═'.repeat(52)}`);
  console.log(`  📊  Results: ${passed} passed, ${failed} failed  (${total} total)`);
  if (failed > 0) {
    console.log(`  ⚠️   ${failed} test(s) need attention`);
  } else {
    console.log(`  🎉  All ${total} tests passed!`);
  }
  console.log(`${'═'.repeat(52)}\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('\n💥 Test runner crashed:', err.message);
  process.exit(1);
});
