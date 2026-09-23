// FILE: D:\websmith\lib\backend-db\index.ts
// PURPOSE: Database connection - Neon PostgreSQL only
// RULE 2: Single Database Policy - Neon PostgreSQL is the only database
// RULE 6: Complete code - no truncation
// RULE 7: Database integrity protected
// UPDATED: Added all missing tables and columns for complete license system

import { Pool } from 'pg';
import { runMigrations } from '@/lib/migrations/runner';
import { COUNTRY_CODES } from '@/lib/data/country-codes';
import { seedMigratedMedia } from '@/lib/media/storage';

let pool: Pool | null = null;

export async function getDb(): Promise<Pool> {
  // Return existing pool if already created
  if (pool) {
    return pool;
  }

  // Get connection string from environment
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set. Neon PostgreSQL connection required.');
  }

  // Create new Neon PostgreSQL connection pool
  pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  // Test connection and ensure tables exist
  const client = await pool.connect();

  try {
    // ============================================================
    // CREATE ALL TABLES WITH COMPLETE SCHEMA
    // ============================================================

    // 0. Create users table (API Center Admin / Auth)
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

    // 1. Create products table (COMPLETE)
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

    // 2. Create plans table (COMPLETE with trial support)
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

    // 3. Create licenses table (COMPLETE with all columns + inactive_reason)
    await client.query(`
      CREATE TABLE IF NOT EXISTS licenses (
        license_key TEXT PRIMARY KEY,
        product_id TEXT,
        customer_name TEXT,
        customer_email TEXT,
        customer_username TEXT,
        plan TEXT,
        plan_id INTEGER,
        status TEXT DEFAULT 'inactive',
        inactive_reason TEXT,
        expiry_date TEXT NOT NULL,
        duration_days INTEGER DEFAULT 365,
        max_devices INTEGER DEFAULT 1,
        device_count INTEGER DEFAULT 0,
        hardware_id TEXT DEFAULT '',
        notes TEXT,
        is_activated BOOLEAN DEFAULT FALSE,
        is_trial BOOLEAN DEFAULT FALSE,
        activated_at TIMESTAMP,
        last_validated TIMESTAMP,
        last_renewed_at TIMESTAMP,
        customer_phone TEXT,
        customer_mobile TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 4a. Create customers table
    await client.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT,
        phone TEXT,
        company TEXT,
        company_name TEXT,
        country TEXT,
        country_code TEXT DEFAULT '',
        hardware_id TEXT DEFAULT '',
        notes TEXT,
        status TEXT DEFAULT 'active',
        last_login TIMESTAMP,
        total_licenses INTEGER DEFAULT 0,
        active_licenses INTEGER DEFAULT 0,
        total_revenue DECIMAL(12,2) DEFAULT 0,
        customer_type TEXT DEFAULT 'trial',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 4b. Create customers_licenses junction table
    await client.query(`
      CREATE TABLE IF NOT EXISTS customer_licenses (
        id SERIAL PRIMARY KEY,
        customer_email TEXT NOT NULL,
        license_key TEXT NOT NULL,
        product_id TEXT,
        plan_name TEXT,
        status TEXT,
        expiry_date TEXT,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(customer_email, license_key)
      )
    `);

    // 4. Create activations table (COMPLETE)
    await client.query(`
      CREATE TABLE IF NOT EXISTS activations (
        id SERIAL PRIMARY KEY,
        license_key TEXT,
        hardware_id TEXT NOT NULL,
        device_name TEXT,
        ip_address TEXT,
        activated_at TEXT,
        last_seen TEXT,
        os_version TEXT,
        product_version TEXT,
        company_name TEXT,
        status TEXT DEFAULT 'active',
        is_active BOOLEAN DEFAULT TRUE,
        metadata JSONB
      )
    `);

    // 5. Create trials table (COMPLETE with analytics fields)
    await client.query(`
      CREATE TABLE IF NOT EXISTS trials (
        id SERIAL PRIMARY KEY,
        hardware_id TEXT NOT NULL UNIQUE,
        status TEXT DEFAULT 'active',
        expiry_date TEXT NOT NULL,
        started_at TEXT DEFAULT CURRENT_TIMESTAMP,
        product_id TEXT,
        plan_id INTEGER,
        user_id TEXT,
        converted_at TIMESTAMP,
        converted_to_license_key TEXT,
        customer_email TEXT,
        customer_name TEXT,
        mobile_number TEXT,
        ip_address TEXT,
        cpu_id TEXT,
        motherboard_id TEXT,
        device_hash TEXT,
        software_version TEXT,
        sdk_version TEXT,
        runtime_type TEXT,
        activation_source TEXT DEFAULT 'sdk_onboarding',
        os_info TEXT,
        installation_timestamp TEXT,
        trial_template_id INTEGER,
        trial_duration_days INTEGER DEFAULT 7,
        reset_attempts INTEGER DEFAULT 0,
        suspicious_flag BOOLEAN DEFAULT FALSE,
        suspicious_reason TEXT,
        suspicious_logged_at TEXT,
        expired_at TIMESTAMP,
        notified_admin BOOLEAN DEFAULT FALSE
      )
    `);

    // Add customer_type to customers if missing (for existing DBs)
    try {
      await client.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_type TEXT DEFAULT 'trial'`);
    } catch { /* column may already exist */ }

    // Add expired_at to trials if missing
    try {
      await client.query(`ALTER TABLE trials ADD COLUMN IF NOT EXISTS expired_at TIMESTAMP`);
    } catch { /* column may already exist */ }

    // 6. Create audit_logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        event_type TEXT,
        message TEXT,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        ip_address TEXT,
        license_key TEXT,
        hardware_id TEXT
      )
    `);

    // 6b. Create trial_audit_logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS trial_audit_logs (
        id SERIAL PRIMARY KEY,
        trial_id INTEGER REFERENCES trials(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL,
        message TEXT,
        ip_address TEXT,
        metadata JSONB,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 7. Create OTP verifications table
    await client.query(`
      CREATE TABLE IF NOT EXISTS otp_verifications (
        id SERIAL PRIMARY KEY,
        email TEXT,
        phone TEXT,
        otp_code TEXT NOT NULL,
        purpose TEXT DEFAULT 'activation',
        expires_at TIMESTAMPTZ NOT NULL,
        verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(email, purpose)
      )
    `);

    // 8. Create license_bindings table (NEW)
    await client.query(`
      CREATE TABLE IF NOT EXISTS license_bindings (
        id SERIAL PRIMARY KEY,
        license_key TEXT,
        hardware_id TEXT NOT NULL,
        status TEXT DEFAULT 'bound',
        bound_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        device_name TEXT,
        UNIQUE(license_key, hardware_id)
      )
    `);

    // 9. Create license_hardware table (NEW)
    await client.query(`
      CREATE TABLE IF NOT EXISTS license_hardware (
        id SERIAL PRIMARY KEY,
        hardware_id TEXT UNIQUE NOT NULL,
        license_key TEXT,
        device_name TEXT,
        online_status TEXT DEFAULT 'offline',
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 10. Create system_settings table (NEW)
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id SERIAL PRIMARY KEY,
        settings JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 11. Create renewal_history table (NEW)
    await client.query(`
      CREATE TABLE IF NOT EXISTS renewal_history (
        id SERIAL PRIMARY KEY,
        license_key TEXT,
        old_plan TEXT,
        new_plan TEXT,
        old_plan_id INTEGER,
        new_plan_id INTEGER,
        old_expiry_date TEXT,
        new_expiry_date TEXT,
        extra_days INTEGER,
        renewed_by TEXT,
        renewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        notes TEXT
      )
    `);

    // 12. Create renewal_requests table (customer-submitted renewal requests from SDK)
    await client.query(`
      CREATE TABLE IF NOT EXISTS renewal_requests (
        id SERIAL PRIMARY KEY,
        license_key TEXT,
        customer_name TEXT,
        email TEXT,
        mobile TEXT,
        subject TEXT,
        message TEXT,
        request_type TEXT,
        selected_plan_id TEXT,
        selected_plan_name TEXT,
        current_plan_name TEXT,
        product_id TEXT,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 12b. Create reactivation_requests table (for hardware change/reactivation workflow)
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

    // 13. Create developer_api_keys table (COMPLETE)
    await client.query(`
      CREATE TABLE IF NOT EXISTS developer_api_keys (
        id SERIAL PRIMARY KEY,
        product_id TEXT NOT NULL,
        api_key TEXT UNIQUE NOT NULL,
        secret_hash TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        permissions TEXT[] DEFAULT '{}',
        rate_limit INTEGER DEFAULT 1000,
        expires_at TIMESTAMP,
        last_used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 13. Create api_key_audit_log table
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

    // 14. Create api_request_logs table
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

    // 15. Create public_api_nonces table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public_api_nonces (
        id SERIAL PRIMARY KEY,
        nonce TEXT UNIQUE NOT NULL,
        api_key_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 16. Create notifications table
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT,
        link TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 17. Create countries table (for public API country code list)
    await client.query(`
      CREATE TABLE IF NOT EXISTS countries (
        code TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        dial TEXT NOT NULL,
        dial_code TEXT,
        display_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Seed countries if table is empty
    const countryCount = await client.query('SELECT COUNT(*) FROM countries');
    if (parseInt(countryCount.rows[0].count) === 0) {
      const countries = [
        { code: 'IN', name: 'India', dial: '+91', display_order: 1 },
        { code: 'US', name: 'United States', dial: '+1', display_order: 2 },
        { code: 'GB', name: 'United Kingdom', dial: '+44', display_order: 3 },
        { code: 'CA', name: 'Canada', dial: '+1' },
        { code: 'AU', name: 'Australia', dial: '+61' },
        { code: 'DE', name: 'Germany', dial: '+49' },
        { code: 'FR', name: 'France', dial: '+33' },
        { code: 'IT', name: 'Italy', dial: '+39' },
        { code: 'ES', name: 'Spain', dial: '+34' },
        { code: 'BR', name: 'Brazil', dial: '+55' },
        { code: 'JP', name: 'Japan', dial: '+81' },
        { code: 'CN', name: 'China', dial: '+86' },
        { code: 'KR', name: 'South Korea', dial: '+82' },
        { code: 'SG', name: 'Singapore', dial: '+65' },
        { code: 'AE', name: 'United Arab Emirates', dial: '+971' },
        { code: 'SA', name: 'Saudi Arabia', dial: '+966' },
        { code: 'ZA', name: 'South Africa', dial: '+27' },
        { code: 'NG', name: 'Nigeria', dial: '+234' },
        { code: 'KE', name: 'Kenya', dial: '+254' },
        { code: 'EG', name: 'Egypt', dial: '+20' },
        { code: 'MX', name: 'Mexico', dial: '+52' },
        { code: 'AR', name: 'Argentina', dial: '+54' },
        { code: 'CL', name: 'Chile', dial: '+56' },
        { code: 'CO', name: 'Colombia', dial: '+57' },
        { code: 'NL', name: 'Netherlands', dial: '+31' },
        { code: 'SE', name: 'Sweden', dial: '+46' },
        { code: 'NO', name: 'Norway', dial: '+47' },
        { code: 'DK', name: 'Denmark', dial: '+45' },
        { code: 'FI', name: 'Finland', dial: '+358' },
        { code: 'CH', name: 'Switzerland', dial: '+41' },
        { code: 'AT', name: 'Austria', dial: '+43' },
        { code: 'BE', name: 'Belgium', dial: '+32' },
        { code: 'PT', name: 'Portugal', dial: '+351' },
        { code: 'IE', name: 'Ireland', dial: '+353' },
        { code: 'NZ', name: 'New Zealand', dial: '+64' },
        { code: 'HK', name: 'Hong Kong', dial: '+852' },
        { code: 'MY', name: 'Malaysia', dial: '+60' },
        { code: 'TH', name: 'Thailand', dial: '+66' },
        { code: 'VN', name: 'Vietnam', dial: '+84' },
        { code: 'PH', name: 'Philippines', dial: '+63' },
        { code: 'PK', name: 'Pakistan', dial: '+92' },
        { code: 'BD', name: 'Bangladesh', dial: '+880' },
        { code: 'TR', name: 'Turkey', dial: '+90' },
        { code: 'RU', name: 'Russia', dial: '+7' },
        { code: 'UA', name: 'Ukraine', dial: '+380' },
        { code: 'PL', name: 'Poland', dial: '+48' },
        { code: 'RO', name: 'Romania', dial: '+40' },
        { code: 'GR', name: 'Greece', dial: '+30' },
        { code: 'IL', name: 'Israel', dial: '+972' },
      ];
      for (const c of countries) {
        const rules = COUNTRY_CODES.find(cc => cc.code === c.code);
        await client.query(
          `INSERT INTO countries (code, name, dial, display_order, min_digits, max_digits)
           VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (code) DO NOTHING`,
          [c.code, c.name, c.dial, c.display_order || 99,
           rules ? rules.minDigits : null, rules ? rules.maxDigits : null]
        );
      }
    }

    // ============================================================
    // STATES & CITIES (checkout location pickers — DB driven)
    // ============================================================

    await client.query(`
      CREATE TABLE IF NOT EXISTS states (
        id SERIAL PRIMARY KEY,
        country_code TEXT NOT NULL,
        name TEXT NOT NULL,
        code TEXT,
        display_order INTEGER DEFAULT 0,
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

    await client.query(`CREATE INDEX IF NOT EXISTS idx_states_country ON states(country_code)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cities_country ON cities(country_code)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cities_state ON cities(state_id)`);

    const stateCount = await client.query('SELECT COUNT(*) FROM states');
    if (parseInt(stateCount.rows[0].count) === 0) {
      const STATES: Record<string, Array<[string, string?]>> = {
        IN: [['Andhra Pradesh','AP'],['Arunachal Pradesh','AR'],['Assam','AS'],['Bihar','BR'],['Chhattisgarh','CG'],['Goa','GA'],['Gujarat','GJ'],['Haryana','HR'],['Himachal Pradesh','HP'],['Jharkhand','JH'],['Karnataka','KA'],['Kerala','KL'],['Madhya Pradesh','MP'],['Maharashtra','MH'],['Manipur','MN'],['Meghalaya','ML'],['Mizoram','MZ'],['Nagaland','NL'],['Odisha','OD'],['Punjab','PB'],['Rajasthan','RJ'],['Sikkim','SK'],['Tamil Nadu','TN'],['Telangana','TS'],['Tripura','TR'],['Uttar Pradesh','UP'],['Uttarakhand','UK'],['West Bengal','WB'],['Andaman and Nicobar Islands','AN'],['Chandigarh','CH'],['Dadra and Nagar Haveli and Daman and Diu','DN'],['Delhi','DL'],['Jammu and Kashmir','JK'],['Ladakh','LA'],['Lakshadweep','LD'],['Puducherry','PY']],
        US: [['Alabama','AL'],['Alaska','AK'],['Arizona','AZ'],['Arkansas','AR'],['California','CA'],['Colorado','CO'],['Connecticut','CT'],['Delaware','DE'],['Florida','FL'],['Georgia','GA'],['Hawaii','HI'],['Idaho','ID'],['Illinois','IL'],['Indiana','IN'],['Iowa','IA'],['Kansas','KS'],['Kentucky','KY'],['Louisiana','LA'],['Maine','ME'],['Maryland','MD'],['Massachusetts','MA'],['Michigan','MI'],['Minnesota','MN'],['Mississippi','MS'],['Missouri','MO'],['Montana','MT'],['Nebraska','NE'],['Nevada','NV'],['New Hampshire','NH'],['New Jersey','NJ'],['New Mexico','NM'],['New York','NY'],['North Carolina','NC'],['North Dakota','ND'],['Ohio','OH'],['Oklahoma','OK'],['Oregon','OR'],['Pennsylvania','PA'],['Rhode Island','RI'],['South Carolina','SC'],['South Dakota','SD'],['Tennessee','TN'],['Texas','TX'],['Utah','UT'],['Vermont','VT'],['Virginia','VA'],['Washington','WA'],['West Virginia','WV'],['Wisconsin','WI'],['Wyoming','WY']],
        CA: [['Alberta','AB'],['British Columbia','BC'],['Manitoba','MB'],['New Brunswick','NB'],['Newfoundland and Labrador','NL'],['Northwest Territories','NT'],['Nova Scotia','NS'],['Nunavut','NU'],['Ontario','ON'],['Prince Edward Island','PE'],['Quebec','QC'],['Saskatchewan','SK'],['Yukon','YT']],
        AU: [['New South Wales','NSW'],['Queensland','QLD'],['South Australia','SA'],['Tasmania','TAS'],['Victoria','VIC'],['Western Australia','WA'],['Australian Capital Territory','ACT'],['Northern Territory','NT']],
        GB: [['England','ENG'],['Scotland','SCT'],['Wales','WLS'],['Northern Ireland','NIR']],
        DE: [['Baden-Württemberg','BW'],['Bavaria','BY'],['Berlin','BE'],['Brandenburg','BB'],['Bremen','HB'],['Hamburg','HH'],['Hesse','HE'],['Lower Saxony','NI'],['Mecklenburg-Vorpommern','MV'],['North Rhine-Westphalia','NW'],['Rhineland-Palatinate','RP'],['Saarland','SL'],['Saxony','SN'],['Saxony-Anhalt','ST'],['Schleswig-Holstein','SH'],['Thuringia','TH']],
        FR: [['Auvergne-Rhône-Alpes'],['Bourgogne-Franche-Comté'],['Bretagne'],['Centre-Val de Loire'],['Corse'],['Grand Est'],['Hauts-de-France'],['Île-de-France'],['Normandie'],['Nouvelle-Aquitaine'],['Occitanie'],['Pays de la Loire'],['Provence-Alpes-Côte d\'Azur']],
      };
      for (const [cc, list] of Object.entries(STATES)) {
        for (const [name, code] of list) {
          await client.query(
            `INSERT INTO states (country_code, name, code) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
            [cc, name, code || null]
          );
        }
      }
    }

    const cityCount = await client.query('SELECT COUNT(*) FROM cities');
    if (parseInt(cityCount.rows[0].count) === 0) {
      const CITIES: Record<string, Record<string, string[]>> = {
        IN: {
          'Andhra Pradesh': ['Visakhapatnam','Vijayawada','Guntur','Nellore','Tirupati'],
          'Assam': ['Guwahati','Silchar','Dibrugarh'],
          'Bihar': ['Patna','Gaya','Bhagalpur','Muzaffarpur'],
          'Chhattisgarh': ['Raipur','Bilaspur','Korba'],
          'Delhi': ['New Delhi'],
          'Gujarat': ['Ahmedabad','Surat','Vadodara','Rajkot','Gandhinagar'],
          'Haryana': ['Gurugram','Faridabad','Panipat'],
          'Jharkhand': ['Ranchi','Jamshedpur','Dhanbad'],
          'Karnataka': ['Bengaluru','Mysuru','Hubballi','Mangaluru'],
          'Kerala': ['Thiruvananthapuram','Kochi','Kozhikode','Kollam'],
          'Madhya Pradesh': ['Indore','Bhopal','Gwalior','Jabalpur'],
          'Maharashtra': ['Mumbai','Pune','Nagpur','Nashik','Aurangabad','Thane','Navi Mumbai'],
          'Odisha': ['Bhubaneswar','Cuttack','Rourkela'],
          'Punjab': ['Ludhiana','Amritsar','Jalandhar','Chandigarh'],
          'Rajasthan': ['Jaipur','Jodhpur','Udaipur','Kota'],
          'Tamil Nadu': ['Chennai','Coimbatore','Madurai','Salem','Tiruchirappalli'],
          'Telangana': ['Hyderabad','Warangal','Karimnagar'],
          'Uttar Pradesh': ['Lucknow','Kanpur','Varanasi','Agra','Ghaziabad','Noida','Prayagraj'],
          'Uttarakhand': ['Dehradun','Haridwar','Nainital'],
          'West Bengal': ['Kolkata','Howrah','Siliguri','Durgapur'],
        },
        US: {
          'California': ['Los Angeles','San Francisco','San Diego','San Jose','Sacramento'],
          'New York': ['New York City','Buffalo','Rochester','Albany'],
          'Texas': ['Houston','Dallas','Austin','San Antonio','Fort Worth'],
          'Florida': ['Miami','Orlando','Tampa','Jacksonville'],
          'Illinois': ['Chicago','Naperville','Springfield'],
          'Washington': ['Seattle','Spokane','Tacoma'],
          'Massachusetts': ['Boston','Cambridge','Worcester'],
          'Georgia': ['Atlanta','Savannah','Augusta'],
          'Colorado': ['Denver','Boulder','Colorado Springs'],
          'Arizona': ['Phoenix','Tucson','Scottsdale'],
          'Nevada': ['Las Vegas','Reno','Henderson'],
          'Oregon': ['Portland','Eugene','Salem'],
          'Pennsylvania': ['Philadelphia','Pittsburgh','Harrisburg'],
          'Michigan': ['Detroit','Grand Rapids','Ann Arbor'],
          'North Carolina': ['Charlotte','Raleigh','Durham'],
          'Virginia': ['Richmond','Virginia Beach','Arlington'],
          'Ohio': ['Columbus','Cleveland','Cincinnati'],
          'New Jersey': ['Newark','Jersey City','Princeton'],
          'Maryland': ['Baltimore','Annapolis','Bethesda'],
          'Minnesota': ['Minneapolis','Saint Paul'],
        },
      };
      for (const [cc, byState] of Object.entries(CITIES)) {
        for (const [stateName, cityList] of Object.entries(byState)) {
          const stateRes = await client.query(
            `SELECT id FROM states WHERE country_code = $1 AND name = $2`,
            [cc, stateName]
          );
          const stateId = stateRes.rows[0]?.id;
          if (!stateId) continue;
          for (const cityName of cityList) {
            await client.query(
              `INSERT INTO cities (state_id, country_code, name) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
              [stateId, cc, cityName]
            );
          }
        }
      }
    }

    // ============================================================
    // ADD FOREIGN KEY CONSTRAINTS
    // ============================================================

    try {
      await client.query(`
        ALTER TABLE licenses 
        ADD CONSTRAINT fk_licenses_product 
        FOREIGN KEY (product_id) 
        REFERENCES products(product_id) 
        ON DELETE SET NULL
      `);
    } catch (fkError) {
      console.log('Foreign key fk_licenses_product check:', fkError.message);
    }

    try {
      await client.query(`
        ALTER TABLE licenses 
        ADD CONSTRAINT fk_licenses_plan 
        FOREIGN KEY (plan_id) 
        REFERENCES plans(id) 
        ON DELETE SET NULL
      `);
    } catch (fkError) {
      console.log('Foreign key fk_licenses_plan check:', fkError.message);
    }

    try {
      await client.query(`
        ALTER TABLE plans 
        ADD CONSTRAINT fk_plans_product 
        FOREIGN KEY (product_id) 
        REFERENCES products(product_id) 
        ON DELETE CASCADE
      `);
    } catch (fkError) {
      console.log('Foreign key fk_plans_product check:', fkError.message);
    }

    try {
      await client.query(`
        ALTER TABLE activations 
        ADD CONSTRAINT fk_activations_license 
        FOREIGN KEY (license_key) 
        REFERENCES licenses(license_key) 
        ON DELETE CASCADE
      `);
    } catch (fkError) {
      console.log('Foreign key fk_activations_license check:', fkError.message);
    }

    try {
      await client.query(`
        ALTER TABLE license_bindings 
        ADD CONSTRAINT fk_license_bindings_license 
        FOREIGN KEY (license_key) 
        REFERENCES licenses(license_key) 
        ON DELETE CASCADE
      `);
    } catch (fkError) {
      console.log('Foreign key fk_license_bindings_license check:', fkError.message);
    }

    try {
      await client.query(`
        ALTER TABLE license_hardware 
        ADD CONSTRAINT fk_license_hardware_license 
        FOREIGN KEY (license_key) 
        REFERENCES licenses(license_key) 
        ON DELETE SET NULL
      `);
    } catch (fkError) {
      console.log('Foreign key fk_license_hardware_license check:', fkError.message);
    }

    try {
      await client.query(`
        ALTER TABLE renewal_history 
        ADD CONSTRAINT fk_renewal_history_license 
        FOREIGN KEY (license_key) 
        REFERENCES licenses(license_key) 
        ON DELETE SET NULL
      `);
    } catch (fkError) {
      console.log('Foreign key fk_renewal_history_license check:', fkError.message);
    }

    try {
      await client.query(`
        ALTER TABLE trials 
        ADD CONSTRAINT fk_trials_product 
        FOREIGN KEY (product_id) 
        REFERENCES products(product_id) 
        ON DELETE CASCADE
      `);
    } catch (fkError) {
      console.log('Foreign key fk_trials_product check:', fkError.message);
    }

    try {
      await client.query(`
        ALTER TABLE trials 
        ADD CONSTRAINT fk_trials_converted_license 
        FOREIGN KEY (converted_to_license_key) 
        REFERENCES licenses(license_key) 
        ON DELETE SET NULL
      `);
    } catch (fkError) {
      console.log('Foreign key fk_trials_converted_license check:', fkError.message);
    }

    try {
      await client.query(`
        ALTER TABLE developer_api_keys 
        ADD CONSTRAINT fk_developer_api_keys_product 
        FOREIGN KEY (product_id) 
        REFERENCES products(product_id) 
        ON DELETE CASCADE
      `);
    } catch (fkError) {
      console.log('Foreign key fk_developer_api_keys_product check:', fkError.message);
    }

    try {
      await client.query(`
        ALTER TABLE api_key_audit_log 
        ADD CONSTRAINT fk_api_key_audit_log_key 
        FOREIGN KEY (key_id) 
        REFERENCES developer_api_keys(id) 
        ON DELETE CASCADE
      `);
    } catch (fkError) {
      console.log('Foreign key fk_api_key_audit_log_key check:', fkError.message);
    }

    try {
      await client.query(`
        ALTER TABLE api_request_logs 
        ADD CONSTRAINT fk_api_request_logs_key 
        FOREIGN KEY (api_key_id) 
        REFERENCES developer_api_keys(id) 
        ON DELETE CASCADE
      `);
    } catch (fkError) {
      console.log('Foreign key fk_api_request_logs_key check:', fkError.message);
    }

    try {
      await client.query(`
        ALTER TABLE public_api_nonces 
        ADD CONSTRAINT fk_public_api_nonces_key 
        FOREIGN KEY (api_key_id) 
        REFERENCES developer_api_keys(id) 
        ON DELETE CASCADE
      `);
    } catch (fkError) {
      console.log('Foreign key fk_public_api_nonces_key check:', fkError.message);
    }

    // ============================================================
    // MISSING FOREIGN KEY CONSTRAINTS — SAFETY NETS
    // ============================================================

    try {
      await client.query(`
        ALTER TABLE trials 
        ADD CONSTRAINT fk_trials_plan 
        FOREIGN KEY (plan_id) 
        REFERENCES plans(id) 
        ON DELETE SET NULL
      `);
    } catch (fkError) {
      console.log('Foreign key fk_trials_plan check:', fkError.message);
    }

    try {
      await client.query(`
        ALTER TABLE subscriptions 
        ADD CONSTRAINT fk_subscriptions_plan 
        FOREIGN KEY (plan_id) 
        REFERENCES plans(id) 
        ON DELETE SET NULL
      `);
    } catch (fkError) {
      console.log('Foreign key fk_subscriptions_plan check:', fkError.message);
    }

    try {
      await client.query(`
        ALTER TABLE coupons 
        ADD CONSTRAINT fk_coupons_plan 
        FOREIGN KEY (applies_to_plan_id) 
        REFERENCES plans(id) 
        ON DELETE SET NULL
      `);
    } catch (fkError) {
      console.log('Foreign key fk_coupons_plan check:', fkError.message);
    }

    try {
      await client.query(`
        ALTER TABLE order_items 
        ADD CONSTRAINT fk_order_items_plan 
        FOREIGN KEY (plan_id) 
        REFERENCES plans(id) 
        ON DELETE SET NULL
      `);
    } catch (fkError) {
      console.log('Foreign key fk_order_items_plan check:', fkError.message);
    }

    try {
      await client.query(`
        ALTER TABLE cart_items 
        ADD CONSTRAINT fk_cart_items_plan 
        FOREIGN KEY (plan_id) 
        REFERENCES plans(id) 
        ON DELETE SET NULL
      `);
    } catch (fkError) {
      console.log('Foreign key fk_cart_items_plan check:', fkError.message);
    }

    try {
      await client.query(`
        ALTER TABLE customer_licenses 
        ADD CONSTRAINT fk_customer_licenses_license 
        FOREIGN KEY (license_key) 
        REFERENCES licenses(license_key) 
        ON DELETE CASCADE
      `);
    } catch (fkError) {
      console.log('Foreign key fk_customer_licenses_license check:', fkError.message);
    }

    // ============================================================
    // STORE TABLES (Phase 10)
    // ============================================================

    // 17. Create payment_gateways table
    await client.query(`
      CREATE TABLE IF NOT EXISTS payment_gateways (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        is_active BOOLEAN DEFAULT FALSE,
        config JSONB DEFAULT '{}'::jsonb,
        supported_currencies TEXT[] DEFAULT '{"USD"}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 18. Create coupons table
    await client.query(`
      CREATE TABLE IF NOT EXISTS coupons (
        id SERIAL PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        description TEXT,
        discount_type TEXT NOT NULL DEFAULT 'percentage',
        discount_value DECIMAL(10,2) NOT NULL,
        min_purchase_amount DECIMAL(10,2) DEFAULT 0,
        max_uses INTEGER DEFAULT 0,
        current_uses INTEGER DEFAULT 0,
        max_uses_per_customer INTEGER DEFAULT 1,
        applies_to_product_id TEXT,
        applies_to_plan_id INTEGER,
        starts_at TIMESTAMP,
        expires_at TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 19. Create orders table
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        order_number TEXT UNIQUE NOT NULL,
        customer_email TEXT NOT NULL,
        customer_name TEXT,
        status TEXT DEFAULT 'pending',
        subtotal DECIMAL(12,2) DEFAULT 0,
        discount DECIMAL(12,2) DEFAULT 0,
        tax DECIMAL(12,2) DEFAULT 0,
        total DECIMAL(12,2) DEFAULT 0,
        currency TEXT DEFAULT 'USD',
        coupon_code TEXT,
        payment_gateway TEXT,
        payment_intent_id TEXT,
        paid_at TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 20. Create order_items table
    await client.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id TEXT NOT NULL,
        plan_id INTEGER,
        plan_name TEXT,
        quantity INTEGER DEFAULT 1,
        unit_price DECIMAL(12,2) DEFAULT 0,
        total_price DECIMAL(12,2) DEFAULT 0,
        license_key_generated TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 20b. Create payments table (payment records — one row per captured payment)
    await client.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        payment_number TEXT UNIQUE NOT NULL,
        order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
        order_number TEXT NOT NULL,
        customer_email TEXT NOT NULL,
        gateway TEXT NOT NULL DEFAULT 'dummy',
        transaction_id TEXT,
        method TEXT,
        amount DECIMAL(12,2) NOT NULL DEFAULT 0,
        currency TEXT DEFAULT 'USD',
        status TEXT DEFAULT 'pending',
        paid_at TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 21. Create subscriptions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id SERIAL PRIMARY KEY,
        customer_email TEXT NOT NULL,
        product_id TEXT NOT NULL,
        plan_id INTEGER NOT NULL,
        status TEXT DEFAULT 'active',
        current_period_start TIMESTAMP,
        current_period_end TIMESTAMP,
        trial_end TIMESTAMP,
        cancelled_at TIMESTAMP,
        payment_gateway TEXT,
        gateway_subscription_id TEXT,
        next_billing_date TIMESTAMP,
        amount DECIMAL(12,2) DEFAULT 0,
        currency TEXT DEFAULT 'USD',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 22. Create invoices table
    await client.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id SERIAL PRIMARY KEY,
        invoice_number TEXT UNIQUE NOT NULL,
        order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
        subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL,
        customer_email TEXT NOT NULL,
        status TEXT DEFAULT 'draft',
        amount DECIMAL(12,2) DEFAULT 0,
        tax DECIMAL(12,2) DEFAULT 0,
        total DECIMAL(12,2) DEFAULT 0,
        currency TEXT DEFAULT 'USD',
        gateway_invoice_id TEXT,
        pdf_url TEXT,
        paid_at TIMESTAMP,
        due_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 23. Create carts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS carts (
        id SERIAL PRIMARY KEY,
        session_id TEXT UNIQUE NOT NULL,
        customer_email TEXT,
        coupon_code TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 24. Create cart_items table
    await client.query(`
      CREATE TABLE IF NOT EXISTS cart_items (
        id SERIAL PRIMARY KEY,
        cart_id INTEGER NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
        product_id TEXT NOT NULL,
        plan_id INTEGER,
        quantity INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 25. Create wishlist table
    await client.query(`
      CREATE TABLE IF NOT EXISTS wishlist (
        id SERIAL PRIMARY KEY,
        customer_email TEXT NOT NULL,
        product_id TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(customer_email, product_id)
      )
    `);

    // 26. Create trial_templates table
    await client.query(`
      CREATE TABLE IF NOT EXISTS trial_templates (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        duration_days INTEGER NOT NULL DEFAULT 7,
        hardware_binding_enabled BOOLEAN DEFAULT TRUE,
        max_hardware_changes INTEGER DEFAULT 1,
        max_devices INTEGER DEFAULT 1,
        collect_name BOOLEAN DEFAULT TRUE,
        collect_email BOOLEAN DEFAULT TRUE,
        collect_mobile BOOLEAN DEFAULT FALSE,
        support_url TEXT,
        store_url TEXT,
        offline_cache_enabled BOOLEAN DEFAULT TRUE,
        is_active BOOLEAN DEFAULT TRUE,
        is_system_default BOOLEAN DEFAULT FALSE,
        is_permanent BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 27. Create email_templates table
    await client.query(`
      CREATE TABLE IF NOT EXISTS email_templates (
        id SERIAL PRIMARY KEY,
        email_type TEXT NOT NULL,
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        plain_text TEXT DEFAULT '',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(email_type)
      )
    `);

    // 28b. Create sms_config table
    await client.query(`
      CREATE TABLE IF NOT EXISTS sms_config (
        id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        provider TEXT DEFAULT 'fast2sms',
        api_key TEXT DEFAULT '',
        sender_id TEXT DEFAULT 'WEBSMS',
        route TEXT DEFAULT 'dlt',
        environment TEXT DEFAULT 'production',
        enabled BOOLEAN DEFAULT FALSE,
        default_country_code TEXT DEFAULT '+91',
        retry_count INTEGER DEFAULT 2,
        timeout INTEGER DEFAULT 5000,
        delivery_report BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Seed default SMS config row if not exists
    try {
      await client.query(`
        INSERT INTO sms_config (id, provider, api_key, sender_id, route, environment, enabled, default_country_code, retry_count, timeout, delivery_report)
        VALUES (1, 'fast2sms', '', 'WEBSMS', 'dlt', 'production', false, '+91', 2, 5000, false)
        ON CONFLICT (id) DO NOTHING
      `);
    } catch (e) {
      console.log('SMS config seed check:', e.message);
    }

    // 29. Create sms_templates table
    await client.query(`
      CREATE TABLE IF NOT EXISTS sms_templates (
        id SERIAL PRIMARY KEY,
        sms_type TEXT NOT NULL,
        message TEXT NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(sms_type)
      )
    `);

    // 30. Create event_notification_config table
    await client.query(`
      CREATE TABLE IF NOT EXISTS event_notification_config (
        id SERIAL PRIMARY KEY,
        event_type TEXT NOT NULL UNIQUE,
        email_enabled BOOLEAN DEFAULT TRUE,
        sms_enabled BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 31. Create notification_logs table
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 27. Create requests table (Universal Request Center - AWS-01)
    await client.query(`
      CREATE TABLE IF NOT EXISTS requests (
        id SERIAL PRIMARY KEY,
        request_id TEXT UNIQUE NOT NULL,
        request_type TEXT NOT NULL,
        status TEXT DEFAULT 'open',
        customer_email TEXT,
        customer_name TEXT,
        product_id TEXT,
        product_name TEXT,
        plan_name TEXT,
        license_key TEXT,
        hardware_id TEXT,
        sdk_version TEXT,
        runtime_type TEXT,
        subject TEXT,
        message TEXT,
        admin_notes TEXT,
        resolved_at TIMESTAMP,
        closed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_requests_request_type ON requests(request_type)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_requests_customer_email ON requests(customer_email)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests(created_at DESC)`);

    // 27b. Create communication_conversations table (public API /api/v1/communication/create)
    await client.query(`
      CREATE TABLE IF NOT EXISTS communication_conversations (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        customer_email TEXT NOT NULL,
        customer_name TEXT DEFAULT '',
        subject TEXT DEFAULT '',
        product_id TEXT DEFAULT '',
        license_key TEXT DEFAULT '',
        hardware_id TEXT DEFAULT '',
        sdk_version TEXT DEFAULT '',
        runtime_type TEXT DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TIMESTAMP
      )
    `);
    // Migration: add deleted_at column for soft delete BEFORE creating indexes on it
    try { await client.query(`ALTER TABLE communication_conversations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP`); } catch (e) {}
    // Migration: admin_read_at — admin "Mark Read" tracking; conversations with customer
    // messages newer than this timestamp are treated as unread.
    try { await client.query(`ALTER TABLE communication_conversations ADD COLUMN IF NOT EXISTS admin_read_at TIMESTAMP`); } catch (e) {}
    await client.query(`CREATE INDEX IF NOT EXISTS idx_communication_conversations_category ON communication_conversations(category)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_communication_conversations_customer_email ON communication_conversations(customer_email)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_communication_conversations_status ON communication_conversations(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_communication_conversations_created_at ON communication_conversations(created_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_communication_conversations_deleted_at ON communication_conversations(deleted_at)`);

    // 27c. Create conversation_messages table for threaded conversations
    await client.query(`
      CREATE TABLE IF NOT EXISTS conversation_messages (
        id SERIAL PRIMARY KEY,
        request_id TEXT REFERENCES requests(request_id) ON DELETE CASCADE,
        conversation_id TEXT REFERENCES communication_conversations(id) ON DELETE CASCADE,
        sender_type TEXT NOT NULL CHECK (sender_type IN ('customer', 'admin')),
        sender_name TEXT NOT NULL,
        sender_email TEXT NOT NULL,
        message TEXT NOT NULL,
        is_internal BOOLEAN DEFAULT FALSE,
        email_sent BOOLEAN DEFAULT FALSE,
        email_error TEXT,
        provider_message_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Migration: add conversation_id column to existing conversation_messages
    try { await client.query(`ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS conversation_id TEXT REFERENCES communication_conversations(id) ON DELETE CASCADE`); } catch (e) {}
    try { await client.query(`ALTER TABLE conversation_messages ALTER COLUMN request_id DROP NOT NULL`); } catch (e) {}
    // The universal inbound adapters use the provider Message-ID as their
    // durable idempotency boundary. This applies to every transport that
    // writes the shared conversation model; NULL stays valid for legacy and
    // non-email conversation messages.
    try { await client.query(`ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS provider_message_id TEXT`); } catch (e) {}
    // Indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_conversation_messages_request_id ON conversation_messages(request_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation_id ON conversation_messages(conversation_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_conversation_messages_created_at ON conversation_messages(created_at ASC)`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_conversation_messages_provider_message_id ON conversation_messages(provider_message_id) WHERE provider_message_id IS NOT NULL`);

    // 27d. Create conversation_attachments table for file attachments on messages
    await client.query(`
      CREATE TABLE IF NOT EXISTS conversation_attachments (
        id SERIAL PRIMARY KEY,
        message_id INTEGER REFERENCES conversation_messages(id) ON DELETE CASCADE,
        file_name TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        mime_type TEXT NOT NULL,
        storage_path TEXT NOT NULL,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    try { await client.query(`ALTER TABLE conversation_attachments ADD COLUMN IF NOT EXISTS message_id INTEGER REFERENCES conversation_messages(id) ON DELETE CASCADE`); } catch (e) {}
    // Durable attachment bytes (BYTEA) — stored so downloads work on hosts with
    // no persistent disk (e.g. Vercel serverless). Served via the internal
    // communications/attachments download route; disk storage_path stays as a
    // best-effort cache + fallback for legacy rows.
    try { await client.query(`ALTER TABLE conversation_attachments ADD COLUMN IF NOT EXISTS content BYTEA`); } catch (e) {}
    await client.query(`CREATE INDEX IF NOT EXISTS idx_conversation_attachments_message_id ON conversation_attachments(message_id)`);

    // 27d-bis. Conversation delete tombstones — permanent-delete persistence.
    // When a conversation is permanently deleted its conversation_messages rows
    // go away, so the read-only IMAP syncs (which NEVER mark Seen) can no longer
    // dedupe the still-UNSEEN provider message and would re-import it as a NEW
    // conversation. Each permanently-deleted inbound message records a tombstone
    // keyed by its identity; every inbound transport skips tombstoned messages.
    // provider_message_id is '' for messages that carried no Message-ID header
    // (they are matched by sender+subject instead — consistent with the existing
    // from+subject dedupe the syncs already use).
    await client.query(`
      CREATE TABLE IF NOT EXISTS conversation_delete_tombstones (
        provider_message_id TEXT NOT NULL,
        sender_email TEXT NOT NULL,
        subject TEXT NOT NULL,
        mailbox_id TEXT,
        deleted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (provider_message_id, sender_email, subject)
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tombstones_provider_message_id ON conversation_delete_tombstones(provider_message_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tombstones_mailbox_id ON conversation_delete_tombstones(mailbox_id)`);

    // 27f. Create email_attachments table — metadata for files attached to outbound emails
    await client.query(`
      CREATE TABLE IF NOT EXISTS email_attachments (
        id SERIAL PRIMARY KEY,
        notification_log_id INTEGER REFERENCES notification_logs(id) ON DELETE SET NULL,
        email_type TEXT,
        recipient TEXT,
        license_key TEXT,
        file_name TEXT NOT NULL,
        file_size BIGINT,
        mime_type TEXT,
        storage_path TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_email_attachments_notification_log_id ON email_attachments(notification_log_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_email_attachments_recipient ON email_attachments(recipient)`);
    try { await client.query(`ALTER TABLE email_attachments ADD COLUMN IF NOT EXISTS content BYTEA`); } catch (e) {}

    // 27e-bis. Create email_preferences table for centralized unsubscribe tracking
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

    // 27e. Create message_queue table for email delivery queue and retry logic
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

    // 27g. Create mailboxes table for external email account management (IMAP/SMTP)
    await client.query(`
      CREATE TABLE IF NOT EXISTS mailboxes (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        email_address TEXT NOT NULL UNIQUE,
        display_name TEXT DEFAULT '',
        imap_host TEXT NOT NULL,
        imap_port INTEGER NOT NULL DEFAULT 993,
        imap_secure BOOLEAN NOT NULL DEFAULT TRUE,
        imap_username TEXT NOT NULL,
        imap_password TEXT NOT NULL,
        smtp_host TEXT NOT NULL,
        smtp_port INTEGER NOT NULL DEFAULT 465,
        smtp_secure BOOLEAN NOT NULL DEFAULT TRUE,
        smtp_username TEXT NOT NULL,
        smtp_password TEXT NOT NULL,
        connection_status TEXT NOT NULL DEFAULT 'unknown',
        sync_status TEXT NOT NULL DEFAULT 'never',
        is_default_sender BOOLEAN NOT NULL DEFAULT FALSE,
        is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        signature TEXT DEFAULT '',
        auto_reply_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        auto_reply_message TEXT DEFAULT '',
        auto_reply_template_key TEXT DEFAULT '',
        auto_reply_signature TEXT DEFAULT '',
        queue_size INTEGER NOT NULL DEFAULT 0,
        last_sync TIMESTAMP,
        last_success TIMESTAMP,
        last_failure TIMESTAMP,
        last_error TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_mailboxes_email ON mailboxes(email_address)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_mailboxes_enabled ON mailboxes(is_enabled)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_mailboxes_default ON mailboxes(is_default_sender)`);
    // Migration: mailbox_id — ownership link from a conversation to the mailbox
    // integration that synced it (used by mailbox integration removal). Nullable:
    // conversations created by other paths (replies, queues) stay unowned.
    // Placed AFTER the mailboxes table DDL so the FK reference is valid.
    try { await client.query(`ALTER TABLE communication_conversations ADD COLUMN IF NOT EXISTS mailbox_id TEXT REFERENCES mailboxes(id) ON DELETE SET NULL`); } catch (e) {}
    await client.query(`CREATE INDEX IF NOT EXISTS idx_communication_conversations_mailbox_id ON communication_conversations(mailbox_id)`);

    // 27h. Create mailbox_sync_logs table for tracking sync history
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
    await client.query(`CREATE INDEX IF NOT EXISTS idx_mailbox_sync_logs_mailbox_id ON mailbox_sync_logs(mailbox_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_mailbox_sync_logs_started_at ON mailbox_sync_logs(started_at DESC)`);

    // 27i. Create conversation_folders table (database-driven mailbox folders)
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
    await client.query(`CREATE INDEX IF NOT EXISTS idx_conversation_folders_section ON conversation_folders(section)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_conversation_folders_deleted ON conversation_folders(deleted_at)`);

    // 27i. Seed system folders (id = stable key used by the Communication Center UI)
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

    // 28. Create sales_enquiries table (Phase 12 - Purchase Workflow)
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

    // 28. Create sdk_jobs table
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

    // Migration: ensure product_id is TEXT if table already exists with UUID type
    try {
      await client.query(`ALTER TABLE sdk_runtime_settings ALTER COLUMN product_id TYPE TEXT USING product_id::TEXT`);
    } catch (e) { /* column may already be TEXT or not exist */ }
    try {
      await client.query(`ALTER TABLE sdk_runtime_settings ADD COLUMN IF NOT EXISTS email_verification BOOLEAN DEFAULT TRUE`);
    } catch (e) { /* column may already exist */ }
    try {
      await client.query(`ALTER TABLE sdk_runtime_settings ADD COLUMN IF NOT EXISTS allow_conversion BOOLEAN DEFAULT TRUE`);
    } catch (e) { /* column may already exist */ }
    try {
      await client.query(`ALTER TABLE sdk_runtime_settings ADD COLUMN IF NOT EXISTS offline_grace_days INTEGER DEFAULT 0`);
    } catch (e) { /* column may already exist */ }
    try {
      await client.query(`ALTER TABLE sdk_runtime_settings ADD COLUMN IF NOT EXISTS support_email TEXT DEFAULT 'support@websmithdigital.com'`);
    } catch (e) { /* column may already exist */ }

    // 29. Create sdk_runtime_settings table
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

    // 30. Create media_assets table (website media migrated from MongoDB to Neon).
    // id is a NATIVE SERIAL in production (HTTP evidence: url /api/media/3).
    // CREATE TABLE IF NOT EXISTS never alters an existing table, so the
    // idempotent ADD COLUMN guards below repair tables that predate the
    // data/created_at/updated_at columns (metadata rows with NULL data are
    // backfilled by seedMigratedMedia so /api/media/<id> can serve bytes).
    // Code never forces a UUID into id: inserts omit it and use id = DEFAULT,
    // so fresh ids come from the column's own default on BOTH serial and
    // uuid-default columns.
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
    await client.query(`ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS data BYTEA`);
    await client.query(`ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP`);
    await client.query(`ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP`);
    // Production's migrated media_assets table also carries columns this
    // implementation does not use (live evidence: `asset_key` is NOT NULL with
    // no default, so every INSERT that omits it fails with "null value in
    // column \"asset_key\" ... violates not-null constraint" — the seed AND the
    // upload upsert). Any NOT NULL column with no default that this
    // implementation does not populate is relaxed to NULL so those INSERTs
    // succeed; columns this implementation always supplies are left untouched.
    // Idempotent: after the first run no such column remains.
    await client.query(`
      DO $$
      DECLARE
        r record;
      BEGIN
        FOR r IN
          SELECT a.attname
          FROM pg_attribute a
          WHERE a.attrelid = 'media_assets'::regclass
            AND a.attnum > 0
            AND NOT a.attisdropped
            AND a.attnotnull
            AND NOT EXISTS (
              SELECT 1 FROM pg_attrdef d WHERE d.adrelid = a.attrelid AND d.adnum = a.attnum
            )
            AND a.attname NOT IN
              ('slot_key','file_name','content_type','file_size','data','created_at','updated_at')
        LOOP
          EXECUTE format('ALTER TABLE media_assets ALTER COLUMN %I DROP NOT NULL', r.attname);
        END LOOP;
      END $$;
    `);
    // The original migrated media_assets table was created WITHOUT a unique
    // constraint on slot_key (live evidence: "there is no unique or exclusion
    // constraint matching the ON CONFLICT specification" on every upload POST),
    // which makes every ON CONFLICT (slot_key) — the upload upsert AND the
    // seed below — fail. CREATE TABLE IF NOT EXISTS can never add it, so add
    // the constraint idempotently here (skipped when any single-column unique
    // index/constraint already covers slot_key). Production also holds DUPLICATE
    // slot_key rows (live evidence: ADD CONSTRAINT UNIQUE aborted with 23505
    // "Key (slot_key)=(global_collaboration_video) is duplicated."), so the
    // duplicates are removed FIRST — keeping, per slot_key, the row that has
    // bytes (data IS NOT NULL) else the lowest id (each media slot must hold
    // exactly one asset). Idempotent: once the constraint exists no duplicates
    // exist, so the DELETE is a no-op.
    await client.query(`
      DELETE FROM media_assets
      WHERE id NOT IN (
        SELECT DISTINCT ON (slot_key) id
        FROM media_assets
        ORDER BY slot_key, (data IS NOT NULL) DESC, id ASC
      )
    `);
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_index i
          WHERE i.indrelid = 'media_assets'::regclass
            AND i.indisunique
            AND NOT i.indisprimary
            AND (SELECT count(*) FROM unnest(i.indkey)) = 1
            AND EXISTS (
              SELECT 1
              FROM unnest(i.indkey) AS c(attnum)
              JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = c.attnum
              WHERE a.attname = 'slot_key'
            )
        ) THEN
          EXECUTE 'ALTER TABLE media_assets ADD CONSTRAINT media_assets_slot_key_uniq UNIQUE (slot_key)';
        END IF;
      END $$;
    `);

    // Preserve the single valid record migrated from the previous media store.
    // Best-effort repair: a seed failure must never abort getDb's schema init.
    try {
      await seedMigratedMedia(client);
    } catch (seedError) {
      console.error(
        'Media seed error:',
        seedError instanceof Error ? seedError.message : seedError
      );
    }

    // ============================================================
    // INSERT DEFAULT SYSTEM SETTINGS
    // ============================================================
    try {
      await client.query(`
        INSERT INTO system_settings (id, settings) 
        VALUES (1, '{"license_cleanup": {"enabled": false, "days_after_expiry": 30, "delete_notes": true, "last_run_at": null}}')
        ON CONFLICT (id) DO NOTHING
      `);
    } catch (settingsError) {
      console.log('System settings insert check:', settingsError.message);
    }

    // Seed default event notification config
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
      try {
        await client.query(
          `INSERT INTO event_notification_config (event_type, email_enabled, sms_enabled)
           VALUES ($1, $2, $3)
           ON CONFLICT (event_type) DO NOTHING`,
          [cfg.event_type, cfg.email_enabled, cfg.sms_enabled]
        );
      } catch (e) {
        console.log(`Event config insert check for ${cfg.event_type}:`, e.message);
      }
    }

    // Insert universal trial template (system default, permanent)
    try {
      await client.query(`
        INSERT INTO trial_templates (name, description, duration_days, is_active, is_system_default, is_permanent, max_devices, max_hardware_changes)
        VALUES ('Universal Trial', 'Universal evaluation license automatically available for every product. Trial activates automatically on first successful installation and counts down from first activation.', 7, true, true, true, 1, 1)
        ON CONFLICT DO NOTHING
      `);
      // Enforce: only the Universal Trial is system default and permanent
      await client.query(`
        UPDATE trial_templates SET is_system_default = (name = 'Universal Trial'), is_permanent = (name = 'Universal Trial')
      `);
      // Deduplicate: if multiple "Universal Trial" rows exist, keep only the first
      await client.query(`
        DELETE FROM trial_templates WHERE name = 'Universal Trial' AND id != (SELECT MIN(id) FROM trial_templates WHERE name = 'Universal Trial')
      `);
    } catch (trialError) {
      console.log('Universal trial insert check:', trialError.message);
    }

    // ============================================================
    // VERSIONED MIGRATIONS
    // ============================================================
    try {
      await runMigrations(pool);
    } catch (migrationError) {
      console.error('[Database] Migration error:', migrationError instanceof Error ? migrationError.message : migrationError);
      if (migrationError instanceof Error && migrationError.stack) {
        console.error('[Database] Migration stack:', migrationError.stack);
      }
    }

    // ============================================================
    // MIGRATIONS FOR EXISTING TABLES
    // ============================================================

    try { await client.query(`ALTER TABLE licenses ADD COLUMN IF NOT EXISTS inactive_reason TEXT`); } catch (e) { /* column may already exist */ }
    try { await client.query(`ALTER TABLE licenses ADD COLUMN IF NOT EXISTS is_trial BOOLEAN DEFAULT FALSE`); } catch (e) { /* column may already exist */ }
    try { await client.query(`ALTER TABLE licenses ADD COLUMN IF NOT EXISTS hardware_id TEXT DEFAULT ''`); } catch (e) { /* column may already exist */ }
    try { await client.query(`ALTER TABLE licenses ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP`); } catch (e) { /* column may already exist */ }
    try { await client.query(`ALTER TABLE activations ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE`); } catch (e) { /* column may already exist */ }
    // Trials table migrations — columns used in code but missing from original CREATE TABLE
    try { await client.query(`ALTER TABLE trials ADD COLUMN IF NOT EXISTS plan_id INTEGER`); } catch (e) {}
    try { await client.query(`ALTER TABLE trials ADD COLUMN IF NOT EXISTS user_id TEXT`); } catch (e) {}
    try { await client.query(`ALTER TABLE trials ADD COLUMN IF NOT EXISTS mobile_number TEXT`); } catch (e) {}
    try { await client.query(`ALTER TABLE trials ADD COLUMN IF NOT EXISTS ip_address TEXT`); } catch (e) {}
    try { await client.query(`ALTER TABLE trials ADD COLUMN IF NOT EXISTS cpu_id TEXT`); } catch (e) {}
    try { await client.query(`ALTER TABLE trials ADD COLUMN IF NOT EXISTS motherboard_id TEXT`); } catch (e) {}
    try { await client.query(`ALTER TABLE trials ADD COLUMN IF NOT EXISTS device_hash TEXT`); } catch (e) {}
    try { await client.query(`ALTER TABLE trials ADD COLUMN IF NOT EXISTS software_version TEXT`); } catch (e) {}
    try { await client.query(`ALTER TABLE trials ADD COLUMN IF NOT EXISTS os_info TEXT`); } catch (e) {}
    try { await client.query(`ALTER TABLE trials ADD COLUMN IF NOT EXISTS installation_timestamp TEXT`); } catch (e) {}
    try { await client.query(`ALTER TABLE trials ADD COLUMN IF NOT EXISTS trial_template_id INTEGER`); } catch (e) {}
    try { await client.query(`ALTER TABLE trials ADD COLUMN IF NOT EXISTS trial_duration_days INTEGER DEFAULT 7`); } catch (e) {}
    try { await client.query(`ALTER TABLE trials ADD COLUMN IF NOT EXISTS reset_attempts INTEGER DEFAULT 0`); } catch (e) {}
    try { await client.query(`ALTER TABLE trials ADD COLUMN IF NOT EXISTS suspicious_flag BOOLEAN DEFAULT FALSE`); } catch (e) {}
    try { await client.query(`ALTER TABLE trials ADD COLUMN IF NOT EXISTS suspicious_reason TEXT`); } catch (e) {}
    try { await client.query(`ALTER TABLE trials ADD COLUMN IF NOT EXISTS suspicious_logged_at TEXT`); } catch (e) {}
    try { await client.query(`ALTER TABLE trials ADD COLUMN IF NOT EXISTS notified_admin BOOLEAN DEFAULT FALSE`); } catch (e) {}
    // Customers table migrations
    try { await client.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS mobile TEXT`); } catch (e) {}
    try { await client.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS address_line1 TEXT`); } catch (e) {}
    try { await client.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS address_line2 TEXT`); } catch (e) {}
    try { await client.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS city TEXT`); } catch (e) {}
    try { await client.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS state TEXT`); } catch (e) {}
    try { await client.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS postal_code TEXT`); } catch (e) {}
    try { await client.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS alternative_mobile TEXT`); } catch (e) {}
    // Orders table migrations — structured billing snapshot (source: customers record)
    try { await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS billing_address JSONB`); } catch (e) {}
    // Trial templates migrations
    try { await client.query(`ALTER TABLE trial_templates ADD COLUMN IF NOT EXISTS is_system_default BOOLEAN DEFAULT FALSE`); } catch (e) {}
    try { await client.query(`ALTER TABLE trial_templates ADD COLUMN IF NOT EXISTS max_devices INTEGER DEFAULT 1`); } catch (e) {}
    // Renewal requests migrations
    try { await client.query(`ALTER TABLE renewal_requests ADD COLUMN IF NOT EXISTS product_name TEXT`); } catch (e) {}
    try { await client.query(`ALTER TABLE renewal_requests ADD COLUMN IF NOT EXISTS current_plan_id TEXT`); } catch (e) {}
    try { await client.query(`ALTER TABLE renewal_requests ADD COLUMN IF NOT EXISTS customer_email TEXT`); } catch (e) {}
    try { await client.query(`ALTER TABLE renewal_requests ADD COLUMN IF NOT EXISTS customer_mobile TEXT`); } catch (e) {}
    // notification_logs migrations
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

    // ============================================================
    // CREATE ALL INDEXES
    // ============================================================
    await client.query(`CREATE INDEX IF NOT EXISTS idx_licenses_product_id ON licenses(product_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_licenses_plan_id ON licenses(plan_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_licenses_customer_email ON licenses(customer_email)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_licenses_last_validated ON licenses(last_validated)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_licenses_is_activated ON licenses(is_activated)`);
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_activations_license_key ON activations(license_key)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_activations_hardware_id ON activations(hardware_id)`);
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_trials_hardware_id ON trials(hardware_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_trials_product_id ON trials(product_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_trials_status ON trials(status)`);
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_plans_product_id ON plans(product_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_plans_is_trial_plan ON plans(is_trial_plan)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_plans_display_order ON plans(display_order)`);
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_license_bindings_license_key ON license_bindings(license_key)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_license_bindings_hardware_id ON license_bindings(hardware_id)`);
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_license_hardware_hardware_id ON license_hardware(hardware_id)`);
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_renewal_history_license_key ON renewal_history(license_key)`);
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_reactivation_requests_license_key ON reactivation_requests(license_key)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_reactivation_requests_status ON reactivation_requests(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_reactivation_requests_created_at ON reactivation_requests(created_at DESC)`);
    
    // Add attempts tracking to otp_verifications (AWS-01)
    try { await client.query(`ALTER TABLE otp_verifications ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0`); } catch (e) { }
    try { await client.query(`ALTER TABLE otp_verifications ADD COLUMN IF NOT EXISTS max_attempts INTEGER DEFAULT 15`); } catch (e) { }
    try { await client.query(`ALTER TABLE otp_verifications ALTER COLUMN expires_at TYPE TIMESTAMPTZ USING expires_at AT TIME ZONE 'UTC'`); } catch (e) { }
    try { await client.query(`ALTER TABLE otp_verifications ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC'`); } catch (e) { }

    await client.query(`CREATE INDEX IF NOT EXISTS idx_otp_verifications_email ON otp_verifications(email)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_otp_verifications_expires_at ON otp_verifications(expires_at)`);
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_license_key ON audit_logs(license_key)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_trial_audit_logs_trial_id ON trial_audit_logs(trial_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_trial_audit_logs_event_type ON trial_audit_logs(event_type)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_trial_audit_logs_timestamp ON trial_audit_logs(timestamp)`);
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_api_keys_product_id ON developer_api_keys(product_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_api_keys_status ON developer_api_keys(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_api_keys_api_key ON developer_api_keys(api_key)`);
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_api_key_audit_log_key_id ON api_key_audit_log(key_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_api_key_audit_log_action ON api_key_audit_log(action)`);
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_api_request_logs_api_key_id ON api_request_logs(api_key_id)`);
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_public_api_nonces_nonce ON public_api_nonces(nonce)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_public_api_nonces_api_key_id ON public_api_nonces(api_key_id)`);
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sms_templates_type ON sms_templates(sms_type)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_notification_logs_event ON notification_logs(event_type)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_notification_logs_channel ON notification_logs(channel)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_notification_logs_created ON notification_logs(created_at)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_notification_logs_license ON notification_logs(license_key)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_payments_customer_email ON payments(customer_email)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`);

    // ============================================================
    // PAYMENT GATEWAYS SEED (DB-driven checkout; dummy = development)
    // ============================================================
    await client.query(
      `INSERT INTO payment_gateways (name, display_name, is_active, supported_currencies) VALUES
         ('dummy', 'Test Payment (Development)', TRUE, ARRAY['USD','EUR','GBP','INR']),
         ('stripe', 'Stripe', FALSE, ARRAY['USD','EUR','GBP']),
         ('razorpay', 'Razorpay', FALSE, ARRAY['INR']),
         ('paypal', 'PayPal', FALSE, ARRAY['USD','EUR','GBP']),
         ('paddle', 'Paddle', FALSE, ARRAY['USD','EUR','GBP'])
       ON CONFLICT (name) DO UPDATE SET display_name = EXCLUDED.display_name,
         supported_currencies = EXCLUDED.supported_currencies,
         is_active = CASE WHEN payment_gateways.name = 'dummy' THEN TRUE ELSE payment_gateways.is_active END`
    );

    console.log('[Database] Neon PostgreSQL connected successfully with complete schema and all indexes');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  } finally {
    client.release();
  }

  return pool;
}

// Helper function to close the connection pool (for graceful shutdown)
export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('[Database] Connection pool closed');
  }
}
