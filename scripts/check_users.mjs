import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  try {
    const portalUsers = await pool.query('SELECT * FROM portal_users');
    console.log('portal_users count:', portalUsers.rowCount);
    console.log('portal_users rows:', JSON.stringify(portalUsers.rows, null, 2));

    const allTables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%user%'");
    console.log('user tables:', allTables.rows);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}
check();
