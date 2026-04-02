import sql from '../../lib/db.js';
import { verifyRequest } from '../../lib/auth.js';

export default async function handler(req, res) {
  const auth = verifyRequest(req);
  if (!auth.ok) return res.status(auth.status).json({ message: auth.message });

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Fetch customers
    const customers = await sql`
      SELECT id, name, email, phone, address, notes, source, created_at
      FROM customers
      ORDER BY created_at DESC
    `;

    // Fetch orders
    const orders = await sql`
      SELECT o.id, o.customer_id, c.name AS customer_name, o.status, o.total, o.parts, o.procedure, o.notes, o.created_at
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      ORDER BY o.created_at DESC
    `;

    const statusHe = { pending: 'ממתין', processing: 'בעיבוד', shipped: 'נשלח', delivered: 'נמסר' };

    // Build customers CSV
    const customerHeaders = ['ID', 'שם', 'אימייל', 'טלפון', 'כתובת', 'הערות', 'מקור', 'תאריך הצטרפות'];
    const customerRows = customers.map(c => [
      c.id,
      c.name,
      c.email || '',
      c.phone || '',
      c.address || '',
      (c.notes || '').replace(/"/g, '""'),
      c.source || '',
      new Date(c.created_at).toLocaleDateString('he-IL')
    ]);

    // Build orders CSV
    const orderHeaders = ['ID', 'לקוח', 'סטטוס', 'סכום', 'חלקי סכום', 'תהליך', 'הערות', 'תאריך'];
    const orderRows = orders.map(o => [
      o.id,
      o.customer_name,
      statusHe[o.status] || o.status,
      o.total || 0,
      o.parts || '',
      o.procedure || '',
      (o.notes || '').replace(/"/g, '""'),
      new Date(o.created_at).toLocaleDateString('he-IL')
    ]);

    // Combine into single file
    const csv = [
      '=== לקוחות ===',
      customerHeaders.join(','),
      ...customerRows.map(row => row.map(cell => `"${cell}"`).join(',')),
      '',
      '=== הזמנות ===',
      orderHeaders.join(','),
      ...orderRows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Add UTF-8 BOM so Excel recognizes Hebrew characters
    const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
    const csvBuffer = Buffer.concat([bom, Buffer.from(csv, 'utf-8')]);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="export_all.csv"');
    return res.status(200).send(csvBuffer);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}
