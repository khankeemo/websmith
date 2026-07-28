const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});
async function main() {
  const client = await pool.connect();
  try {
    const apikey = await client.query(
      "SELECT id, product_id, status, name FROM developer_api_keys WHERE api_key = $1",
      ['pk_zeos_6d1222642b60654de7bd336b820484d20c01869997b9d557e634240cd0573860']
    );
    console.log('=== API KEY ===');
    console.log(JSON.stringify(apikey.rows, null, 2));

    const trials = await client.query(
      "SELECT id, hardware_id, product_id, status, expiry_date, started_at, customer_email FROM trials WHERE hardware_id LIKE $1",
      ['574bd1e119aee98e%']
    );
    console.log('\n=== TRIALS ===');
    console.log(JSON.stringify(trials.rows, null, 2));

    if (apikey.rows.length > 0) {
      const apiProductId = apikey.rows[0].product_id;
      console.log('\nAPI key product_id: ' + apiProductId);

      const filteredTrials = await client.query(
        "SELECT id, hardware_id, product_id, status FROM trials WHERE hardware_id LIKE $1 AND product_id = $2",
        ['574bd1e119aee98e%', apiProductId]
      );
      console.log('Filtered trials (with product_id): ' + JSON.stringify(filteredTrials.rows, null, 2));

      const unfilteredTrials = await client.query(
        "SELECT id, hardware_id, product_id, status FROM trials WHERE hardware_id LIKE $1",
        ['574bd1e119aee98e%']
      );
      console.log('Unfiltered trials: ' + JSON.stringify(unfilteredTrials.rows, null, 2));
    }
  } finally {
    client.release();
    pool.end();
  }
}
main().catch(console.error);
