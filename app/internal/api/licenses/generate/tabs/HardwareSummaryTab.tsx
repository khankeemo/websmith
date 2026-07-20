// FILE: app/internal/api/licenses/generate/tabs/HardwareSummaryTab.tsx
// PURPOSE: Tab 7 - Hardware Summary
// SCOPE: View hardware devices summary (total, online, offline)
// RULE: UI only - NO database queries, NO business logic
// RULE: Theme variables only - NO hardcoded colors
// RULE: Hardware page owns hardware - show summary only

"use client";

import { useState, useEffect } from "react";
import {
  Cpu,
  Loader2,
  Link2,
  Unlink,
} from "lucide-react";

// ============================================================
// TYPES
// ============================================================

interface HardwareDevice {
  id: number;
  hardware_id: string;
  device_name: string;
  online_status: "online" | "offline";
  license_key: string;
}

// ============================================================
// HARDWARE SUMMARY TAB
// ============================================================

export function HardwareSummaryTab() {
  const [hardware, setHardware] = useState<HardwareDevice[]>([]);
  const [loading, setLoading] = useState(true);

  const API_BASE = "/internal/backend";

  // ============================================================
  // FETCH HARDWARE
  // ============================================================
  useEffect(() => {
    const fetchHardware = async () => {
      try {
        const response = await fetch(`${API_BASE}/hardware`);
        const data = await response.json();
        if (data.success) {
          setHardware(data.data || []);
        }
      } catch (err) {
        console.error("Failed to fetch hardware:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchHardware();
  }, []);

  // ============================================================
  // RENDER
  // ============================================================
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 text-[var(--api-blue-400)] animate-spin" />
      </div>
    );
  }

  const total = hardware.length;
  const online = hardware.filter((d) => d.online_status === "online").length;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-[var(--border-color)] p-4 text-center">
          <Cpu className="h-6 w-6 mx-auto text-[var(--text-muted)] mb-2" />
          <p className="text-2xl font-bold text-[var(--text-primary)]">{total}</p>
          <p className="text-xs text-[var(--text-muted)]">Total Devices</p>
        </div>
        <div className="rounded-xl border border-[var(--api-green-500-20)] bg-[var(--api-green-500-5)] p-4 text-center">
          <Link2 className="h-6 w-6 mx-auto text-[var(--api-green-400)] mb-2" />
          <p className="text-2xl font-bold text-[var(--api-green-400)]">{online}</p>
          <p className="text-xs text-[var(--text-muted)]">Online</p>
        </div>
        <div className="rounded-xl border border-[var(--api-red-500-20)] bg-[var(--api-red-500-5)] p-4 text-center">
          <Unlink className="h-6 w-6 mx-auto text-[var(--api-red-400)] mb-2" />
          <p className="text-2xl font-bold text-[var(--api-red-400)]">{total - online}</p>
          <p className="text-xs text-[var(--text-muted)]">Offline</p>
        </div>
      </div>

      {/* Hardware List (Summary) */}
      {hardware.length > 0 ? (
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {hardware.slice(0, 5).map((device) => (
            <div
              key={device.id}
              className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5"
            >
              <div
                className={`p-2 rounded-lg ${
                  device.online_status === "online"
                    ? "bg-[var(--api-green-500-10)]"
                    : "bg-[var(--api-red-500-10)]"
                }`}
              >
                {device.online_status === "online" ? (
                  <Link2 className="h-4 w-4 text-[var(--api-green-400)]" />
                ) : (
                  <Unlink className="h-4 w-4 text-[var(--api-red-400)]" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm text-[var(--text-primary)]">
                    {device.hardware_id}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full border ${
                      device.online_status === "online"
                        ? "text-[var(--api-green-400)] bg-[var(--api-green-500-10)] border-[var(--api-green-500-20)]"
                        : "text-[var(--api-red-400)] bg-[var(--api-red-500-10)] border-[var(--api-red-500-20)]"
                    }`}
                  >
                    {device.online_status}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-[var(--text-muted)]">
                  <span>{device.device_name || "Unnamed Device"}</span>
                  <span>License: {device.license_key}</span>
                </div>
              </div>
            </div>
          ))}
          {hardware.length > 5 && (
            <div className="text-center text-xs text-[var(--text-muted)] py-2">
              Showing 5 of {hardware.length} devices
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8 text-[var(--text-muted)]">
          <Cpu className="h-8 w-8 opacity-20 mx-auto mb-2" />
          <p className="text-sm">No hardware devices found</p>
          <p className="text-xs mt-1">Devices appear when licenses are activated</p>
        </div>
      )}

      {/* View Full Hardware Center */}
      <div className="pt-2 border-t border-[var(--border-color)]">
        <button
          onClick={() => (window.location.href = "/internal/api/hardware")}
          className="text-sm text-[var(--api-blue-400)] hover:text-[var(--api-blue-300)] transition-colors"
        >
          View Full Hardware Center →
        </button>
      </div>
    </div>
  );
}