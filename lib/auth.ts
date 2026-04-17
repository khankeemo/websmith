export type UserRole = "admin" | "client" | "developer";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  company?: string;
  avatar?: string;
  adminLevel?: "super" | "sub" | null;
  isTemporaryPassword?: boolean;
  setupCompleted?: boolean;
  preferences?: {
    theme: "light" | "dark";
    notifications: {
      email: boolean;
      push: boolean;
      projectUpdates?: boolean;
      queryResponses?: boolean;
    };
  };
  customId?: string;
}

const TOKEN_KEY = "token";
const USER_KEY = "user";

export const setAuthSession = (token: string, user: AuthUser) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const getToken = () => {
  if (typeof window === "undefined") {
    return null;
  }

  return localStorage.getItem(TOKEN_KEY);
};

export const getStoredUser = (): AuthUser | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = localStorage.getItem(USER_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
};

export const clearAuthSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

export const PUBLIC_PATHS = [
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/forgotpassword",
  "/reset-password",
  "/resetpassword",
  "/auth/callback",

  "/services",
  "/lead-form",
  "/success",
  "/auth/change-password",
  "/about",
  "/careers",
  "/blog",
  "/documentation",
  "/support",
  "/privacy",
  "/terms",
];


/**
 * Checks if a pathname is a public route, handling trailing slashes and casing.
 */
export const isPublicPath = (pathname: string) => {
  if (!pathname) return false;

  // Normalize: lowercase, then remove all trailing slashes
  const normalized = pathname.toLowerCase().replace(/\/+$/, "") || "/";

  // Strict check against PUBLIC_PATHS list
  const isMatch = PUBLIC_PATHS.some((p) => {
    const pNormalized = p.toLowerCase().replace(/\/+$/, "") || "/";
    return pNormalized === normalized;
  });

  if (isMatch) return true;

  // Fuzzy check for critical auth paths (fallback fix for Vercel trailing slash/hyphen oddities)
  const lowerPath = pathname.toLowerCase();
  
  // More aggressive defensive check for forgot/reset routes
  if (
    lowerPath.includes("/forgot") || 
    lowerPath.includes("/reset") ||
    lowerPath.startsWith("forgot") ||
    lowerPath.startsWith("reset")
  ) {
    return true;
  }

  return false;
};



export const getDefaultRouteForRole = (role?: string | null) => {
  if (role === "admin") {
    return "/admin/dashboard";
  }

  if (role === "client") {
    return "/client/dashboard";
  }

  if (role === "developer") {
    return "/developer/dashboard";
  }

  return "/login";
};

