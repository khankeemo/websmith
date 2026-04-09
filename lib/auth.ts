export type UserRole = "admin" | "client" | "developer";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isTemporaryPassword?: boolean;
  setupCompleted?: boolean;
  preferences?: {
    theme: "light" | "dark";
    notifications: {
      email: boolean;
      push: boolean;
    };
  };
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
