// FILE: D:\websmith\components\internal-api\Topbar.tsx
// PURPOSE: Websmith License Operations Center Topbar - API Center Auth Only
// RULE 02: All code stays inside /internal - no main website interference
// RULE 05: API Center Only - Uses api_center_token, NOT lib/auth.ts

"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  LayoutDashboard,
  MessagesSquare,
  LogOut,
  Settings,
  UserCircle,
  ChevronDown,
  Activity,
  Sparkles,
} from "lucide-react";
import { NotificationBell } from "./NotificationBell";
import { ThemeSwitcher } from "./ThemeSwitcher";

interface UserData {
  id: string;
  email: string;
  name: string;
  role: string;
}

export default function Topbar() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ============================================================
  // FETCH USER
  // ============================================================
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = localStorage.getItem("api_center_token");
        if (!token) {
          setLoading(false);
          return;
        }

        const response = await fetch("/internal/backend/api/auth/verify", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();
        if (data.valid && data.user) {
          setUser(data.user);
        }
      } catch (error) {
        console.error("Failed to fetch user:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  // ============================================================
  // CLOSE DROPDOWN
  // ============================================================
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ============================================================
  // NAVIGATION HANDLERS
  // ============================================================
  const handleGoHome = () => {
    router.push("/internal/api/dashboard");
  };

  const handleGoBackend = () => {
    window.location.href = `${process.env.NEXT_PUBLIC_APP_URL || ""}/internal/api/communications`;
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      localStorage.removeItem("api_center_token");
      localStorage.removeItem("api_center_remember");
      document.cookie = "api_center_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      setIsDropdownOpen(false);
      await new Promise((resolve) => setTimeout(resolve, 300));
      router.push("/internal/api/auth/login");
    } catch (error) {
      console.error("Logout error:", error);
      setIsLoggingOut(false);
    }
  };

  const handleGoProfile = () => {
    router.push("/internal/api/auth/profile");
    setIsDropdownOpen(false);
  };

  const handleGoSettings = () => {
    router.push("/internal/api/settings");
    setIsDropdownOpen(false);
  };

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const getUserInitials = () => {
    if (!user?.name) return "U";
    return user.name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="sticky top-0 z-40 h-[72px] px-6 flex items-center justify-between backdrop-blur-xl bg-[var(--bg-primary)]/70 border-b border-[var(--border-color)] shadow-[0_4px_24px_rgba(0,0,0,0.25)]">
      {/* LEFT: Navigation Buttons + Title Section */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleGoHome}
          className="group relative flex items-center justify-center gap-2 h-9 px-3 rounded-lg bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]/50 hover:border-[var(--border-color)] transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/5 overflow-hidden"
        >
          <span className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/5 to-purple-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <LayoutDashboard size={16} className="relative transition-transform duration-300 group-hover:scale-110" />
          <span className="text-sm font-medium hidden sm:inline relative">Dashboard</span>
        </button>

        <button
          onClick={handleGoBackend}
          className="group relative flex items-center justify-center gap-2 h-9 px-3 rounded-lg bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]/50 hover:border-[var(--border-color)] transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/5 overflow-hidden"
        >
          <span className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/5 to-purple-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <MessagesSquare size={16} className="relative transition-transform duration-300 group-hover:scale-110" />
          <span className="text-sm font-medium hidden sm:inline relative">Communication</span>
        </button>

        {/* Title Section */}
        <div className="flex flex-col ml-2 group">
          <h1 className="text-lg font-semibold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
            Websmith License Operations Center
            <Sparkles size={14} className="text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          </h1>
          <p className="text-xs text-[var(--text-secondary)] flex items-center gap-1.5">
            <Activity size={10} className="text-emerald-400" />
            License & Hardware Management
          </p>
        </div>
      </div>

      {/* RIGHT: Actions (NO Search Bar) */}
      <div className="flex items-center gap-3">
        {/* Theme Switcher */}
        <ThemeSwitcher />

        {/* Notifications */}
        <NotificationBell />

        {/* User Avatar with Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={toggleDropdown}
            className="group relative flex items-center gap-2 h-9 px-2 rounded-lg bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] transition-all duration-300 hover:bg-[var(--bg-tertiary)]/50 hover:border-[var(--border-color)] hover:shadow-lg hover:shadow-blue-500/5 cursor-pointer overflow-hidden"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/5 to-purple-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="relative h-7 w-7 rounded-lg bg-gradient-to-br from-blue-500/10 to-purple-500/10 flex items-center justify-center overflow-hidden transition-transform duration-300 group-hover:scale-105">
              {loading ? (
                <div className="h-4 w-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
              ) : user?.name ? (
                <span className="text-xs font-bold text-[var(--text-primary)]">
                  {getUserInitials()}
                </span>
              ) : (
                <User className="h-4 w-4 text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors" />
              )}
              {/* Online indicator */}
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[var(--bg-primary)] animate-pulse" />
            </div>

            <ChevronDown
              className={`h-3.5 w-3.5 text-[var(--text-secondary)] transition-all duration-300 ${
                isDropdownOpen ? "rotate-180 text-blue-400" : ""
              }`}
            />
          </button>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute right-0 top-[calc(100%+8px)] w-56 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow-2xl shadow-black/50 backdrop-blur-xl animate-fadeInDown">
              {/* User Info */}
              <div className="px-4 py-3 border-b border-[var(--border-color)]">
                {loading ? (
                  <>
                    <div className="h-4 w-24 bg-[var(--bg-tertiary)]/50 rounded animate-pulse" />
                    <div className="h-3 w-32 bg-[var(--bg-tertiary)]/50 rounded mt-1 animate-pulse" />
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-2">
                      {user?.name || "Guest User"}
                      <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/20">
                        {user?.role || "guest"}
                      </span>
                    </p>
                    <p className="text-xs text-[var(--text-secondary)] truncate">
                      {user?.email || "guest@websmith.com"}
                    </p>
                  </>
                )}
              </div>

              {/* Menu Items */}
              <div className="py-1">
                <button
                  onClick={handleGoProfile}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]/30 transition-all duration-200 group"
                >
                  <UserCircle className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
                  Profile
                </button>
                <button
                  onClick={handleGoSettings}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]/30 transition-all duration-200 group"
                >
                  <Settings className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
                  Settings
                </button>
              </div>

              {/* Divider */}
              <div className="border-t border-[var(--border-color)] my-1" />

              {/* Logout */}
              <div className="py-1">
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all duration-200 group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <LogOut className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
                  {isLoggingOut ? (
                    <span className="flex items-center gap-2">
                      <span className="h-3 w-3 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                      Signing out...
                    </span>
                  ) : (
                    "Sign Out"
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}