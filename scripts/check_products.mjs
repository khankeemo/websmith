import pg from 'pg';
const pool = new pg.Pool({
  connectionString: 'postgresql://neondb_owner:npg_Ol4gL3VoJqrU@ep-rough-shadow-aqg7hh1h-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
});
try {
  const products = await pool.query('SELECT id, product_name, product_code FROM products LIMIT 5');
  console.log('Products:', JSON.stringify(products.rows, null, 2));
  const keys = await pool.query('SELECT id, api_key, product_id FROM api_keys LIMIT 5');
  console.log('\nAPI keys:', JSON.stringify(keys.rows, null, 2));
  const sdk = await pool.query('SELECT product_id, trial_duration_days, device_limit, offline_grace_days, cache_days, trial_message FROM sdk_runtime_settings LIMIT 5');
  console.log('\nsdk_runtime_settings:', JSON.stringify(sdk.rows, null, 2));
} catch (err) {
  console.error('ERROR:', err.message);
} finally {
  await pool.end();
}
