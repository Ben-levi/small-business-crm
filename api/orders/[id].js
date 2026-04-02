import sql from '../../lib/db.js';
import { verifyRequest } from '../../lib/auth.js';

export default async function handler(req, res) {
  const auth = verifyRequest(req);
  if (!auth.ok) return res.status(auth.status).json({ message: auth.message });

  const { id } = req.query;

  if (req.method === 'GET') {
    const [order] = await sql`
      SELECT o.*, c.name AS customer_name
      FROM orders o JOIN customers c ON c.id = o.customer_id
      WHERE o.id = ${id}
    `;
    if (!order) return res.status(404).json({ message: 'Order not found' });
    return res.status(200).json(order);
  }

  if (req.method === 'PUT') {
    const { status, items, total, parts, procedure, notes } = req.body;
    const [updated] = await sql`
      UPDATE orders SET
        status     = COALESCE(${status || null}, status),
        items      = COALESCE(${items ? JSON.stringify(items) + '::jsonb' : null}, items),
        total      = COALESCE(${total  ?? null}, total),
        parts      = COALESCE(${parts  || null}, parts),
        procedure  = COALESCE(${procedure || null}, procedure),
        notes      = COALESCE(${notes || null}, notes),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;
    if (!updated) return res.status(404).json({ message: 'Order not found' });
    return res.status(200).json(updated);
  }

  res.status(405).json({ message: 'Method not allowed' });
}
