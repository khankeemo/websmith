// FILE: lib/portal/db.ts
// PURPOSE: Shared PostgreSQL pool for the Universal Buy & Renew Portal
//          (/internal/api/buy and /internal/api/renew backend). Single pooled
//          connection — every portal route uses this module so the pool is
//          created once per server instance (mirrors the store route pattern).

import { Pool } from 'pg';

let pool: Pool | null = null;

export function getPortalDb(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 8000,
    });
  }
  return pool;
}
