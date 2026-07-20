// FILE: components/internal-api/NotificationBell.tsx
// PURPOSE: Notification bell icon with dropdown toggle
// FIX: Added auth check before making API calls

"use client";

import { useState, useRef, useEffect } from "react";
import { Bell } from "lucide-react";
import { useNotifications } from "@/app/internal/api/auth/hooks/useNotifications";
import { NotificationDropdown } from "./NotificationDropdown";

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const { unreadCount } = useNotifications();

  useEffect(() => {
    // ✅ Check if token exists before making any API calls
    const token = localStorage.getItem("api_center_token");
    if (!token) {
      console.log("📝 No token, skipping notification fetch");
      setMounted(true);
      return;
    }

    setMounted(true);

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Don't render during SSR
  if (!mounted) {
    return (
      <div className="relative h-9 w-9 rounded-lg bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] flex items-center justify-center">
        <Bell className="h-4 w-4 text-[var(--text-secondary)]" />
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative h-9 w-9 rounded-lg bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] flex items-center justify-center transition-all duration-200 hover:bg-[var(--bg-tertiary)]/40 hover:border-[var(--border-color)]"
      >
        <Bell className={`h-4 w-4 transition-colors ${
          isOpen ? "text-blue-400" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        }`} />
        
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-[var(--bg-primary)] shadow-[0_0_10px_rgba(239,68,68,0.3)]">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && <NotificationDropdown onClose={() => setIsOpen(false)} />}
    </div>
  );
}