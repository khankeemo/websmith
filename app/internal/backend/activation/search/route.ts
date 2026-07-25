import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export async function GET(request: NextRequest) {
  let client = null;

  try {
    const { searchParams } = new URL(request.url);
    let email = searchParams.get('email')?.toLowerCase();
    let licenseKey = searchParams.get('license_key')?.toUpperCase();
    const customerName = searchParams.get('customer_name');
    const mobile = searchParams.get('mobile');
    const hardwareId = searchParams.get('hardware_id');
    const deviceName = searchParams.get('device_name');
    const activationId = searchParams.get('activation_id');

    if (!email && !licenseKey && !customerName && !mobile && !hardwareId && !deviceName && !activationId) {
      return NextResponse.json(
        { success: false, error: "Provide at least one search parameter: email, license_key, customer_name, mobile, hardware_id, device_name, or activation_id" },
        { status: 400 }
      );
    }

    client = await pool.connect();

    // Search by activation_id: find activation, then resolve license_key
    if (!email && !licenseKey && activationId) {
      const actRes = await client.query(
        `SELECT license_key FROM activations WHERE id = $1 OR hardware_id = $1`,
        [activationId]
      );
      if (actRes.rows.length > 0) {
        licenseKey = actRes.rows[0].license_key?.toUpperCase();
      }
      if (!licenseKey) {
        client.release();
        return NextResponse.json({ success: false, error: "Activation not found" }, { status: 404 });
      }
    }

    // Search by hardware_id or device_name: find activation, then resolve license_key
    if (!email && !licenseKey && (hardwareId || deviceName)) {
      let hwQuery: string;
      let hwParam: string;
      if (hardwareId) {
        hwQuery = `SELECT license_key FROM activations WHERE hardware_id = $1 ORDER BY last_seen DESC LIMIT 1`;
        hwParam = hardwareId;
      } else {
        hwQuery = `SELECT license_key FROM activations WHERE LOWER(device_name) LIKE $1 ORDER BY last_seen DESC LIMIT 1`;
        hwParam = `%${deviceName!.toLowerCase()}%`;
      }
      const actRes = await client.query(hwQuery, [hwParam]);
      if (actRes.rows.length > 0) {
        licenseKey = actRes.rows[0].license_key?.toUpperCase();
      }
      if (!licenseKey) {
        client.release();
        const field = hardwareId ? "Hardware ID" : "Device name";
        return NextResponse.json({ success: false, error: `${field} not found. No matching license found.` }, { status: 404 });
      }
    }

    // Search by customer_name: find customer, then resolve email
    if (!email && !licenseKey && customerName) {
      const custRes = await client.query(
        `SELECT email FROM customers WHERE LOWER(name) LIKE $1 AND email IS NOT NULL AND email != '' ORDER BY created_at DESC LIMIT 1`,
        [`%${customerName.toLowerCase()}%`]
      );
      if (custRes.rows.length > 0) {
        email = custRes.rows[0].email?.toLowerCase();
      }
      if (!email) {
        client.release();
        return NextResponse.json({ success: false, error: "Customer not found by name" }, { status: 404 });
      }
    }

    // Search by mobile: find customer, then resolve email
    if (!email && !licenseKey && mobile) {
      const mobileRes = await client.query(
        `SELECT email FROM customers WHERE phone LIKE $1 OR mobile LIKE $1 AND email IS NOT NULL AND email != '' ORDER BY created_at DESC LIMIT 1`,
        [`%${mobile}%`]
      );
      if (mobileRes.rows.length > 0) {
        email = mobileRes.rows[0].email?.toLowerCase();
      }
      if (!email) {
        client.release();
        return NextResponse.json({ success: false, error: "Customer not found by mobile number" }, { status: 404 });
      }
    }

    let customer = null;
    let trial = null;
    let license = null;
    let hardwareRecords: any[] = [];
    let plans: any[] = [];

    // Initialize mobile fallback fields
    let trialMobileNumber = '';
    let licenseCustomerPhone = '';
    let licenseCustomerMobile = '';

    // If email provided, look up customer, trial, and license in parallel
    if (email) {
      const [customerRes, trialRes, licenseRes] = await Promise.all([
        client.query(
          `SELECT id, email, name, phone, mobile, company, country, status, created_at, updated_at
           FROM customers WHERE LOWER(email) = $1`,
          [email]
        ),
        client.query(
          `SELECT t.*, p.name as product_name, pl.name as plan_name
           FROM trials t
           LEFT JOIN products p ON t.product_id = p.product_id
           LEFT JOIN plans pl ON t.plan_id = pl.id
           WHERE LOWER(t.customer_email) = $1
           ORDER BY t.started_at DESC LIMIT 1`,
          [email]
        ),
        client.query(
          `SELECT * FROM licenses WHERE LOWER(customer_email) = $1 ORDER BY created_at DESC LIMIT 1`,
          [email]
        ),
      ]);

      if (customerRes.rows.length > 0) customer = customerRes.rows[0];
      if (trialRes.rows.length > 0) trial = trialRes.rows[0];
      if (licenseRes.rows.length > 0) license = licenseRes.rows[0];

      // Fetch mobile fallback fields
      const trialMobileRes = await client.query(
        `SELECT mobile_number FROM trials WHERE LOWER(customer_email) = $1 AND mobile_number IS NOT NULL AND mobile_number != '' ORDER BY created_at DESC LIMIT 1`,
        [email]
      );
      if (trialMobileRes.rows.length > 0) trialMobileNumber = trialMobileRes.rows[0].mobile_number || '';
      const licensePhoneRes = await client.query(
        `SELECT customer_phone, customer_mobile FROM licenses WHERE LOWER(customer_email) = $1 ORDER BY created_at DESC LIMIT 1`,
        [email]
      );
      if (licensePhoneRes.rows.length > 0) {
        licenseCustomerPhone = licensePhoneRes.rows[0].customer_phone || '';
        licenseCustomerMobile = licensePhoneRes.rows[0].customer_mobile || '';
      }
    }

    // If license key provided, look up license
    if (licenseKey) {
      const licenseRes = await client.query(
        `SELECT * FROM licenses WHERE license_key = $1`,
        [licenseKey]
      );
      if (licenseRes.rows.length > 0) {
        license = licenseRes.rows[0];
      }
    }

    // If we have a license from either path, look up trial and customer in parallel
    if (license) {
      const [trialRes, customerRes, trialMobileRes, licensePhoneRes] = await Promise.all([
        trial === null ? client.query(
          `SELECT t.*, p.name as product_name, pl.name as plan_name
           FROM trials t
           LEFT JOIN products p ON t.product_id = p.product_id
           LEFT JOIN plans pl ON t.plan_id = pl.id
           WHERE t.converted_to_license_key = $1
           ORDER BY t.started_at DESC LIMIT 1`,
          [license.license_key]
        ) : Promise.resolve({ rows: [] }),
        customer === null && license.customer_email ? client.query(
          `SELECT id, email, name, phone, mobile, company, country, status, created_at, updated_at
           FROM customers WHERE LOWER(email) = $1`,
          [license.customer_email.toLowerCase()]
        ) : Promise.resolve({ rows: [] }),
        customer === null && license.customer_email ? client.query(
        `SELECT mobile_number FROM trials WHERE LOWER(customer_email) = $1 AND mobile_number IS NOT NULL AND mobile_number != '' ORDER BY started_at DESC LIMIT 1`,
          [license.customer_email.toLowerCase()]
        ) : Promise.resolve({ rows: [] }),
        customer === null && license.customer_email ? client.query(
          `SELECT customer_phone, customer_mobile FROM licenses WHERE LOWER(customer_email) = $1 ORDER BY created_at DESC LIMIT 1`,
          [license.customer_email.toLowerCase()]
        ) : Promise.resolve({ rows: [] }),
      ]);

      if (trialRes && trialRes.rows.length > 0) trial = trialRes.rows[0];
      if (customerRes && customerRes.rows.length > 0) customer = customerRes.rows[0];
      if (trialMobileRes && trialMobileRes.rows.length > 0) trialMobileNumber = trialMobileRes.rows[0].mobile_number || '';
      if (licensePhoneRes && licensePhoneRes.rows.length > 0) {
        licenseCustomerPhone = licensePhoneRes.rows[0].customer_phone || '';
        licenseCustomerMobile = licensePhoneRes.rows[0].customer_mobile || '';
      }
    }

    // Fetch hardware records, plans, and products in parallel
    const [hwRes, plansRes, productsRes] = await Promise.all([
      (async () => {
        const searchEmail = email || (customer?.email || '').toLowerCase();
        if (!searchEmail) return { rows: [] };
        const hw = await client.query(
          `SELECT DISTINCT a.hardware_id, a.device_name, a.ip_address, a.os_version, a.activated_at, a.last_seen, a.status as activation_status,
                  lh.online_status, lh.last_seen as hw_last_seen
           FROM activations a
           JOIN licenses l ON a.license_key = l.license_key
           LEFT JOIN license_hardware lh ON a.hardware_id = lh.hardware_id
           WHERE LOWER(l.customer_email) = $1
           ORDER BY a.last_seen DESC LIMIT 10`,
          [searchEmail]
        );
        if (hw.rows.length === 0 && trial?.hardware_id) {
          const trialHw = await client.query(
            `SELECT $1 as hardware_id, NULL as device_name, NULL as ip_address, NULL as os_version,
                    t.started_at as activated_at, t.started_at as last_seen, 'trial' as activation_status,
                    NULL as online_status, NULL as hw_last_seen
             FROM trials t WHERE t.hardware_id = $1 LIMIT 1`,
            [trial.hardware_id]
          );
          hw.rows = trialHw.rows;
        }
        return hw;
      })(),
      (async () => {
        const productId = trial?.product_id || license?.product_id;
        if (!productId) return { rows: [] };
        return client.query(
          `SELECT id, name, description, max_devices, default_expiry_days, price, is_active, features, display_order
           FROM plans WHERE product_id = $1 AND is_active = TRUE ORDER BY display_order ASC, name ASC`,
          [productId]
        );
      })(),
      (async () => {
        return client.query(
          `SELECT product_id, name, is_active FROM products WHERE is_active = TRUE AND is_deleted = FALSE ORDER BY name ASC`
        );
      })(),
    ]);

    hardwareRecords = hwRes.rows;
    plans = plansRes.rows;
    const products = productsRes.rows;

    const now = new Date();

    // Calculate trial info
    let trialInfo = null;
    if (trial) {
      const startedAt = trial.started_at || '';
      const expiryDate = trial.expiry_date;
      const end = expiryDate ? new Date(expiryDate) : null;
      let daysRemaining = 0;
      if (end && end > now) {
        daysRemaining = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      }

      trialInfo = {
        started_at: startedAt,
        expiry_date: expiryDate,
        days_remaining: daysRemaining,
        status: trial.status,
        is_expired: trial.status === 'expired' || (end ? end < now : false),
        is_converted: trial.status === 'converted' || !!trial.converted_at,
        converted_to_license_key: trial.converted_to_license_key,
        product_id: trial.product_id,
        product_name: trial.product_name,
        plan_name: trial.plan_name,
        max_devices: trial.max_devices || 1,
      };
    }

    // Calculate license days remaining
    let licenseDaysRemaining = 0;
    if (license && license.expiry_date) {
      const licEnd = new Date(license.expiry_date);
      if (licEnd > now) {
        licenseDaysRemaining = Math.ceil((licEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      }
    }

    client.release();

    return NextResponse.json({
      success: true,
      data: {
        customer: customer ? {
          id: customer.id,
          email: customer.email || '',
          name: customer.name || '',
          phone: customer.phone || licenseCustomerPhone || '',
          company: customer.company || '',
          country: customer.country || '',
          status: customer.status || '',
          mobile: customer.mobile || customer.phone || trialMobileNumber || licenseCustomerMobile || licenseCustomerPhone || '',
          hardware_id: customer.hardware_id || '',
          product_id: trial?.product_id || license?.product_id || '',
          plan_id: trial?.plan_id || license?.plan_id || '',
        } : null,
        trial: trialInfo,
        license: license ? {
          license_key: license.license_key,
          customer_name: license.customer_name,
          customer_email: license.customer_email,
          plan: license.plan,
          plan_id: license.plan_id,
          status: license.status,
          expiry_date: license.expiry_date,
          days_remaining: licenseDaysRemaining,
          max_devices: license.max_devices,
          device_count: license.device_count,
          is_activated: license.is_activated,
          is_trial: license.is_trial,
          product_id: license.product_id,
        } : null,
        hardware: hardwareRecords.map(hw => ({
          hardware_id: hw.hardware_id || '',
          device_name: hw.device_name || '',
          ip_address: hw.ip_address || '',
          os_version: hw.os_version || '',
          activated_at: hw.activated_at || '',
          last_seen: hw.last_seen || '',
          status: hw.activation_status || hw.online_status || '',
        })),
        plans,
        products,
      },
    });
  } catch (error) {
    console.error("Activation search error:", error);
    if (client) client.release();
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
