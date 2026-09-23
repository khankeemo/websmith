#!/usr/bin/env node
import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Pool } = pg;

function getEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    throw new Error('.env file not found in ' + process.cwd());
  }
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const env = {};
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
      env[key] = val;
    }
  }
  return env;
}

const COLLECTIONS = [
  'users',
  'clients',
  'projects',
  'tickets',
  'resolution_templates',
  'uploads',
  'notifications',
  'settings',
  'services',
  'project_offerings',
  'tasks',
  'invoices',
  'payments',
  'leads',
  'softwarestorelistings',
  'directmessages',
  'softwarestoreinquiries',
  'paymentwebhookevents',
  'notification_logs',
  'cms_industries',
  'cms_service_categories',
  'cms_services'
];

const MIGRATIONS = [
  {
    filename: '000_schema.sql',
    sql: `
      ALTER TABLE trial_templates ADD COLUMN IF NOT EXISTS is_permanent BOOLEAN DEFAULT FALSE;
      UPDATE trial_templates SET is_permanent = TRUE WHERE is_system_default = TRUE;
    `
  },
  {
    filename: '001_trial_audit_logs.sql',
    sql: `
      CREATE TABLE IF NOT EXISTS trial_audit_logs (
        id SERIAL PRIMARY KEY,
        trial_id INTEGER REFERENCES trials(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL,
        message TEXT,
        ip_address TEXT,
        metadata JSONB,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `
  },
  {
    filename: '002_universal_trial.sql',
    sql: `
      ALTER TABLE trial_templates ADD COLUMN IF NOT EXISTS is_permanent BOOLEAN DEFAULT FALSE;
      UPDATE trial_templates SET is_permanent = TRUE WHERE is_system_default = TRUE;
      ALTER TABLE products DROP COLUMN IF EXISTS default_trial_template_id;
      INSERT INTO trial_templates (name, description, duration_days, is_active, is_system_default, is_permanent, max_devices, max_hardware_changes)
      SELECT 'Universal Trial', 'Universal evaluation license automatically available for every product. Trial activates automatically on first successful installation and counts down from first activation.', 7, true, true, true, 1, 1
      WHERE NOT EXISTS (SELECT 1 FROM trial_templates WHERE is_system_default = TRUE);
      UPDATE trial_templates SET is_system_default = TRUE, is_permanent = TRUE WHERE name = 'Universal Trial';
    `
  },
  {
    filename: '003_cleanup_templates.sql',
    sql: `
      DELETE FROM trial_templates WHERE is_permanent = FALSE AND name IN ('Starter', 'Basic', 'Professional', 'Enterprise', 'Lifetime');
      UPDATE trial_templates SET is_system_default = TRUE, is_permanent = TRUE WHERE name = 'Universal Trial';
      UPDATE trial_templates SET is_system_default = FALSE WHERE name != 'Universal Trial';
      UPDATE trial_templates SET is_permanent = FALSE WHERE name != 'Universal Trial';
      DELETE FROM trial_templates
      WHERE name = 'Universal Trial'
        AND id != (SELECT MIN(id) FROM trial_templates WHERE name = 'Universal Trial');
    `
  },
  {
    filename: '004_enforce_single_default.sql',
    sql: `
      UPDATE trial_templates SET is_system_default = (name = 'Universal Trial'), is_permanent = (name = 'Universal Trial');
      DELETE FROM trial_templates WHERE name = 'Universal Trial' AND id != (SELECT MIN(id) FROM trial_templates WHERE name = 'Universal Trial');
    `
  },
  {
    filename: '005_sdk_version.sql',
    sql: `
      ALTER TABLE trials ADD COLUMN IF NOT EXISTS sdk_version TEXT;
    `
  },
  {
    filename: '006_countries.sql',
    sql: `
      CREATE TABLE IF NOT EXISTS countries (
        code TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        dial TEXT NOT NULL,
        display_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO countries (code, name, dial, display_order) VALUES
        ('IN', 'India', '+91', 1),
        ('US', 'United States', '+1', 2),
        ('GB', 'United Kingdom', '+44', 3),
        ('CA', 'Canada', '+1', 99),
        ('AU', 'Australia', '+61', 99),
        ('DE', 'Germany', '+49', 99),
        ('FR', 'France', '+33', 99),
        ('IT', 'Italy', '+39', 99),
        ('ES', 'Spain', '+34', 99),
        ('BR', 'Brazil', '+55', 99),
        ('JP', 'Japan', '+81', 99),
        ('CN', 'China', '+86', 99),
        ('KR', 'South Korea', '+82', 99),
        ('SG', 'Singapore', '+65', 99),
        ('AE', 'United Arab Emirates', '+971', 99),
        ('SA', 'Saudi Arabia', '+966', 99),
        ('ZA', 'South Africa', '+27', 99),
        ('NG', 'Nigeria', '+234', 99),
        ('KE', 'Kenya', '+254', 99),
        ('EG', 'Egypt', '+20', 99),
        ('MX', 'Mexico', '+52', 99),
        ('AR', 'Argentina', '+54', 99),
        ('CL', 'Chile', '+56', 99),
        ('CO', 'Colombia', '+57', 99),
        ('NL', 'Netherlands', '+31', 99),
        ('SE', 'Sweden', '+46', 99),
        ('NO', 'Norway', '+47', 99),
        ('DK', 'Denmark', '+45', 99),
        ('FI', 'Finland', '+358', 99),
        ('CH', 'Switzerland', '+41', 99),
        ('AT', 'Austria', '+43', 99),
        ('BE', 'Belgium', '+32', 99),
        ('PT', 'Portugal', '+351', 99),
        ('IE', 'Ireland', '+353', 99),
        ('NZ', 'New Zealand', '+64', 99),
        ('HK', 'Hong Kong', '+852', 99),
        ('MY', 'Malaysia', '+60', 99),
        ('TH', 'Thailand', '+66', 99),
        ('VN', 'Vietnam', '+84', 99),
        ('PH', 'Philippines', '+63', 99),
        ('PK', 'Pakistan', '+92', 99),
        ('BD', 'Bangladesh', '+880', 99),
        ('TR', 'Turkey', '+90', 99),
        ('RU', 'Russia', '+7', 99),
        ('UA', 'Ukraine', '+380', 99),
        ('PL', 'Poland', '+48', 99),
        ('RO', 'Romania', '+40', 99),
        ('GR', 'Greece', '+30', 99),
        ('IL', 'Israel', '+972', 99)
      ON CONFLICT (code) DO NOTHING;
    `
  },
  {
    filename: '007_trial_analytics.sql',
    sql: `
      ALTER TABLE trials ADD COLUMN IF NOT EXISTS runtime_type TEXT;
      ALTER TABLE trials ADD COLUMN IF NOT EXISTS activation_source TEXT DEFAULT 'sdk_onboarding';
    `
  },
  {
    filename: '008_reactivation_requests.sql',
    sql: `
      CREATE TABLE IF NOT EXISTS reactivation_requests (
        id SERIAL PRIMARY KEY,
        license_key TEXT NOT NULL,
        customer_name TEXT,
        customer_email TEXT,
        customer_phone TEXT,
        customer_mobile TEXT,
        hardware_id TEXT,
        product_id TEXT,
        product_name TEXT,
        plan TEXT,
        new_customer_name TEXT,
        new_customer_email TEXT,
        new_customer_phone TEXT,
        new_hardware_id TEXT,
        reason TEXT,
        status TEXT DEFAULT 'pending',
        admin_notes TEXT,
        admin_actioned_at TIMESTAMP,
        actioned_by TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_reactivation_requests_license_key ON reactivation_requests(license_key);
      CREATE INDEX IF NOT EXISTS idx_reactivation_requests_status ON reactivation_requests(status);
      CREATE INDEX IF NOT EXISTS idx_reactivation_requests_created_at ON reactivation_requests(created_at DESC);
    `
  },
  {
    filename: '009_otp_attempts.sql',
    sql: `
      ALTER TABLE otp_verifications ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0;
      ALTER TABLE otp_verifications ADD COLUMN IF NOT EXISTS max_attempts INTEGER DEFAULT 15;
    `
  },
  {
    filename: '010_country_mobile_rules.sql',
    sql: `
      ALTER TABLE countries ADD COLUMN IF NOT EXISTS min_digits INTEGER;
      ALTER TABLE countries ADD COLUMN IF NOT EXISTS max_digits INTEGER;
      UPDATE countries SET min_digits = 10, max_digits = 10 WHERE code = 'IN';
      UPDATE countries SET min_digits = 10, max_digits = 10 WHERE code = 'US';
      UPDATE countries SET min_digits = 10, max_digits = 10 WHERE code = 'GB';
      UPDATE countries SET min_digits = 10, max_digits = 10 WHERE code = 'CA';
      UPDATE countries SET min_digits = 9,  max_digits = 9  WHERE code = 'AU';
      UPDATE countries SET min_digits = 9,  max_digits = 11 WHERE code = 'DE';
      UPDATE countries SET min_digits = 9,  max_digits = 9  WHERE code = 'FR';
      UPDATE countries SET min_digits = 9,  max_digits = 10 WHERE code = 'IT';
      UPDATE countries SET min_digits = 9,  max_digits = 9  WHERE code = 'ES';
      UPDATE countries SET min_digits = 10, max_digits = 11 WHERE code = 'BR';
      UPDATE countries SET min_digits = 10, max_digits = 10 WHERE code = 'JP';
      UPDATE countries SET min_digits = 11, max_digits = 11 WHERE code = 'CN';
      UPDATE countries SET min_digits = 9,  max_digits = 10 WHERE code = 'KR';
      UPDATE countries SET min_digits = 8,  max_digits = 8  WHERE code = 'SG';
      UPDATE countries SET min_digits = 9,  max_digits = 9  WHERE code = 'AE';
      UPDATE countries SET min_digits = 9,  max_digits = 9  WHERE code = 'SA';
      UPDATE countries SET min_digits = 9,  max_digits = 9  WHERE code = 'ZA';
      UPDATE countries SET min_digits = 10, max_digits = 10 WHERE code = 'NG';
      UPDATE countries SET min_digits = 9,  max_digits = 9  WHERE code = 'KE';
      UPDATE countries SET min_digits = 10, max_digits = 10 WHERE code = 'EG';
      UPDATE countries SET min_digits = 10, max_digits = 10 WHERE code = 'MX';
      UPDATE countries SET min_digits = 10, max_digits = 10 WHERE code = 'AR';
      UPDATE countries SET min_digits = 9,  max_digits = 9  WHERE code = 'CL';
      UPDATE countries SET min_digits = 10, max_digits = 10 WHERE code = 'CO';
      UPDATE countries SET min_digits = 9,  max_digits = 9  WHERE code = 'NL';
      UPDATE countries SET min_digits = 7,  max_digits = 9  WHERE code = 'SE';
      UPDATE countries SET min_digits = 8,  max_digits = 8  WHERE code = 'NO';
      UPDATE countries SET min_digits = 8,  max_digits = 8  WHERE code = 'DK';
      UPDATE countries SET min_digits = 9,  max_digits = 9  WHERE code = 'FI';
      UPDATE countries SET min_digits = 9,  max_digits = 9  WHERE code = 'CH';
      UPDATE countries SET min_digits = 9,  max_digits = 10 WHERE code = 'AT';
      UPDATE countries SET min_digits = 9,  max_digits = 9  WHERE code = 'BE';
      UPDATE countries SET min_digits = 9,  max_digits = 9  WHERE code = 'PT';
      UPDATE countries SET min_digits = 9,  max_digits = 9  WHERE code = 'IE';
      UPDATE countries SET min_digits = 8,  max_digits = 10 WHERE code = 'NZ';
      UPDATE countries SET min_digits = 8,  max_digits = 8  WHERE code = 'HK';
      UPDATE countries SET min_digits = 9,  max_digits = 10 WHERE code = 'MY';
      UPDATE countries SET min_digits = 9,  max_digits = 9  WHERE code = 'TH';
      UPDATE countries SET min_digits = 9,  max_digits = 10 WHERE code = 'VN';
      UPDATE countries SET min_digits = 10, max_digits = 10 WHERE code = 'PH';
      UPDATE countries SET min_digits = 10, max_digits = 10 WHERE code = 'PK';
      UPDATE countries SET min_digits = 10, max_digits = 10 WHERE code = 'BD';
      UPDATE countries SET min_digits = 10, max_digits = 10 WHERE code = 'TR';
      UPDATE countries SET min_digits = 10, max_digits = 10 WHERE code = 'RU';
      UPDATE countries SET min_digits = 9,  max_digits = 9  WHERE code = 'UA';
      UPDATE countries SET min_digits = 9,  max_digits = 9  WHERE code = 'PL';
      UPDATE countries SET min_digits = 9,  max_digits = 9  WHERE code = 'RO';
      UPDATE countries SET min_digits = 10, max_digits = 10 WHERE code = 'GR';
      UPDATE countries SET min_digits = 9,  max_digits = 9  WHERE code = 'IL';
    `
  }
];

async function seedMediaAssets(client) {
  const seedSlots = [
    {
      slot_key: "global_collaboration_video",
      file_name: "API-Center.mp4",
      content_type: "video/mp4",
      relative: path.join("public", "videos", "API-Center.mp4"),
    },
    {
      slot_key: "global_collaboration_image",
      file_name: "photo-1552664730-d307ca884978.jpg",
      content_type: "image/jpeg",
      relative: path.join("public", "images", "photo-1552664730-d307ca884978.jpg"),
    },
  ];

  for (const slot of seedSlots) {
    const filePath = path.join(process.cwd(), slot.relative);
    if (!fs.existsSync(filePath)) continue;
    const data = fs.readFileSync(filePath);
    await client.query(
      `INSERT INTO media_assets (slot_key, file_name, content_type, file_size, data, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, now(), now())
       ON CONFLICT (slot_key) DO UPDATE SET
         data = COALESCE(media_assets.data, EXCLUDED.data),
         file_name = COALESCE(media_assets.file_name, EXCLUDED.file_name),
         content_type = COALESCE(media_assets.content_type, EXCLUDED.content_type),
         file_size = COALESCE(media_assets.file_size, EXCLUDED.file_size)
       WHERE media_assets.data IS NULL`,
      [slot.slot_key, slot.file_name, slot.content_type, data.length, data]
    );
  }
}

async function main() {
  const isFresh = process.argv.includes('--fresh') || process.argv.includes('--reset');

  console.log('====================================================');
  console.log('   WEBSMITH DATABASE INITIALIZATION & SYNC (NEON)   ');
  console.log('====================================================\n');

  const env = getEnv();
  if (!env.DATABASE_URL) {
    console.error('❌ Error: DATABASE_URL not found in .env');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();

  try {
    console.log('✓ Successfully connected to Neon PostgreSQL.');

    if (isFresh) {
      console.log('\n⚠️  [--fresh] Dropping all existing tables in schema public...');
      await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
      console.log('✓ Public schema recreated.');
    }

    console.log('\n[1/5] Creating core application tables...');

    // 0. Users (API Center Admin / Auth)
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT DEFAULT 'admin',
        avatar TEXT,
        theme TEXT DEFAULT 'system',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 1. Products
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        product_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        version TEXT DEFAULT '1.0.0',
        description TEXT,
        price REAL DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TEXT,
        updated_at TEXT,
        company_name TEXT,
        product_type TEXT,
        latest_version TEXT,
        website TEXT,
        api_key TEXT,
        is_deleted BOOLEAN DEFAULT FALSE,
        short_description TEXT,
        logo_url TEXT,
        platform TEXT,
        docs_url TEXT,
        support_url TEXT,
        featured BOOLEAN DEFAULT FALSE,
        display_order INTEGER DEFAULT 0,
        public_product_id TEXT
      )
    `);

    // 2. Plans
    await client.query(`
      CREATE TABLE IF NOT EXISTS plans (
        id SERIAL PRIMARY KEY,
        product_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        max_devices INTEGER DEFAULT 1,
        default_expiry_days INTEGER DEFAULT 365,
        price REAL DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        features JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        display_order INTEGER NOT NULL DEFAULT 0,
        trial_days_limit INTEGER DEFAULT 30,
        is_trial_plan BOOLEAN DEFAULT FALSE,
        CONSTRAINT unique_plan_name_per_product UNIQUE(product_id, name)
      )
    `);

    // 3. Licenses
    await client.query(`
      CREATE TABLE IF NOT EXISTS licenses (
        license_key TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        plan_id INTEGER NOT NULL,
        plan_name TEXT NOT NULL,
        customer_name TEXT,
        customer_email TEXT,
        customer_phone TEXT,
        customer_mobile TEXT,
        status TEXT DEFAULT 'active',
        expiry_date TEXT,
        max_devices INTEGER DEFAULT 1,
        device_count INTEGER DEFAULT 0,
        created_at TEXT,
        updated_at TEXT,
        notes TEXT,
        last_validated TEXT,
        is_trial BOOLEAN DEFAULT FALSE,
        hardware_id TEXT,
        is_activated BOOLEAN DEFAULT FALSE,
        trial_started_at TEXT,
        trial_days_limit INTEGER DEFAULT 30,
        user_id TEXT,
        features JSONB,
        price REAL DEFAULT 0,
        offline_mode BOOLEAN DEFAULT FALSE,
        offline_days_allowed INTEGER DEFAULT 0,
        last_offline_check TEXT,
        inactive_reason TEXT,
        deleted_at TIMESTAMP
      )
    `);

    // 4. Customers
    await client.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        mobile TEXT,
        alternative_mobile TEXT,
        address_line1 TEXT,
        address_line2 TEXT,
        city TEXT,
        state TEXT,
        postal_code TEXT,
        country TEXT DEFAULT 'India',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 5. Customer Licenses
    await client.query(`
      CREATE TABLE IF NOT EXISTS customer_licenses (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
        license_key TEXT REFERENCES licenses(license_key) ON DELETE CASCADE,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(customer_id, license_key)
      )
    `);

    // 6. Activations
    await client.query(`
      CREATE TABLE IF NOT EXISTS activations (
        id SERIAL PRIMARY KEY,
        license_key TEXT NOT NULL,
        hardware_id TEXT NOT NULL,
        activated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        device_name TEXT,
        ip_address TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        UNIQUE(license_key, hardware_id)
      )
    `);

    // 7. Trials
    await client.query(`
      CREATE TABLE IF NOT EXISTS trials (
        id SERIAL PRIMARY KEY,
        product_id TEXT NOT NULL,
        plan_id INTEGER,
        user_id TEXT,
        hardware_id TEXT,
        email TEXT,
        mobile_number TEXT,
        name TEXT,
        status TEXT DEFAULT 'active',
        ip_address TEXT,
        cpu_id TEXT,
        motherboard_id TEXT,
        device_hash TEXT,
        software_version TEXT,
        os_info TEXT,
        installation_timestamp TEXT,
        trial_template_id INTEGER,
        trial_duration_days INTEGER DEFAULT 7,
        reset_attempts INTEGER DEFAULT 0,
        suspicious_flag BOOLEAN DEFAULT FALSE,
        suspicious_reason TEXT,
        suspicious_logged_at TEXT,
        notified_admin BOOLEAN DEFAULT FALSE,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        sdk_version TEXT,
        runtime_type TEXT,
        activation_source TEXT DEFAULT 'sdk_onboarding'
      )
    `);

    // 8. Audit Logs & Verification
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        license_key TEXT,
        action TEXT NOT NULL,
        performed_by TEXT,
        ip_address TEXT,
        details JSONB,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS trial_audit_logs (
        id SERIAL PRIMARY KEY,
        trial_id INTEGER,
        event_type TEXT NOT NULL,
        message TEXT,
        ip_address TEXT,
        metadata JSONB,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS otp_verifications (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL,
        otp TEXT NOT NULL,
        attempts INTEGER DEFAULT 0,
        max_attempts INTEGER DEFAULT 15,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMPTZ NOT NULL,
        verified BOOLEAN DEFAULT FALSE
      )
    `);

    // 9. Hardware & Bindings
    await client.query(`
      CREATE TABLE IF NOT EXISTS license_bindings (
        id SERIAL PRIMARY KEY,
        license_key TEXT NOT NULL,
        hardware_id TEXT NOT NULL,
        bound_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(license_key, hardware_id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS license_hardware (
        id SERIAL PRIMARY KEY,
        license_key TEXT NOT NULL,
        hardware_id TEXT NOT NULL,
        first_activated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_checkin TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(license_key, hardware_id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id INTEGER PRIMARY KEY,
        settings JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS renewal_history (
        id SERIAL PRIMARY KEY,
        license_key TEXT NOT NULL,
        old_expiry TIMESTAMP,
        new_expiry TIMESTAMP,
        renewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        renewed_by TEXT
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS renewal_requests (
        id SERIAL PRIMARY KEY,
        license_key TEXT NOT NULL,
        product_name TEXT,
        current_plan_id TEXT,
        customer_email TEXT,
        customer_mobile TEXT,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS reactivation_requests (
        id SERIAL PRIMARY KEY,
        license_key TEXT NOT NULL,
        customer_name TEXT,
        customer_email TEXT,
        customer_phone TEXT,
        customer_mobile TEXT,
        hardware_id TEXT,
        product_id TEXT,
        product_name TEXT,
        plan TEXT,
        new_customer_name TEXT,
        new_customer_email TEXT,
        new_customer_phone TEXT,
        new_hardware_id TEXT,
        reason TEXT,
        status TEXT DEFAULT 'pending',
        admin_notes TEXT,
        admin_actioned_at TIMESTAMP,
        actioned_by TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS developer_api_keys (
        id SERIAL PRIMARY KEY,
        product_id TEXT NOT NULL,
        api_key TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        permissions TEXT[] DEFAULT '{}',
        rate_limit INTEGER DEFAULT 1000,
        expires_at TIMESTAMP,
        last_used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS api_key_audit_log (
        id SERIAL PRIMARY KEY,
        key_id INTEGER,
        action TEXT NOT NULL,
        performed_by TEXT,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS api_request_logs (
        id SERIAL PRIMARY KEY,
        api_key_id INTEGER,
        endpoint TEXT,
        method TEXT,
        status_code INTEGER,
        ip_address TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS public_api_nonces (
        id SERIAL PRIMARY KEY,
        nonce TEXT UNIQUE NOT NULL,
        api_key_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id TEXT,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT DEFAULT 'info',
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS countries (
        code TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        dial TEXT NOT NULL,
        display_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        min_digits INTEGER,
        max_digits INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS states (
        id SERIAL PRIMARY KEY,
        country_code TEXT NOT NULL REFERENCES countries(code) ON DELETE CASCADE,
        name TEXT NOT NULL,
        code TEXT,
        UNIQUE(country_code, name)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS cities (
        id SERIAL PRIMARY KEY,
        state_id INTEGER REFERENCES states(id) ON DELETE CASCADE,
        country_code TEXT NOT NULL,
        name TEXT NOT NULL,
        UNIQUE(state_id, name)
      )
    `);

    // 10. Store & Billing
    await client.query(`
      CREATE TABLE IF NOT EXISTS payment_gateways (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL,
        is_active BOOLEAN DEFAULT FALSE,
        supported_currencies TEXT[] DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS coupons (
        id SERIAL PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        discount_type TEXT NOT NULL,
        discount_value REAL NOT NULL,
        min_purchase_amount REAL DEFAULT 0,
        max_uses INTEGER,
        current_uses INTEGER DEFAULT 0,
        max_uses_per_customer INTEGER,
        applies_to_product_id TEXT,
        applies_to_plan_id INTEGER,
        expires_at TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        order_number TEXT UNIQUE NOT NULL,
        customer_email TEXT NOT NULL,
        customer_name TEXT,
        customer_phone TEXT,
        customer_mobile TEXT,
        company_name TEXT,
        billing_address JSONB,
        subtotal REAL NOT NULL DEFAULT 0,
        tax REAL NOT NULL DEFAULT 0,
        discount_amount REAL NOT NULL DEFAULT 0,
        total REAL NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'USD',
        status TEXT NOT NULL DEFAULT 'pending',
        coupon_code TEXT,
        notes TEXT,
        payment_gateway TEXT DEFAULT 'dummy',
        payment_intent_id TEXT,
        paid_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id TEXT NOT NULL,
        plan_id INTEGER NOT NULL,
        product_name TEXT NOT NULL,
        plan_name TEXT NOT NULL,
        price REAL NOT NULL DEFAULT 0,
        quantity INTEGER NOT NULL DEFAULT 1,
        total REAL NOT NULL DEFAULT 0,
        license_key_generated BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        gateway TEXT NOT NULL DEFAULT 'dummy',
        gateway_order_id TEXT,
        gateway_payment_id TEXT,
        amount REAL NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'USD',
        status TEXT NOT NULL DEFAULT 'pending',
        method TEXT,
        transaction_id TEXT,
        customer_email TEXT,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id SERIAL PRIMARY KEY,
        customer_email TEXT NOT NULL,
        product_id TEXT NOT NULL,
        plan_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        billing_interval TEXT NOT NULL DEFAULT 'monthly',
        price REAL NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'USD',
        current_period_start TIMESTAMP NOT NULL,
        current_period_end TIMESTAMP NOT NULL,
        cancel_at_period_end BOOLEAN DEFAULT FALSE,
        canceled_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id SERIAL PRIMARY KEY,
        invoice_number TEXT UNIQUE NOT NULL,
        order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
        customer_email TEXT NOT NULL,
        customer_name TEXT,
        customer_mobile TEXT,
        company_name TEXT,
        subtotal REAL NOT NULL DEFAULT 0,
        tax REAL NOT NULL DEFAULT 0,
        total REAL NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'USD',
        status TEXT NOT NULL DEFAULT 'unpaid',
        paid_at TIMESTAMP,
        due_date TIMESTAMP,
        items JSONB,
        billing_address JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS carts (
        id SERIAL PRIMARY KEY,
        session_id TEXT UNIQUE NOT NULL,
        coupon_code TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS cart_items (
        id SERIAL PRIMARY KEY,
        cart_id INTEGER NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
        product_id TEXT NOT NULL,
        plan_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(cart_id, product_id, plan_id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS wishlist (
        id SERIAL PRIMARY KEY,
        session_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(session_id, product_id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS trial_templates (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        duration_days INTEGER DEFAULT 7,
        is_active BOOLEAN DEFAULT TRUE,
        is_system_default BOOLEAN DEFAULT FALSE,
        is_permanent BOOLEAN DEFAULT FALSE,
        max_devices INTEGER DEFAULT 1,
        max_hardware_changes INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 11. Notifications & Communications
    await client.query(`
      CREATE TABLE IF NOT EXISTS email_templates (
        id SERIAL PRIMARY KEY,
        template_type TEXT UNIQUE NOT NULL,
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        variables TEXT[] DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS sms_config (
        id SERIAL PRIMARY KEY,
        provider TEXT NOT NULL,
        is_active BOOLEAN DEFAULT FALSE,
        auth_id TEXT,
        auth_token TEXT,
        from_number TEXT,
        route TEXT DEFAULT 'dlt',
        dlt_principal_entity_id TEXT,
        dlt_sender_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS sms_templates (
        id SERIAL PRIMARY KEY,
        sms_type TEXT UNIQUE NOT NULL,
        template_text TEXT NOT NULL,
        dlt_template_id TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS event_notification_config (
        id SERIAL PRIMARY KEY,
        event_type TEXT UNIQUE NOT NULL,
        email_enabled BOOLEAN DEFAULT TRUE,
        sms_enabled BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS notification_logs (
        id SERIAL PRIMARY KEY,
        event_type TEXT NOT NULL,
        channel TEXT NOT NULL,
        recipient TEXT NOT NULL,
        subject TEXT,
        status TEXT NOT NULL DEFAULT 'sent',
        response TEXT,
        error TEXT,
        license_key TEXT,
        hardware_id TEXT,
        sender_name TEXT,
        sender_email TEXT,
        template_name TEXT,
        retry_count INTEGER DEFAULT 0,
        support_request_id TEXT,
        sales_enquiry_id TEXT,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Ensure columns exist if table was already created
    try { await client.query(`ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS subject TEXT`); } catch (e) {}
    try { await client.query(`ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS response TEXT`); } catch (e) {}
    try { await client.query(`ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS error TEXT`); } catch (e) {}
    try { await client.query(`ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS hardware_id TEXT`); } catch (e) {}
    try { await client.query(`ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS sender_name TEXT`); } catch (e) {}
    try { await client.query(`ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS sender_email TEXT`); } catch (e) {}
    try { await client.query(`ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS template_name TEXT`); } catch (e) {}
    try { await client.query(`ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0`); } catch (e) {}
    try { await client.query(`ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS support_request_id TEXT`); } catch (e) {}
    try { await client.query(`ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS sales_enquiry_id TEXT`); } catch (e) {}
    try { await client.query(`ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS error_message TEXT`); } catch (e) {}

    await client.query(`
      CREATE TABLE IF NOT EXISTS requests (
        id SERIAL PRIMARY KEY,
        request_type TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        customer_email TEXT,
        customer_name TEXT,
        details JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS mailboxes (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        email_address TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        imap_host TEXT NOT NULL,
        imap_port INTEGER NOT NULL DEFAULT 993,
        imap_secure BOOLEAN NOT NULL DEFAULT true,
        imap_username TEXT NOT NULL,
        imap_password TEXT NOT NULL,
        smtp_host TEXT NOT NULL,
        smtp_port INTEGER NOT NULL DEFAULT 465,
        smtp_secure BOOLEAN NOT NULL DEFAULT true,
        smtp_username TEXT NOT NULL,
        smtp_password TEXT NOT NULL,
        connection_status TEXT NOT NULL DEFAULT 'unknown',
        sync_status TEXT NOT NULL DEFAULT 'never',
        is_default_sender BOOLEAN NOT NULL DEFAULT false,
        is_enabled BOOLEAN NOT NULL DEFAULT true,
        signature TEXT DEFAULT '',
        auto_reply_enabled BOOLEAN DEFAULT false,
        auto_reply_message TEXT DEFAULT '',
        queue_size INTEGER DEFAULT 0,
        last_sync TIMESTAMP,
        last_success TIMESTAMP,
        last_failure TIMESTAMP,
        last_error TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS communication_conversations (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        customer_email TEXT NOT NULL,
        customer_name TEXT DEFAULT '',
        subject TEXT NOT NULL,
        product_id TEXT,
        license_key TEXT,
        hardware_id TEXT,
        sdk_version TEXT,
        runtime_type TEXT,
        mailbox_id TEXT REFERENCES mailboxes(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        admin_read_at TIMESTAMP,
        deleted_at TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS conversation_messages (
        id SERIAL PRIMARY KEY,
        request_id INTEGER REFERENCES requests(id) ON DELETE SET NULL,
        conversation_id TEXT NOT NULL REFERENCES communication_conversations(id) ON DELETE CASCADE,
        sender_type TEXT NOT NULL CHECK (sender_type IN ('customer', 'admin')),
        sender_name TEXT NOT NULL,
        sender_email TEXT NOT NULL,
        message TEXT NOT NULL,
        is_internal BOOLEAN DEFAULT false,
        email_sent BOOLEAN DEFAULT false,
        email_error TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS conversation_attachments (
        id SERIAL PRIMARY KEY,
        message_id INTEGER NOT NULL REFERENCES conversation_messages(id) ON DELETE CASCADE,
        file_name TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        mime_type TEXT NOT NULL,
        storage_path TEXT NOT NULL,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS conversation_delete_tombstones (
        id SERIAL PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_by TEXT NOT NULL,
        reason TEXT
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS email_attachments (
        id SERIAL PRIMARY KEY,
        notification_log_id INTEGER REFERENCES notification_logs(id) ON DELETE SET NULL,
        email_type TEXT NOT NULL,
        recipient TEXT NOT NULL,
        license_key TEXT,
        file_name TEXT NOT NULL,
        file_size BIGINT NOT NULL,
        mime_type TEXT NOT NULL,
        storage_path TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS email_preferences (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL,
        email_hash TEXT NOT NULL UNIQUE,
        token TEXT NOT NULL UNIQUE,
        is_unsubscribed BOOLEAN NOT NULL DEFAULT FALSE,
        unsubscribed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_email_preferences_email_hash ON email_preferences(email_hash)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_email_preferences_token ON email_preferences(token)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_email_preferences_is_unsubscribed ON email_preferences(is_unsubscribed) WHERE is_unsubscribed = TRUE`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS message_queue (
        id SERIAL PRIMARY KEY,
        conversation_id TEXT REFERENCES communication_conversations(id) ON DELETE CASCADE,
        category TEXT NOT NULL,
        customer_email TEXT NOT NULL,
        customer_name TEXT DEFAULT '',
        subject TEXT DEFAULT '',
        message TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        retry_count INTEGER DEFAULT 0,
        max_retries INTEGER DEFAULT 5,
        last_error TEXT,
        next_retry_at TIMESTAMP,
        sent_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_message_queue_conversation_id ON message_queue(conversation_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_message_queue_status ON message_queue(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_message_queue_next_retry_at ON message_queue(next_retry_at)`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS mailbox_sync_logs (
        id SERIAL PRIMARY KEY,
        mailbox_id TEXT NOT NULL REFERENCES mailboxes(id) ON DELETE CASCADE,
        status TEXT NOT NULL,
        messages_fetched INTEGER DEFAULT 0,
        messages_new INTEGER DEFAULT 0,
        messages_updated INTEGER DEFAULT 0,
        error_message TEXT DEFAULT '',
        duration_ms INTEGER DEFAULT 0,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS conversation_folders (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        section TEXT NOT NULL DEFAULT 'internal',
        kind TEXT NOT NULL DEFAULT 'list',
        filter_json TEXT DEFAULT '{}',
        is_system BOOLEAN NOT NULL DEFAULT FALSE,
        display_order INTEGER NOT NULL DEFAULT 0,
        deleted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS sales_enquiries (
        id SERIAL PRIMARY KEY,
        product_name TEXT NOT NULL,
        selected_plan TEXT,
        product_version TEXT,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL,
        mobile TEXT NOT NULL,
        company TEXT,
        country TEXT,
        requirements TEXT,
        status TEXT DEFAULT 'new' NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS sdk_jobs (
        job_id TEXT PRIMARY KEY,
        status TEXT DEFAULT 'pending',
        payload JSONB,
        result JSONB,
        error TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        current_stage TEXT,
        stage_started_at TIMESTAMP,
        retry_count INTEGER DEFAULT 0,
        max_retries INTEGER DEFAULT 3,
        resume_count INTEGER DEFAULT 0,
        checkpoints JSONB DEFAULT '{}'::jsonb,
        stage_metrics JSONB DEFAULT '{}'::jsonb,
        stage_errors JSONB DEFAULT '{}'::jsonb,
        stage_artifacts JSONB DEFAULT '{}'::jsonb,
        logs JSONB DEFAULT '[]'::jsonb,
        download_url TEXT,
        filename TEXT,
        product_name TEXT
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS sdk_runtime_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id TEXT NOT NULL UNIQUE,
        trial_enabled BOOLEAN DEFAULT TRUE,
        allow_conversion BOOLEAN DEFAULT TRUE,
        email_verification BOOLEAN DEFAULT TRUE,
        trial_duration_days INTEGER DEFAULT 7,
        device_limit INTEGER DEFAULT 1,
        offline_grace_days INTEGER DEFAULT 0,
        cache_days INTEGER DEFAULT 0,
        trial_message TEXT DEFAULT '',
        support_email TEXT DEFAULT 'support@websmithdigital.com',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS media_assets (
        id SERIAL PRIMARY KEY,
        slot_key TEXT NOT NULL UNIQUE,
        file_name TEXT NOT NULL DEFAULT '',
        content_type TEXT NOT NULL DEFAULT 'application/octet-stream',
        file_size BIGINT NOT NULL DEFAULT 0,
        data BYTEA,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✓ All core application tables created.');

    console.log('\n[2/5] Running versioned incremental migrations...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    for (const migration of MIGRATIONS) {
      const existing = await client.query('SELECT id FROM _migrations WHERE filename = $1', [migration.filename]);
      if (existing.rows.length === 0) {
        await client.query(migration.sql);
        await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [migration.filename]);
        console.log(` - Applied migration: ${migration.filename}`);
      } else {
        console.log(` - Already applied: ${migration.filename}`);
      }
    }

    console.log('\n[3/5] Seeding default configuration & lookup data...');

    // System Settings
    await client.query(`
      INSERT INTO system_settings (id, settings) 
      VALUES (1, '{"license_cleanup": {"enabled": false, "days_after_expiry": 30, "delete_notes": true, "last_run_at": null}}')
      ON CONFLICT (id) DO NOTHING
    `);

    // Event notification configs
    const DEFAULT_EVENT_CONFIGS = [
      { event_type: 'otp_verification', email_enabled: true, sms_enabled: true },
      { event_type: 'license_created', email_enabled: true, sms_enabled: true },
      { event_type: 'trial_started', email_enabled: true, sms_enabled: true },
      { event_type: 'trial_ending_reminder', email_enabled: true, sms_enabled: true },
      { event_type: 'activation_success', email_enabled: true, sms_enabled: true },
      { event_type: 'activation_failed', email_enabled: true, sms_enabled: true },
      { event_type: 'license_renewed', email_enabled: true, sms_enabled: true },
      { event_type: 'license_expired', email_enabled: true, sms_enabled: true },
      { event_type: 'license_revoked', email_enabled: true, sms_enabled: true },
      { event_type: 'device_changed', email_enabled: true, sms_enabled: true },
      { event_type: 'device_reset', email_enabled: true, sms_enabled: true },
      { event_type: 'payment_success', email_enabled: true, sms_enabled: true },
      { event_type: 'subscription_reminder', email_enabled: true, sms_enabled: true },
      { event_type: 'product_purchased', email_enabled: true, sms_enabled: true },
      { event_type: 'welcome_customer', email_enabled: true, sms_enabled: true },
      { event_type: 'admin_notification', email_enabled: true, sms_enabled: false },
      { event_type: 'product_archived', email_enabled: true, sms_enabled: false },
      { event_type: 'product_restored', email_enabled: true, sms_enabled: false },
      { event_type: 'sdk_generated', email_enabled: true, sms_enabled: false },
      { event_type: 'api_key_generated', email_enabled: true, sms_enabled: false },
      { event_type: 'security_alert', email_enabled: true, sms_enabled: false },
      { event_type: 'audit_summary', email_enabled: true, sms_enabled: false },
    ];
    for (const cfg of DEFAULT_EVENT_CONFIGS) {
      await client.query(
        `INSERT INTO event_notification_config (event_type, email_enabled, sms_enabled)
         VALUES ($1, $2, $3)
         ON CONFLICT (event_type) DO NOTHING`,
        [cfg.event_type, cfg.email_enabled, cfg.sms_enabled]
      );
    }

    // Payment gateways
    await client.query(`
      INSERT INTO payment_gateways (name, display_name, is_active, supported_currencies) VALUES
         ('dummy', 'Test Payment (Development)', TRUE, ARRAY['USD','EUR','GBP','INR']),
         ('stripe', 'Stripe', FALSE, ARRAY['USD','EUR','GBP']),
         ('razorpay', 'Razorpay', FALSE, ARRAY['INR']),
         ('paypal', 'PayPal', FALSE, ARRAY['USD','EUR','GBP']),
         ('paddle', 'Paddle', FALSE, ARRAY['USD','EUR','GBP'])
       ON CONFLICT (name) DO UPDATE SET display_name = EXCLUDED.display_name,
         supported_currencies = EXCLUDED.supported_currencies,
         is_active = CASE WHEN payment_gateways.name = 'dummy' THEN TRUE ELSE payment_gateways.is_active END
    `);

    // Folders
    await client.query(`
      INSERT INTO conversation_folders (id, name, section, kind, filter_json, is_system, display_order)
      SELECT * FROM (VALUES
        ('all', 'All', 'internal', 'list', '{}', TRUE, 0),
        ('sales', 'Sales', 'internal', 'list', '{"category":"sales"}', TRUE, 1),
        ('support', 'Support', 'internal', 'list', '{"category":"support"}', TRUE, 2),
        ('activation', 'Activation', 'internal', 'list', '{"category":"activation"}', TRUE, 3),
        ('renewal', 'Renewal', 'internal', 'list', '{"category":"renewal"}', TRUE, 4),
        ('reactivation', 'Reactivation', 'internal', 'list', '{"category":"reactivation"}', TRUE, 5),
        ('hardware', 'Hardware', 'internal', 'list', '{"category":"hardware_replacement"}', TRUE, 6),
        ('trial', 'Trial', 'internal', 'list', '{"search":"trial"}', TRUE, 7),
        ('payment', 'Payment', 'internal', 'list', '{"search":"payment"}', TRUE, 8),
        ('sdk', 'SDK', 'internal', 'list', '{"search":"sdk"}', TRUE, 9),
        ('customer', 'Customer', 'internal', 'list', '{"has_customer":"true"}', TRUE, 10),
        ('notifications', 'Notifications', 'internal', 'logs', '{}', TRUE, 11),
        ('email-history', 'Universal Email', 'internal', 'history', '{}', TRUE, 12),
        ('ext-inbox', 'Inbox', 'external', 'list', '{"status":"open,waiting_customer"}', TRUE, 13),
        ('ext-sent', 'Sent', 'external', 'list', '{"sent":"true"}', TRUE, 14),
        ('ext-draft', 'Draft', 'external', 'list', '{"status":"draft"}', TRUE, 15),
        ('ext-waiting', 'Waiting', 'external', 'list', '{"status":"waiting_customer"}', TRUE, 16),
        ('ext-failed', 'Failed', 'external', 'list', '{"status":"waiting_support,waiting_sales"}', TRUE, 17),
        ('ext-queued', 'Queued', 'external', 'queue', '{}', TRUE, 18),
        ('ext-spam', 'Spam', 'external', 'list', '{"status":"spam"}', TRUE, 19),
        ('ext-trash', 'Trash', 'external', 'list', '{"show_deleted":"true"}', TRUE, 20),
        ('mailboxes', 'Mailboxes', 'external', 'mailboxes', '{}', TRUE, 21)
      ) AS v(id, name, section, kind, filter_json, is_system, display_order)
      WHERE NOT EXISTS (SELECT 1 FROM conversation_folders)
    `);

    // Media Assets
    await seedMediaAssets(client);
    console.log('✓ Default settings, folders, event configs, and media assets seeded.');

    console.log('\n[4/5] Ensuring Portal (Migrated Collections) tables exist...');
    for (const colName of COLLECTIONS) {
      const tableName = `portal_${colName.toLowerCase()}`;
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${tableName} (
          _id TEXT PRIMARY KEY,
          data JSONB NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_${tableName}_data ON ${tableName} USING GIN (data);
      `);
    }

    // Check if portal has documents; if not and backup exists, import them
    const backupFile = path.resolve(process.cwd(), 'scripts/backup/mongo_full_backup_latest.json');
    if (fs.existsSync(backupFile)) {
      const checkPortal = await client.query('SELECT COUNT(*)::int AS count FROM portal_users');
      if (checkPortal.rows[0].count === 0) {
        console.log(' - Populating portal tables from backup json...');
        const backup = JSON.parse(fs.readFileSync(backupFile, 'utf-8'));
        let totalDocs = 0;
        for (const colName of COLLECTIONS) {
          const tableName = `portal_${colName.toLowerCase()}`;
          const colData = backup.collections[colName];
          const docs = colData ? colData.documents : [];
          for (const doc of docs) {
            const id = doc._id;
            const createdAt = doc.createdAt || doc.created_at || new Date().toISOString();
            const updatedAt = doc.updatedAt || doc.updated_at || new Date().toISOString();
            await client.query(
              `INSERT INTO ${tableName} (_id, data, created_at, updated_at)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (_id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at`,
              [id, JSON.stringify(doc), createdAt, updatedAt]
            );
            totalDocs++;
          }
        }
        console.log(` - Inserted ${totalDocs} portal documents from backup.`);
      } else {
        console.log(' - Portal tables already contain records, keeping existing data.');
      }
    }
    console.log('✓ Portal tables ready.');

    console.log('\n[5/5] Creating performance indexes...');
    await client.query(`CREATE INDEX IF NOT EXISTS idx_licenses_product_id ON licenses(product_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_licenses_customer_email ON licenses(customer_email)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_activations_license_key ON activations(license_key)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_trials_hardware_id ON trials(hardware_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_trials_product_id ON trials(product_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_plans_product_id ON plans(product_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`);
    console.log('✓ Performance indexes verified.');

    const tableListRes = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
    );
    console.log(`\n====================================================`);
    console.log(`🎉 SUCCESS! Database initialized with ${tableListRes.rows.length} tables.`);
    console.log(`====================================================\n`);

  } catch (err) {
    console.error('❌ Database initialization failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
