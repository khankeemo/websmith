// FILE: app/internal/api/auth/hooks/useTheme.t
// PURPOSE: useTheme hook for API Center

"use client";

import { useContext } from "react";
import { ThemeContextType } from "../types/theme";

// Create context here to avoid circular imports
import React from "react";

const ThemeContext = React.createContext<ThemeContextType | undefined>(undefined);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

export { ThemeContext };