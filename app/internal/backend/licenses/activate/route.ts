// FILE: app/internal/backend/licenses/activate/route.ts
// PURPOSE: Activate a license with Notification

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { triggerNotification } from '@/lib/notification/notification-service';

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
function getSenderEmail(): string {
  const email = process.env.SENDER_EMAIL;
  if (!email) throw new Error('SENDER_EMAIL environment variable is required');
  return email;
}

function getBrandName(): string {
  return process.env.BRAND_NAME || 'License Management';
}

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send OTP via email using Brevo API
async function sendOTPEmail(email: string, otp: string): Promise<boolean> {
  try {
    const apiKey = process.env.BREVO_API_KEY;
    
    if (!apiKey) {
      console.error('BREVO_API_KEY not configured');
      return false;
    }
    
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey
      },
      body: JSON.stringify({
        sender: {
          name: getBrandName(),
          email: getSenderEmail()
        },
        to: [{ email: email }],
        subject: 'Your OTP Verification Code',
        htmlContent: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; }
              .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
              .header { text-align: center; border-bottom: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 20px; }
              .logo { font-size: 24px; font-weight: bold; color: #3b82f6; }
              .otp-code { font-size: 36px; font-weight: bold; text-align: center; color: #3b82f6; background: #eff6ff; padding: 20px; border-radius: 8px; letter-spacing: 5px; margin: 20px 0; }
              .footer { text-align: center; font-size: 12px; color: #666; margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; }
              .warning { color: #ef4444; font-size: 12px; text-align: center; margin-top: 10px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div class="logo">${getBrandName()}</div>
              </div>
              <h2 style="text-align: center; color: #333;">Your Verification Code</h2>
              <div class="otp-code">${otp}</div>
              <p style="text-align: center; color: #555;">This code is valid for <strong>5 minutes</strong>.</p>
              <p style="text-align: center; color: #555;">If you didn't request this code, please ignore this email.</p>
              <div class="footer">
                <p>${getBrandName()} - License Management System</p>
                <p>Need help? Contact support</p>
              </div>
            </div>
          </body>
          </html>
        `,
        textContent: `Your OTP verification code is: ${otp}. Valid for 5 minutes.`
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Brevo API error:', errorText);
      return false;
    }
    
    return true;
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
    
    // Step 1: Find the license
    const licenseResult = await client.query(
      `SELECT 
        license_key,
        customer_name,
        customer_email,
        customer_mobile,
        customer_phone,
        plan,
        plan_id,
        status,
        expiry_date,
        max_devices,
        device_count,
        product_id,
        duration_days,
        is_activated,
        activated_at,
        updated_at
      FROM licenses 
      WHERE license_key = $1`,
      [normalizedLicenseKey]
    );
    
    if (licenseResult.rows.length === 0) {
      client.release();
      return NextResponse.json({ success: false, error: "License key not found" }, { status: 404 });
    }
    
    const license = licenseResult.rows[0];
    
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
    
    // Step 4: Check if license is expired
    if (license.expiry_date && new Date(license.expiry_date) < new Date()) {
      triggerNotification(pool, 'activation_failed', {
        license_key: normalizedLicenseKey,
        customer_name: name,
        customer_email: normalizedEmail,
        device_name: body.device_name || 'Unknown',
      }).catch(() => {});
      client.release();
      return NextResponse.json({ success: false, error: "License has expired" }, { status: 403 });
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