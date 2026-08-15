// Shared, client-safe Client Portal Greeting builder (Phase 5).
//
// The greeting is a professional, editable message inserted into the reply
// editor. It intentionally carries NO internal markers: the legacy
// `-- Client Portal Greeting --` / `-- End Client Portal Greeting --` markers
// were removed from the product so they can never appear in the editor output,
// in an email body, in a template, or in a database-generated customer message.
//
// This module is pure (no node:*, no bcrypt) so it can be used by both the
// admin React UI and the server-side ticket email helpers.

export function buildClientPortalGreeting(options: {
  name?: string;
  hasPortalAccount: boolean;
  portalUrl?: string;
}): string {
  const { name, hasPortalAccount, portalUrl } = options;
  const origin = (portalUrl || "https://www.websmithdigital.com").replace(/\/+$/, "");
  const accountLine = hasPortalAccount
    ? "Log in using the email address registered to your account and the password you set up. Websmith will never ask you to send passwords over email. If you have forgotten your password, use the \u201cForgot Password\u201d option on the login page to receive a secure reset code."
    : "If you have a Websmith Client Portal account, log in using your account email and password. Websmith will never ask you to send passwords over email. If you don't have an account yet, reply to this email and we will be happy to set one up for you.";

  return [
    `Hello ${name || "there"},`,
    "",
    "Thank you for contacting the Websmith Digital team \u2014 you have reached the right place.",
    "",
    "You can continue this conversation and keep track of your project through the Client Portal.",
    "",
    `Client Portal login: ${origin}/login`,
    "",
    accountLine,
    "",
    "Once logged in, open My Projects / Project Status to view the latest progress on your project.",
    "",
    "Best regards,",
    "The Websmith Digital Team",
  ].join("\n");
}
