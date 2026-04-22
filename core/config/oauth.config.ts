// C:\websmith\core\config\oauth.config.ts
// OAuth Configuration - Google & Yahoo OAuth Setup
// Features: OAuth client configuration for social logins

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://websmithdigital.com").replace(/\/$/, "");

export const OAUTH_CONFIG = {
  google: {
    clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "",
    scope: "email profile",
    redirectUri: `${APP_URL}/auth/google/callback`,
  },
  yahoo: {
    clientId: process.env.NEXT_PUBLIC_YAHOO_CLIENT_ID || "",
    scope: "openid email profile",
    redirectUri: `${APP_URL}/auth/yahoo/callback`,
  },
};

// For development without credentials, use demo mode
export const DEMO_MODE = !process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
