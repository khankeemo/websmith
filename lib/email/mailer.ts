import { renderCustomerMessageHtml, renderCustomerMessagePlain } from "@/lib/tickets/email";
import {
  isUnsubscribed,
  getUnsubscribeLink,
  shouldIncludeUnsubscribe,
  UNSUBSCRIBE_FOOTER_HTML,
  UNSUBSCRIBE_FOOTER_TEXT,
} from "@/lib/email/unsubscribe";
import { COMPANY_NAME, BRANDING_TAGLINE, WEBSITE_URL } from "@/lib/email/branding";
import nodemailer from 'nodemailer';
import { getDb } from '@/lib/backend-db';

const MAIL_FROM_ADDRESS = process.env.MAIL_FROM_ADDRESS || 'no-reply@websmithdigital.com';
const MAIL_SUPPORT_ADDRESS = process.env.MAIL_SUPPORT_ADDRESS || 'support@websmithdigital.com';
const MAIL_SALES_ADDRESS = process.env.MAIL_SALES_ADDRESS || 'sales@websmithdigital.com';
const MAIL_FROM_NAME = process.env.MAIL_FROM_NAME || 'Websmith Digital';
const MAIL_SUPPORT_NAME = process.env.MAIL_SUPPORT_NAME || 'Websmith Digital Support Team';
const MAIL_SALES_NAME = process.env.MAIL_SALES_NAME || 'Websmith Digital Sales Team';

async function getContactInfo(_client?: any) {
  try {
    const { getPortalDb } = await import('@/lib/server/api');
    const db = await getPortalDb();
    const doc = await db.collection('settings').findOne({ key: 'contact_info' });
    return doc?.value ?? {};
  } catch (error) {
    console.error('Failed to fetch contact info for email service:', error);
    return {};
  }
}

async function getFromAddress(client: any) {
  try {
    const contactInfo = await getContactInfo(client);
    return contactInfo.no_reply_email || MAIL_FROM_ADDRESS;
  } catch (error) {
    console.error('Failed to fetch contact info for email service:', error);
    return MAIL_FROM_ADDRESS;
  }
}

async function getSupportAddress(client: any) {
  try {
    const contactInfo = await getContactInfo(client);
    return contactInfo.email || MAIL_SUPPORT_ADDRESS;
  } catch (error) {
    console.error('Failed to fetch contact info for email service:', error);
    return MAIL_SUPPORT_ADDRESS;
  }
}

async function getSalesAddress(client: any) {
  try {
    const contactInfo = await getContactInfo(client);
    return contactInfo.sales_email || MAIL_SALES_ADDRESS;
  } catch (error) {
    console.error('Failed to fetch contact info for email service:', error);
    return MAIL_SALES_ADDRESS;
  }
}

function wrapHtml(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9">
    <tr><td align="center" style="padding:24px 16px">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06)">
        <tr><td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:28px 32px;text-align:center">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px">${COMPANY_NAME}</h1>
          <p style="margin:4px 0 0;color:#8899bb;font-size:13px">${BRANDING_TAGLINE}</p>
        </td></tr>
        <tr><td style="padding:32px">
          <h2 style="margin:0 0 16px;color:#1a1a2e;font-size:20px;font-weight:600">${title}</h2>
          ${bodyHtml}
        </td></tr>
        <tr><td style="background-color:#f8f9fb;padding:24px 32px;border-top:1px solid #e8ecf1">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="text-align:center;font-size:13px;color:#8899aa;line-height:1.6">
              <p style="margin:0 0 8px;font-weight:600;color:#555">${COMPANY_NAME} — ${BRANDING_TAGLINE}</p>
              <p style="margin:0 0 4px">Need help or facing an issue? Contact our support team at <a href="mailto:{{support_email}}" style="color:#4a90d9;text-decoration:none">{{support_email}}</a></p>
              <p style="margin:0 0 4px">Visit our website: <a href="{{website}}" style="color:#4a90d9;text-decoration:none">{{website}}</a></p>
              <p style="margin:12px 0 0;font-size:11px;color:#aab">© ${new Date().getFullYear()} ${COMPANY_NAME}. All rights reserved. | This is an automated email. Please do not reply directly to this address. Need help or facing an issue? Contact our support team at <a href="mailto:{{support_email}}" style="color:#4a90d9;text-decoration:none">{{support_email}}</a></p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function infoTable(rows: { label: string; value: string }[]): string {
  const r = rows.map(r => `<tr><td style="padding:8px 16px;font-size:13px;color:#555;border-bottom:1px solid #eee;white-space:nowrap;vertical-align:top;font-weight:500">${r.label}</td><td style="padding:8px 16px;font-size:13px;color:#1a1a2e;border-bottom:1px solid #eee;width:100%">${r.value}</td></tr>`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fb;border-radius:8px;margin:16px 0;border:1px solid #e8ecf1">${r}</table>`;
}

function btn(text: string, url?: string): string {
  const href = url || '#';
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0"><tr><td style="background:#4a90d9;border-radius:6px;padding:0"><a href="${href}" style="display:inline-block;padding:12px 28px;color:#fff;text-decoration:none;font-size:14px;font-weight:600;border-radius:6px">${text}</a></td></tr></table>`;
}

const EMAIL_ROUTES: Record<string, { sender: string; name: string }> = {
  otp_verification: { sender: MAIL_FROM_ADDRESS, name: MAIL_FROM_NAME },
  license_activated: { sender: MAIL_FROM_ADDRESS, name: MAIL_FROM_NAME },
  activation_success: { sender: MAIL_FROM_ADDRESS, name: MAIL_FROM_NAME },
  activation_confirmation: { sender: MAIL_FROM_ADDRESS, name: MAIL_FROM_NAME },
  activation_failed: { sender: MAIL_FROM_ADDRESS, name: MAIL_FROM_NAME },
  trial_started: { sender: MAIL_FROM_ADDRESS, name: MAIL_FROM_NAME },
  trial_expired: { sender: MAIL_FROM_ADDRESS, name: MAIL_FROM_NAME },
  license_created: { sender: MAIL_FROM_ADDRESS, name: MAIL_FROM_NAME },
  license_renewed: { sender: MAIL_FROM_ADDRESS, name: MAIL_FROM_NAME },
  license_expired: { sender: MAIL_FROM_ADDRESS, name: MAIL_FROM_NAME },
  license_revoked: { sender: MAIL_FROM_ADDRESS, name: MAIL_FROM_NAME },
  device_reset: { sender: MAIL_FROM_ADDRESS, name: MAIL_FROM_NAME },
  device_changed: { sender: MAIL_FROM_ADDRESS, name: MAIL_FROM_NAME },
  payment_success: { sender: MAIL_FROM_ADDRESS, name: MAIL_FROM_NAME },
  subscription_reminder: { sender: MAIL_FROM_ADDRESS, name: MAIL_FROM_NAME },
  welcome_customer: { sender: MAIL_FROM_ADDRESS, name: MAIL_FROM_NAME },
  reactivation_approved: { sender: MAIL_FROM_ADDRESS, name: MAIL_FROM_NAME },
  reactivation_rejected: { sender: MAIL_FROM_ADDRESS, name: MAIL_FROM_NAME },
  password_reset: { sender: MAIL_FROM_ADDRESS, name: MAIL_FROM_NAME },
  admin_notification: { sender: MAIL_FROM_ADDRESS, name: MAIL_FROM_NAME },
  support_reply: { sender: MAIL_FROM_ADDRESS, name: MAIL_FROM_NAME },
  new_sales_enquiry: { sender: MAIL_FROM_ADDRESS, name: MAIL_FROM_NAME },
  sales_reply: { sender: MAIL_FROM_ADDRESS, name: MAIL_FROM_NAME },
  conversation_created: { sender: MAIL_FROM_ADDRESS, name: MAIL_FROM_NAME },
};
const EMAIL_TYPES: Record<string, {
  subject: string;
  defaultBody: (data: Record<string, string>) => string;
  defaultPlainText: (data: Record<string, string>) => string;
}> = {
  // ================================================================
  // 0. OTP VERIFICATION
  // ================================================================
  otp_verification: {
    subject: 'Your OTP Verification Code',
    defaultBody: (d) => wrapHtml('Your Verification Code', `
      <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.6">Hello,</p>
      <p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.6">Your OTP verification code is:</p>
      <div style="font-size:36px;font-weight:bold;text-align:center;color:#3b82f6;background:#eff6ff;padding:20px;border-radius:8px;letter-spacing:5px;margin:20px 0">${d.otp_code || 'N/A'}</div>
      <p style="text-align:center;color:#555">Valid for <strong>5 minutes</strong>.</p>
      <p style="margin:12px 0 0;font-size:13px;color:#8899aa;font-style:italic">If you did not request this code, please ignore this email.</p>
    `),
    defaultPlainText: (d) => `Your OTP verification code is: ${d.otp_code || 'N/A'}. Valid for 5 minutes.

If you did not request this code, please ignore this email.`
  },

  // ================================================================
  // 1. LICENSE CREATED
  // ================================================================
  license_created: {
    subject: 'Your {{product}} License Has Been Created',
    defaultBody: (d) => wrapHtml('License Created', `
      <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.6">Hello ${d.customer_name || 'there'},</p>
      <p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.6">Your license for <strong style="color:#1a1a2e">${d.product_name || 'your product'}</strong> has been successfully created. You can now activate and use the software on your authorized devices.</p>
      ${infoTable([
        { label: 'Product', value: d.product_name || 'N/A' },
        { label: 'Plan', value: d.plan_name || 'N/A' },
        { label: 'License Key', value: `<code style="background:#eef2f7;padding:2px 8px;border-radius:4px;font-size:13px">${d.license_key || 'N/A'}</code>` },
        { label: 'Expiry Date', value: d.expiry_date || 'No expiry' },
      ])}
      <p style="margin:12px 0;font-size:14px;color:#555;line-height:1.6">To get started, download your software and activate it using the license key above. Detailed activation instructions can be found in our documentation.</p>
      ${btn('View Documentation', `${d.website || '#'}/docs`)}
      <p style="margin:8px 0 0;font-size:13px;color:#8899aa;font-style:italic">If you have any trouble activating your license, please reach out to our support team and we will be happy to assist you.</p>
    `),
    defaultPlainText: (d) => `Hello ${d.customer_name || 'there'},

Your license for ${d.product_name || 'your product'} has been successfully created. You can now activate and use the software on your authorized devices.

Product: ${d.product_name || 'N/A'}
Plan: ${d.plan_name || 'N/A'}
License Key: ${d.license_key || 'N/A'}
Expiry Date: ${d.expiry_date || 'No expiry'}

To get started, download your software and activate it using the license key above. Detailed activation instructions can be found in our documentation.

If you have any trouble activating your license, please reach out to our support team.

Best regards,
The ${COMPANY_NAME} Team`
  },

  // ================================================================
  // 2. TRIAL STARTED
  // ================================================================
  trial_started: {
    subject: 'Your {{product}} Free Trial Has Started',
    defaultBody: (d) => wrapHtml('Trial Started', `
      <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.6">Welcome ${d.customer_name || 'there'}! Thank you for trying <strong style="color:#1a1a2e">${d.product_name || 'our product'}</strong>.</p>
      <p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.6">Your free trial is now active. The trial period begins counting down from the moment you first activate the software on your device, giving you the full trial duration to explore all features.</p>
      ${infoTable([
        { label: 'Product', value: d.product_name || 'N/A' },
        { label: 'Plan', value: d.plan_name || 'Trial' },
        { label: 'Trial Expiry', value: d.expiry_date || 'N/A' },
        { label: 'Days Remaining', value: d.days_remaining || 'N/A' },
      ])}
      <p style="margin:12px 0;font-size:14px;color:#555;line-height:1.6">During your trial you have access to all the features included in the plan. If you have any questions or need assistance getting started, our documentation and support team are here to help.</p>
      ${btn('Explore Features', `${d.website || '#'}/features`)}
      <p style="margin:8px 0 0;font-size:13px;color:#8899aa;font-style:italic">No payment information is required for the trial. You will not be charged unless you decide to purchase a license after the trial period.</p>
    `),
    defaultPlainText: (d) => `Welcome ${d.customer_name || 'there'}! Thank you for trying ${d.product_name || 'our product'}.

Your free trial is now active. The trial period begins counting down from the moment you first activate the software on your device, giving you the full trial duration to explore all features.

Product: ${d.product_name || 'N/A'}
Plan: ${d.plan_name || 'Trial'}
Trial Expiry: ${d.expiry_date || 'N/A'}
Days Remaining: ${d.days_remaining || 'N/A'}

During your trial you have access to all the features included in the plan. If you have any questions or need assistance getting started, our documentation and support team are here to help.

No payment information is required for the trial. You will not be charged unless you decide to purchase a license after the trial period.

Best regards,
The ${COMPANY_NAME} Team`
  },

  // ================================================================
  // 3. ACTIVATION SUCCESS
  // ================================================================
  activation_success: {
    subject: 'Device Activated Successfully',
    defaultBody: (d) => wrapHtml('Activation Successful', `
      <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.6">Hello ${d.customer_name || 'there'},</p>
      <p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.6">Your license has been successfully activated. You can now start using the software immediately.</p>
      ${infoTable([
        { label: 'License Key', value: `<code style="background:#eef2f7;padding:2px 8px;border-radius:4px;font-size:13px">${d.license_key || 'N/A'}</code>` },
        { label: 'Activated Device', value: d.device_name || 'Unknown device' },
        { label: 'Activation Date', value: d.activation_date || new Date().toLocaleDateString() },
      ])}
      <p style="margin:12px 0;font-size:14px;color:#555;line-height:1.6">You can manage your devices, view your license details, and access support resources anytime through your account dashboard.</p>
      ${btn('Go to Dashboard', `${d.website || '#'}/dashboard`)}
    `),
    defaultPlainText: (d) => `Hello ${d.customer_name || 'there'},

Your license has been successfully activated. You can now start using the software immediately.

License Key: ${d.license_key || 'N/A'}
Activated Device: ${d.device_name || 'Unknown device'}
Activation Date: ${d.activation_date || new Date().toLocaleDateString()}

You can manage your devices, view your license details, and access support resources anytime through your account dashboard.

Best regards,
The ${COMPANY_NAME} Team`
  },

  // ================================================================
  // 4. ACTIVATION FAILED
  // ================================================================
  activation_failed: {
    subject: 'Device Activation Failed',
    defaultBody: (d) => wrapHtml('Activation Failed', `
      <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.6">Hello ${d.customer_name || 'there'},</p>
      <p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.6">We were unable to activate your license on the requested device. Please review the details below and try the recommended steps.</p>
      ${infoTable([
        { label: 'License Key', value: `<code style="background:#eef2f7;padding:2px 8px;border-radius:4px;font-size:13px">${d.license_key || 'N/A'}</code>` },
        { label: 'Error', value: d.reason || 'Unknown error' },
      ])}
      <p style="margin:12px 0;font-size:14px;color:#555;line-height:1.6"><strong style="color:#1a1a2e">Troubleshooting steps:</strong></p>
      <ol style="margin:8px 0 12px;padding-left:20px;font-size:14px;color:#555;line-height:1.8">
        <li>Ensure your device has a stable internet connection</li>
        <li>Verify that the license key is entered correctly</li>
        <li>Check that your system meets the minimum software requirements</li>
        <li>Disable any VPN or firewall that may be blocking the activation server</li>
        <li>Try restarting the application and attempting activation again</li>
      </ol>
      <p style="margin:12px 0;font-size:14px;color:#555;line-height:1.6">If the problem persists after trying these steps, please contact our support team with the error details above and we will investigate further.</p>
      ${btn('Contact Support', `mailto:{{support_email}}`)}
    `),
    defaultPlainText: (d) => `Hello ${d.customer_name || 'there'},

We were unable to activate your license on the requested device. Please review the details below and try the recommended steps.

License Key: ${d.license_key || 'N/A'}
Error: ${d.reason || 'Unknown error'}

Troubleshooting steps:
1. Ensure your device has a stable internet connection
2. Verify that the license key is entered correctly
3. Check that your system meets the minimum software requirements
4. Disable any VPN or firewall that may be blocking the activation server
5. Try restarting the application and attempting activation again

If the problem persists after trying these steps, please contact our support team with the error details above and we will investigate further.

Best regards,
The ${COMPANY_NAME} Team`
  },

  // ================================================================
  // 5. LICENSE RENEWED
  // ================================================================
  license_renewed: {
    subject: 'Your {{product}} License Has Been Renewed',
    defaultBody: (d) => wrapHtml('License Renewed', `
      <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.6">Hello ${d.customer_name || 'there'},</p>
      <p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.6">Thank you for renewing your license. Your continued trust in <strong style="color:#1a1a2e">${d.product_name || 'our product'}</strong> means a lot to us.</p>
      ${infoTable([
        { label: 'Product', value: d.product_name || 'N/A' },
        { label: 'Plan', value: d.plan_name || 'N/A' },
        { label: 'License Key', value: `<code style="background:#eef2f7;padding:2px 8px;border-radius:4px;font-size:13px">${d.license_key || 'N/A'}</code>` },
        { label: 'New Expiry Date', value: d.expiry_date || 'N/A' },
      ])}
      <p style="margin:12px 0;font-size:14px;color:#555;line-height:1.6">Your renewed license is active immediately with an updated expiry date. No further action is needed on your part — you can continue using the software without interruption.</p>
      ${btn('View License Details', `${d.website || '#'}/dashboard`)}
      <p style="margin:8px 0 0;font-size:13px;color:#8899aa;font-style:italic">We appreciate your business and are committed to providing you with the best possible experience.</p>
    `),
    defaultPlainText: (d) => `Hello ${d.customer_name || 'there'},

Thank you for renewing your license. Your continued trust in ${d.product_name || 'our product'} means a lot to us.

Product: ${d.product_name || 'N/A'}
Plan: ${d.plan_name || 'N/A'}
License Key: ${d.license_key || 'N/A'}
New Expiry Date: ${d.expiry_date || 'N/A'}

Your renewed license is active immediately with an updated expiry date. No further action is needed on your part — you can continue using the software without interruption.

We appreciate your business and are committed to providing you with the best possible experience.

Best regards,
The ${COMPANY_NAME} Team`
  },

  // ================================================================
  // 6. LICENSE EXPIRED
  // ================================================================
  license_expired: {
    subject: 'Your {{product}} License Has Expired',
    defaultBody: (d) => wrapHtml('License Expired', `
      <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.6">Hello ${d.customer_name || 'there'},</p>
      <p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.6">Your license for <strong style="color:#1a1a2e">${d.product_name || 'your product'}</strong> has expired. Protected features may no longer be accessible.</p>
      ${infoTable([
        { label: 'Product', value: d.product_name || 'N/A' },
        { label: 'License Key', value: `<code style="background:#eef2f7;padding:2px 8px;border-radius:4px;font-size:13px">${d.license_key || 'N/A'}</code>` },
        { label: 'Expired On', value: d.expiry_date || 'N/A' },
      ])}
      <p style="margin:12px 0;font-size:14px;color:#555;line-height:1.6">To regain access to all features, please renew your license at your earliest convenience. Renewing is quick and easy — simply visit your account dashboard and follow the renewal instructions.</p>
      ${btn('Renew Now', `${d.website || '#'}/renew`)}
      <p style="margin:8px 0 0;font-size:13px;color:#8899aa;font-style:italic">If you have already renewed, please disregard this message. If you believe this is an error, contact our support team.</p>
    `),
    defaultPlainText: (d) => `Hello ${d.customer_name || 'there'},

Your license for ${d.product_name || 'your product'} has expired. Protected features may no longer be accessible.

Product: ${d.product_name || 'N/A'}
License Key: ${d.license_key || 'N/A'}
Expired On: ${d.expiry_date || 'N/A'}

To regain access to all features, please renew your license at your earliest convenience. Renewing is quick and easy — simply visit your account dashboard and follow the renewal instructions.

If you have already renewed, please disregard this message. If you believe this is an error, contact our support team.

Best regards,
The ${COMPANY_NAME} Team`
  },

  // ================================================================
  // 7. LICENSE REVOKED
  // ================================================================
  license_revoked: {
    subject: 'Your License Has Been Revoked',
    defaultBody: (d) => wrapHtml('License Revoked', `
      <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.6">Hello ${d.customer_name || 'there'},</p>
      <p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.6">This email is to inform you that the following license has been revoked. The software can no longer be activated or used with this license key.</p>
      ${infoTable([
        { label: 'License Key', value: `<code style="background:#eef2f7;padding:2px 8px;border-radius:4px;font-size:13px">${d.license_key || 'N/A'}</code>` },
        { label: 'Product', value: d.product_name || 'N/A' },
      ])}
      <p style="margin:12px 0;font-size:14px;color:#555;line-height:1.6">If you believe this action was taken in error, or if you have any questions about this revocation, please contact our support team immediately and we will review the situation.</p>
      ${btn('Contact Support', `mailto:{{support_email}}`)}
      <p style="margin:8px 0 0;font-size:13px;color:#8899aa;font-style:italic">We take license management seriously to protect our customers and their software investments.</p>
    `),
    defaultPlainText: (d) => `Hello ${d.customer_name || 'there'},

This email is to inform you that the following license has been revoked. The software can no longer be activated or used with this license key.

License Key: ${d.license_key || 'N/A'}
Product: ${d.product_name || 'N/A'}

If you believe this action was taken in error, or if you have any questions about this revocation, please contact our support team immediately and we will review the situation.

We take license management seriously to protect our customers and their software investments.

Best regards,
The ${COMPANY_NAME} Team`
  },

  // ================================================================
  // 8. DEVICE RESET
  // ================================================================
  device_reset: {
    subject: 'Device Reset Successful',
    defaultBody: (d) => wrapHtml('Device Reset Successful', `
      <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.6">Hello ${d.customer_name || 'there'},</p>
      <p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.6">The device binding for your license has been reset successfully. You may now activate the license on another supported device.</p>
      ${infoTable([
        { label: 'License Key', value: `<code style="background:#eef2f7;padding:2px 8px;border-radius:4px;font-size:13px">${d.license_key || 'N/A'}</code>` },
        { label: 'Previous Device', value: d.device_name || 'Unknown device' },
      ])}
      <p style="margin:12px 0;font-size:14px;color:#555;line-height:1.6">Please note that your license may have a limit on the number of devices that can be activated simultaneously. You can check your current activation status and manage your devices from your account dashboard.</p>
      ${btn('Manage Devices', `${d.website || '#'}/dashboard`)}
    `),
    defaultPlainText: (d) => `Hello ${d.customer_name || 'there'},

The device binding for your license has been reset successfully. You may now activate the license on another supported device.

License Key: ${d.license_key || 'N/A'}
Previous Device: ${d.device_name || 'Unknown device'}

Please note that your license may have a limit on the number of devices that can be activated simultaneously. You can check your current activation status and manage your devices from your account dashboard.

Best regards,
The ${COMPANY_NAME} Team`
  },

  // ================================================================
  // 9. DEVICE CHANGED
  // ================================================================
  device_changed: {
    subject: 'Device Change Detected on Your License',
    defaultBody: (d) => wrapHtml('Device Change Detected', `
      <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.6">Hello ${d.customer_name || 'there'},</p>
      <p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.6">We detected that a different device has been associated with your license. This notification is sent to keep you informed about activity on your account.</p>
      ${infoTable([
        { label: 'License Key', value: `<code style="background:#eef2f7;padding:2px 8px;border-radius:4px;font-size:13px">${d.license_key || 'N/A'}</code>` },
        { label: 'Detected Device', value: d.device_name || 'Unknown device' },
        { label: 'Date', value: d.activation_date || new Date().toLocaleDateString() },
      ])}
      <p style="margin:12px 0;font-size:14px;color:#555;line-height:1.6"><strong style="color:#cc3333">If you did not authorize this change:</strong> Please contact our support team immediately so we can secure your license and investigate any unauthorized activity.</p>
      ${btn('Contact Support', `mailto:{{support_email}}`)}
      <p style="margin:8px 0 0;font-size:13px;color:#8899aa;font-style:italic">If this was you, no action is needed. You can continue using the software as normal.</p>
    `),
    defaultPlainText: (d) => `Hello ${d.customer_name || 'there'},

We detected that a different device has been associated with your license. This notification is sent to keep you informed about activity on your account.

License Key: ${d.license_key || 'N/A'}
Detected Device: ${d.device_name || 'Unknown device'}
Date: ${d.activation_date || new Date().toLocaleDateString()}

*** If you did not authorize this change: ***
Please contact our support team immediately so we can secure your license and investigate any unauthorized activity.

If this was you, no action is needed. You can continue using the software as normal.

Best regards,
The ${COMPANY_NAME} Team`
  },

  // ================================================================
  // 10. PAYMENT SUCCESS
  // ================================================================
  payment_success: {
    subject: 'Payment Successful – Thank You!',
    defaultBody: (d) => wrapHtml('Payment Received', `
      <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.6">Hello ${d.customer_name || 'there'},</p>
      <p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.6">Thank you for your purchase! We have received your payment successfully. Your transaction details are provided below for your records.</p>
      ${infoTable([
        { label: 'Product', value: d.product_name || 'N/A' },
        { label: 'Plan', value: d.plan_name || 'N/A' },
        { label: 'Amount Paid', value: `$${d.amount || '0'}` },
      ])}
      <p style="margin:12px 0;font-size:14px;color:#555;line-height:1.6">Your license is now active and ready to use. If you purchased a subscription, it will automatically renew according to the terms selected during checkout.</p>
      <p style="margin:12px 0;font-size:14px;color:#555;line-height:1.6">A receipt has been generated and is available in your account dashboard. For any billing inquiries, please contact our support team.</p>
      ${btn('View Receipt', `${d.website || '#'}/billing`)}
      <p style="margin:8px 0 0;font-size:13px;color:#8899aa;font-style:italic">We appreciate your business and are excited to have you on board!</p>
    `),
    defaultPlainText: (d) => `Hello ${d.customer_name || 'there'},

Thank you for your purchase! We have received your payment successfully. Your transaction details are provided below for your records.

Product: ${d.product_name || 'N/A'}
Plan: ${d.plan_name || 'N/A'}
Amount Paid: $${d.amount || '0'}

Your license is now active and ready to use. If you purchased a subscription, it will automatically renew according to the terms selected during checkout.

A receipt has been generated and is available in your account dashboard. For any billing inquiries, please contact our support team.

We appreciate your business and are excited to have you on board!

Best regards,
The ${COMPANY_NAME} Team`
  },

  // ================================================================
  // 11. SUBSCRIPTION REMINDER
  // ================================================================
  subscription_reminder: {
    subject: 'Reminder: Your {{product}} Subscription Renews Soon',
    defaultBody: (d) => wrapHtml('Renewal Reminder', `
      <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.6">Hello ${d.customer_name || 'there'},</p>
      <p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.6">This is a friendly reminder that your subscription for <strong style="color:#1a1a2e">${d.product_name || 'your product'}</strong> is approaching its renewal date. To ensure uninterrupted service, please renew before your current period expires.</p>
      ${infoTable([
        { label: 'Product', value: d.product_name || 'N/A' },
        { label: 'Current Plan', value: d.plan_name || 'N/A' },
        { label: 'Renewal Date', value: d.expiry_date || 'N/A' },
        { label: 'License Key', value: `<code style="background:#eef2f7;padding:2px 8px;border-radius:4px;font-size:13px">${d.license_key || 'N/A'}</code>` },
      ])}
      <p style="margin:12px 0;font-size:14px;color:#555;line-height:1.6">Renewing is quick and easy. Simply click the button below to be taken to your renewal portal where you can review and complete the process.</p>
      ${btn('Renew Subscription', `${d.website || '#'}/renew`)}
      <p style="margin:8px 0 0;font-size:13px;color:#8899aa;font-style:italic">If you have already renewed or have any questions, please disregard this reminder or contact our support team.</p>
    `),
    defaultPlainText: (d) => `Hello ${d.customer_name || 'there'},

This is a friendly reminder that your subscription for ${d.product_name || 'your product'} is approaching its renewal date. To ensure uninterrupted service, please renew before your current period expires.

Product: ${d.product_name || 'N/A'}
Current Plan: ${d.plan_name || 'N/A'}
Renewal Date: ${d.expiry_date || 'N/A'}
License Key: ${d.license_key || 'N/A'}

Renewing is quick and easy. Visit your renewal portal to review and complete the process.

If you have already renewed or have any questions, please disregard this reminder or contact our support team.

Best regards,
The ${COMPANY_NAME} Team`
  },

  // ================================================================
  // 12. WELCOME CUSTOMER (Enquiry Confirmation)
  // ================================================================
  welcome_customer: {
    subject: 'Thank You for Contacting Websmith Digital - {{request_id}}',
    defaultBody: (d) => wrapHtml('Thank You for Contacting Us', `
      <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.6">Dear ${d.client_name || d.customer_name || 'there'},</p>
      <p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.6">Thank you for reaching out to ${COMPANY_NAME}. We have successfully received your inquiry (Reference: <strong>${d.request_id || d.order_number || 'N/A'}</strong>) and our team is reviewing your requirements.</p>
      ${infoTable([
        { label: 'Reference Number', value: `<code style="background:#eef2f7;padding:2px 8px;border-radius:4px;font-size:13px">${d.request_id || d.order_number || 'N/A'}</code>` },
        { label: 'Inquiry Subject', value: d.query_subject || d.subject || d.product || 'N/A' },
        { label: 'Product / Plan', value: d.product ? `${d.product} (${d.plan_name || 'Standard'})` : (d.plan_name || 'N/A') },
      ].filter(r => r.value !== 'N/A'))}
      ${d.query_message || d.message ? `
      <div style="background:#f0f4ff;border-left:4px solid #007AFF;padding:16px 20px;margin:16px 0;border-radius:4px;font-size:14px;color:#333;line-height:1.6">
        <strong>Your Message:</strong><br/>
        ${renderCustomerMessageHtml(d.query_message || d.message || '')}
      </div>` : ''}
      <p style="margin:16px 0;font-size:14px;color:#555;line-height:1.6">Our team will connect with you at <strong>${d.client_email || d.customer_email || 'your email'}</strong> during your preferred contact window.</p>
      ${d.portal_url ? btn('Access Client Portal', d.portal_url) : ''}
      <p style="margin:12px 0;font-size:14px;color:#555;line-height:1.6">If you have any questions in the meantime, please do not hesitate to reach out to our support team at <a href="mailto:{{support_email}}" style="color:#4a90d9;text-decoration:none">{{support_email}}</a>.</p>
      <p style="margin:8px 0 0;font-size:13px;color:#8899aa;font-style:italic">We look forward to working with you.</p>
    `),
    defaultPlainText: (d) => `Dear ${d.client_name || d.customer_name || 'there'},

Thank you for reaching out to ${COMPANY_NAME}. We have successfully received your inquiry (Reference: ${d.request_id || d.order_number || 'N/A'}).

Subject: ${d.query_subject || d.subject || d.product || 'N/A'}
${d.query_message || d.message ? `Message: ${d.query_message || d.message}\n` : ''}
Client Portal: ${d.portal_url || 'https://websmithdigital.com/login'}

Our team will connect with you at ${d.client_email || d.customer_email || 'your email'} shortly.

If you have any questions in the meantime, please reach out to our support team at {{support_email}}.

Best regards,
The ${COMPANY_NAME} Team`
  },

  // ================================================================
  // 14. REACTIVATION APPROVED
  // ================================================================
  reactivation_approved: {
    subject: 'Your License Reactivation Has Been Approved',
    defaultBody: (d) => wrapHtml('Reactivation Approved', `
      <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.6">Hello ${d.customer_name || 'there'},</p>
      <p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.6">Your license reactivation request has been <strong style="color:#16a34a">approved</strong>. Your license is now active again.</p>
      ${infoTable([
        { label: 'Product', value: d.product_name || 'N/A' },
        { label: 'Plan', value: d.plan_name || 'N/A' },
        { label: 'License Key', value: `<code style="background:#eef2f7;padding:2px 8px;border-radius:4px;font-size:13px">${d.license_key || 'N/A'}</code>` },
        { label: 'Expiry Date', value: d.expiry_date || 'No expiry' },
      ].filter(r => r.value !== 'N/A'))}
      <p style="margin:12px 0;font-size:14px;color:#555;line-height:1.6">Please open your application and activate it using the license key above. You may need to restart the application for the changes to take effect.</p>
      ${btn('Open Application', d.website ? `${d.website}/license/reactivation` : '#')}
      <p style="margin:8px 0 0;font-size:13px;color:#8899aa;font-style:italic">If you have any questions, please contact our support team.</p>
    `),
    defaultPlainText: (d) => `Hello ${d.customer_name || 'there'},

Your license reactivation request has been approved. Your license is now active again.

Product: ${d.product_name || 'N/A'}
Plan: ${d.plan_name || 'N/A'}
License Key: ${d.license_key || 'N/A'}
Expiry Date: ${d.expiry_date || 'No expiry'}

Please open your application and activate it using the license key above. You may need to restart the application for the changes to take effect.

If you have any questions, please contact our support team.

Best regards,
The ${COMPANY_NAME} Team`
  },

  // ================================================================
  // 15. REACTIVATION REJECTED
  // ================================================================
  reactivation_rejected: {
    subject: 'Your License Reactivation Request Was Not Approved',
    defaultBody: (d) => wrapHtml('Reactivation Rejected', `
      <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.6">Hello ${d.customer_name || 'there'},</p>
      <p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.6">Your license reactivation request for <strong style="color:#1a1a2e">${d.product_name || 'your software'}</strong> could not be approved at this time.</p>
      ${d.admin_message ? `<div style="background:#fef2f2;border-left:4px solid #dc2626;padding:16px 20px;margin:16px 0;border-radius:4px;font-size:14px;color:#991b1b;line-height:1.6">${d.admin_message}</div>` : ''}
      <p style="margin:12px 0;font-size:14px;color:#555;line-height:1.6">If you believe this is an error or need further assistance, please contact our support team and we will be happy to help.</p>
      <p style="margin:8px 0 0;font-size:13px;color:#8899aa;font-style:italic">We apologize for the inconvenience.</p>
    `),
    defaultPlainText: (d) => `Hello ${d.customer_name || 'there'},

Your license reactivation request for ${d.product_name || 'your software'} could not be approved at this time.

${d.admin_message ? `Reason: ${d.admin_message}\n` : ''}
If you believe this is an error or need further assistance, please contact our support team.

We apologize for the inconvenience.

Best regards,
The ${COMPANY_NAME} Team`
  },

  // ================================================================
  // 16. ADMIN NOTIFICATION
  // ================================================================
  admin_notification: {
    subject: '[New Inquiry Raised - {{request_id}}] {{subject}} (from {{customer_name}})',
    defaultBody: (d) => {
      const cleanWa = (d.whatsapp_phone || '').replace(/[^\d]/g, '');
      const cleanCall = (d.calling_phone || d.customer_phone || '').replace(/[^\d+]/g, '');
      const tableRows = [
        { label: 'Request ID', value: d.request_id ? `<strong style="color:#007AFF;font-size:14px">${d.request_id}</strong>` : 'N/A' },
        { label: 'Lead Source', value: d.source ? `🎯 <strong>${d.source}</strong>` : 'N/A' },
        { label: 'Customer Name', value: d.customer_name || 'N/A' },
        { label: 'Email Address', value: d.customer_email ? `<a href="mailto:${d.customer_email}" style="color:#007AFF;text-decoration:none">${d.customer_email}</a>` : 'N/A' },
        { label: 'Calling Phone', value: cleanCall ? `<a href="tel:${cleanCall}" style="color:#007AFF;font-weight:600;text-decoration:none">📞 ${d.calling_phone || d.customer_phone}</a>` : 'N/A' },
        { label: 'WhatsApp Number', value: cleanWa ? `<a href="https://wa.me/${cleanWa}" target="_blank" style="color:#128c7e;font-weight:600;text-decoration:none">💬 Chat on WhatsApp (${d.whatsapp_phone})</a>` : 'N/A' },
        { label: 'Client Timezone', value: d.timezone || d.client_timezone ? `🌐 <strong>${d.timezone || d.client_timezone}</strong>` : 'N/A' },
        { label: 'Preferred Schedule', value: d.preferred_date ? `📅 <strong>${d.preferred_date}</strong>` : 'N/A' },
        { label: 'Admin Call Time (IST)', value: d.admin_call_time_ist ? `⏰ <strong style="color:#d97706;background:#fef3c7;padding:2px 8px;border-radius:4px">${d.admin_call_time_ist}</strong>` : 'N/A' },
        { label: 'Selected Services', value: d.services ? `🛠️ <strong>${d.services}</strong>` : 'N/A' },
        { label: 'Estimated Budget', value: d.budget ? `💰 <strong style="color:#16a34a;background:#dcfce7;padding:2px 8px;border-radius:4px">${d.budget}</strong>` : 'N/A' },
        { label: 'Target Timeline', value: d.timeline ? `⏱️ <strong>${d.timeline}</strong>` : 'N/A' },
        { label: 'App Platform', value: d.app_platform ? `📱 <strong>${d.app_platform}</strong>` : 'N/A' },
        { label: 'CMS Requirement', value: d.cms_requirement ? `📝 <strong>${d.cms_requirement}</strong>` : 'N/A' },
        { label: 'Company / Organization', value: d.company || 'N/A' },
        { label: 'Subject', value: d.subject || 'N/A' },
        { label: 'Product', value: d.product_name || 'N/A' },
        { label: 'License Key', value: d.license_key || 'N/A' },
      ].filter(r => r.value !== 'N/A');

      return wrapHtml(`New Inquiry Raised${d.request_id ? ` — ${d.request_id}` : ''}`, `
        <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.6">Hello Administrator,</p>
        <p style="margin:0 0 20px;font-size:14px;color:#555;line-height:1.6">A new customer inquiry or ticket has been raised via the public website:</p>
        <div style="background:#f0f4ff;border-left:4px solid #007AFF;padding:16px 20px;margin:16px 0;border-radius:4px;font-size:14px;color:#333;line-height:1.6">
          <strong>Customer Message:</strong><br/>
          ${renderCustomerMessageHtml(d.message || d.admin_message || 'No details provided.')}
        </div>
        ${tableRows.length > 0 ? infoTable(tableRows) : ''}
        ${d.admin_url ? btn('Open in Admin Messages', d.admin_url) : ''}
        <p style="margin:16px 0 0;font-size:13px;color:#8899aa">This is an automated administrative alert from Websmith Digital.</p>
      `);
    },
    defaultPlainText: (d) => `Hello Administrator,

A new inquiry has been raised via the public website [${d.request_id || 'N/A'}]:

${d.message || d.admin_message || 'No details provided.'}

Request ID: ${d.request_id || 'N/A'}
${d.source ? `Lead Source: ${d.source}\n` : ''}Customer: ${d.customer_name || 'N/A'}
Email: ${d.customer_email || 'N/A'}
${d.calling_phone || d.customer_phone ? `Calling Phone: ${d.calling_phone || d.customer_phone}\n` : ''}${d.whatsapp_phone ? `WhatsApp: ${d.whatsapp_phone} (https://wa.me/${(d.whatsapp_phone || '').replace(/[^\d]/g, '')})\n` : ''}${d.timezone || d.client_timezone ? `Client Timezone: ${d.timezone || d.client_timezone}\n` : ''}${d.preferred_date ? `Preferred Schedule: ${d.preferred_date}\n` : ''}${d.admin_call_time_ist ? `Admin Call Time (IST): ${d.admin_call_time_ist}\n` : ''}${d.services ? `Selected Services: ${d.services}\n` : ''}${d.budget ? `Estimated Budget: ${d.budget}\n` : ''}${d.timeline ? `Target Timeline: ${d.timeline}\n` : ''}${d.app_platform ? `App Platform: ${d.app_platform}\n` : ''}${d.cms_requirement ? `CMS Requirement: ${d.cms_requirement}\n` : ''}${d.company ? `Company: ${d.company}\n` : ''}${d.subject ? `Subject: ${d.subject}\n` : ''}
Open Admin Dashboard: ${d.admin_url || 'https://websmithdigital.com/admin/messages'}

This is an automated administrative notification.`
  },

  // ================================================================
  // 17. SUPPORT REPLY
  // ================================================================
  support_reply: {
    subject: 'Re: Your Support Request - {{request_id}}',
    defaultBody: (d) => wrapHtml('Support Team', `
      <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.6">Hello ${d.customer_name || 'there'},</p>
      <p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.6">We have received a response to your support request <strong>{{request_id}}</strong>.</p>
      <div style="background:#f8f9fa;border-left:4px solid #4a90d9;padding:16px 20px;margin:16px 0;border-radius:4px;font-size:14px;color:#333;line-height:1.6">
        ${renderCustomerMessageHtml(d.message || '') || 'No message provided.'}
      </div>
      <p style="margin:12px 0;font-size:14px;color:#555;line-height:1.6">You can continue this conversation by replying to this email or visiting our support portal.</p>
      <p style="margin:8px 0 0;font-size:13px;color:#8899aa;font-style:italic">If you did not submit a support request, please ignore this email.</p>
    `),
    defaultPlainText: (d) => `Hello ${d.customer_name || 'there'},

We have received a response to your support request ${d.request_id}.

${renderCustomerMessagePlain(d.message) || 'No message provided.'}

You can continue this conversation by replying to this email or visiting our support portal.

If you did not submit a support request, please ignore this email.

Best regards,
The ${COMPANY_NAME} Support Team`
  },

  // ================================================================
  // 18. NEW SALES ENQUIRY (to sales@)
  // ================================================================
  new_sales_enquiry: {
    subject: 'New Sales Enquiry - {{product_name}}',
    defaultBody: (d) => wrapHtml('New Sales Enquiry', `
      <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.6">Hello Sales Team,</p>
      <p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.6">A new sales enquiry has been received.</p>
      ${infoTable([
        { label: 'Customer', value: d.customer_name || 'N/A' },
        { label: 'Email', value: d.customer_email || 'N/A' },
        { label: 'Phone', value: d.customer_phone || 'N/A' },
        { label: 'Company', value: d.company || 'N/A' },
        { label: 'Product', value: d.product_name || 'N/A' },
        { label: 'Plan', value: d.plan_name || 'N/A' },
        { label: 'Reference', value: d.enquiry_id || 'N/A' },
      ].filter(r => r.value !== 'N/A'))}
      <div style="background:#f0f4ff;border-left:4px solid #4a90d9;padding:16px 20px;margin:16px 0;border-radius:4px;font-size:14px;color:#333;line-height:1.6">
        ${d.message || 'No details provided.'}
      </div>
      <p style="margin:12px 0 0;font-size:13px;color:#8899aa">Please follow up with the customer within 24 hours.</p>
    `),
    defaultPlainText: (d) => `Hello Sales Team,

A new sales enquiry has been received.

Customer: ${d.customer_name || 'N/A'}
Email: ${d.customer_email || 'N/A'}
Phone: ${d.customer_phone || 'N/A'}
Company: ${d.company || 'N/A'}
Product: ${d.product_name || 'N/A'}
Plan: ${d.plan_name || 'N/A'}
Reference: ${d.enquiry_id || 'N/A'}

Message:
${d.message || 'No details provided.'}

Please follow up with the customer within 24 hours.

Best regards,
${COMPANY_NAME} Sales System`
  },

  // ================================================================
  // 19. CONVERSATION CREATED (admin notification - category based)
  // ================================================================
  conversation_created: {
    subject: 'New {{category}} Conversation - {{conversation_id}}',
    defaultBody: (d) => wrapHtml('New Conversation', `
      <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.6">Hello ${d.sender_name || 'Team'},</p>
      <p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.6">A new <strong>${d.category || 'general'}</strong> conversation has been created.</p>
      ${infoTable([
        { label: 'Category', value: d.category || 'General' },
        { label: 'Customer', value: d.customer_name || 'N/A' },
        { label: 'Email', value: d.customer_email || 'N/A' },
        { label: 'Product', value: d.product_name || 'N/A' },
        { label: 'License', value: d.license_key || 'N/A' },
        { label: 'Hardware', value: d.hardware_id || 'N/A' },
        { label: 'Conversation', value: d.conversation_id || 'N/A' },
      ].filter(r => r.value !== 'N/A'))}
      <div style="background:#f0f4ff;border-left:4px solid #4a90d9;padding:16px 20px;margin:16px 0;border-radius:4px;font-size:14px;color:#333;line-height:1.6">
        ${d.message || 'No details provided.'}
      </div>
      <p style="margin:12px 0 0;font-size:13px;color:#8899aa">Please review and respond accordingly.</p>
    `),
    defaultPlainText: (d) => `Hello ${d.sender_name || 'Team'},

A new ${d.category || 'general'} conversation has been created.

Category: ${d.category || 'General'}
Customer: ${d.customer_name || 'N/A'}
Email: ${d.customer_email || 'N/A'}
Product: ${d.product_name || 'N/A'}
License: ${d.license_key || 'N/A'}
Hardware: ${d.hardware_id || 'N/A'}
Conversation: ${d.conversation_id || 'N/A'}

Message:
${d.message || 'No details provided.'}

Please review and respond accordingly.
${COMPANY_NAME} Support`
  },

  // ================================================================
  // 20. SALES REPLY (to customer from sales@)
  // ================================================================
  sales_reply: {
    subject: 'Re: Your Sales Enquiry - {{enquiry_id}}',
    defaultBody: (d) => wrapHtml('Sales Team', `
      <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.6">Hello ${d.customer_name || 'there'},</p>
      <p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.6">Our sales team has responded to your enquiry <strong>{{enquiry_id}}</strong>.</p>
      <div style="background:#f8f9fa;border-left:4px solid #10b981;padding:16px 20px;margin:16px 0;border-radius:4px;font-size:14px;color:#333;line-height:1.6">
        ${renderCustomerMessageHtml(d.message || '') || 'No message provided.'}
      </div>
      <p style="margin:12px 0;font-size:14px;color:#555;line-height:1.6">You can continue this conversation by replying to this email or contacting our sales team directly.</p>
      <p style="margin:8px 0 0;font-size:13px;color:#8899aa;font-style:italic">If you did not submit a sales enquiry, please ignore this email.</p>
    `),
    defaultPlainText: (d) => `Hello ${d.customer_name || 'there'},

Our sales team has responded to your enquiry ${d.enquiry_id}.

${renderCustomerMessagePlain(d.message) || 'No message provided.'}

You can continue this conversation by replying to this email or contacting our sales team directly.

If you did not submit a sales enquiry, please ignore this email.

Best regards,
${COMPANY_NAME} Sales Team`
  },

  // ================================================================
  // 20. TRIAL EXPIRED
  // ================================================================
  trial_expired: {
    subject: 'Your {{product}} Free Trial Has Expired',
    defaultBody: (d) => wrapHtml('Trial Expired', `
      <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.6">Hello ${d.customer_name || 'there'},</p>
      <p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.6">Your free trial for <strong style="color:#1a1a2e">${d.product_name || 'our product'}</strong> has expired.</p>
      ${infoTable([
        { label: 'Product', value: d.product_name || 'N/A' },
        { label: 'Plan', value: d.plan_name || 'Trial' },
        { label: 'Expired On', value: d.expiry_date || 'N/A' },
      ])}
      <p style="margin:12px 0;font-size:14px;color:#555;line-height:1.6">To continue using the software without interruption, please purchase a license from our website.</p>
      ${btn('Purchase License', `${d.website || '#'}/pricing`)}
      <p style="margin:8px 0 0;font-size:13px;color:#8899aa;font-style:italic">If you believe this is an error or need assistance, please contact our support team.</p>
    `),
    defaultPlainText: (d) => `Hello ${d.customer_name || 'there'},

Your free trial for ${d.product_name || 'our product'} has expired.

Product: ${d.product_name || 'N/A'}
Plan: ${d.plan_name || 'Trial'}
Expired On: ${d.expiry_date || 'N/A'}

To continue using the software without interruption, please purchase a license from our website.

If you believe this is an error or need assistance, please contact our support team.

Best regards,
The ${COMPANY_NAME} Team`
  },

  // ================================================================
  // 21. ACTIVATION CONFIRMATION
  // ================================================================
  activation_confirmation: {
    subject: 'License Activation Confirmed - {{product}}',
    defaultBody: (d) => wrapHtml('Activation Confirmed', `
      <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.6">Hello ${d.customer_name || 'there'},</p>
      <p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.6">Your license for <strong style="color:#1a1a2e">${d.product_name || 'your product'}</strong> has been successfully activated.</p>
      ${infoTable([
        { label: 'Product', value: d.product_name || 'N/A' },
        { label: 'Plan', value: d.plan_name || 'N/A' },
        { label: 'License Key', value: `<code style="background:#eef2f7;padding:2px 8px;border-radius:4px;font-size:13px">${d.license_key || 'N/A'}</code>` },
        { label: 'Activated Device', value: d.device_name || 'Unknown device' },
        { label: 'Activation Date', value: d.activation_date || new Date().toLocaleDateString() },
        { label: 'Expiry Date', value: d.expiry_date || 'No expiry' },
      ])}
      <p style="margin:12px 0;font-size:14px;color:#555;line-height:1.6">You can now start using the software immediately. If you need to manage your devices or view your license details, visit your account dashboard.</p>
      ${btn('Go to Dashboard', `${d.website || '#'}/dashboard`)}
    `),
    defaultPlainText: (d) => `Hello ${d.customer_name || 'there'},

Your license for ${d.product_name || 'your product'} has been successfully activated.

Product: ${d.product_name || 'N/A'}
Plan: ${d.plan_name || 'N/A'}
License Key: ${d.license_key || 'N/A'}
Activated Device: ${d.device_name || 'Unknown device'}
Activation Date: ${d.activation_date || new Date().toLocaleDateString()}
Expiry Date: ${d.expiry_date || 'No expiry'}

You can now start using the software immediately. If you need to manage your devices or view your license details, visit your account dashboard.

Best regards,
The ${COMPANY_NAME} Team`
  },

  // ================================================================
  // 22. PASSWORD RESET
  // ================================================================
  password_reset: {
    subject: 'Password Reset - {{product}}',
    defaultBody: (d) => wrapHtml('Password Reset Request', `
      <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.6">Hello ${d.customer_name || 'there'},</p>
      <p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.6">We received a request to reset your password for <strong style="color:#1a1a2e">${d.product_name || 'Websmith Digital'}</strong>.</p>
      <div style="font-size:36px;font-weight:bold;text-align:center;color:#3b82f6;background:#eff6ff;padding:20px;border-radius:8px;letter-spacing:5px;margin:20px 0">${d.otp_code || 'N/A'}</div>
      <p style="text-align:center;color:#555">Valid for <strong>5 minutes</strong>.</p>
      <p style="margin:12px 0;font-size:14px;color:#555;line-height:1.6">If you did not request this password reset, please ignore this email or contact our support team immediately.</p>
    `),
    defaultPlainText: (d) => `Hello ${d.customer_name || 'there'},

We received a request to reset your password for ${d.product_name || 'Websmith Digital'}.

Your OTP verification code is: ${d.otp_code || 'N/A'}. Valid for 5 minutes.

If you did not request this password reset, please ignore this email or contact our support team immediately.

Best regards,
The ${COMPANY_NAME} Team`
  },

};

async function getTemplate(client: any, emailType: string): Promise<{ subject: string; body: string; plain_text: string } | null> {
  try {
    const pg = (client && typeof client.query === 'function') ? client : await getDb();
    const r = await pg.query(
      `SELECT subject, body, plain_text FROM email_templates WHERE email_type = $1 AND is_active = true ORDER BY updated_at DESC LIMIT 1`,
      [emailType]
    );
    if (r.rows.length > 0) return r.rows[0];
  } catch { /* table may not exist */ }
  return null;
}

async function logEmailDelivery(
  client: any,
  params: {
    emailType: string;
    sender: string;
    recipient: string;
    subject: string;
    status: string;
    response?: string;
    error?: string;
    licenseKey?: string;
    hardwareId?: string;
    supportRequestId?: string;
    salesRequestId?: string;
  }
): Promise<void> {
  try {
    let pgClient = client;
    if (!pgClient || (typeof pgClient.query !== 'function' && typeof pgClient.collection !== 'function')) {
      pgClient = await getDb();
    }

    if (pgClient && typeof pgClient.query === 'function') {
      await pgClient.query(
        `INSERT INTO notification_logs (event_type, channel, recipient, subject, status, response, error, license_key, hardware_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)`,
        [
          params.emailType,
          'email',
          params.recipient,
          params.subject,
          params.status,
          params.response || null,
          params.error || null,
          params.licenseKey || null,
          params.hardwareId || null,
        ]
      );
    } else if (pgClient && typeof pgClient.collection === 'function') {
      await pgClient.collection('notification_logs').insertOne({
        event_type: params.emailType,
        channel: 'email',
        recipient: params.recipient,
        subject: params.subject,
        status: params.status,
        response: params.response || null,
        error: params.error || null,
        license_key: params.licenseKey || null,
        hardware_id: params.hardwareId || null,
        created_at: new Date(),
      });
    }
  } catch (logError) {
    console.error(`[Email] Failed to log delivery:`, logError);
  }
}

export interface EmailAttachmentInput {
  name?: string;
  filename?: string;
  content: string | Buffer; // base64 string or Buffer
  type?: string;
  contentType?: string;
}

export interface EmailSendOptions {
  attachments?: EmailAttachmentInput[];
  custom?: { subject: string; html: string; plainText: string } | null;
  // Optional sender override (used by the admin reply/send routes when the
  // compose UI picks a specific mail account). When omitted the sender is
  // derived from the email type as before.
  from?: { email: string; name?: string } | null;
  // Optional CC/BCC recipients (used by the Communication Center composer).
  cc?: { email: string; name?: string }[];
  bcc?: { email: string; name?: string }[];
  replyTo?: string;
}

let cachedTransporter: any = null;
let cachedTransporterConfigKey: string | null = null;

export async function getSmtpTransporter(): Promise<{ transporter: any; senderName: string; senderEmail: string }> {
  // 1. Check environment variables first
  const envHost = process.env.SMTP_HOST;
  const envPort = process.env.SMTP_PORT;
  const envUser = process.env.SMTP_USER || process.env.SMTP_USERNAME;
  const envPass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;
  const envSecure = process.env.SMTP_SECURE === 'true' || Number(envPort) === 465;
  const envSenderEmail = process.env.MAIL_FROM_ADDRESS || process.env.SENDER_EMAIL || envUser;
  const envSenderName = process.env.MAIL_FROM_NAME || 'Websmith Digital';

  if (envHost && envUser && envPass && envPass !== 'YOUR_PRIVATEEMAIL_PASSWORD_HERE' && !envPass.startsWith('YOUR_')) {
    const configKey = `env:${envHost}:${envPort}:${envUser}`;
    if (cachedTransporter && cachedTransporterConfigKey === configKey) {
      return { transporter: cachedTransporter, senderName: envSenderName, senderEmail: envSenderEmail || envUser };
    }
    const transporter = nodemailer.createTransport({
      host: envHost,
      port: Number(envPort) || 465,
      secure: envSecure,
      pool: true,
      maxConnections: 3,
      auth: { user: envUser, pass: envPass },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 15000,
    });
    cachedTransporter = transporter;
    cachedTransporterConfigKey = configKey;
    return { transporter, senderName: envSenderName, senderEmail: envSenderEmail || envUser };
  }

  // 2. Active mailbox in PostgreSQL
  const db = await getDb();
  const res = await db.query(
    'SELECT * FROM mailboxes WHERE is_enabled = TRUE ORDER BY is_default_sender DESC, created_at DESC LIMIT 1'
  );
  const mailbox = res.rows[0];
  if (!mailbox) {
    throw new Error('No active mailbox configured in database and no SMTP environment variables provided');
  }

  const configKey = `db:${mailbox.id}:${mailbox.smtp_host}:${mailbox.smtp_port}:${mailbox.smtp_username}`;
  if (cachedTransporter && cachedTransporterConfigKey === configKey) {
    return {
      transporter: cachedTransporter,
      senderName: mailbox.display_name || 'Websmith Digital',
      senderEmail: mailbox.email_address,
    };
  }

  const transporter = nodemailer.createTransport({
    host: mailbox.smtp_host,
    port: Number(mailbox.smtp_port) || 465,
    secure: Boolean(mailbox.smtp_secure),
    pool: true,
    maxConnections: 3,
    auth: { user: mailbox.smtp_username, pass: mailbox.smtp_password },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 15000,
  });
  cachedTransporter = transporter;
  cachedTransporterConfigKey = configKey;
  return {
    transporter,
    senderName: mailbox.display_name || 'Websmith Digital',
    senderEmail: mailbox.email_address,
  };
}

async function sendViaNodemailerSmtp(
  to: { email: string; name?: string },
  subject: string,
  htmlBody: string,
  plainText: string,
  options: EmailSendOptions = {},
  senderOverride?: { email: string; name?: string }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const { transporter, senderName: defaultSenderName, senderEmail: defaultSenderEmail } = await getSmtpTransporter();

    const fromName = options.from?.name || senderOverride?.name || defaultSenderName;
    const fromEmail = options.from?.email || senderOverride?.email || defaultSenderEmail || 'no-reply@websmithdigital.com';
    const supportAddress = process.env.MAIL_SUPPORT_ADDRESS || 'support@websmithdigital.com';

    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      replyTo: options.replyTo || supportAddress,
      to: to.name ? `"${to.name}" <${to.email}>` : to.email,
      ...(options.cc && options.cc.length > 0 ? { cc: options.cc.map((c) => c.email) } : {}),
      ...(options.bcc && options.bcc.length > 0 ? { bcc: options.bcc.map((b) => b.email) } : {}),
      subject,
      text: plainText,
      html: htmlBody,
      ...(options.attachments && options.attachments.length > 0
        ? {
            attachments: options.attachments.map((a: any) => ({
              filename: a.filename || a.name || 'attachment',
              content: Buffer.isBuffer(a.content)
                ? a.content
                : typeof a.content === 'string'
                  ? Buffer.from(a.content, 'base64')
                  : a.content,
              contentType: a.contentType || a.type,
            })),
          }
        : {}),
    });

    console.log(`[Email] Delivered via Nodemailer SMTP to ${to.email} (messageId: ${info.messageId})`);
    return { success: true, messageId: String(info.messageId || '') };
  } catch (err: any) {
    console.error('[Email] Primary Nodemailer SMTP failed:', err?.message || err);

    // If env SMTP failed (e.g. invalid credentials or network error), fallback to DB mailbox
    try {
      const db = await getDb();
      const res = await db.query(
        'SELECT * FROM mailboxes WHERE is_enabled = TRUE ORDER BY is_default_sender DESC, created_at DESC LIMIT 1'
      );
      const mailbox = res.rows[0];
      if (mailbox) {
        console.warn(`[Email] Falling back to DB mailbox: ${mailbox.email_address}`);
        const fallbackTransporter = nodemailer.createTransport({
          host: mailbox.smtp_host,
          port: Number(mailbox.smtp_port) || 465,
          secure: Boolean(mailbox.smtp_secure),
          pool: true,
          maxConnections: 3,
          auth: { user: mailbox.smtp_username, pass: mailbox.smtp_password },
          tls: { rejectUnauthorized: false },
          connectionTimeout: 15000,
        });

        const supportAddress = process.env.MAIL_SUPPORT_ADDRESS || 'support@websmithdigital.com';
        const fallbackInfo = await fallbackTransporter.sendMail({
          from: `"${options.from?.name || mailbox.display_name || 'Websmith Digital'}" <${options.from?.email || mailbox.email_address}>`,
          replyTo: supportAddress,
          to: to.name ? `"${to.name}" <${to.email}>` : to.email,
          ...(options.cc && options.cc.length > 0 ? { cc: options.cc.map((c) => c.email) } : {}),
          ...(options.bcc && options.bcc.length > 0 ? { bcc: options.bcc.map((b) => b.email) } : {}),
          subject,
          text: plainText,
          html: htmlBody,
          ...(options.attachments && options.attachments.length > 0
            ? {
                attachments: options.attachments.map((a: any) => ({
                  filename: a.filename || a.name || 'attachment',
                  content: Buffer.isBuffer(a.content)
                    ? a.content
                    : typeof a.content === 'string'
                      ? Buffer.from(a.content, 'base64')
                      : a.content,
                  contentType: a.contentType || a.type,
                })),
              }
            : {}),
        });

        console.log(`[Email] Delivered via fallback DB mailbox to ${to.email} (messageId: ${fallbackInfo.messageId})`);
        return { success: true, messageId: String(fallbackInfo.messageId || '') };
      }
    } catch (fallbackErr: any) {
      console.error('[Email] Fallback DB mailbox also failed:', fallbackErr?.message || fallbackErr);
    }

    return { success: false, error: err?.message || 'SMTP delivery failed' };
  }
}

export async function sendEmail(
  client: any,
  emailType: string,
  to: { email: string; name?: string },
  data: Record<string, string> = {},
  options: EmailSendOptions = {}
): Promise<{ success: boolean; messageId?: string; error?: string }> {

  // Resolve sender addresses from Manage Page contact info (falls back to env vars)
  const fromAddress = await getFromAddress(client);
  const supportAddress = await getSupportAddress(client);
  const salesAddress = await getSalesAddress(client);

  // All outgoing and autogenerated emails strictly route from no-reply
  let senderEmail = fromAddress;
  let senderName = MAIL_FROM_NAME;

  // Sender override (only if explicit options.from provided by caller or compose UI)
  if (options.from?.email) {
    senderEmail = options.from.email;
    senderName = options.from.name || senderName;
  }

  try {
    const template = await getTemplate(client, emailType);
    const config = EMAIL_TYPES[emailType];
    if (!config && !options.custom) {
      console.warn(`Unknown email type: ${emailType}`);
      return { success: false, error: 'Unknown email type' };
    }

    if (!data.support_email && supportAddress) data.support_email = supportAddress;

    let subject = options.custom?.subject || template?.subject || config?.subject || '';
    let htmlBody = options.custom?.html || template?.body || config?.defaultBody(data) || '';
    let plainText = options.custom?.plainText || template?.plain_text || config?.defaultPlainText(data) || '';

    for (const [key, val] of Object.entries(data)) {
      subject = subject.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val || '');
      htmlBody = htmlBody.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val || '');
      plainText = plainText.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val || '');
    }

    // Add automated email disclaimer for automated emails
    if (senderEmail === fromAddress || !options.custom) {
      const disclaimer = `<div style="margin:24px 0 0;padding:16px 0 0;border-top:1px solid #e8ecf1;font-size:12px;line-height:1.6;color:#64748b;font-family:sans-serif;">
  <p style="margin:0 0 8px;font-style:italic;">This is an automated email. Please do not reply directly to this address.</p>
  <p style="margin:0;">Need help or facing an issue? Contact our support team at <br><a href="mailto:${supportAddress}" style="color:#0284c7;font-weight:600;text-decoration:none;">${supportAddress}</a></p>
</div>`;
      if (htmlBody.includes('</body>')) {
        htmlBody = htmlBody.replace('</body>', `${disclaimer}</body>`);
      } else {
        htmlBody += disclaimer;
      }
      plainText += `\n\n---\nThis is an automated email. Please do not reply directly to this address. Need help or facing an issue? Contact our support team at \n\n${supportAddress}\n`;
    }

    // Send guard + unsubscribe footer for non-essential customer-facing emails
    const includeFooter = shouldIncludeUnsubscribe(emailType);
    if (includeFooter) {
      const recipientEmail = to.email.toLowerCase().trim();
      if (await isUnsubscribed(recipientEmail)) {
        await logEmailDelivery(client, {
          emailType,
          sender: senderEmail,
          recipient: to.email,
          subject,
          status: 'skipped',
          error: 'Recipient has unsubscribed',
          licenseKey: data.license_key,
          hardwareId: data.hardware_id,
          supportRequestId: data.request_id,
        });
        return { success: false, error: 'Recipient has unsubscribed' };
      }

      const unsubscribeUrl = await getUnsubscribeLink(recipientEmail);
      htmlBody = htmlBody.replace(
        '</body>',
        UNSUBSCRIBE_FOOTER_HTML.replace(/{{unsubscribe_url}}/g, unsubscribeUrl) + '</body>'
      );
      plainText = plainText + UNSUBSCRIBE_FOOTER_TEXT.replace(/{{unsubscribe_url}}/g, unsubscribeUrl);
    }

    // Outbound email delivery via Nodemailer SMTP exclusively
    const smtpRes = await sendViaNodemailerSmtp(
      to,
      subject,
      htmlBody,
      plainText,
      options,
      { email: senderEmail, name: senderName }
    );

    await logEmailDelivery(client, {
      emailType,
      sender: senderEmail,
      recipient: to.email,
      subject,
      status: smtpRes.success ? 'sent' : 'failed',
      response: smtpRes.messageId,
      error: smtpRes.error,
      licenseKey: data.license_key,
      hardwareId: data.hardware_id,
      supportRequestId: data.request_id,
      salesRequestId: data.request_id,
    });

    return smtpRes;

  } catch (error) {
    console.error(`Email send error [${emailType} -> ${to.email}]:`, error);
    try {
      await logEmailDelivery(client, {
        emailType,
        sender: senderEmail,
        recipient: to.email,
        subject: '',
        status: 'failed',
        error: (error as Error)?.message || 'Unknown error',
        licenseKey: data.license_key,
        hardwareId: data.hardware_id,
      });
    } catch {}
    return { success: false, error: (error as Error)?.message || 'Unknown error' };
  }
}
