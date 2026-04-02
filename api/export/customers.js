import sql from '../../lib/db.js';
import { verifyRequest } from '../../lib/auth.js';

export default async function handler(req, res) {
  const auth = verifyRequest(req);
  if (!auth.ok) return res.status(auth.status).json({ message: auth.message });

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const rows = await sql`
      SELECT id, name, email, phone, address, notes, source, created_at
      FROM customers
      ORDER BY created_at DESC
    `;

    // Convert to CSV
    const headers = ['ID', 'שם', 'אימייל', 'טלפון', 'כתובת', 'הערות', 'מקור', 'תאריך הצטרפות'];
    const csvRows = rows.map(c => [
      c.id,
      c.name,
      c.email || '',
      c.phone || '',
      c.address || '',
      (c.notes || '').replace(/"/g, '""'), // Escape quotes
      c.source || '',
      new Date(c.created_at).toLocaleDateString('he-IL')
    ]);

    const csv = [
      headers.join(','),
      ...csvRows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="customers.csv"');
    return res.status(200).send(csv);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}
