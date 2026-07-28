import { Pool } from 'pg';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});
async function main() {
  const client = await pool.connect();
  try {
    // 1. Check API key
    const apikey = await client.query(
      `SELECT id, product_id, status, name FROM developer_api_keys WHERE api_key = $1`,
      ['pk_zeos_6d1222642b60654de7bd336b820484d20c01869997b9d557e634240cd0573860']
    );
    console.log('=== API KEY ===');
    console.log(JSON.stringify(apikey.rows, null, 2));

    // 2. Check trials for this hardware
    const trials = await client.query(
      `SELECT id, hardware_id, product_id, status, expiry_date, started_at, customer_email FROM trials WHERE hardware_id LIKE $1`,
      ['574bd1e119aee98e%']
    );
    console.log('\n=== TRIALS ===');
    console.log(JSON.stringify(trials.rows, null, 2));

    // 3. Additional check - any trials for this product
    if (apikey.rows.length > 0) {
      const apiProductId = apikey.rows[0].product_id;
      console.log(`\nAPI key product_id: ${apiProductId}`);
      
      // Unfiltered trial check
      const allTrials = await client.query(
        `SELECT id, hardware_id, product_id, status FROM trials WHERE hardware_id LIKE $1`,
        ['574bd1e119aee98e%']
      );
      console.log('\nUnfiltered trials for hardware:', JSON.stringify(allTrials.rows, null, 2));
      
      // Filtered query (what the API runs)
      const filteredTrials = await client.query(
        `SELECT id, hardware_id, product_id, status FROM trials WHERE hardware_id LIKE $1 AND product_id = $2`,
        ['574bd1e119aee98e%', apiProductId]
      );
      console.log('\nFiltered trials (with product_id):', JSON.stringify(filteredTrials.rows, null, 2));
    }
    
    // 4. Check product
    const products = await client.query(
      `SELECT product_id, name FROM products WHERE product_id LIKE $1`,
      ['prod_zem%']
    );
    console.log('\n=== PRODUCTS ===');
    console.log(JSON.stringify(products.rows, null, 2));

  } finally {
    client.release();
    pool.end();
  }
}
main().catch(console.error);
