// C:\websmith\core\config\oauth.config.ts
// OAuth Configuration - Google & Yahoo OAuth Setup
// Features: OAuth client configuration for social logins

export const OAUTH_CONFIG = {
  google: {
    clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "",
    scope: "email profile",
    redirectUri: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/auth/google/callback`,
  },
  yahoo: {
    clientId: process.env.NEXT_PUBLIC_YAHOO_CLIENT_ID || "",
    scope: "openid email profile",
    redirectUri: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/auth/yahoo/callback`,
  },
};

// For development without credentials, use demo mode
export const DEMO_MODE = !process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;