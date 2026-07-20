import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

interface TemplateDef {
  email_type: string;
  subject: string;
  body: string;
  plain_text: string;
}

function getBrandName(): string {
  return process.env.BRAND_NAME || 'License Management';
}

const SEED_TEMPLATES: TemplateDef[] = [
  {
    email_type: "license_created",
    subject: "Your {{product}} License Has Been Created",
    body: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9">
    <tr><td align="center" style="padding:24px 16px">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06)">
        <tr><td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:28px 32px;text-align:center">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px">WebSmith</h1>
          <p style="margin:4px 0 0;color:#8899bb;font-size:13px">License Management Platform</p>
        </td></tr>
        <tr><td style="padding:32px">
          <h2 style="margin:0 0 16px;color:#1a1a2e;font-size:20px;font-weight:600">License Created</h2>
          <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.6">Hello {{customer_name}},</p>
          <p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.6">Your license for <strong style="color:#1a1a2e">{{product_name}}</strong> has been successfully created. You can now activate and use the software on your authorized devices.</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fb;border-radius:8px;margin:16px 0;border:1px solid #e8ecf1">
            <tr><td style="padding:8px 16px;font-size:13px;color:#555;border-bottom:1px solid #eee;white-space:nowrap;vertical-align:top;font-weight:500">Product</td><td style="padding:8px 16px;font-size:13px;color:#1a1a2e;border-bottom:1px solid #eee;width:100%">{{product_name}}</td></tr>
            <tr><td style="padding:8px 16px;font-size:13px;color:#555;border-bottom:1px solid #eee;white-space:nowrap;vertical-align:top;font-weight:500">Plan</td><td style="padding:8px 16px;font-size:13px;color:#1a1a2e;border-bottom:1px solid #eee;width:100%">{{plan_name}}</td></tr>
            <tr><td style="padding:8px 16px;font-size:13px;color:#555;border-bottom:1px solid #eee;white-space:nowrap;vertical-align:top;font-weight:500">License Key</td><td style="padding:8px 16px;font-size:13px;color:#1a1a2e;border-bottom:1px solid #eee;width:100%"><code style="background:#eef2f7;padding:2px 8px;border-radius:4px;font-size:13px">{{license_key}}</code></td></tr>
            <tr><td style="padding:8px 16px;font-size:13px;color:#555;border-bottom:1px solid #eee;white-space:nowrap;vertical-align:top;font-weight:500">Expiry Date</td><td style="padding:8px 16px;font-size:13px;color:#1a1a2e;border-bottom:1px solid #eee;width:100%">{{expiry_date}}</td></tr>
          </table>
          <p style="margin:12px 0;font-size:14px;color:#555;line-height:1.6">To get started, download your software and activate it using the license key above. Detailed activation instructions can be found in our documentation.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0"><tr><td style="background:#4a90d9;border-radius:6px;padding:0"><a href="{{website}}/docs" style="display:inline-block;padding:12px 28px;color:#fff;text-decoration:none;font-size:14px;font-weight:600;border-radius:6px">View Documentation</a></td></tr></table>
          <p style="margin:8px 0 0;font-size:13px;color:#8899aa;font-style:italic">If you have any trouble activating your license, please reach out to our support team and we will be happy to assist you.</p>
        </td></tr>
        <tr><td style="background-color:#f8f9fb;padding:24px 32px;border-top:1px solid #e8ecf1">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="text-align:center;font-size:13px;color:#8899aa;line-height:1.6">
            <p style="margin:0 0 8px;font-weight:600;color:#555">WebSmith License Management</p>
            <p style="margin:0 0 4px">Need help? Contact our support team at <a href="mailto:{{support_email}}" style="color:#4a90d9;text-decoration:none">{{support_email}}</a></p>
            <p style="margin:0 0 4px">Visit our website: <a href="{{website}}" style="color:#4a90d9;text-decoration:none">{{website}}</a></p>
            <p style="margin:12px 0 0;font-size:11px;color:#aab">© 2026 WebSmith. All rights reserved. | This is an automated message, please do not reply directly.</p>
          </td></tr></table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    plain_text: `Hello {{customer_name}},

Your license for {{product_name}} has been successfully created. You can now activate and use the software on your authorized devices.

Product: {{product_name}}
Plan: {{plan_name}}
License Key: {{license_key}}
Expiry Date: {{expiry_date}}

To get started, download your software and activate it using the license key above. Detailed activation instructions can be found in our documentation.

If you have any trouble activating your license, please reach out to our support team.

Best regards,
The WebSmith Team`
  },
  {
    email_type: "trial_started",
    subject: "Your {{product}} Free Trial Has Started",
    body: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9">
    <tr><td align="center" style="padding:24px 16px">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06)">
        <tr><td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:28px 32px;text-align:center">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px">WebSmith</h1>
          <p style="margin:4px 0 0;color:#8899bb;font-size:13px">License Management Platform</p>
        </td></tr>
        <tr><td style="padding:32px">
          <h2 style="margin:0 0 16px;color:#1a1a2e;font-size:20px;font-weight:600">Trial Started</h2>
          <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.6">Welcome {{customer_name}}! Thank you for trying <strong style="color:#1a1a2e">{{product_name}}</strong>.</p>
          <p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.6">Your free trial is now active. The trial period begins counting down from the moment you first activate the software on your device, giving you the full trial duration to explore all features.</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fb;border-radius:8px;margin:16px 0;border:1px solid #e8ecf1">
            <tr><td style="padding:8px 16px;font-size:13px;color:#555;border-bottom:1px solid #eee;white-space:nowrap;vertical-align:top;font-weight:500">Product</td><td style="padding:8px 16px;font-size:13px;color:#1a1a2e;border-bottom:1px solid #eee;width:100%">{{product_name}}</td></tr>
            <tr><td style="padding:8px 16px;font-size:13px;color:#555;border-bottom:1px solid #eee;white-space:nowrap;vertical-align:top;font-weight:500">Plan</td><td style="padding:8px 16px;font-size:13px;color:#1a1a2e;border-bottom:1px solid #eee;width:100%">{{plan_name}}</td></tr>
            <tr><td style="padding:8px 16px;font-size:13px;color:#555;border-bottom:1px solid #eee;white-space:nowrap;vertical-align:top;font-weight:500">Trial Expiry</td><td style="padding:8px 16px;font-size:13px;color:#1a1a2e;border-bottom:1px solid #eee;width:100%">{{expiry_date}}</td></tr>
            <tr><td style="padding:8px 16px;font-size:13px;color:#555;border-bottom:1px solid #eee;white-space:nowrap;vertical-align:top;font-weight:500">Days Remaining</td><td style="padding:8px 16px;font-size:13px;color:#1a1a2e;border-bottom:1px solid #eee;width:100%">{{days_remaining}}</td></tr>
          </table>
          <p style="margin:12px 0;font-size:14px;color:#555;line-height:1.6">During your trial you have access to all the features included in the plan. If you have any questions or need assistance getting started, our documentation and support team are here to help.</p>
          <p style="margin:8px 0 0;font-size:13px;color:#8899aa;font-style:italic">No payment information is required for the trial. You will not be charged unless you decide to purchase a license after the trial period.</p>
        </td></tr>
        <tr><td style="background-color:#f8f9fb;padding:24px 32px;border-top:1px solid #e8ecf1">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="text-align:center;font-size:13px;color:#8899aa;line-height:1.6">
            <p style="margin:0 0 8px;font-weight:600;color:#555">WebSmith License Management</p>
            <p style="margin:0 0 4px">Need help? Contact our support team at <a href="mailto:{{support_email}}" style="color:#4a90d9;text-decoration:none">{{support_email}}</a></p>
            <p style="margin:0 0 4px">Visit our website: <a href="{{website}}" style="color:#4a90d9;text-decoration:none">{{website}}</a></p>
            <p style="margin:12px 0 0;font-size:11px;color:#aab">© 2026 WebSmith. All rights reserved. | This is an automated message, please do not reply directly.</p>
          </td></tr></table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    plain_text: `Welcome {{customer_name}}! Thank you for trying {{product_name}}.

Your free trial is now active. The trial period begins counting down from the moment you first activate the software on your device, giving you the full trial duration to explore all features.

Product: {{product_name}}
Plan: {{plan_name}}
Trial Expiry: {{expiry_date}}
Days Remaining: {{days_remaining}}

During your trial you have access to all the features included in the plan. If you have any questions or need assistance getting started, our documentation and support team are here to help.

No payment information is required for the trial. You will not be charged unless you decide to purchase a license after the trial period.

Best regards,
The WebSmith Team`
  },
  {
    email_type: "activation_success",
    subject: "Device Activated Successfully",
    body: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9">
    <tr><td align="center" style="padding:24px 16px">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06)">
        <tr><td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:28px 32px;text-align:center">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px">WebSmith</h1>
          <p style="margin:4px 0 0;color:#8899bb;font-size:13px">License Management Platform</p>
        </td></tr>
        <tr><td style="padding:32px">
          <h2 style="margin:0 0 16px;color:#1a1a2e;font-size:20px;font-weight:600">Activation Successful</h2>
          <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.6">Hello {{customer_name}},</p>
          <p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.6">Your license has been successfully activated. You can now start using the software immediately.</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fb;border-radius:8px;margin:16px 0;border:1px solid #e8ecf1">
            <tr><td style="padding:8px 16px;font-size:13px;color:#555;border-bottom:1px solid #eee;white-space:nowrap;vertical-align:top;font-weight:500">License Key</td><td style="padding:8px 16px;font-size:13px;color:#1a1a2e;border-bottom:1px solid #eee;width:100%"><code style="background:#eef2f7;padding:2px 8px;border-radius:4px;font-size:13px">{{license_key}}</code></td></tr>
            <tr><td style="padding:8px 16px;font-size:13px;color:#555;border-bottom:1px solid #eee;white-space:nowrap;vertical-align:top;font-weight:500">Activated Device</td><td style="padding:8px 16px;font-size:13px;color:#1a1a2e;border-bottom:1px solid #eee;width:100%">{{device_name}}</td></tr>
            <tr><td style="padding:8px 16px;font-size:13px;color:#555;border-bottom:1px solid #eee;white-space:nowrap;vertical-align:top;font-weight:500">Activation Date</td><td style="padding:8px 16px;font-size:13px;color:#1a1a2e;border-bottom:1px solid #eee;width:100%">{{activation_date}}</td></tr>
          </table>
          <p style="margin:12px 0;font-size:14px;color:#555;line-height:1.6">You can manage your devices, view your license details, and access support resources anytime through your account dashboard.</p>
        </td></tr>
        <tr><td style="background-color:#f8f9fb;padding:24px 32px;border-top:1px solid #e8ecf1">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="text-align:center;font-size:13px;color:#8899aa;line-height:1.6">
            <p style="margin:0 0 8px;font-weight:600;color:#555">WebSmith License Management</p>
            <p style="margin:0 0 4px">Need help? Contact our support team at <a href="mailto:{{support_email}}" style="color:#4a90d9;text-decoration:none">{{support_email}}</a></p>
            <p style="margin:0 0 4px">Visit our website: <a href="{{website}}" style="color:#4a90d9;text-decoration:none">{{website}}</a></p>
            <p style="margin:12px 0 0;font-size:11px;color:#aab">© 2026 WebSmith. All rights reserved. | This is an automated message, please do not reply directly.</p>
          </td></tr></table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    plain_text: `Hello {{customer_name}},

Your license has been successfully activated. You can now start using the software immediately.

License Key: {{license_key}}
Activated Device: {{device_name}}
Activation Date: {{activation_date}}

You can manage your devices, view your license details, and access support resources anytime through your account dashboard.

Best regards,
The WebSmith Team`
  },
  {
    email_type: "activation_failed",
    subject: "Device Activation Failed",
    body: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9">
    <tr><td align="center" style="padding:24px 16px">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06)">
        <tr><td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:28px 32px;text-align:center">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px">WebSmith</h1>
          <p style="margin:4px 0 0;color:#8899bb;font-size:13px">License Management Platform</p>
        </td></tr>
        <tr><td style="padding:32px">
          <h2 style="margin:0 0 16px;color:#1a1a2e;font-size:20px;font-weight:600">Activation Failed</h2>
          <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.6">Hello {{customer_name}},</p>
          <p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.6">We were unable to activate your license on the requested device. Please review the details below and try the recommended steps.</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fb;border-radius:8px;margin:16px 0;border:1px solid #e8ecf1">
            <tr><td style="padding:8px 16px;font-size:13px;color:#555;border-bottom:1px solid #eee;white-space:nowrap;vertical-align:top;font-weight:500">License Key</td><td style="padding:8px 16px;font-size:13px;color:#1a1a2e;border-bottom:1px solid #eee;width:100%"><code style="background:#eef2f7;padding:2px 8px;border-radius:4px;font-size:13px">{{license_key}}</code></td></tr>
            <tr><td style="padding:8px 16px;font-size:13px;color:#555;border-bottom:1px solid #eee;white-space:nowrap;vertical-align:top;font-weight:500">Error</td><td style="padding:8px 16px;font-size:13px;color:#1a1a2e;border-bottom:1px solid #eee;width:100%">{{reason}}</td></tr>
          </table>
          <p style="margin:12px 0;font-size:14px;color:#555;line-height:1.6"><strong style="color:#1a1a2e">Troubleshooting steps:</strong></p>
          <ol style="margin:8px 0 12px;padding-left:20px;font-size:14px;color:#555;line-height:1.8">
            <li>Ensure your device has a stable internet connection</li>
            <li>Verify that the license key is entered correctly</li>
            <li>Check that your system meets the minimum software requirements</li>
            <li>Disable any VPN or firewall that may be blocking the activation server</li>
            <li>Try restarting the application and attempting activation again</li>
          </ol>
          <p style="margin:12px 0;font-size:14px;color:#555;line-height:1.6">If the problem persists after trying these steps, please contact our support team with the error details above and we will investigate further.</p>
        </td></tr>
        <tr><td style="background-color:#f8f9fb;padding:24px 32px;border-top:1px solid #e8ecf1">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="text-align:center;font-size:13px;color:#8899aa;line-height:1.6">
            <p style="margin:0 0 8px;font-weight:600;color:#555">WebSmith License Management</p>
            <p style="margin:0 0 4px">Need help? Contact our support team at <a href="mailto:{{support_email}}" style="color:#4a90d9;text-decoration:none">{{support_email}}</a></p>
            <p style="margin:0 0 4px">Visit our website: <a href="{{website}}" style="color:#4a90d9;text-decoration:none">{{website}}</a></p>
            <p style="margin:12px 0 0;font-size:11px;color:#aab">© 2026 WebSmith. All rights reserved. | This is an automated message, please do not reply directly.</p>
          </td></tr></table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    plain_text: `Hello {{customer_name}},

We were unable to activate your license on the requested device. Please review the details below and try the recommended steps.

License Key: {{license_key}}
Error: {{reason}}

Troubleshooting steps:
1. Ensure your device has a stable internet connection
2. Verify that the license key is entered correctly
3. Check that your system meets the minimum software requirements
4. Disable any VPN or firewall that may be blocking the activation server
5. Try restarting the application and attempting activation again

If the problem persists after trying these steps, please contact our support team with the error details above and we will investigate further.

Best regards,
The WebSmith Team`
  },
  {
    email_type: "license_renewed",
    subject: "Your {{product}} License Has Been Renewed",
    body: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9">
    <tr><td align="center" style="padding:24px 16px">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06)">
        <tr><td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:28px 32px;text-align:center">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px">WebSmith</h1>
          <p style="margin:4px 0 0;color:#8899bb;font-size:13px">License Management Platform</p>
        </td></tr>
        <tr><td style="padding:32px">
          <h2 style="margin:0 0 16px;color:#1a1a2e;font-size:20px;font-weight:600">License Renewed</h2>
          <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.6">Hello {{customer_name}},</p>
          <p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.6">Thank you for renewing your license. Your continued trust in <strong style="color:#1a1a2e">{{product_name}}</strong> means a lot to us.</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fb;border-radius:8px;margin:16px 0;border:1px solid #e8ecf1">
            <tr><td style="padding:8px 16px;font-size:13px;color:#555;border-bottom:1px solid #eee;white-space:nowrap;vertical-align:top;font-weight:500">Product</td><td style="padding:8px 16px;font-size:13px;color:#1a1a2e;border-bottom:1px solid #eee;width:100%">{{product_name}}</td></tr>
            <tr><td style="padding:8px 16px;font-size:13px;color:#555;border-bottom:1px solid #eee;white-space:nowrap;vertical-align:top;font-weight:500">Plan</td><td style="padding:8px 16px;font-size:13px;color:#1a1a2e;border-bottom:1px solid #eee;width:100%">{{plan_name}}</td></tr>
            <tr><td style="padding:8px 16px;font-size:13px;color:#555;border-bottom:1px solid #eee;white-space:nowrap;vertical-align:top;font-weight:500">License Key</td><td style="padding:8px 16px;font-size:13px;color:#1a1a2e;border-bottom:1px solid #eee;width:100%"><code style="background:#eef2f7;padding:2px 8px;border-radius:4px;font-size:13px">{{license_key}}</code></td></tr>
            <tr><td style="padding:8px 16px;font-size:13px;color:#555;border-bottom:1px solid #eee;white-space:nowrap;vertical-align:top;font-weight:500">New Expiry Date</td><td style="padding:8px 16px;font-size:13px;color:#1a1a2e;border-bottom:1px solid #eee;width:100%">{{expiry_date}}</td></tr>
          </table>
          <p style="margin:12px 0;font-size:14px;color:#555;line-height:1.6">Your renewed license is active immediately with an updated expiry date. No further action is needed on your part — you can continue using the software without interruption.</p>
          <p style="margin:8px 0 0;font-size:13px;color:#8899aa;font-style:italic">We appreciate your business and are committed to providing you with the best possible experience.</p>
        </td></tr>
        <tr><td style="background-color:#f8f9fb;padding:24px 32px;border-top:1px solid #e8ecf1">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="text-align:center;font-size:13px;color:#8899aa;line-height:1.6">
            <p style="margin:0 0 8px;font-weight:600;color:#555">WebSmith License Management</p>
            <p style="margin:0 0 4px">Need help? Contact our support team at <a href="mailto:{{support_email}}" style="color:#4a90d9;text-decoration:none">{{support_email}}</a></p>
            <p style="margin:0 0 4px">Visit our website: <a href="{{website}}" style="color:#4a90d9;text-decoration:none">{{website}}</a></p>
            <p style="margin:12px 0 0;font-size:11px;color:#aab">© 2026 WebSmith. All rights reserved. | This is an automated message, please do not reply directly.</p>
          </td></tr></table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    plain_text: `Hello {{customer_name}},

Thank you for renewing your license. Your continued trust in {{product_name}} means a lot to us.

Product: {{product_name}}
Plan: {{plan_name}}
License Key: {{license_key}}
New Expiry Date: {{expiry_date}}

Your renewed license is active immediately with an updated expiry date. No further action is needed on your part — you can continue using the software without interruption.

We appreciate your business and are committed to providing you with the best possible experience.

Best regards,
The WebSmith Team`
  },
  {
    email_type: "license_expired",
    subject: "Your {{product}} License Has Expired",
    body: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9">
    <tr><td align="center" style="padding:24px 16px">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06)">
        <tr><td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:28px 32px;text-align:center">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px">WebSmith</h1>
          <p style="margin:4px 0 0;color:#8899bb;font-size:13px">License Management Platform</p>
        </td></tr>
        <tr><td style="padding:32px">
          <h2 style="margin:0 0 16px;color:#1a1a2e;font-size:20px;font-weight:600">License Expired</h2>
          <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.6">Hello {{customer_name}},</p>
          <p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.6">Your license for <strong style="color:#1a1a2e">{{product_name}}</strong> has expired. Protected features may no longer be accessible.</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fb;border-radius:8px;margin:16px 0;border:1px solid #e8ecf1">
            <tr><td style="padding:8px 16px;font-size:13px;color:#555;border-bottom:1px solid #eee;white-space:nowrap;vertical-align:top;font-weight:500">Product</td><td style="padding:8px 16px;font-size:13px;color:#1a1a2e;border-bottom:1px solid #eee;width:100%">{{product_name}}</td></tr>
            <tr><td style="padding:8px 16px;font-size:13px;color:#555;border-bottom:1px solid #eee;white-space:nowrap;vertical-align:top;font-weight:500">License Key</td><td style="padding:8px 16px;font-size:13px;color:#1a1a2e;border-bottom:1px solid #eee;width:100%"><code style="background:#eef2f7;padding:2px 8px;border-radius:4px;font-size:13px">{{license_key}}</code></td></tr>
            <tr><td style="padding:8px 16px;font-size:13px;color:#555;border-bottom:1px solid #eee;white-space:nowrap;vertical-align:top;font-weight:500">Expired On</td><td style="padding:8px 16px;font-size:13px;color:#1a1a2e;border-bottom:1px solid #eee;width:100%">{{expiry_date}}</td></tr>
          </table>
          <p style="margin:12px 0;font-size:14px;color:#555;line-height:1.6">To regain access to all features, please renew your license at your earliest convenience. Renewing is quick and easy — simply visit your account dashboard and follow the renewal instructions.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0"><tr><td style="background:#4a90d9;border-radius:6px;padding:0"><a href="{{website}}/renew" style="display:inline-block;padding:12px 28px;color:#fff;text-decoration:none;font-size:14px;font-weight:600;border-radius:6px">Renew Now</a></td></tr></table>
          <p style="margin:8px 0 0;font-size:13px;color:#8899aa;font-style:italic">If you have already renewed, please disregard this message. If you believe this is an error, contact our support team.</p>
        </td></tr>
        <tr><td style="background-color:#f8f9fb;padding:24px 32px;border-top:1px solid #e8ecf1">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="text-align:center;font-size:13px;color:#8899aa;line-height:1.6">
            <p style="margin:0 0 8px;font-weight:600;color:#555">WebSmith License Management</p>
            <p style="margin:0 0 4px">Need help? Contact our support team at <a href="mailto:{{support_email}}" style="color:#4a90d9;text-decoration:none">{{support_email}}</a></p>
            <p style="margin:0 0 4px">Visit our website: <a href="{{website}}" style="color:#4a90d9;text-decoration:none">{{website}}</a></p>
            <p style="margin:12px 0 0;font-size:11px;color:#aab">© 2026 WebSmith. All rights reserved. | This is an automated message, please do not reply directly.</p>
          </td></tr></table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    plain_text: `Hello {{customer_name}},

Your license for {{product_name}} has expired. Protected features may no longer be accessible.

Product: {{product_name}}
License Key: {{license_key}}
Expired On: {{expiry_date}}

To regain access to all features, please renew your license at your earliest convenience. Renewing is quick and easy — simply visit your account dashboard and follow the renewal instructions.

If you have already renewed, please disregard this message. If you believe this is an error, contact our support team.

Best regards,
The WebSmith Team`
  },
  {
    email_type: "license_revoked",
    subject: "Your License Has Been Revoked",
    body: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9">
    <tr><td align="center" style="padding:24px 16px">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06)">
        <tr><td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:28px 32px;text-align:center">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px">WebSmith</h1>
          <p style="margin:4px 0 0;color:#8899bb;font-size:13px">License Management Platform</p>
        </td></tr>
        <tr><td style="padding:32px">
          <h2 style="margin:0 0 16px;color:#1a1a2e;font-size:20px;font-weight:600">License Revoked</h2>
          <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.6">Hello {{customer_name}},</p>
          <p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.6">This email is to inform you that the following license has been revoked. The software can no longer be activated or used with this license key.</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fb;border-radius:8px;margin:16px 0;border:1px solid #e8ecf1">
            <tr><td style="padding:8px 16px;font-size:13px;color:#555;border-bottom:1px solid #eee;white-space:nowrap;vertical-align:top;font-weight:500">License Key</td><td style="padding:8px 16px;font-size:13px;color:#1a1a2e;border-bottom:1px solid #eee;width:100%"><code style="background:#eef2f7;padding:2px 8px;border-radius:4px;font-size:13px">{{license_key}}</code></td></tr>
            <tr><td style="padding:8px 16px;font-size:13px;color:#555;border-bottom:1px solid #eee;white-space:nowrap;vertical-align:top;font-weight:500">Product</td><td style="padding:8px 16px;font-size:13px;color:#1a1a2e;border-bottom:1px solid #eee;width:100%">{{product_name}}</td></tr>
          </table>
          <p style="margin:12px 0;font-size:14px;color:#555;line-height:1.6">If you believe this action was taken in error, or if you have any questions about this revocation, please contact our support team immediately and we will review the situation.</p>
          <p style="margin:8px 0 0;font-size:13px;color:#8899aa;font-style:italic">We take license management seriously to protect our customers and their software investments.</p>
        </td></tr>
        <tr><td style="background-color:#f8f9fb;padding:24px 32px;border-top:1px solid #e8ecf1">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="text-align:center;font-size:13px;color:#8899aa;line-height:1.6">
            <p style="margin:0 0 8px;font-weight:600;color:#555">WebSmith License Management</p>
            <p style="margin:0 0 4px">Need help? Contact our support team at <a href="mailto:{{support_email}}" style="color:#4a90d9;text-decoration:none">{{support_email}}</a></p>
            <p style="margin:0 0 4px">Visit our website: <a href="{{website}}" style="color:#4a90d9;text-decoration:none">{{website}}</a></p>
            <p style="margin:12px 0 0;font-size:11px;color:#aab">© 2026 WebSmith. All rights reserved. | This is an automated message, please do not reply directly.</p>
          </td></tr></table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    plain_text: `Hello {{customer_name}},

This email is to inform you that the following license has been revoked. The software can no longer be activated or used with this license key.

License Key: {{license_key}}
Product: {{product_name}}

If you believe this action was taken in error, or if you have any questions about this revocation, please contact our support team immediately and we will review the situation.

We take license management seriously to protect our customers and their software investments.

Best regards,
The WebSmith Team`
  },
  {
    email_type: "device_reset",
    subject: "Device Reset Successful",
    body: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9">
    <tr><td align="center" style="padding:24px 16px">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06)">
        <tr><td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:28px 32px;text-align:center">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px">WebSmith</h1>
          <p style="margin:4px 0 0;color:#8899bb;font-size:13px">License Management Platform</p>
        </td></tr>
        <tr><td style="padding:32px">
          <h2 style="margin:0 0 16px;color:#1a1a2e;font-size:20px;font-weight:600">Device Reset Successful</h2>
          <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.6">Hello {{customer_name}},</p>
          <p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.6">The device binding for your license has been reset successfully. You may now activate the license on another supported device.</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fb;border-radius:8px;margin:16px 0;border:1px solid #e8ecf1">
            <tr><td style="padding:8px 16px;font-size:13px;color:#555;border-bottom:1px solid #eee;white-space:nowrap;vertical-align:top;font-weight:500">License Key</td><td style="padding:8px 16px;font-size:13px;color:#1a1a2e;border-bottom:1px solid #eee;width:100%"><code style="background:#eef2f7;padding:2px 8px;border-radius:4px;font-size:13px">{{license_key}}</code></td></tr>
            <tr><td style="padding:8px 16px;font-size:13px;color:#555;border-bottom:1px solid #eee;white-space:nowrap;vertical-align:top;font-weight:500">Previous Device</td><td style="padding:8px 16px;font-size:13px;color:#1a1a2e;border-bottom:1px solid #eee;width:100%">{{device_name}}</td></tr>
          </table>
          <p style="margin:12px 0;font-size:14px;color:#555;line-height:1.6">Please note that your license may have a limit on the number of devices that can be activated simultaneously. You can check your current activation status and manage your devices from your account dashboard.</p>
        </td></tr>
        <tr><td style="background-color:#f8f9fb;padding:24px 32px;border-top:1px solid #e8ecf1">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="text-align:center;font-size:13px;color:#8899aa;line-height:1.6">
            <p style="margin:0 0 8px;font-weight:600;color:#555">WebSmith License Management</p>
            <p style="margin:0 0 4px">Need help? Contact our support team at <a href="mailto:{{support_email}}" style="color:#4a90d9;text-decoration:none">{{support_email}}</a></p>
            <p style="margin:0 0 4px">Visit our website: <a href="{{website}}" style="color:#4a90d9;text-decoration:none">{{website}}</a></p>
            <p style="margin:12px 0 0;font-size:11px;color:#aab">© 2026 WebSmith. All rights reserved. | This is an automated message, please do not reply directly.</p>
          </td></tr></table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    plain_text: `Hello {{customer_name}},

The device binding for your license has been reset successfully. You may now activate the license on another supported device.

License Key: {{license_key}}
Previous Device: {{device_name}}

Please note that your license may have a limit on the number of devices that can be activated simultaneously. You can check your current activation status and manage your devices from your account dashboard.

Best regards,
The WebSmith Team`
  },
  {
    email_type: "device_changed",
    subject: "Device Change Detected on Your License",
    body: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9">
    <tr><td align="center" style="padding:24px 16px">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06)">
        <tr><td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:28px 32px;text-align:center">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px">WebSmith</h1>
          <p style="margin:4px 0 0;color:#8899bb;font-size:13px">License Management Platform</p>
        </td></tr>
        <tr><td style="padding:32px">
          <h2 style="margin:0 0 16px;color:#1a1a2e;font-size:20px;font-weight:600">Device Change Detected</h2>
          <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.6">Hello {{customer_name}},</p>
          <p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.6">We detected that a different device has been associated with your license. This notification is sent to keep you informed about activity on your account.</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fb;border-radius:8px;margin:16px 0;border:1px solid #e8ecf1">
            <tr><td style="padding:8px 16px;font-size:13px;color:#555;border-bottom:1px solid #eee;white-space:nowrap;vertical-align:top;font-weight:500">License Key</td><td style="padding:8px 16px;font-size:13px;color:#1a1a2e;border-bottom:1px solid #eee;width:100%"><code style="background:#eef2f7;padding:2px 8px;border-radius:4px;font-size:13px">{{license_key}}</code></td></tr>
            <tr><td style="padding:8px 16px;font-size:13px;color:#555;border-bottom:1px solid #eee;white-space:nowrap;vertical-align:top;font-weight:500">Detected Device</td><td style="padding:8px 16px;font-size:13px;color:#1a1a2e;border-bottom:1px solid #eee;width:100%">{{device_name}}</td></tr>
            <tr><td style="padding:8px 16px;font-size:13px;color:#555;border-bottom:1px solid #eee;white-space:nowrap;vertical-align:top;font-weight:500">Date</td><td style="padding:8px 16px;font-size:13px;color:#1a1a2e;border-bottom:1px solid #eee;width:100%">{{activation_date}}</td></tr>
          </table>
          <p style="margin:12px 0;font-size:14px;color:#555;line-height:1.6"><strong style="color:#cc3333">If you did not authorize this change:</strong> Please contact our support team immediately so we can secure your license and investigate any unauthorized activity.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0"><tr><td style="background:#cc3333;border-radius:6px;padding:0"><a href="mailto:{{support_email}}" style="display:inline-block;padding:12px 28px;color:#fff;text-decoration:none;font-size:14px;font-weight:600;border-radius:6px">Contact Support</a></td></tr></table>
          <p style="margin:8px 0 0;font-size:13px;color:#8899aa;font-style:italic">If this was you, no action is needed. You can continue using the software as normal.</p>
        </td></tr>
        <tr><td style="background-color:#f8f9fb;padding:24px 32px;border-top:1px solid #e8ecf1">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="text-align:center;font-size:13px;color:#8899aa;line-height:1.6">
            <p style="margin:0 0 8px;font-weight:600;color:#555">WebSmith License Management</p>
            <p style="margin:0 0 4px">Need help? Contact our support team at <a href="mailto:{{support_email}}" style="color:#4a90d9;text-decoration:none">{{support_email}}</a></p>
            <p style="margin:0 0 4px">Visit our website: <a href="{{website}}" style="color:#4a90d9;text-decoration:none">{{website}}</a></p>
            <p style="margin:12px 0 0;font-size:11px;color:#aab">© 2026 WebSmith. All rights reserved. | This is an automated message, please do not reply directly.</p>
          </td></tr></table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    plain_text: `Hello {{customer_name}},

We detected that a different device has been associated with your license. This notification is sent to keep you informed about activity on your account.

License Key: {{license_key}}
Detected Device: {{device_name}}
Date: {{activation_date}}

*** If you did not authorize this change: ***
Please contact our support team immediately so we can secure your license and investigate any unauthorized activity.

If this was you, no action is needed. You can continue using the software as normal.

Best regards,
The WebSmith Team`
  },
  {
    email_type: "payment_success",
    subject: "Payment Successful – Thank You!",
    body: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9">
    <tr><td align="center" style="padding:24px 16px">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06)">
        <tr><td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:28px 32px;text-align:center">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px">WebSmith</h1>
          <p style="margin:4px 0 0;color:#8899bb;font-size:13px">License Management Platform</p>
        </td></tr>
        <tr><td style="padding:32px">
          <h2 style="margin:0 0 16px;color:#1a1a2e;font-size:20px;font-weight:600">Payment Received</h2>
          <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.6">Hello {{customer_name}},</p>
          <p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.6">Thank you for your purchase! We have received your payment successfully. Your transaction details are provided below for your records.</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fb;border-radius:8px;margin:16px 0;border:1px solid #e8ecf1">
            <tr><td style="padding:8px 16px;font-size:13px;color:#555;border-bottom:1px solid #eee;white-space:nowrap;vertical-align:top;font-weight:500">Product</td><td style="padding:8px 16px;font-size:13px;color:#1a1a2e;border-bottom:1px solid #eee;width:100%">{{product_name}}</td></tr>
            <tr><td style="padding:8px 16px;font-size:13px;color:#555;border-bottom:1px solid #eee;white-space:nowrap;vertical-align:top;font-weight:500">Plan</td><td style="padding:8px 16px;font-size:13px;color:#1a1a2e;border-bottom:1px solid #eee;width:100%">{{plan_name}}</td></tr>
            <tr><td style="padding:8px 16px;font-size:13px;color:#555;border-bottom:1px solid #eee;white-space:nowrap;vertical-align:top;font-weight:500">Amount Paid</td><td style="padding:8px 16px;font-size:13px;color:#1a1a2e;border-bottom:1px solid #eee;width:100%">\${{amount}}</td></tr>
          </table>
          <p style="margin:12px 0;font-size:14px;color:#555;line-height:1.6">Your license is now active and ready to use. If you purchased a subscription, it will automatically renew according to the terms selected during checkout.</p>
          <p style="margin:12px 0;font-size:14px;color:#555;line-height:1.6">A receipt has been generated and is available in your account dashboard. For any billing inquiries, please contact our support team.</p>
          <p style="margin:8px 0 0;font-size:13px;color:#8899aa;font-style:italic">We appreciate your business and are excited to have you on board!</p>
        </td></tr>
        <tr><td style="background-color:#f8f9fb;padding:24px 32px;border-top:1px solid #e8ecf1">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="text-align:center;font-size:13px;color:#8899aa;line-height:1.6">
            <p style="margin:0 0 8px;font-weight:600;color:#555">WebSmith License Management</p>
            <p style="margin:0 0 4px">Need help? Contact our support team at <a href="mailto:{{support_email}}" style="color:#4a90d9;text-decoration:none">{{support_email}}</a></p>
            <p style="margin:0 0 4px">Visit our website: <a href="{{website}}" style="color:#4a90d9;text-decoration:none">{{website}}</a></p>
            <p style="margin:12px 0 0;font-size:11px;color:#aab">© 2026 WebSmith. All rights reserved. | This is an automated message, please do not reply directly.</p>
          </td></tr></table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    plain_text: `Hello {{customer_name}},

Thank you for your purchase! We have received your payment successfully. Your transaction details are provided below for your records.

Product: {{product_name}}
Plan: {{plan_name}}
Amount Paid: \${{amount}}

Your license is now active and ready to use. If you purchased a subscription, it will automatically renew according to the terms selected during checkout.

A receipt has been generated and is available in your account dashboard. For any billing inquiries, please contact our support team.

We appreciate your business and are excited to have you on board!

Best regards,
The WebSmith Team`
  },
  {
    email_type: "subscription_reminder",
    subject: "Reminder: Your {{product}} Subscription Renews Soon",
    body: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9">
    <tr><td align="center" style="padding:24px 16px">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06)">
        <tr><td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:28px 32px;text-align:center">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px">WebSmith</h1>
          <p style="margin:4px 0 0;color:#8899bb;font-size:13px">License Management Platform</p>
        </td></tr>
        <tr><td style="padding:32px">
          <h2 style="margin:0 0 16px;color:#1a1a2e;font-size:20px;font-weight:600">Renewal Reminder</h2>
          <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.6">Hello {{customer_name}},</p>
          <p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.6">This is a friendly reminder that your subscription for <strong style="color:#1a1a2e">{{product_name}}</strong> is approaching its renewal date. To ensure uninterrupted service, please renew before your current period expires.</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fb;border-radius:8px;margin:16px 0;border:1px solid #e8ecf1">
            <tr><td style="padding:8px 16px;font-size:13px;color:#555;border-bottom:1px solid #eee;white-space:nowrap;vertical-align:top;font-weight:500">Product</td><td style="padding:8px 16px;font-size:13px;color:#1a1a2e;border-bottom:1px solid #eee;width:100%">{{product_name}}</td></tr>
            <tr><td style="padding:8px 16px;font-size:13px;color:#555;border-bottom:1px solid #eee;white-space:nowrap;vertical-align:top;font-weight:500">Current Plan</td><td style="padding:8px 16px;font-size:13px;color:#1a1a2e;border-bottom:1px solid #eee;width:100%">{{plan_name}}</td></tr>
            <tr><td style="padding:8px 16px;font-size:13px;color:#555;border-bottom:1px solid #eee;white-space:nowrap;vertical-align:top;font-weight:500">Renewal Date</td><td style="padding:8px 16px;font-size:13px;color:#1a1a2e;border-bottom:1px solid #eee;width:100%">{{expiry_date}}</td></tr>
            <tr><td style="padding:8px 16px;font-size:13px;color:#555;border-bottom:1px solid #eee;white-space:nowrap;vertical-align:top;font-weight:500">License Key</td><td style="padding:8px 16px;font-size:13px;color:#1a1a2e;border-bottom:1px solid #eee;width:100%"><code style="background:#eef2f7;padding:2px 8px;border-radius:4px;font-size:13px">{{license_key}}</code></td></tr>
          </table>
          <p style="margin:12px 0;font-size:14px;color:#555;line-height:1.6">Renewing is quick and easy. Simply click the button below to be taken to your renewal portal where you can review and complete the process.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0"><tr><td style="background:#4a90d9;border-radius:6px;padding:0"><a href="{{website}}/renew" style="display:inline-block;padding:12px 28px;color:#fff;text-decoration:none;font-size:14px;font-weight:600;border-radius:6px">Renew Subscription</a></td></tr></table>
          <p style="margin:8px 0 0;font-size:13px;color:#8899aa;font-style:italic">If you have already renewed or have any questions, please disregard this reminder or contact our support team.</p>
        </td></tr>
        <tr><td style="background-color:#f8f9fb;padding:24px 32px;border-top:1px solid #e8ecf1">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="text-align:center;font-size:13px;color:#8899aa;line-height:1.6">
            <p style="margin:0 0 8px;font-weight:600;color:#555">WebSmith License Management</p>
            <p style="margin:0 0 4px">Need help? Contact our support team at <a href="mailto:{{support_email}}" style="color:#4a90d9;text-decoration:none">{{support_email}}</a></p>
            <p style="margin:0 0 4px">Visit our website: <a href="{{website}}" style="color:#4a90d9;text-decoration:none">{{website}}</a></p>
            <p style="margin:12px 0 0;font-size:11px;color:#aab">© 2026 WebSmith. All rights reserved. | This is an automated message, please do not reply directly.</p>
          </td></tr></table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    plain_text: `Hello {{customer_name}},

This is a friendly reminder that your subscription for {{product_name}} is approaching its renewal date. To ensure uninterrupted service, please renew before your current period expires.

Product: {{product_name}}
Current Plan: {{plan_name}}
Renewal Date: {{expiry_date}}
License Key: {{license_key}}

Renewing is quick and easy. Visit your renewal portal to review and complete the process.

If you have already renewed or have any questions, please disregard this reminder or contact our support team.

Best regards,
The WebSmith Team`
  },
  {
    email_type: "admin_notification",
    subject: "Administrator Notification",
    body: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9">
    <tr><td align="center" style="padding:24px 16px">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06)">
        <tr><td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:28px 32px;text-align:center">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px">WebSmith</h1>
          <p style="margin:4px 0 0;color:#8899bb;font-size:13px">License Management Platform</p>
        </td></tr>
        <tr><td style="padding:32px">
          <h2 style="margin:0 0 16px;color:#1a1a2e;font-size:20px;font-weight:600">System Notification</h2>
          <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.6">Hello Administrator,</p>
          <p style="margin:0 0 20px;font-size:14px;color:#555;line-height:1.6">The following system notification requires your attention:</p>
          <div style="background:#f0f4ff;border-left:4px solid #4a90d9;padding:16px 20px;margin:16px 0;border-radius:4px;font-size:14px;color:#333;line-height:1.6">
            {{message}}
          </div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fb;border-radius:8px;margin:16px 0;border:1px solid #e8ecf1">
            <tr><td style="padding:8px 16px;font-size:13px;color:#555;border-bottom:1px solid #eee;white-space:nowrap;vertical-align:top;font-weight:500">Customer</td><td style="padding:8px 16px;font-size:13px;color:#1a1a2e;border-bottom:1px solid #eee;width:100%">{{customer_name}}</td></tr>
            <tr><td style="padding:8px 16px;font-size:13px;color:#555;border-bottom:1px solid #eee;white-space:nowrap;vertical-align:top;font-weight:500">Email</td><td style="padding:8px 16px;font-size:13px;color:#1a1a2e;border-bottom:1px solid #eee;width:100%">{{customer_email}}</td></tr>
            <tr><td style="padding:8px 16px;font-size:13px;color:#555;border-bottom:1px solid #eee;white-space:nowrap;vertical-align:top;font-weight:500">Product</td><td style="padding:8px 16px;font-size:13px;color:#1a1a2e;border-bottom:1px solid #eee;width:100%">{{product_name}}</td></tr>
            <tr><td style="padding:8px 16px;font-size:13px;color:#555;border-bottom:1px solid #eee;white-space:nowrap;vertical-align:top;font-weight:500">License Key</td><td style="padding:8px 16px;font-size:13px;color:#1a1a2e;border-bottom:1px solid #eee;width:100%">{{license_key}}</td></tr>
          </table>
          <p style="margin:12px 0 0;font-size:13px;color:#8899aa">This is an automated administrative notification. Please review and take appropriate action if needed.</p>
        </td></tr>
        <tr><td style="background-color:#f8f9fb;padding:24px 32px;border-top:1px solid #e8ecf1">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="text-align:center;font-size:13px;color:#8899aa;line-height:1.6">
            <p style="margin:0 0 8px;font-weight:600;color:#555">WebSmith License Management</p>
            <p style="margin:0 0 4px">Need help? Contact our support team at <a href="mailto:{{support_email}}" style="color:#4a90d9;text-decoration:none">{{support_email}}</a></p>
            <p style="margin:0 0 4px">Visit our website: <a href="{{website}}" style="color:#4a90d9;text-decoration:none">{{website}}</a></p>
            <p style="margin:12px 0 0;font-size:11px;color:#aab">© 2026 WebSmith. All rights reserved. | This is an automated message, please do not reply directly.</p>
          </td></tr></table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    plain_text: `Hello Administrator,

The following system notification requires your attention:

{{message}}

Customer: {{customer_name}}
Email: {{customer_email}}
Product: {{product_name}}
License Key: {{license_key}}

This is an automated administrative notification. Please review and take appropriate action if needed.`
  }
];

export async function POST() {
  let client = null;
  try {
    client = await pool.connect();

    await client.query(`
      ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS plain_text TEXT DEFAULT ''
    `);

    let inserted = 0;
    let updated = 0;

    const brand = getBrandName();
    for (const tmpl of SEED_TEMPLATES) {
      const existing = await client.query(
        `SELECT id FROM email_templates WHERE email_type = $1`,
        [tmpl.email_type]
      );

      const subject = tmpl.subject.replaceAll('WebSmith', brand);
      const body = tmpl.body.replaceAll('WebSmith', brand);
      const plain_text = (tmpl.plain_text || '').replaceAll('WebSmith', brand);

      if (existing.rows.length === 0) {
        await client.query(
          `INSERT INTO email_templates (email_type, subject, body, plain_text, is_active, updated_at)
           VALUES ($1, $2, $3, $4, true, CURRENT_TIMESTAMP)`,
          [tmpl.email_type, subject, body, plain_text]
        );
        inserted++;
      } else {
        await client.query(
          `UPDATE email_templates SET subject = $2, body = $3, plain_text = $4, is_active = true, updated_at = CURRENT_TIMESTAMP WHERE email_type = $1`,
          [tmpl.email_type, subject, body, plain_text]
        );
        updated++;
      }
    }

    client.release();
    return NextResponse.json({
      success: true,
      message: `Seeded ${inserted} new templates, updated ${updated} existing templates`,
      inserted,
      updated,
    });

  } catch (error) {
    console.error("Seed templates error:", error);
    if (client) client.release();
    return NextResponse.json({ success: false, error: "Failed to seed templates" }, { status: 500 });
  }
}
