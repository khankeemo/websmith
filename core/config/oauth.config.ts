// OAuth Configuration - Google & Yahoo OAuth Setup

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");

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
