// FILE: app/internal/backend/api/auth/forgot-password/route.ts
// PURPOSE: Send OTP via Brevo API for password reset

import { NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function getSenderEmail(): string {
  const email = process.env.SENDER_EMAIL;
  if (!email) throw new Error('SENDER_EMAIL environment variable is required');
  return email;
}

function getBrandName(): string {
  return process.env.BRAND_NAME || 'License Management';
}

async function sendOTPEmail(email: string, otp: string, name: string): Promise<boolean> {
  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  if (!BREVO_API_KEY) {
    console.error("BREVO_API_KEY is not set");
    return false;
  }

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: {
          email: getSenderEmail(),
          name: getBrandName(),
        },
        to: [{ email, name: name || "User" }],
        subject: "Password Reset Request",
        htmlContent: `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; background: #0B1120; color: #fff; padding: 40px; }
                .container { max-width: 500px; margin: 0 auto; background: #1a1a2e; padding: 40px; border-radius: 16px; border: 1px solid #333; }
                .logo { text-align: center; margin-bottom: 30px; }
                .logo h1 { color: #60A5FA; font-size: 24px; }
                .code { font-size: 48px; font-weight: bold; text-align: center; color: #60A5FA; letter-spacing: 8px; padding: 20px; background: #0B1120; border-radius: 12px; margin: 20px 0; font-family: monospace; }
                .text { color: #94A3B8; text-align: center; line-height: 1.6; }
                .footer { text-align: center; color: #475569; font-size: 12px; margin-top: 30px; border-top: 1px solid #333; padding-top: 20px; }
                .warning { color: #F59E0B; font-size: 14px; text-align: center; margin-top: 20px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="logo"><h1>🔐 API Center</h1></div>
                <h2 style="text-align: center; color: #fff; font-weight: 300;">Password Reset Request</h2>
                <p style="color: #94A3B8; text-align: center; line-height: 1.6;">We received a request to reset your password. Use the following code to reset it:</p>
                <div style="font-size: 48px; font-weight: bold; text-align: center; color: #60A5FA; letter-spacing: 8px; padding: 20px; background: #0B1120; border-radius: 12px; margin: 20px 0; font-family: monospace;">${otp}</div>
                <p style="color: #94A3B8; text-align: center; line-height: 1.6;">This code will expire in <strong style="color: #fff;">10 minutes</strong>.</p>
                <p style="color: #94A3B8; text-align: center; line-height: 1.6;">If you didn't request this, please ignore this email.</p>
                <div style="color: #F59E0B; font-size: 14px; text-align: center; margin-top: 20px;">⚠️ Do not share this code with anyone</div>
                <div style="text-align: center; color: #475569; font-size: 12px; margin-top: 30px; border-top: 1px solid #333; padding-top: 20px;">
                  <p>Websmith Digital · Universal API Center</p>
                  <p>© ${new Date().getFullYear()} All rights reserved</p>
                </div>
              </div>
            </body>
          </html>
        `,
        textContent: `Password Reset Request\n\nYour OTP code is: ${otp}\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this, please ignore this email.\n\nWebsmith Digital · Universal API Center`,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Brevo API error:", errorData);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Failed to send OTP email:", error);
    return false;
  }
}

export async function POST(request: Request) {
  let client = null;

  try {
    const { email } = await request.json();

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { success: false, error: "Valid email is required" },
        { status: 400 }
      );
    }

    client = await pool.connect();

    const userResult = await client.query(
      `SELECT id, email, name FROM users WHERE email = $1`,
      [email.trim().toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      client.release();
      return NextResponse.json({
        success: true,
        message: "If an account exists, an OTP has been sent",
      });
    }

    const user = userResult.rows[0];
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await client.query(
      `INSERT INTO otp_verifications (email, otp_code, purpose, expires_at, created_at, verified)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, false)
       ON CONFLICT (email, purpose)
       DO UPDATE SET otp_code = $2, expires_at = $4, created_at = CURRENT_TIMESTAMP, verified = false`,
      [email.trim().toLowerCase(), otp, "password_reset", expiresAt]
    );

    client.release();

    const emailSent = await sendOTPEmail(email, otp, user.name || "User");

    if (!emailSent) {
      return NextResponse.json(
        { success: false, error: "Failed to send OTP email. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "OTP sent successfully",
      email: email,
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    if (client) {
      try {
        client.release();
      } catch (releaseError) {
        // Ignore
      }
    }
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}