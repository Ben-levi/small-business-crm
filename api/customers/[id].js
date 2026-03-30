import sql from '../../lib/db.js';
import { verifyRequest } from '../../lib/auth.js';

export default async function handler(req, res) {
  const auth = verifyRequest(req);
  if (!auth.ok) return res.status(auth.status).json({ message: auth.message });

  const { id } = req.query;

  if (req.method === 'GET') {
    const [customer] = await sql`SELECT * FROM customers WHERE id = ${id}`;
    if (!customer) return res.status(404).json({ message: 'Customer not found' });

    const orders = await sql`
      SELECT * FROM orders WHERE customer_id = ${id} ORDER BY created_at DESC
    `;
    return res.status(200).json({ ...customer, orders });
  }

  if (req.method === 'PUT') {
    const { name, email, phone, address, notes } = req.body;
    const [updated] = await sql`
      UPDATE customers SET
        name    = COALESCE(${name    || null}, name),
        email   = COALESCE(${email   || null}, email),
        phone   = COALESCE(${phone   || null}, phone),
        address = COALESCE(${address || null}, address),
        notes   = COALESCE(${notes   || null}, notes)
      WHERE id = ${id}
      RETURNING *
    `;
    if (!updated) return res.status(404).json({ message: 'Customer not found' });
    return res.status(200).json(updated);
  }

  if (req.method === 'DELETE') {
    await sql`DELETE FROM orders WHERE customer_id = ${id}`;
    await sql`DELETE FROM customers WHERE id = ${id}`;
    return res.status(204).end();
  }

  res.status(405).json({ message: 'Method not allowed' });
}
