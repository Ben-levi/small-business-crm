import sql from '../../lib/db.js';
import { verifyRequest } from '../../lib/auth.js';

export default async function handler(req, res) {
  const auth = verifyRequest(req);
  if (!auth.ok) return res.status(auth.status).json({ message: auth.message });

  if (req.method === 'GET') {
    const { status, customer_id, from, to, page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const rows = await sql`
      SELECT o.*, c.name AS customer_name
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      WHERE
        (${status      || null} IS NULL OR o.status      = ${status      || null})
        AND (${customer_id || null} IS NULL OR o.customer_id = ${parseInt(customer_id) || null})
        AND (${from        || null} IS NULL OR o.created_at >= ${from        || null}::date)
        AND (${to          || null} IS NULL OR o.created_at <= ${to          || null}::date)
      ORDER BY o.created_at DESC
      LIMIT ${parseInt(limit)} OFFSET ${offset}
    `;
    const [{ count }] = await sql`
      SELECT COUNT(*) FROM orders o
      WHERE
        (${status      || null} IS NULL OR o.status      = ${status      || null})
        AND (${customer_id || null} IS NULL OR o.customer_id = ${parseInt(customer_id) || null})
        AND (${from        || null} IS NULL OR o.created_at >= ${from        || null}::date)
        AND (${to          || null} IS NULL OR o.created_at <= ${to          || null}::date)
    `;
    return res.status(200).json({ orders: rows, total: parseInt(count) });
  }

  if (req.method === 'POST') {
    const { customer_id, items, total } = req.body;
    if (!customer_id) return res.status(400).json({ message: 'customer_id is required' });

    const [order] = await sql`
      INSERT INTO orders (customer_id, items, total)
      VALUES (${customer_id}, ${JSON.stringify(items || [])}::jsonb, ${total || 0})
      RETURNING *
    `;
    return res.status(201).json(order);
  }

  res.status(405).json({ message: 'Method not allowed' });
}
