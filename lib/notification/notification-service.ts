import { Pool, PoolClient } from 'pg';
import { sendEmail } from '@/lib/email/mailer';
import { sendSMSWithRetry, loadSmsConfig } from '@/lib/sms/fast2sms';

interface NotificationContext {
  license_key?: string;
  customer_email?: string;
  customer_name?: string;
  customer_phone?: string;
  product_id?: string;
  plan_name?: string;
  hardware_id?: string;
  device_name?: string;
  expiry_date?: string;
  activation_date?: string;
  max_devices?: number;
  product_version?: string;
  company?: string;
  support_email?: string;
  website?: string;
  trial_days?: number;
  days_remaining?: number;
  otp_code?: string;
  amount?: string;
  renewal_date?: string;
  admin_message?: string;
  alert_message?: string;
  summary_details?: string;
  order_number?: string;
  [key: string]: any;
}

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@websmithdigital.com';
const COMPANY_NAME = process.env.COMPANY_NAME || 'WebSmith';
const WEBSITE_URL = process.env.WEBSITE_URL || 'https://websmithdigital.com';

async function fetchCustomerData(client: PoolClient, email: string) {
  const r = await client.query(
    `SELECT name, email, phone, company FROM customers WHERE email = $1`,
    [email.toLowerCase()]
  );
  return r.rows[0] || null;
}

async function fetchLicenseData(client: PoolClient, licenseKey: string) {
  const r = await client.query(
    `SELECT l.*, p.name AS product_name, p.version AS product_version, p.company_name, p.website
     FROM licenses l
     LEFT JOIN products p ON l.product_id = p.product_id
     WHERE l.license_key = $1`,
    [licenseKey]
  );
  return r.rows[0] || null;
}

async function fetchProductData(client: PoolClient, productId: string) {
  const r = await client.query(
    `SELECT name, version, company_name, website, support_url FROM products WHERE product_id = $1`,
    [productId]
  );
  return r.rows[0] || null;
}

async function fetchTrialData(client: PoolClient, hardwareId: string) {
  const r = await client.query(
    `SELECT t.*, p.name AS product_name, p.version AS product_version
     FROM trials t
     LEFT JOIN products p ON t.product_id = p.product_id
     WHERE t.hardware_id = $1`,
    [hardwareId]
  );
  return r.rows[0] || null;
}

async function checkEventConfig(client: PoolClient, eventType: string): Promise<{ email_enabled: boolean; sms_enabled: boolean }> {
  try {
    const r = await client.query(
      `SELECT email_enabled, sms_enabled FROM event_notification_config WHERE event_type = $1`,
      [eventType]
    );
    if (r.rows.length > 0) {
      return { email_enabled: r.rows[0].email_enabled, sms_enabled: r.rows[0].sms_enabled };
    }
  } catch { }
  return { email_enabled: true, sms_enabled: false };
}

function buildVariables(ctx: NotificationContext): Record<string, string> {
  return {
    customer_name: ctx.customer_name || '',
    customer_email: ctx.customer_email || '',
    customer_phone: ctx.customer_phone || '',
    product: ctx.product_name || ctx.product_id || '',
    product_version: ctx.product_version || '',
    plan_name: ctx.plan_name || '',
    license_key: ctx.license_key || '',
    expiry_date: ctx.expiry_date || '',
    activation_date: ctx.activation_date || '',
    max_devices: String(ctx.max_devices || ''),
    device_name: ctx.device_name || '',
    company: ctx.company || COMPANY_NAME,
    support_email: ctx.support_email || SUPPORT_EMAIL,
    website: ctx.website || WEBSITE_URL,
    trial_days: String(ctx.trial_days || ''),
    days_remaining: String(ctx.days_remaining || ''),
    otp_code: ctx.otp_code || '',
    amount: ctx.amount || '',
    renewal_date: ctx.renewal_date || '',
    admin_message: ctx.admin_message || '',
    alert_message: ctx.alert_message || '',
    summary_details: ctx.summary_details || '',
    order_number: ctx.order_number || '',
    sender_name: COMPANY_NAME,
    sender_email: SUPPORT_EMAIL,
  };
}

async function writeAuditLog(client: PoolClient, eventType: string, message: string, ctx: NotificationContext) {
  try {
    await client.query(
      `INSERT INTO audit_logs (event_type, message, timestamp, ip_address, license_key, hardware_id)
       VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5)`,
      [eventType, message, '', ctx.license_key || '', ctx.hardware_id || '']
    );
  } catch (error) {
    console.error(`Failed to write audit log for ${eventType}:`, error);
  }
}

async function writeNotificationLog(
  client: PoolClient,
  eventType: string,
  channel: string,
  recipient: string,
  status: string,
  subject?: string,
  error?: string,
  ctx?: NotificationContext
) {
  try {
    await client.query(
      `INSERT INTO notification_logs (event_type, channel, recipient, subject, status, error, license_key, hardware_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [eventType, channel, recipient, subject || null, status, error || null, ctx?.license_key || null, ctx?.hardware_id || null]
    );
  } catch (logError) {
    console.error(`Failed to write notification log:`, logError);
  }
}

async function createInternalNotification(client: PoolClient, title: string, message: string, type: string, link: string) {
  try {
    await client.query(
      `INSERT INTO notifications (user_id, title, message, type, link, created_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
      ['system', title, message, type, link]
    );
  } catch (error) {
    console.error(`Failed to create internal notification:`, error);
  }
}

export async function triggerNotification(
  pool: Pool,
  eventType: string,
  ctx: NotificationContext,
  customData?: Record<string, string>
): Promise<{ emailSent: boolean; smsSent: boolean; notificationCreated: boolean; auditLogged: boolean }> {
  const result = { emailSent: false, smsSent: false, notificationCreated: false, auditLogged: false };
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();

    const config = await checkEventConfig(client, eventType);
    let emailTo: string | null = null;
    let phoneTo: string | null = null;
    let customerName = ctx.customer_name || '';

    if (ctx.customer_email) {
      const customer = await fetchCustomerData(client, ctx.customer_email);
      if (customer) {
        customerName = customer.name || customerName;
        phoneTo = customer.phone || ctx.customer_phone || null;
        ctx.customer_phone = ctx.customer_phone || customer.phone || '';
        ctx.company = ctx.company || customer.company || '';
      }
    }

    if (ctx.license_key && !ctx.product_name) {
      const license = await fetchLicenseData(client, ctx.license_key);
      if (license) {
        customerName = customerName || license.customer_name || '';
        ctx.customer_email = ctx.customer_email || license.customer_email || '';
        ctx.customer_phone = ctx.customer_phone || license.customer_mobile || license.customer_phone || '';
        ctx.product_name = ctx.product_name || license.product_name || '';
        ctx.product_version = ctx.product_version || license.product_version || '';
        ctx.company = ctx.company || license.company_name || '';
        ctx.website = ctx.website || license.website || '';
        ctx.plan_name = ctx.plan_name || license.plan || '';
        ctx.expiry_date = ctx.expiry_date || (license.expiry_date ? license.expiry_date.split('T')[0] : '');
        ctx.max_devices = ctx.max_devices || license.max_devices;
      }
    }

    if (ctx.product_id && !ctx.product_name) {
      const product = await fetchProductData(client, ctx.product_id);
      if (product) {
        ctx.product_name = ctx.product_name || product.name || '';
        ctx.product_version = ctx.product_version || product.version || '';
        ctx.company = ctx.company || product.company_name || '';
        ctx.website = ctx.website || product.website || '';
        ctx.support_email = ctx.support_email || SUPPORT_EMAIL;
      }
    }

    if (ctx.hardware_id && !ctx.customer_name && !ctx.license_key) {
      const trial = await fetchTrialData(client, ctx.hardware_id);
      if (trial) {
        customerName = customerName || trial.customer_name || '';
        ctx.customer_email = ctx.customer_email || trial.customer_email || '';
        ctx.product_name = ctx.product_name || trial.product_name || '';
        ctx.product_version = ctx.product_version || trial.product_version || '';
        ctx.expiry_date = ctx.expiry_date || (trial.expiry_date ? trial.expiry_date.split('T')[0] : '');
      }
    }

    ctx.customer_name = ctx.customer_name || customerName || '';
    emailTo = ctx.customer_email || null;

    const allData = { ...buildVariables(ctx), ...(customData || {}) };

    if (emailTo && config.email_enabled) {
      try {
        const emailResult = await sendEmail(client, eventType, { email: emailTo, name: ctx.customer_name }, allData);
        result.emailSent = emailResult.success;
        await writeNotificationLog(client, eventType, 'email', emailTo, emailResult.success ? 'sent' : 'failed', emailResult.messageId, emailResult.success ? undefined : (emailResult.error || 'Email send failed'), ctx);
      } catch (emailError) {
        console.error(`Email send error for ${eventType}:`, emailError);
        await writeNotificationLog(client, eventType, 'email', emailTo, 'error', undefined, String(emailError), ctx);
      }
    }

    if (phoneTo && config.sms_enabled) {
      let smsConfig = null;
      try { smsConfig = await loadSmsConfig(client); } catch {}
      const smsGloballyEnabled = smsConfig?.enabled === true;

      if (!smsGloballyEnabled) {
        console.log(`SMS globally disabled — skipping SMS for ${eventType} -> ${phoneTo}`);
        await writeNotificationLog(client, eventType, 'sms', phoneTo, 'skipped', undefined, 'SMS globally disabled in config', ctx);
      } else {
        try {
          const smsResult = await sendSMSWithRetry(client, eventType, phoneTo, allData, undefined, smsConfig);
          result.smsSent = smsResult.success;
          await writeNotificationLog(
            client, eventType, 'sms', phoneTo,
            smsResult.success ? 'sent' : 'failed',
            undefined,
            smsResult.error,
            ctx
          );
        } catch (smsError) {
          console.error(`SMS send error for ${eventType}:`, smsError);
          await writeNotificationLog(client, eventType, 'sms', phoneTo, 'error', undefined, String(smsError), ctx);
        }
      }
    }

    const notificationType = eventType;
    const notificationLink = ctx.license_key
      ? `/internal/api/licenses/${ctx.license_key}`
      : ctx.hardware_id
        ? `/internal/api/trials/status?hardware_id=${ctx.hardware_id}`
        : '/internal/api/notifications';

    const notificationTitle = eventType.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    const notificationMessage = `${notificationTitle}: ${ctx.customer_name || ''} - ${ctx.product_name || ctx.license_key || ctx.hardware_id || ''}`.trim();

    await createInternalNotification(client, notificationTitle, notificationMessage, notificationType, notificationLink);
    result.notificationCreated = true;

    const auditMessage = `${eventType}: ${ctx.customer_name || ctx.customer_email || ''} ${ctx.product_name ? `- ${ctx.product_name}` : ''} ${ctx.license_key ? `[${ctx.license_key}]` : ''}`;
    await writeAuditLog(client, eventType, auditMessage, ctx);
    result.auditLogged = true;

    return result;

  } catch (error) {
    console.error(`Notification service error [${eventType}]:`, error);
    return result;
  } finally {
    if (client) client.release();
  }
}
