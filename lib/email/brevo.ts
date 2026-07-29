const BREVO_API_KEY = process.env.BREVO_API_KEY;
const MAIL_FROM_ADDRESS = process.env.MAIL_FROM_ADDRESS || process.env.SENDER_EMAIL || 'no-reply@websmithdigital.com';
const MAIL_SUPPORT_ADDRESS = process.env.MAIL_SUPPORT_ADDRESS || process.env.SENDER_EMAIL || 'support@websmithdigital.com';
const MAIL_SALES_ADDRESS = process.env.MAIL_SALES_ADDRESS || 'sales@websmithdigital.com';
const MAIL_FROM_NAME = process.env.MAIL_FROM_NAME || process.env.BREVO_SENDER_NAME || 'Websmith Support';
const MAIL_SUPPORT_NAME = process.env.MAIL_SUPPORT_NAME || 'Websmith Support Team';
const MAIL_SALES_NAME = process.env.MAIL_SALES_NAME || 'Websmith Sales Team';
const COMPANY_NAME = process.env.BRANDING_COMPANY_NAME || 'Websmith Digital';
const WEBSITE_URL = process.env.BRANDING_WEBSITE_URL || 'https://websmithdigital.com';

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
          <p style="margin:4px 0 0;color:#8899bb;font-size:13px">License Management</p>
        </td></tr>
        <tr><td style="padding:32px">
          <h2 style="margin:0 0 16px;color:#1a1a2e;font-size:20px;font-weight:600">${title}</h2>
          ${bodyHtml}
        </td></tr>
        <tr><td style="background-color:#f8f9fb;padding:24px 32px;border-top:1px solid #e8ecf1">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="text-align:center;font-size:13px;color:#8899aa;line-height:1.6">
              <p style="margin:0 0 8px;font-weight:600;color:#555">${COMPANY_NAME} — License Management</p>
              <p style="margin:0 0 4px">Need help? Contact our support team at <a href="mailto:{{support_email}}" style="color:#4a90d9;text-decoration:none">{{support_email}}</a></p>
              <p style="margin:0 0 4px">Visit our website: <a href="{{website}}" style="color:#4a90d9;text-decoration:none">{{website}}</a></p>
              <p style="margin:12px 0 0;font-size:11px;color:#aab">© ${new Date().getFullYear()} ${COMPANY_NAME}. All rights reserved. | This is an automated message, please do not reply directly.</p>
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
  admin_notification: { sender: MAIL_SUPPORT_ADDRESS, name: MAIL_SUPPORT_NAME },
  support_reply: { sender: MAIL_SUPPORT_ADDRESS, name: MAIL_SUPPORT_NAME },
  new_sales_enquiry: { sender: MAIL_SALES_ADDRESS, name: MAIL_SALES_NAME },
  sales_reply: { sender: MAIL_SALES_ADDRESS, name: MAIL_SALES_NAME },
  conversation_created: { sender: MAIL_SUPPORT_ADDRESS, name: MAIL_SUPPORT_NAME },
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
    subject: 'Thank You for Your Enquiry – {{product}}',
    defaultBody: (d) => wrapHtml('Enquiry Received', `
      <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.6">Dear ${d.customer_name || 'there'},</p>
      <p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.6">Thank you for your interest in <strong style="color:#1a1a2e">${d.product || 'our product'}</strong>. We have received your enquiry and our team will review it shortly.</p>
      ${infoTable([
        { label: 'Reference Number', value: `<code style="background:#eef2f7;padding:2px 8px;border-radius:4px;font-size:13px">${d.order_number || 'N/A'}</code>` },
        { label: 'Product', value: d.product || 'N/A' },
        { label: 'Selected Plan', value: d.plan_name || 'N/A' },
        { label: 'Version', value: d.product_version || 'N/A' },
      ].filter(r => r.value !== 'N/A'))}
      <p style="margin:16px 0;font-size:14px;color:#555;line-height:1.6">Our sales team will contact you at <strong>${d.customer_email || 'your email'}</strong> within 24 hours to discuss the next steps and help you get started.</p>
      <h3 style="margin:20px 0 12px;font-size:15px;color:#1a1a2e;font-weight:600">Next Steps</h3>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px">
        <tr><td style="padding:6px 12px;font-size:14px;color:#555;vertical-align:top">1.</td><td style="padding:6px 0;font-size:14px;color:#555">Our team reviews your requirements</td></tr>
        <tr><td style="padding:6px 12px;font-size:14px;color:#555;vertical-align:top">2.</td><td style="padding:6px 0;font-size:14px;color:#555">We contact you with personalized options</td></tr>
        <tr><td style="padding:6px 12px;font-size:14px;color:#555;vertical-align:top">3.</td><td style="padding:6px 0;font-size:14px;color:#555">License is generated and sent to your email</td></tr>
        <tr><td style="padding:6px 12px;font-size:14px;color:#555;vertical-align:top">4.</td><td style="padding:6px 0;font-size:14px;color:#555">Activate and start using the software</td></tr>
      </table>
      <p style="margin:12px 0;font-size:14px;color:#555;line-height:1.6">If you have any questions in the meantime, please do not hesitate to reach out to our support team at <a href="mailto:{{support_email}}" style="color:#4a90d9;text-decoration:none">{{support_email}}</a>.</p>
      <p style="margin:8px 0 0;font-size:13px;color:#8899aa;font-style:italic">We look forward to helping you succeed with ${d.product || 'our software'}.</p>
    `),
    defaultPlainText: (d) => `Dear ${d.customer_name || 'there'},

Thank you for your interest in ${d.product || 'our product'}. We have received your enquiry and our team will review it shortly.

Reference Number: ${d.order_number || 'N/A'}
Product: ${d.product || 'N/A'}
Selected Plan: ${d.plan_name || 'N/A'}
Version: ${d.product_version || 'N/A'}

Our sales team will contact you at ${d.customer_email || 'your email'} within 24 hours to discuss the next steps and help you get started.

Next Steps:
1. Our team reviews your requirements
2. We contact you with personalized options
3. License is generated and sent to your email
4. Activate and start using the software

If you have any questions in the meantime, please do not hesitate to reach out to our support team at {{support_email}}.

We look forward to helping you succeed.

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
    subject: 'Administrator Notification',
    defaultBody: (d) => wrapHtml('System Notification', `
      <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.6">Hello Administrator,</p>
      <p style="margin:0 0 20px;font-size:14px;color:#555;line-height:1.6">The following system notification requires your attention:</p>
      <div style="background:#f0f4ff;border-left:4px solid #4a90d9;padding:16px 20px;margin:16px 0;border-radius:4px;font-size:14px;color:#333;line-height:1.6">
        ${d.message || 'No details provided.'}
      </div>
      ${d.customer_name ? infoTable([
        { label: 'Customer', value: d.customer_name || 'N/A' },
        { label: 'Email', value: d.customer_email || 'N/A' },
        { label: 'Product', value: d.product_name || 'N/A' },
        { label: 'License Key', value: d.license_key || 'N/A' },
      ].filter(r => r.value !== 'N/A')) : ''}
      <p style="margin:12px 0 0;font-size:13px;color:#8899aa">This is an automated administrative notification. Please review and take appropriate action if needed.</p>
    `),
    defaultPlainText: (d) => `Hello Administrator,

The following system notification requires your attention:

${d.message || 'No details provided.'}
${d.customer_name ? `\nCustomer: ${d.customer_name}\nEmail: ${d.customer_email || 'N/A'}\nProduct: ${d.product_name || 'N/A'}\nLicense Key: ${d.license_key || 'N/A'}` : ''}

This is an automated administrative notification. Please review and take appropriate action if needed.`
  },

  // ================================================================
  // 17. SUPPORT REPLY
  // ================================================================
  support_reply: {
    subject: 'Re: Your Support Request - {{request_id}}',
    defaultBody: (d) => wrapHtml('Support Reply', `
      <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.6">Hello ${d.customer_name || 'there'},</p>
      <p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.6">We have received a response to your support request <strong>{{request_id}}</strong>.</p>
      <div style="background:#f8f9fa;border-left:4px solid #4a90d9;padding:16px 20px;margin:16px 0;border-radius:4px;font-size:14px;color:#333;line-height:1.6">
        ${d.message || 'No message provided.'}
      </div>
      <p style="margin:12px 0;font-size:14px;color:#555;line-height:1.6">You can continue this conversation by replying to this email or visiting our support portal.</p>
      <p style="margin:8px 0 0;font-size:13px;color:#8899aa;font-style:italic">If you did not submit a support request, please ignore this email.</p>
    `),
    defaultPlainText: (d) => `Hello ${d.customer_name || 'there'},

We have received a response to your support request ${d.request_id}.

${d.message || 'No message provided.'}

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
    defaultBody: (d) => wrapHtml('Sales Reply', `
      <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.6">Hello ${d.customer_name || 'there'},</p>
      <p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.6">Our sales team has responded to your enquiry <strong>{{enquiry_id}}</strong>.</p>
      <div style="background:#f8f9fa;border-left:4px solid #10b981;padding:16px 20px;margin:16px 0;border-radius:4px;font-size:14px;color:#333;line-height:1.6">
        ${d.message || 'No message provided.'}
      </div>
      <p style="margin:12px 0;font-size:14px;color:#555;line-height:1.6">You can continue this conversation by replying to this email or contacting our sales team directly.</p>
      <p style="margin:8px 0 0;font-size:13px;color:#8899aa;font-style:italic">If you did not submit a sales enquiry, please ignore this email.</p>
    `),
    defaultPlainText: (d) => `Hello ${d.customer_name || 'there'},

Our sales team has responded to your enquiry ${d.enquiry_id}.

${d.message || 'No message provided.'}

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
    const r = await client.query(
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
    await client.query(
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
  } catch (logError) {
    console.error(`[Email] Failed to log delivery:`, logError);
  }
}

export async function sendEmail(
  client: any,
  emailType: string,
  to: { email: string; name?: string },
  data: Record<string, string> = {}
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!BREVO_API_KEY) {
    console.warn(`BREVO_API_KEY not set — skipping email: ${emailType} to ${to.email}`);
    return { success: false, error: 'BREVO_API_KEY not configured' };
  }

  try {
    const template = await getTemplate(client, emailType);
    const config = EMAIL_TYPES[emailType];
    if (!config) {
      console.warn(`Unknown email type: ${emailType}`);
      return { success: false, error: 'Unknown email type' };
    }

    const subject = template?.subject || config.subject;
    let htmlBody = template?.body || config.defaultBody(data);
    let plainText = template?.plain_text || config.defaultPlainText(data);

    for (const [key, val] of Object.entries(data)) {
      htmlBody = htmlBody.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val || '');
      plainText = plainText.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val || '');
    }

    const route = EMAIL_ROUTES[emailType] || { sender: MAIL_FROM_ADDRESS, name: MAIL_FROM_NAME };
    const senderEmail = route.sender;
    const senderName = route.name;

    // Add automated email disclaimer for MAIL_FROM_ADDRESS
    if (senderEmail === MAIL_FROM_ADDRESS) {
      const disclaimer = '<p style="margin:16px 0 0;font-size:12px;color:#8899aa;font-style:italic;border-top:1px solid #e8ecf1;padding-top:12px">This is an automated email. Please do not reply.</p>';
      htmlBody = htmlBody.replace('</body>', `${disclaimer}</body>`);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let response: Response | null = null;
    let lastError: string = '';
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        response = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'api-key': BREVO_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sender: { name: senderName, email: senderEmail },
            to: [{ email: to.email, name: to.name || 'Valued Customer' }],
            subject,
            htmlContent: htmlBody,
            textContent: plainText,
          }),
          signal: controller.signal,
        });
        if (response.ok) break;
        const errText = await response.text();
        lastError = errText;
        console.warn(`Brevo attempt ${attempt + 1} failed [${emailType} -> ${to.email}]: ${errText}`);
        if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
      } catch (fetchError: any) {
        lastError = fetchError?.message || 'Network error';
        console.warn(`Brevo attempt ${attempt + 1} network error [${emailType} -> ${to.email}]: ${lastError}`);
        if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
      }
    }
    clearTimeout(timeoutId);

    if (!response || !response.ok) {
      const err = lastError || 'Failed to send email after 3 retries';
      console.error(`Brevo send failed [${emailType} -> ${to.email}]: ${err}`);
      await logEmailDelivery(client, {
        emailType,
        sender: senderEmail,
        recipient: to.email,
        subject,
        status: 'failed',
        error: err,
        licenseKey: data.license_key,
        hardwareId: data.hardware_id,
        supportRequestId: data.request_id,
      });
      return { success: false, error: err };
    }

    const brevoResponse = await response.json();
    const messageId = brevoResponse.messageId;

    console.log(`Email sent: ${emailType} -> ${to.email} (messageId: ${messageId})`);
    await logEmailDelivery(client, {
      emailType,
      sender: senderEmail,
      recipient: to.email,
      subject,
      status: 'sent',
      response: messageId || 'ok',
      licenseKey: data.license_key,
      hardwareId: data.hardware_id,
      supportRequestId: data.request_id,
    });
    return { success: true, messageId };

  } catch (error) {
    console.error(`Email send error [${emailType} -> ${to.email}]:`, error);
    try {
      await logEmailDelivery(client, {
        emailType,
        sender: MAIL_FROM_ADDRESS,
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
