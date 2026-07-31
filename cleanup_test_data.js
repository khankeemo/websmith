const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://neondb_owner:npg_Ol4gL3VoJqrU@ep-rough-shadow-aqg7hh1h-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require', ssl: { rejectUnauthorized: false } });
await c.connect();

// Cleanup test data
await c.query("DELETE FROM otp_verifications WHERE email IN ('activation-test@websmithdigital.com', 'activation-test2@websmithdigital.com', 'test@websmithdigital.com')");
await c.query("DELETE FROM licenses WHERE customer_email IN ('activation-test@websmithdigital.com', 'activation-test2@websmithdigital.com')");
await c.query("DELETE FROM customers WHERE email IN ('activation-test@websmithdigital.com', 'activation-test2@websmithdigital.com')");
await c.query("DELETE FROM users WHERE email IN ('activation-test@websmithdigital.com', 'activation-test2@websmithdigital.com')");
await c.query("DELETE FROM trials WHERE customer_email IN ('activation-test@websmithdigital.com', 'activation-test2@websmithdigital.com')");
await c.query("DELETE FROM activations WHERE license_key IN ('H0RV-NM2F-D9P7-FA1I-1T67-5E2R', 'GORQ-3HAI-D181-USLA-HDJ5-QUOJ')");
await c.query("DELETE FROM customer_licenses WHERE customer_email IN ('activation-test@websmithdigital.com', 'activation-test2@websmithdigital.com')");

console.log('Test data cleanup done');
await c.end();