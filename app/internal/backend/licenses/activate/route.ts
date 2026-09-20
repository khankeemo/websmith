// FILE: app/internal/backend/licenses/activate/route.ts
// PURPOSE: Activate a license with Notification

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { triggerNotification } from '@/lib/notification/notification-service';
import { sendEmail } from '@/lib/email/mailer';
import { resolveGlobalLicenseStatus } from '@/lib/license/serializer';

// Database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false }
    : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// ============================================================
// HELPERS
// ============================================================

// Generate random 6-digit OTP
function getBrandName(): string {
  return process.env.BRAND_NAME || 'License Management';
}

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send OTP via the unified email dispatcher (UED) via Nodemailer SMTP.
async function sendOTPEmail(email: string, otp: string): Promise<boolean> {
  try {
    const client = await pool.connect();
    try {
      const result = await sendEmail(
        client,
        'otp_verification',
        { email },
        { otp_code: otp, brand_name: getBrandName(), support_email: process.env.SUPPORT_EMAIL || 'support@websmithdigital.com' }
      );
      return result.success;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Failed to send OTP email:', error);
    return false;
  }
}

// Send OTP via SMS (placeholder)
async function sendOTPSMS(phone: string, otp: string): Promise<boolean> {
  console.log(`[OTP] SMS would send ${otp} to ${phone}`);
  return true;
}

// Get user from token
function getUserFromToken(request: NextRequest): { id: string; email: string; name: string; role: string } | null {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }
    
    const token = authHeader.substring(7);
    const JWT_SECRET = process.env.API_CENTER_JWT_SECRET;
    if (!JWT_SECRET) {
      return null;
    }
    
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name || "Admin",
      role: decoded.role || "admin",
    };
  } catch (error) {
    console.error("❌ Failed to decode token:", error);
    return null;
  }
}

// Verify OTP code
async function verifyOTP(client: any, email: string | null, phone: string | null, otpCode: string, purpose: string = 'activation'): Promise<boolean> {
  const query = `
    SELECT id, expires_at, verified 
    FROM otp_verifications 
    WHERE (email = $1 OR ($2 IS NOT NULL AND phone = $2))
      AND otp_code = $3 
      AND purpose = $4
      AND verified = FALSE
    ORDER BY created_at DESC
    LIMIT 1
  `;
  
  const result = await client.query(query, [email, phone, otpCode, purpose]);
  
  if (result.rows.length === 0) {
    return false;
  }
  
  const otpRecord = result.rows[0];
  
  if (new Date(otpRecord.expires_at) < new Date()) {
    return false;
  }
  
  await client.query(
    `UPDATE otp_verifications SET verified = TRUE WHERE id = $1`,
    [otpRecord.id]
  );
  
  return true;
}

// Store OTP in database
async function storeOTP(client: any, email: string | null, phone: string | null, otpCode: string, purpose: string = 'activation', expiryMinutes: number = 10): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + expiryMinutes);
  
  await client.query(
    `INSERT INTO otp_verifications (email, phone, otp_code, purpose, expires_at, verified)
     VALUES ($1, $2, $3, $4, $5, FALSE)`,
    [email, phone, otpCode, purpose, expiresAt.toISOString()]
  );
}

// ============================================================
// POST /internal/backend/licenses/activate
// ============================================================

export async function POST(request: NextRequest) {
  let client = null;
  
  try {
    // Get user from token
    const currentUser = getUserFromToken(request);
    
    const body = await request.json();
    const { license_key, name, email, hardware_id, device_name, otp_code, phone } = body;
    
    // Validation
    if (!license_key) {
      return NextResponse.json({ success: false, error: "License key is required" }, { status: 400 });
    }
    if (!hardware_id) {
      return NextResponse.json({ success: false, error: "Hardware ID is required" }, { status: 400 });
    }
    if (!name || !email) {
      return NextResponse.json({ success: false, error: "Name and email are required" }, { status: 400 });
    }
    
    client = await pool.connect();
    const now = new Date().toISOString();
    const clientIp = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    const normalizedLicenseKey = license_key.toUpperCase();
    const normalizedEmail = email.toLowerCase();
    
    // Step 1: Global License Status — single source of truth.
    const { verdict, ctx } = await resolveGlobalLicenseStatus(pool, {
      licenseKey: normalizedLicenseKey,
      hardwareId: hardware_id,
    });

    const license = ctx?.license || null;

    if (verdict.status !== 'ACTIVE' && verdict.status !== 'TRIAL_ACTIVE') {
      triggerNotification(pool, 'activation_failed', {
        license_key: normalizedLicenseKey,
        customer_name: name,
        customer_email: normalizedEmail,
        device_name: body.device_name || 'Unknown',
      }).catch(() => {});
      client.release();
      return NextResponse.json({
        success: false,
        status: verdict.status,
        code: verdict.code,
        reason: verdict.reason,
        message: verdict.message,
        actions: verdict.actions,
      }, { status: verdict.httpStatus });
    }

    // Step 2: Verify name matches
    if (license.customer_name !== name) {
      triggerNotification(pool, 'activation_failed', {
        license_key: normalizedLicenseKey,
        customer_name: name,
        customer_email: normalizedEmail,
        device_name: body.device_name || 'Unknown',
      }).catch(() => {});
      client.release();
      return NextResponse.json({ success: false, error: "Name does not match this license" }, { status: 403 });
    }
    
    // Step 3: Verify email matches
    if (license.customer_email !== normalizedEmail) {
      triggerNotification(pool, 'activation_failed', {
        license_key: normalizedLicenseKey,
        customer_name: name,
        customer_email: normalizedEmail,
        device_name: body.device_name || 'Unknown',
      }).catch(() => {});
      client.release();
      return NextResponse.json({ success: false, error: "Email does not match this license" }, { status: 403 });
    }
    
    // Step 5: OTP Verification
    if (!otp_code) {
      const newOtp = generateOTP();
      
      await storeOTP(client, normalizedEmail, phone || null, newOtp, 'activation', 10);
      
      const emailSent = await sendOTPEmail(normalizedEmail, newOtp);
      
      let smsSent = false;
      if (phone) {
        smsSent = await sendOTPSMS(phone, newOtp);
      }
      
      client.release();
      
      return NextResponse.json({
        success: false,
        requires_otp: true,
        message: "OTP sent to your email" + (phone ? " and phone" : ""),
        email_sent: emailSent,
        sms_sent: smsSent,
        otp_expiry_minutes: 10
      }, { status: 202 });
    }
    
    // Verify OTP
    const isOtpValid = await verifyOTP(client, normalizedEmail, phone || null, otp_code, 'activation');
    
    if (!isOtpValid) {
      client.release();
      return NextResponse.json({
        success: false,
        error: "Invalid or expired OTP code. Please request a new code.",
        invalid_otp: true
      }, { status: 403 });
    }
    
    // Step 6: Check if hardware is already activated
    const existingResult = await client.query(
      `SELECT * FROM activations WHERE license_key = $1 AND hardware_id = $2`,
      [license.license_key, hardware_id]
    );
    
    if (existingResult.rows.length > 0) {
      await client.query(
        `UPDATE activations SET last_seen = $1, ip_address = $2 WHERE license_key = $3 AND hardware_id = $4`,
        [now, clientIp, license.license_key, hardware_id]
      );
      
      client.release();
      
      return NextResponse.json({
        success: true,
        message: "License already activated on this device",
        already_activated: true,
        days_left: Math.max(0, Math.ceil((new Date(license.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))),
      });
    }
    
    // Step 7: Check device limit
    const countResult = await client.query(
      `SELECT COUNT(*) as count FROM activations WHERE license_key = $1`,
      [license.license_key]
    );
    const activationCount = parseInt(countResult.rows[0]?.count || "0");
    
    if (activationCount >= license.max_devices) {
      client.release();
      return NextResponse.json({
        success: false,
        error: `Device limit reached (${license.max_devices} devices max)`,
        device_limit_reached: true,
      }, { status: 403 });
    }
    
    // Step 8: Create new activation record
    await client.query(
      `INSERT INTO activations (license_key, hardware_id, device_name, ip_address, activated_at, last_seen, os_version, product_version, company_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [license.license_key, hardware_id, device_name || "Client", clientIp, now, now, body.os_version || null, body.product_version || null, body.company_name || null]
    );
    
    // Step 9: Get mobile number (priority: customers.phone > customers.mobile > trials.mobile_number > licenses.customer_mobile > licenses.customer_phone)
    let customerMobile = body.phone || '';
    if (!customerMobile) {
      const mobileResult = await client.query(
        `SELECT COALESCE(c.phone, '') as phone FROM customers c WHERE c.email = $1`,
        [normalizedEmail]
      );
      if (mobileResult.rows.length > 0 && mobileResult.rows[0].phone) {
        customerMobile = mobileResult.rows[0].phone;
      }
      if (!customerMobile) {
        const trialMobileResult = await client.query(
          `SELECT COALESCE(t.mobile_number, '') as mobile FROM trials t WHERE t.customer_email = $1 AND t.status IN ('active', 'converted') ORDER BY t.started_at DESC LIMIT 1`,
          [normalizedEmail]
        );
        if (trialMobileResult.rows.length > 0 && trialMobileResult.rows[0].mobile) {
          customerMobile = trialMobileResult.rows[0].mobile;
        } else if (license.customer_mobile) {
          customerMobile = license.customer_mobile;
        } else if (license.customer_phone) {
          customerMobile = license.customer_phone;
        }
      }
    }

    // UPDATE license status
    await client.query(
      `UPDATE licenses 
       SET status = 'active', 
            inactive_reason = NULL,
           is_activated = TRUE, 
           activated_at = $1,
           device_count = device_count + 1,
           updated_at = $1,
           last_validated = $1
       WHERE license_key = $2`,
      [now, license.license_key]
    );

    // Audit log activation
    try {
      await client.query(
        `INSERT INTO audit_logs (event_type, message, timestamp, ip_address, license_key)
         VALUES ($1, $2, $3, $4, $5)`,
        ['license_activated', `License ${license.license_key} activated on hardware ${hardware_id}`, now, clientIp, license.license_key]
      );
    } catch (auditError) {
      console.error("Failed to audit license activation:", auditError);
    }
    
    await client.query(
      `INSERT INTO customers (email, name, phone, company, status, customer_type)
       VALUES ($1, $2, $3, $4, 'active', 'paid')
       ON CONFLICT (email) DO UPDATE SET name = COALESCE(NULLIF($2, ''), customers.name), customer_type = 'paid', updated_at = CURRENT_TIMESTAMP`,
      [normalizedEmail, name, body.phone || '', body.company_name || '']
    );

    // Step 10a: Convert active trial to paid if exists
    try {
      await client.query(
        `UPDATE trials
         SET status = 'converted',
             converted_at = $1,
             converted_to_license_key = $2,
             plan_id = $3
         WHERE status = 'active'
           AND (hardware_id = $4 OR customer_email = $5)`,
        [now, license.license_key, license.plan_id, hardware_id, normalizedEmail]
      );
    } catch (trialConvError) {
      console.error("Failed to convert trial:", trialConvError);
    }

    await client.query(
      `INSERT INTO customer_licenses (customer_email, license_key, product_id, plan_name, status, expiry_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (customer_email, license_key) DO NOTHING`,
      [normalizedEmail, license.license_key, license.product_id, license.plan, 'active', license.expiry_date]
    );

    triggerNotification(pool, 'activation_success', {
      license_key: license.license_key,
      customer_name: name,
      customer_email: normalizedEmail,
      customer_phone: body.phone || '',
      product_id: license.product_id,
      plan_name: license.plan,
      expiry_date: license.expiry_date?.split('T')[0],
      max_devices: license.max_devices,
      hardware_id,
      device_name: body.device_name || 'Client',
    }).catch(e => console.error('Activation notification error:', e));
    
    client.release();
    
    // Step 11: Calculate days left
    const daysLeft = Math.max(0, Math.ceil((new Date(license.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    
    return NextResponse.json({
      success: true,
      message: "License activated successfully",
      days_left: daysLeft,
      expiry_date: license.expiry_date?.split('T')[0],
      plan: license.plan,
      max_devices: license.max_devices,
      device_count: (license.device_count || 0) + 1,
      customer: {
        mobile: customerMobile,
      },
    });
    
  } catch (error) {
    console.error("❌ Activation error:", error);
    
    if (client) {
      client.release();
    }
    
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ============================================================
// GET: Request OTP without activation
// ============================================================

export async function GET(request: NextRequest) {
  let client = null;
  
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const phone = searchParams.get('phone');
    const purpose = searchParams.get('purpose') || 'activation';
    
    if (!email && !phone) {
      return NextResponse.json(
        { success: false, error: "Email or phone is required" },
        { status: 400 }
      );
    }
    
    client = await pool.connect();
    const newOtp = generateOTP();
    
    await storeOTP(client, email || null, phone || null, newOtp, purpose, 10);
    
    let emailSent = false;
    if (email) {
      emailSent = await sendOTPEmail(email, newOtp);
    }
    
    let smsSent = false;
    if (phone) {
      smsSent = await sendOTPSMS(phone, newOtp);
    }
    
    client.release();
    
    return NextResponse.json({
      success: true,
      message: "OTP sent successfully",
      email_sent: emailSent,
      sms_sent: smsSent,
      otp_expiry_minutes: 10
    });
    
  } catch (error) {
    console.error("OTP request error:", error);
    
    if (client) {
      client.release();
    }
    
    return NextResponse.json(
      { success: false, error: "Failed to send OTP" },
      { status: 500 }
    );
  }
}