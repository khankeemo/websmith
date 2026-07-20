// FILE: app/internal/api/types/theme.ts
// PURPOSE: Theme types for API Center

export type ThemeMode = "dark" | "light" | "system";

export interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  isDark: boolean;
}

export interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: ThemeMode;
}