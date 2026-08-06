// FILE: app/internal/api/hardware/page.tsx
// PURPOSE: Hardware Management Center - Device lifecycle management
// SCOPE: View devices, Bind Device, Replace Device, Reset Device, Unbind Device
// RULE: UI only - NO database queries, NO business logic
// RULE: Theme variables only - NO hardcoded colors

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Cpu,
  Search,
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Link2,
  Repeat,
  RotateCcw,
  Unlink,
  Plus,
  Filter,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  HardDrive,
  Laptop,
  Server,
  Smartphone,
  Monitor,
  Globe,
  Calendar,
  User,
  Mail,
  Tag,
  Building,
} from "lucide-react";

// ============================================================
// TYPES - Based on actual hardware API response
// ============================================================

interface HardwareDevice {
  id: number;
  hardware_id: string;
  device_name: string;
  ip_address: string;
  activated_at: string;
  last_seen: string;
  os_version: string;
  product_version: string;
  company_name: string;
  hardware_status: string;
  online_status: "online" | "offline";
  // Used internally for admin API calls (not displayed in UI)
  license_key?: string;
  customer?: {
    name?: string;
    email?: string;
    mobile?: string;
  };
  plan?: {
    name?: string;
    max_devices?: number;
  };
  product?: {
    name?: string;
    product_id?: string;
  };
  license?: {
    status?: string;
    expiry_date?: string | null;
    days_remaining?: number | null;
    is_trial?: boolean;
    device_count?: number;
  };
}

interface HardwareResponse {
  success: boolean;
  data: HardwareDevice[];
  error?: string;
}

// ============================================================
// STATISTICS CARD COMPONENT
// ============================================================

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: "blue" | "green" | "red" | "amber" | "purple";
  subtitle?: string;
}

function StatCard({ title, value, icon, color, subtitle }: StatCardProps) {
  const colorClasses = {
    blue: "border-[var(--api-blue-500-20)] bg-[var(--api-blue-500-5)]",
    green: "border-[var(--api-green-500-20)] bg-[var(--api-green-500-5)]",
    red: "border-[var(--api-red-500-20)] bg-[var(--api-red-500-5)]",
    amber: "border-[var(--api-amber-500-20)] bg-[var(--api-amber-500-5)]",
    purple: "border-[var(--api-purple-500-20)] bg-[var(--api-purple-500-5)]",
  };

  const iconColors = {
    blue: "text-[var(--api-blue-400)] bg-[var(--api-blue-500-10)]",
    green: "text-[var(--api-green-400)] bg-[var(--api-green-500-10)]",
    red: "text-[var(--api-red-400)] bg-[var(--api-red-500-10)]",
    amber: "text-[var(--api-amber-400)] bg-[var(--api-amber-500-10)]",
    purple: "text-[var(--api-purple-400)] bg-[var(--api-purple-500-10)]",
  };

  return (
    <div className={`rounded-2xl border ${colorClasses[color]} p-5 backdrop-blur-sm transition-all duration-200 hover:scale-[1.02] hover:shadow-lg`}>
      <div className="flex items-center justify-between">
        <div className={`rounded-xl p-2.5 ${iconColors[color]}`}>
          {icon}
        </div>
        <span className="text-2xl font-bold text-[var(--text-primary)]">{value}</span>
      </div>
      <p className="text-sm text-[var(--text-secondary)] mt-2">{title}</p>
      {subtitle && <p className="text-xs text-[var(--text-muted)] mt-1">{subtitle}</p>}
    </div>
  );
}

// ============================================================
// DEVICE CARD COMPONENT
// ============================================================

interface DeviceCardProps {
  device: HardwareDevice;
  onBind?: () => void;
  onReplace?: () => void;
  onReset?: () => void;
  onUnbind?: () => void;
}

function DeviceCard({ device, onBind, onReplace, onReset, onUnbind }: DeviceCardProps) {
  const [expanded, setExpanded] = useState(false);

  const getDeviceIcon = (name: string | null | undefined) => {
    const lower = (name || "").toLowerCase();
    if (lower.includes("server")) return <Server className="h-4 w-4" />;
    if (lower.includes("laptop") || lower.includes("notebook")) return <Laptop className="h-4 w-4" />;
    if (lower.includes("phone") || lower.includes("iphone") || lower.includes("android")) return <Smartphone className="h-4 w-4" />;
    if (lower.includes("monitor") || lower.includes("desktop")) return <Monitor className="h-4 w-4" />;
    return <HardDrive className="h-4 w-4" />;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online": return "text-[var(--api-green-400)] bg-[var(--api-green-500-10)] border-[var(--api-green-500-20)]";
      case "offline": return "text-[var(--api-red-400)] bg-[var(--api-red-500-10)] border-[var(--api-red-500-20)]";
      default: return "text-[var(--api-amber-400)] bg-[var(--api-amber-500-10)] border-[var(--api-amber-500-20)]";
    }
  };

  const getStatusDot = (status: string) => {
    switch (status) {
      case "online": return "bg-green-400";
      case "offline": return "bg-red-400";
      default: return "bg-amber-400";
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const formatRelative = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className={`rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 transition-all duration-200 hover:shadow-lg overflow-hidden ${
      device.online_status === "online" ? "hover:border-[var(--api-green-500-30)]" : "hover:border-[var(--api-red-500-30)]"
    }`}>
      {/* Header */}
      <div 
        className="flex items-center gap-3 p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className={`p-2 rounded-lg ${device.online_status === "online" ? "bg-[var(--api-green-500-10)]" : "bg-[var(--api-red-500-10)]"}`}>
          {getDeviceIcon(device.device_name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-[var(--text-primary)] truncate">
              {device.device_name || "Unnamed Device"}
            </h4>
            <span className={`text-xs px-2 py-0.5 rounded-full border ${getStatusColor(device.online_status)}`}>
              {device.online_status}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-[var(--text-muted)] font-mono">
              {device.hardware_id.slice(0, 12)}...
            </span>
            <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
              <Clock size={10} />
              {formatRelative(device.last_seen)}
            </span>
          </div>
        </div>
        <button className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)]/50 transition-colors">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="border-t border-[var(--border-color)] p-4 bg-[var(--bg-tertiary)]/5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <HardDrive size={14} className="text-[var(--text-muted)]" />
                <span className="text-[var(--text-muted)]">Hardware ID:</span>
                <span className="text-[var(--text-primary)] font-mono">{device.hardware_id}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Globe size={14} className="text-[var(--text-muted)]" />
                <span className="text-[var(--text-muted)]">IP:</span>
                <span className="text-[var(--text-primary)]">{device.ip_address || ""}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar size={14} className="text-[var(--text-muted)]" />
                <span className="text-[var(--text-muted)]">Activated:</span>
                <span className="text-[var(--text-primary)]">{formatDate(device.activated_at)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <HardDrive size={14} className="text-[var(--text-muted)]" />
                <span className="text-[var(--text-muted)]">OS:</span>
                <span className="text-[var(--text-primary)]">{device.os_version || ""}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar size={14} className="text-[var(--text-muted)]" />
                <span className="text-[var(--text-muted)]">Last Seen:</span>
                <span className="text-[var(--text-primary)]">{formatDate(device.last_seen)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Mail size={14} className="text-[var(--text-muted)]" />
                <span className="text-[var(--text-muted)]">Customer:</span>
                <span className="text-[var(--text-primary)]">{device.customer?.name || device.customer?.email || ""}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Tag size={14} className="text-[var(--text-muted)]" />
                <span className="text-[var(--text-muted)]">Plan:</span>
                <span className="text-[var(--text-primary)]">{device.plan?.name || ""}</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Cpu size={14} className="text-[var(--text-muted)]" />
                <span className="text-[var(--text-muted)]">Product Version:</span>
                <span className="text-[var(--text-primary)]">{device.product_version || ""}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Building size={14} className="text-[var(--text-muted)]" />
                <span className="text-[var(--text-muted)]">Company:</span>
                <span className="text-[var(--text-primary)]">{device.company_name || ""}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <AlertCircle size={14} className="text-[var(--text-muted)]" />
                <span className="text-[var(--text-muted)]">Hardware Status:</span>
                <span className={`text-[var(--text-primary)] capitalize ${getStatusColor(device.hardware_status)} px-2 py-0.5 rounded-full border text-xs`}>
                  {device.hardware_status}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar size={14} className="text-[var(--text-muted)]" />
                <span className="text-[var(--text-muted)]">License Status:</span>
                <span className="text-[var(--text-primary)] capitalize">{device.license?.status || ""}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar size={14} className="text-[var(--text-muted)]" />
                <span className="text-[var(--text-muted)]">Expires:</span>
                <span className="text-[var(--text-primary)]">{device.license?.expiry_date ? formatDate(device.license.expiry_date) : ""}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <HardDrive size={14} className="text-[var(--text-muted)]" />
                <span className="text-[var(--text-muted)]">Devices:</span>
                <span className="text-[var(--text-primary)]">{device.license?.device_count ?? 0}{device.plan?.max_devices ? `/${device.plan.max_devices}` : ""}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-[var(--border-color)]">
            {onBind && (
              <button
                onClick={onBind}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-[var(--api-blue-500-10)] text-[var(--api-blue-400)] border border-[var(--api-blue-500-20)] hover:bg-[var(--api-blue-500-20)] transition-all"
              >
                <Link2 size={12} />
                Bind Device
              </button>
            )}
            {onReplace && (
              <button
                onClick={onReplace}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-[var(--api-amber-500-10)] text-[var(--api-amber-400)] border border-[var(--api-amber-500-20)] hover:bg-[var(--api-amber-500-20)] transition-all"
              >
                <Repeat size={12} />
                Replace
              </button>
            )}
            {onReset && (
              <button
                onClick={onReset}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-[var(--api-red-500-10)] text-[var(--api-red-400)] border border-[var(--api-red-500-20)] hover:bg-[var(--api-red-500-20)] transition-all"
              >
                <RotateCcw size={12} />
                Reset
              </button>
            )}
            {onUnbind && (
              <button
                onClick={onUnbind}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-[var(--api-red-500-10)] text-[var(--api-red-400)] border border-[var(--api-red-500-20)] hover:bg-[var(--api-red-500-20)] transition-all"
              >
                <Unlink size={12} />
                Unbind
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// MAIN HARDWARE PAGE
// ============================================================

export default function HardwarePage() {
  const [devices, setDevices] = useState<HardwareDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "online" | "offline">("all");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Modals
  const [showBindModal, setShowBindModal] = useState(false);
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showUnbindModal, setShowUnbindModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<HardwareDevice | null>(null);
  const [bindForm, setBindForm] = useState({ license_key: "", hardware_id: "", device_name: "" });
  const [replaceForm, setReplaceForm] = useState({ new_hardware_id: "", new_device_name: "" });
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [bindConfirm, setBindConfirm] = useState("");
  const [replaceConfirm, setReplaceConfirm] = useState("");
  const [resetConfirm, setResetConfirm] = useState("");
  const [unbindConfirm, setUnbindConfirm] = useState("");

  const API_BASE = "/internal/backend";

  const fetchHardware = useCallback(async () => {
    setRefreshing(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/hardware`);
      const data: HardwareResponse = await response.json();

      if (data.success) {
        setDevices(data.data || []);
        setLastUpdated(new Date());
      } else {
        setError(data.error || "Failed to load hardware devices");
      }
    } catch (err) {
      console.error("Hardware fetch error:", err);
      setError("Failed to load hardware data. Please refresh.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchHardware();
  }, [fetchHardware]);

  // Listen for activation-changed events to refresh data
  useEffect(() => {
    const handler = () => fetchHardware();
    window.addEventListener("activation-changed", handler);
    return () => window.removeEventListener("activation-changed", handler);
  }, [fetchHardware]);

  // Filter devices
  const filteredDevices = devices.filter((device) => {
    const matchesSearch = 
      device.device_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      device.hardware_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      device.ip_address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      device.os_version?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      device.company_name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = filterStatus === "all" || device.online_status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  // Statistics
  const totalDevices = devices.length;
  const onlineDevices = devices.filter(d => d.online_status === "online").length;
  const offlineDevices = devices.filter(d => d.online_status === "offline").length;
  const uniqueHardwareIds = new Set(devices.map(d => d.hardware_id)).size;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-8 w-8 text-[var(--api-blue-400)] animate-spin" />
        <span className="ml-3 text-[var(--text-secondary)] mt-3">Loading hardware devices...</span>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Hardware Center</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Manage devices, monitor online status, and control hardware lifecycle
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setShowBindModal(true); setBindForm({ license_key: "", hardware_id: "", device_name: "" }); setBindConfirm(""); setModalError(null); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 text-sm text-[var(--api-blue-400)] hover:bg-[var(--api-blue-500-20)] transition-all"
          >
            <Plus size={16} />
            Bind Device
          </button>
          <button
            onClick={fetchHardware}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 hover:text-[var(--text-primary)] transition-all disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-2xl border border-[var(--api-red-500-20)] bg-[var(--api-red-500-5)] p-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-[var(--api-red-400)]" />
            <p className="text-[var(--api-red-400)] text-sm">{error}</p>
            <button
              onClick={fetchHardware}
              className="ml-auto text-sm text-[var(--api-blue-400)] hover:text-blue-300"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          title="Total Devices"
          value={totalDevices}
          icon={<Cpu className="h-5 w-5" />}
          color="blue"
        />
        <StatCard
          title="Online"
          value={onlineDevices}
          icon={<CheckCircle className="h-5 w-5" />}
          color="green"
          subtitle={`${totalDevices > 0 ? Math.round((onlineDevices / totalDevices) * 100) : 0}% uptime`}
        />
        <StatCard
          title="Offline"
          value={offlineDevices}
          icon={<XCircle className="h-5 w-5" />}
          color="red"
        />
        <StatCard
          title="Unique Hardware IDs"
          value={uniqueHardwareIds}
          icon={<HardDrive className="h-5 w-5" />}
          color="purple"
          subtitle={`${devices.length} devices across ${uniqueHardwareIds} hardware IDs`}
        />
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search devices by name, hardware ID, IP, or OS..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilterStatus("all")}
            className={`px-4 py-2.5 rounded-xl text-sm transition-all ${
              filterStatus === "all"
                ? "bg-[var(--api-blue-500-20)] text-[var(--api-blue-400)] border border-blue-500/30"
                : "bg-[var(--bg-tertiary)]/20 text-[var(--text-secondary)] border border-[var(--border-color)] hover:bg-[var(--bg-tertiary)]/30"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterStatus("online")}
            className={`px-4 py-2.5 rounded-xl text-sm transition-all ${
              filterStatus === "online"
                ? "bg-[var(--api-green-500-20)] text-[var(--api-green-400)] border border-green-500/30"
                : "bg-[var(--bg-tertiary)]/20 text-[var(--text-secondary)] border border-[var(--border-color)] hover:bg-[var(--bg-tertiary)]/30"
            }`}
          >
            Online
          </button>
          <button
            onClick={() => setFilterStatus("offline")}
            className={`px-4 py-2.5 rounded-xl text-sm transition-all ${
              filterStatus === "offline"
                ? "bg-[var(--api-red-500-20)] text-[var(--api-red-400)] border border-red-500/30"
                : "bg-[var(--bg-tertiary)]/20 text-[var(--text-secondary)] border border-[var(--border-color)] hover:bg-[var(--bg-tertiary)]/30"
            }`}
          >
            Offline
          </button>
        </div>
      </div>

      {/* Device List */}
      <div className="space-y-3">
        {filteredDevices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-[var(--text-muted)]">
            <Cpu className="h-12 w-12 opacity-20 mb-3" />
            <p className="text-sm font-medium">No devices found</p>
            <p className="text-xs mt-1">
              {searchQuery || filterStatus !== "all" 
                ? "Try adjusting your search or filters" 
                : "No hardware devices have been registered yet"}
            </p>
          </div>
        ) : (
          filteredDevices.map((device) => (
            <DeviceCard
              key={device.id}
              device={device}
              onBind={() => { setSelectedDevice(device); setShowBindModal(true); setBindForm({ license_key: "", hardware_id: "", device_name: device.device_name || "" }); setBindConfirm(""); setModalError(null); }}
              onReplace={() => { setSelectedDevice(device); setShowReplaceModal(true); setReplaceForm({ new_hardware_id: "", new_device_name: "" }); setReplaceConfirm(""); setModalError(null); }}
              onReset={() => { setSelectedDevice(device); setShowResetModal(true); setResetConfirm(""); setModalError(null); }}
              onUnbind={() => { setSelectedDevice(device); setShowUnbindModal(true); setUnbindConfirm(""); setModalError(null); }}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-[var(--text-muted)] pt-4 border-t border-[var(--border-color)]">
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${devices.some(d => d.online_status === "online") ? "bg-green-400 animate-pulse" : "bg-red-400"}`} />
          <span>Hardware API: Online</span>
        </div>
        <div className="flex items-center gap-4">
          <span>{filteredDevices.length} of {devices.length} devices shown</span>
          {lastUpdated && (
            <span>Last updated: {lastUpdated.toLocaleString()}</span>
          )}
        </div>
      </div>
    
    {showBindModal && (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onKeyDown={(e) => { if (e.key === 'Escape') { setShowBindModal(false); } }}>
        <div className="bg-[var(--bg-secondary)] rounded-2xl max-w-md w-full p-6 border border-[var(--border-color)]">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Bind Device</h3>
          <p className="text-sm text-[var(--text-secondary)] mb-4">Bind this hardware to the selected license?</p>
          {modalError && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm mb-4">{modalError}</div>}
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1">License Key *</label>
              <input type="text" value={bindForm.license_key} onChange={e => setBindForm(f => ({ ...f, license_key: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500" placeholder="XXXX-XXXX-XXXX-XXXX" />
            </div>
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1">Hardware ID *</label>
              <input type="text" value={bindForm.hardware_id} onChange={e => setBindForm(f => ({ ...f, hardware_id: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500" placeholder="Unique hardware identifier" />
            </div>
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1">Device Name</label>
              <input type="text" value={bindForm.device_name} onChange={e => setBindForm(f => ({ ...f, device_name: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500" placeholder="e.g., Main Workstation" />
            </div>
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1">Type <span className="font-mono font-bold text-[var(--text-primary)]">BIND</span> to confirm</label>
              <input type="text" value={bindConfirm} onChange={e => setBindConfirm(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !modalSubmitting && bindConfirm.trim().toUpperCase() === "BIND" && bindForm.license_key && bindForm.hardware_id) { document.getElementById('bind-submit-btn')?.click(); } }} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500 font-mono" placeholder="Type BIND" />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={() => setShowBindModal(false)} className="flex-1 px-4 py-2 rounded-lg border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/50">Cancel</button>
            <button id="bind-submit-btn" onClick={async () => {
              if (bindConfirm.trim().toUpperCase() !== "BIND") { setModalError("Type BIND to confirm"); return; }
              if (!bindForm.license_key || !bindForm.hardware_id) { setModalError("License key and hardware ID are required"); return; }
              setModalSubmitting(true); setModalError(null);
              try {
                const token = localStorage.getItem("api_center_token");
                const res = await fetch(`${API_BASE}/admin/bind-device`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(bindForm) });
                const data = await res.json();
                if (data.success) { setShowBindModal(false); fetchHardware(); } else setModalError(data.error || "Failed to bind");
              } catch { setModalError("Failed to bind device"); }
              finally { setModalSubmitting(false); }
            }} disabled={modalSubmitting || bindConfirm.trim().toUpperCase() !== "BIND"} className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">{modalSubmitting ? "Binding..." : "Bind Device"}</button>
          </div>
        </div>
      </div>
    )}

    {/* ============================================================
        REPLACE DEVICE MODAL
    ============================================================ */}
    {showReplaceModal && selectedDevice && (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onKeyDown={(e) => { if (e.key === 'Escape') { setShowReplaceModal(false); } }}>
        <div className="bg-[var(--bg-secondary)] rounded-2xl max-w-md w-full p-6 border border-[var(--border-color)]">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Replace Device</h3>
          <p className="text-sm text-[var(--text-secondary)] mb-4">This will replace the current hardware. Replace <strong className="text-[var(--text-primary)]">{selectedDevice.device_name || selectedDevice.hardware_id}</strong> with a new device.</p>
          {modalError && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm mb-4">{modalError}</div>}
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1">New Hardware ID *</label>
              <input type="text" value={replaceForm.new_hardware_id} onChange={e => setReplaceForm(f => ({ ...f, new_hardware_id: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500" placeholder="New hardware identifier" />
            </div>
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1">New Device Name</label>
              <input type="text" value={replaceForm.new_device_name} onChange={e => setReplaceForm(f => ({ ...f, new_device_name: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500" placeholder="e.g., New Laptop" />
            </div>
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1">Type <span className="font-mono font-bold text-[var(--text-primary)]">REPLACE</span> to confirm</label>
              <input type="text" value={replaceConfirm} onChange={e => setReplaceConfirm(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !modalSubmitting && replaceConfirm.trim().toUpperCase() === "REPLACE" && replaceForm.new_hardware_id) { document.getElementById('replace-submit-btn')?.click(); } }} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500 font-mono" placeholder="Type REPLACE" />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={() => setShowReplaceModal(false)} className="flex-1 px-4 py-2 rounded-lg border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/50">Cancel</button>
            <button id="replace-submit-btn" onClick={async () => {
              if (replaceConfirm.trim().toUpperCase() !== "REPLACE") { setModalError("Type REPLACE to confirm"); return; }
              if (!replaceForm.new_hardware_id) { setModalError("New hardware ID is required"); return; }
              setModalSubmitting(true); setModalError(null);
              try {
                const token = localStorage.getItem("api_center_token");
                const res = await fetch(`${API_BASE}/admin/replace-device`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ license_key: selectedDevice.license_key, old_hardware_id: selectedDevice.hardware_id, new_hardware_id: replaceForm.new_hardware_id, device_name: replaceForm.new_device_name }) });
                const data = await res.json();
                if (data.success) { setShowReplaceModal(false); fetchHardware(); } else setModalError(data.error || "Failed to replace");
              } catch { setModalError("Failed to replace device"); }
              finally { setModalSubmitting(false); }
            }} disabled={modalSubmitting || replaceConfirm.trim().toUpperCase() !== "REPLACE"} className="flex-1 px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50">{modalSubmitting ? "Replacing..." : "Replace Device"}</button>
          </div>
        </div>
      </div>
    )}

    {/* ============================================================
        RESET DEVICE MODAL
    ============================================================ */}
    {showResetModal && selectedDevice && (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onKeyDown={(e) => { if (e.key === 'Escape') { setShowResetModal(false); } }}>
        <div className="bg-[var(--bg-secondary)] rounded-2xl max-w-md w-full p-6 border border-[var(--border-color)]">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="h-6 w-6 text-amber-400" />
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">Reset Device</h3>
          </div>
          <p className="text-sm text-[var(--text-secondary)] mb-4">This will reset the device activation state. Reset device <strong className="text-[var(--text-primary)]">{selectedDevice.device_name || selectedDevice.hardware_id}</strong>? This will clear its activation binding and allow it to be re-activated.</p>
          {modalError && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm mb-4">{modalError}</div>}
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1">Type <span className="font-mono font-bold text-[var(--text-primary)]">RESET</span> to confirm</label>
              <input type="text" value={resetConfirm} onChange={e => setResetConfirm(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !modalSubmitting && resetConfirm.trim().toUpperCase() === "RESET") { document.getElementById('reset-submit-btn')?.click(); } }} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500 font-mono" placeholder="Type RESET" />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={() => setShowResetModal(false)} className="flex-1 px-4 py-2 rounded-lg border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/50">Cancel</button>
            <button id="reset-submit-btn" onClick={async () => {
              if (resetConfirm.trim().toUpperCase() !== "RESET") { setModalError("Type RESET to confirm"); return; }
              setModalSubmitting(true);
              try {
                const token = localStorage.getItem("api_center_token");
                const res = await fetch(`${API_BASE}/admin/reset-device`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ license_key: selectedDevice.license_key, hardware_id: selectedDevice.hardware_id }) });
                const data = await res.json();
                if (data.success) { setShowResetModal(false); fetchHardware(); } else setModalError(data.error || "Failed to reset");
              } catch { setModalError("Failed to reset device"); }
              finally { setModalSubmitting(false); }
            }} disabled={modalSubmitting || resetConfirm.trim().toUpperCase() !== "RESET"} className="flex-1 px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50">{modalSubmitting ? "Resetting..." : "Reset Device"}</button>
          </div>
        </div>
      </div>
    )}

    {/* ============================================================
        UNBIND DEVICE MODAL
    ============================================================ */}
    {showUnbindModal && selectedDevice && (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onKeyDown={(e) => { if (e.key === 'Escape') { setShowUnbindModal(false); } }}>
        <div className="bg-[var(--bg-secondary)] rounded-2xl max-w-md w-full p-6 border border-[var(--border-color)]">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="h-6 w-6 text-red-400" />
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">Unbind Device</h3>
          </div>
          <p className="text-sm text-[var(--text-secondary)] mb-4">This will permanently remove the device from this license. Unbind <strong className="text-[var(--text-primary)]">{selectedDevice.device_name || selectedDevice.hardware_id}</strong> from license <strong className="text-[var(--text-primary)]">{selectedDevice.license_key}</strong>?</p>
          {modalError && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm mb-4">{modalError}</div>}
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1">Type <span className="font-mono font-bold text-[var(--text-primary)]">UNBIND</span> to confirm</label>
              <input type="text" value={unbindConfirm} onChange={e => setUnbindConfirm(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !modalSubmitting && unbindConfirm.trim().toUpperCase() === "UNBIND") { document.getElementById('unbind-submit-btn')?.click(); } }} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500 font-mono" placeholder="Type UNBIND" />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={() => setShowUnbindModal(false)} className="flex-1 px-4 py-2 rounded-lg border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/50">Cancel</button>
            <button id="unbind-submit-btn" onClick={async () => {
              if (unbindConfirm.trim().toUpperCase() !== "UNBIND") { setModalError("Type UNBIND to confirm"); return; }
              setModalSubmitting(true);
              try {
                const token = localStorage.getItem("api_center_token");
                const res = await fetch(`${API_BASE}/admin/reset-device`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ license_key: selectedDevice.license_key, hardware_id: selectedDevice.hardware_id, action: "unbind" }) });
                const data = await res.json();
                if (data.success) { setShowUnbindModal(false); fetchHardware(); } else setModalError(data.error || "Failed to unbind");
              } catch { setModalError("Failed to unbind device"); }
              finally { setModalSubmitting(false); }
            }} disabled={modalSubmitting || unbindConfirm.trim().toUpperCase() !== "UNBIND"} className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">{modalSubmitting ? "Unbinding..." : "Unbind Device"}</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}