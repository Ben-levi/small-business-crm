import { neon } from '@neondatabase/serverless';

// Lazy initialisation — neon() is only called on the first query,
// not at import time. This prevents startup crashes when DATABASE_URL
// is not yet configured (e.g. local dev without .env).
let _sql;
const sql = (strings, ...values) => {
  if (!_sql) _sql = neon(process.env.DATABASE_URL);
  return _sql(strings, ...values);
};

export default sql;
