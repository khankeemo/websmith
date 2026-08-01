import { Pool } from 'pg';

const MIGRATIONS_TABLE = '_migrations';

const MIGRATIONS: { filename: string; sql: string }[] = [
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
  },
];

export async function runMigrations(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id SERIAL PRIMARY KEY,
      filename TEXT UNIQUE NOT NULL,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  for (const migration of MIGRATIONS) {
    const existing = await pool.query(
      `SELECT id FROM ${MIGRATIONS_TABLE} WHERE filename = $1`,
      [migration.filename]
    );
    if (existing.rows.length > 0) continue;

    const client = await pool.connect();
    try {
      await client.query(migration.sql);
      await client.query(
        `INSERT INTO ${MIGRATIONS_TABLE} (filename) VALUES ($1)`,
        [migration.filename]
      );
      console.log(`[Migration] Applied: ${migration.filename}`);
    } catch (err) {
      console.error(`[Migration] FAILED: ${migration.filename}`, err);
      throw err;
    } finally {
      client.release();
    }
  }
}
