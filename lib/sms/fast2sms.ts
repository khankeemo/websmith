import { SmsConfig, SmsProvider } from './types';

const FAST2SMS_API_KEY = process.env.FAST2SMS_API_KEY;
const FAST2SMS_SENDER_ID = process.env.FAST2SMS_SENDER_ID || 'WEBSMS';
const FAST2SMS_API_URL = 'https://www.fast2sms.com/dev/bulkV2';

const SMS_TYPES = [
  'otp_verification', 'license_created', 'trial_started', 'trial_ending_reminder',
  'activation_success', 'activation_failed', 'license_renewed', 'license_expired',
  'license_revoked', 'device_changed', 'device_reset', 'payment_success',
  'subscription_reminder', 'product_purchased', 'welcome_customer',
  'admin_notification', 'product_archived', 'product_restored',
  'sdk_generated', 'api_key_generated', 'security_alert', 'audit_summary'
] as const;

export type SmsType = typeof SMS_TYPES[number];

const DEFAULT_SMS_TEMPLATES: Record<string, { message: string }> = {
  otp_verification: {
    message: 'Your WebSmith verification code is: {{otp_code}}. Valid for 5 minutes. Do not share this code.'
  },
  license_created: {
    message: 'Hi {{customer_name}}, your {{product}} license has been created! Key: {{license_key}}. Expires: {{expiry_date}}. Welcome to WebSmith!'
  },
  trial_started: {
    message: 'Hi {{customer_name}}, your {{product}} trial has started! You have {{trial_days}} days to explore. Expires: {{expiry_date}}. Upgrade anytime!'
  },
  trial_ending_reminder: {
    message: 'Hi {{customer_name}}, your {{product}} trial ends in {{days_remaining}} days ({{expiry_date}}). Upgrade now to keep access!'
  },
  activation_success: {
    message: 'Hi {{customer_name}}, {{product}} activated on {{device_name}}. License: {{license_key}}. Expires: {{expiry_date}}. Enjoy!'
  },
  activation_failed: {
    message: 'Hi {{customer_name}}, {{product}} activation failed for {{device_name}}. Please contact support at {{support_email}}.'
  },
  license_renewed: {
    message: 'Hi {{customer_name}}, your {{product}} license has been renewed! New expiry: {{expiry_date}}. Thank you for your continued trust.'
  },
  license_expired: {
    message: 'Hi {{customer_name}}, your {{product}} license ({{license_key}}) has expired. Renew now to regain access.'
  },
  license_revoked: {
    message: 'Hi {{customer_name}}, your {{product}} license ({{license_key}}) has been revoked. Please contact {{support_email}} for details.'
  },
  device_changed: {
    message: 'Hi {{customer_name}}, {{product}} license was activated on a new device ({{device_name}}). If not you, contact {{support_email}}.'
  },
  device_reset: {
    message: 'Hi {{customer_name}}, devices for {{product}} license ({{license_key}}) were reset. Re-activate your devices to continue.'
  },
  payment_success: {
    message: 'Hi {{customer_name}}, payment of {{amount}} for {{product}} ({{plan_name}}) was successful. Thank you!'
  },
  subscription_reminder: {
    message: 'Hi {{customer_name}}, your {{product}} subscription renews on {{renewal_date}}. Amount: {{amount}}. Thank you!'
  },
  product_purchased: {
    message: 'Hi {{customer_name}}, thank you for purchasing {{product}} ({{plan_name}})! License: {{license_key}}. Download now.'
  },
  welcome_customer: {
    message: 'Welcome to WebSmith, {{customer_name}}! Your {{product}} journey begins now. Need help? Contact {{support_email}}.'
  },
  admin_notification: {
    message: '[Admin] {{admin_message}}'
  },
  product_archived: {
    message: '[Admin] Product {{product}} has been archived.'
  },
  product_restored: {
    message: '[Admin] Product {{product}} has been restored.'
  },
  sdk_generated: {
    message: '[Admin] SDK generated for {{product}} (version {{product_version}}).'
  },
  api_key_generated: {
    message: '[Admin] New API key generated for {{product}}.'
  },
  security_alert: {
    message: '[Alert] {{alert_message}}'
  },
  audit_summary: {
    message: '[Admin] Audit summary: {{summary_details}}'
  }
};

async function getSmsTemplate(client: any, smsType: string): Promise<string | null> {
  try {
    const r = await client.query(
      `SELECT message FROM sms_templates WHERE sms_type = $1 AND is_active = true ORDER BY updated_at DESC LIMIT 1`,
      [smsType]
    );
    if (r.rows.length > 0) return r.rows[0].message;
  } catch { }
  return null;
}

function replaceVariables(text: string, data: Record<string, string>): string {
  let result = text;
  for (const [key, val] of Object.entries(data)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val || '');
  }
  return result;
}

export async function loadSmsConfig(client: any): Promise<SmsConfig | null> {
  try {
    const r = await client.query(`SELECT * FROM sms_config WHERE id = 1`);
    if (r.rows.length > 0) return r.rows[0] as SmsConfig;
  } catch { }
  return null;
}

function pickApiKey(config?: SmsConfig | null): string {
  if (config?.api_key) return config.api_key;
  if (FAST2SMS_API_KEY) return FAST2SMS_API_KEY;
  return '';
}

function pickSenderId(config?: SmsConfig | null): string {
  if (config?.sender_id) return config.sender_id;
  return FAST2SMS_SENDER_ID;
}

function pickRoute(config?: SmsConfig | null): string {
  if (config?.route) return config.route;
  return 'dlt';
}

function pickTimeout(config?: SmsConfig | null): number {
  if (config?.timeout) return config.timeout;
  return 5000;
}

export async function sendSMS(
  client: any,
  smsType: string,
  phoneNumber: string,
  data: Record<string, string> = {},
  config?: SmsConfig | null
): Promise<{ success: boolean; error?: string; response?: any }> {
  const apiKey = pickApiKey(config);
  if (!apiKey) {
    console.warn(`SMS API key not configured — skipping SMS: ${smsType} to ${phoneNumber}`);
    return { success: false, error: 'SMS API key not configured' };
  }

  const cleanedPhone = phoneNumber.replace(/[^0-9]/g, '');
  if (cleanedPhone.length < 10) {
    return { success: false, error: `Invalid phone number: ${phoneNumber}` };
  }

  try {
    let message = DEFAULT_SMS_TEMPLATES[smsType]?.message || '';
    const dbTemplate = await getSmsTemplate(client, smsType);
    if (dbTemplate) message = dbTemplate;

    if (!message) {
      return { success: false, error: `No SMS template for type: ${smsType}` };
    }

    message = replaceVariables(message, data);

    const senderId = pickSenderId(config);
    const route = pickRoute(config);
    const timeout = pickTimeout(config);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(`${FAST2SMS_API_URL}?authorization=${apiKey}&sender_id=${senderId}&message=${encodeURIComponent(message)}&route=${route}&numbers=${cleanedPhone}`, {
      method: 'GET',
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const responseData = await response.json();

    if (!response.ok) {
      console.error(`Fast2SMS send failed [${smsType} -> ${cleanedPhone}]:`, responseData);
      return { success: false, error: JSON.stringify(responseData), response: responseData };
    }

    console.log(`SMS sent: ${smsType} -> ${cleanedPhone}`);
    return { success: true, response: responseData };

  } catch (error: any) {
    if (error?.name === 'AbortError') {
      console.error(`SMS send timeout [${smsType} -> ${cleanedPhone}]`);
      return { success: false, error: 'SMS send timed out' };
    }
    console.error(`SMS send error [${smsType} -> ${cleanedPhone}]:`, error);
    return { success: false, error: String(error) };
  }
}

export async function sendSMSWithRetry(
  client: any,
  smsType: string,
  phoneNumber: string,
  data: Record<string, string> = {},
  maxRetries?: number,
  config?: SmsConfig | null
): Promise<{ success: boolean; error?: string; response?: any }> {
  const effectiveMaxRetries = maxRetries ?? (config?.retry_count ?? 2);
  let lastError: string | undefined;
  for (let attempt = 0; attempt <= effectiveMaxRetries; attempt++) {
    const result = await sendSMS(client, smsType, phoneNumber, data, config);
    if (result.success) return result;
    lastError = result.error;
    if (attempt < effectiveMaxRetries) {
      console.log(`SMS retry ${attempt + 1}/${effectiveMaxRetries} for ${smsType} -> ${phoneNumber}`);
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  return { success: false, error: lastError || `Failed after ${effectiveMaxRetries + 1} attempts` };
}

export class Fast2SmsProvider implements SmsProvider {
  readonly name = 'fast2sms';

  async send(
    phone: string,
    message: string,
    config: SmsConfig
  ): Promise<{ success: boolean; error?: string; response?: any }> {
    const apiKey = config.api_key;
    if (!apiKey) {
      return { success: false, error: 'Fast2SMS API key not configured' };
    }

    const cleanedPhone = phone.replace(/[^0-9]/g, '');
    if (cleanedPhone.length < 10) {
      return { success: false, error: `Invalid phone number: ${phone}` };
    }

    const senderId = config.sender_id || 'WEBSMS';
    const route = config.route || 'dlt';
    const timeout = config.timeout || 5000;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${FAST2SMS_API_URL}?authorization=${apiKey}&sender_id=${senderId}&message=${encodeURIComponent(message)}&route=${route}&numbers=${cleanedPhone}`, {
        method: 'GET',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const responseData = await response.json();

      if (!response.ok) {
        console.error(`Fast2SMS send failed [${cleanedPhone}]:`, responseData);
        return { success: false, error: JSON.stringify(responseData), response: responseData };
      }

      console.log(`Fast2SMS sent to ${cleanedPhone}`);
      return { success: true, response: responseData };

    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error?.name === 'AbortError') {
        return { success: false, error: 'SMS send timed out' };
      }
      console.error(`Fast2SMS error [${cleanedPhone}]:`, error);
      return { success: false, error: String(error) };
    }
  }
}

export { SMS_TYPES, DEFAULT_SMS_TEMPLATES, replaceVariables, getSmsTemplate };
