import sql from '../../lib/db.js';
import { verifyRequest } from '../../lib/auth.js';

export default async function handler(req, res) {
  const auth = verifyRequest(req);
  if (!auth.ok) return res.status(auth.status).json({ message: auth.message });

  if (req.method === 'GET') {
    const { search = '', page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const term = `%${search}%`;

    const rows = await sql`
      SELECT * FROM customers
      WHERE name ILIKE ${term} OR email ILIKE ${term}
      ORDER BY created_at DESC
      LIMIT ${parseInt(limit)} OFFSET ${offset}
    `;
    const [{ count }] = await sql`
      SELECT COUNT(*) FROM customers
      WHERE name ILIKE ${term} OR email ILIKE ${term}
    `;
    return res.status(200).json({ customers: rows, total: parseInt(count) });
  }

  if (req.method === 'POST') {
    const { name, email, phone, address, notes } = req.body;
    if (!name) return res.status(400).json({ message: 'Name is required' });

    const [customer] = await sql`
      INSERT INTO customers (name, email, phone, address, notes)
      VALUES (${name}, ${email || null}, ${phone || null}, ${address || null}, ${notes || null})
      RETURNING *
    `;
    return res.status(201).json(customer);
  }

  res.status(405).json({ message: 'Method not allowed' });
}
