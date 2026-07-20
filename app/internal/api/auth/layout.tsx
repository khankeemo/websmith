/**
 * File: app/internal/api/auth/layout.tsx
 *
 * Description: Auth Layout for API Center - Simple layout for auth pages
 * Auth pages: login, register, forgot-password, reset-password
 * RULE 02: All code stays inside /internal - no main website interference
 * 
 * FIX: Removed duplicate ThemeProvider and NotificationProvider
 * These are now inherited from parent layout (app/internal/api/layout.tsx)
 * This prevents theme state resets and persistence issues
 */

"use client";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-300">
      {children}
    </div>
  );
}