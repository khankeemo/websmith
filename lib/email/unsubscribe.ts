import crypto from "crypto";
import { getDb } from "@/lib/backend-db";

const UNSUBSCRIBE_BASE =
  (process.env.NEXT_PUBLIC_APP_URL ||
    process.env.BRANDING_WEBSITE_URL ||
    "https://www.websmithdigital.com").replace(/\/$/, "");

export const UNSUBSCRIBE_PAGE_PATH = "/unsubscribe_global";

export const UNSUBSCRIBE_URL = `${UNSUBSCRIBE_BASE}${UNSUBSCRIBE_PAGE_PATH}`;

const ESSENTIAL_EMAIL_TYPES = new Set([
  "otp_verification",
  "password_reset",
  "license_activated",
  "license_issued",
  "license_reactivated",
  "license_renewed",
  "trial_started",
  "trial_expiring",
  "trial_expired",
  "device_replacement",
  "subscription_renewal_reminder",
  "payment_receipt",
  "payment_failed",
  "welcome_customer",
]);

export function isEssentialEmail(emailType: string): boolean {
  return ESSENTIAL_EMAIL_TYPES.has(emailType);
}

const INTERNAL_EMAIL_TYPES = new Set([
  "admin_notification",
  "new_sales_enquiry",
  "conversation_created",
]);

export function isInternalEmail(emailType: string): boolean {
  return INTERNAL_EMAIL_TYPES.has(emailType);
}

export const CUSTOMER_FACING_NON_ESSENTIAL_EMAIL_TYPES = new Set([
  "support_reply",
  "sales_reply",
]);

export function isCustomerFacingNonEssential(emailType: string): boolean {
  return CUSTOMER_FACING_NON_ESSENTIAL_EMAIL_TYPES.has(emailType);
}

export function shouldIncludeUnsubscribe(emailType: string): boolean {
  return isCustomerFacingNonEssential(emailType);
}

function hashEmail(email: string): string {
  return crypto
    .createHash("sha256")
    .update(email.toLowerCase().trim())
    .digest("hex");
}

export async function isUnsubscribed(email: string): Promise<boolean> {
  try {
    const db = await getDb();
    const normalized = email.toLowerCase().trim();
    const emailHash = hashEmail(normalized);
    const result = await db.query(
      `SELECT is_unsubscribed FROM email_preferences WHERE email_hash = $1`,
      [emailHash]
    );
    return result.rows.length > 0 && result.rows[0].is_unsubscribed === true;
  } catch (error) {
    console.warn(`Failed to check unsubscribe status for ${email}:`, error);
    return false;
  }
}

export async function getUnsubscribeLink(email: string): Promise<string> {
  try {
    const db = await getDb();
    const normalized = email.toLowerCase().trim();
    const emailHash = hashEmail(normalized);

    const token = crypto.randomBytes(32).toString("hex");

    const result = await db.query(
      `INSERT INTO email_preferences (email, email_hash, token, is_unsubscribed)
       VALUES ($1, $2, $3, FALSE)
       ON CONFLICT (email_hash) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
       RETURNING token`,
      [normalized, emailHash, token]
    );

    return `${UNSUBSCRIBE_URL}?token=${result.rows[0].token}`;
  } catch (error) {
    console.warn(`Failed to generate unsubscribe link for ${email}:`, error);
    return UNSUBSCRIBE_URL;
  }
}

export async function recordUnsubscribe(
  token: string
): Promise<{ success: boolean; email: string | null; error?: string }> {
  try {
    if (!token || token.length < 32) {
      return { success: false, email: null, error: "Invalid token" };
    }

    const db = await getDb();
    const result = await db.query(
      `UPDATE email_preferences
       SET is_unsubscribed = TRUE, unsubscribed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE token = $1 AND is_unsubscribed = FALSE
       RETURNING email`,
      [token]
    );

    if (result.rowCount === 0) {
      const checkResult = await db.query(
        `SELECT email, is_unsubscribed FROM email_preferences WHERE token = $1`,
        [token]
      );
      if (checkResult.rowCount === 0) {
        return { success: false, email: null, error: "Token not found" };
      }
      if (checkResult.rows[0].is_unsubscribed) {
        return { success: false, email: null, error: "Already unsubscribed" };
      }
      return { success: false, email: null, error: "Token not found" };
    }

    return { success: true, email: result.rows[0].email };
  } catch (error) {
    console.error("Failed to record unsubscribe:", error);
    return {
      success: false,
      email: null,
      error: (error as Error)?.message || "Database error",
    };
  }
}

export const UNSUBSCRIBE_FOOTER_HTML = `<p style="margin:16px 0 0;font-size:12px;color:#aab;text-align:center">You're receiving this email because you have an active conversation with Websmith Digital. <a href="{{unsubscribe_url}}" style="color:#4a90d9;text-decoration:underline">Unsubscribe</a> from non-essential emails (transactional notifications will still be delivered).</p>`;

export const UNSUBSCRIBE_FOOTER_TEXT = `\n\n---\nUnsubscribe from non-essential emails (transactional notifications will still be delivered): {{unsubscribe_url}}\n`;
