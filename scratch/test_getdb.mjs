import pg from 'pg';
import fs from 'fs';

// Read .env into process.env
const envContent = fs.readFileSync('.env', 'utf-8');
for (const line of envContent.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx !== -1) {
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

async function testBackendDb() {
  const { getDb } = await import('../lib/backend-db/index.ts');
  console.log('Testing getDb()...');
  const pool = await getDb();
  console.log('getDb() success! Connected pool.');
  const client = await pool.connect();
  const res = await client.query('SELECT COUNT(*) FROM portal_users');
  console.log('portal_users count:', res.rows[0].count);
  client.release();
}

testBackendDb().catch(err => {
  console.error('getDb() FAILED:', err);
});
