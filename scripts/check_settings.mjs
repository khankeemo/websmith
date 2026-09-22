import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  try {
    const res2 = await pool.query("SELECT * FROM mailboxes");
    console.log('mailboxes full:', JSON.stringify(res2.rows, null, 2));

    const cols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'system_settings'");
    console.log('system_settings cols:', cols.rows.map(r => r.column_name));

    const settings = await pool.query("SELECT * FROM system_settings LIMIT 10");
    console.log('system_settings data:', JSON.stringify(settings.rows, null, 2));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}
check();
