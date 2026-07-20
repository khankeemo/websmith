// FILE: app/internal/api/customers/[id]/journey/page.tsx
// PURPOSE: Display customer journey timeline
// RULE: UI only - NO database queries, NO business logic
// RULE: Theme variables only - NO hardcoded colors

"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Loader2,
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  MapPin,
  User,
  Mail,
  Phone,
  Cpu,
  HardDrive,
  Package,
  KeyRound,
  Repeat,
  Eye,
  ChevronRight,
  AlertCircle,
  Info,
  Zap,
  Shield,
  Monitor,
  Server,
  Globe,
  Link2
} from "lucide-react";

// ============================================================
// TYPES
// ============================================================

interface JourneyEvent {
  event_type: string;
  message: string;
  timestamp: string;
  ip_address: string;
  metadata: Record<string, any>;
}

interface TrialData {
  id: number;
  hardware_id: string;
  status: string;
  started_at: string;
  expiry_date: string;
  days_left: number;
  days_active: number;
  product_id: string;
  product_name: string;
  plan_id: number;
  plan_name: string;
  customer_name: string;
  customer_email: string;
  mobile_number: string;
  ip_address: string;
  software_version: string;
  os_info: any;
  installation_timestamp: string;
  converted_at: string | null;
  converted_to_license_key: string | null;
  device_hash: string;
  cpu_id: string;
  motherboard_id: string;
}

interface CustomerData {
  id: string;
  name: string;
  email: string;
  phone: string;
  created_at: string;
}

interface JourneyData {
  success: boolean;
  customer: CustomerData;
  trial: TrialData;
  journey: JourneyEvent[];
  all_trials: any[];
  summary: {
    total_trials: number;
    active_trials: number;
    converted_trials: number;
    expired_trials: number;
    total_events: number;
  };
}

// ============================================================
// EVENT ICON MAPPER
// ============================================================

function getEventIcon(eventType: string) {
  const icons: Record<string, React.ReactNode> = {
    trial_started: <Zap className="h-4 w-4" />,
    trial_checked: <Activity className="h-4 w-4" />,
    trial_extended: <Clock className="h-4 w-4" />,
    trial_expired: <AlertTriangle className="h-4 w-4" />,
    upgrade_viewed: <Eye className="h-4 w-4" />,
    purchase_started: <Package className="h-4 w-4" />,
    conversion_started: <Repeat className="h-4 w-4" />,
    conversion_completed: <CheckCircle className="h-4 w-4" />,
    hardware_changed: <HardDrive className="h-4 w-4" />,
    suspicious_activity: <Shield className="h-4 w-4" />,
    status_checked: <Activity className="h-4 w-4" />,
  };
  return icons[eventType] || <Activity className="h-4 w-4" />;
}

function getEventColor(eventType: string) {
  const colors: Record<string, string> = {
    trial_started: "border-[var(--api-blue-500-20)] bg-[var(--api-blue-500-5)]",
    trial_checked: "border-[var(--api-cyan-500-20)] bg-[var(--api-cyan-500-5)]",
    trial_extended: "border-[var(--api-purple-500-20)] bg-[var(--api-purple-500-5)]",
    trial_expired: "border-[var(--api-red-500-20)] bg-[var(--api-red-500-5)]",
    upgrade_viewed: "border-[var(--api-amber-500-20)] bg-[var(--api-amber-500-5)]",
    purchase_started: "border-[var(--api-pink-500-20)] bg-[var(--api-pink-500-5)]",
    conversion_started: "border-[var(--api-indigo-500-20)] bg-[var(--api-indigo-500-5)]",
    conversion_completed: "border-[var(--api-green-500-20)] bg-[var(--api-green-500-5)]",
    hardware_changed: "border-[var(--api-amber-500-20)] bg-[var(--api-amber-500-5)]",
    suspicious_activity: "border-[var(--api-red-500-20)] bg-[var(--api-red-500-5)]",
    status_checked: "border-[var(--api-cyan-500-20)] bg-[var(--api-cyan-500-5)]",
  };
  return colors[eventType] || "border-[var(--border-color)] bg-[var(--bg-tertiary)]/10";
}

function getEventLabel(eventType: string) {
  const labels: Record<string, string> = {
    trial_started: "Trial Started",
    trial_checked: "Trial Checked",
    trial_extended: "Trial Extended",
    trial_expired: "Trial Expired",
    upgrade_viewed: "Upgrade Viewed",
    purchase_started: "Purchase Started",
    conversion_started: "Conversion Started",
    conversion_completed: "Conversion Completed",
    hardware_changed: "Hardware Changed",
    suspicious_activity: "⚠️ Suspicious Activity",
    status_checked: "Status Checked",
  };
  return labels[eventType] || eventType.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
}

// ============================================================
// JOURNEY EVENT COMPONENT
// ============================================================

function JourneyEventItem({ event, index, isLast }: { event: JourneyEvent; index: number; isLast: boolean }) {
  const formatDate = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (hours < 1) return "Just now";
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString("en-US", { 
      month: "short", 
      day: "numeric", 
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <div className="relative pl-8 pb-6 last:pb-0">
      {/* Timeline line */}
      {!isLast && (
        <div className="absolute left-3 top-4 bottom-0 w-0.5 bg-[var(--border-color)]" />
      )}
      
      {/* Timeline dot */}
      <div className={`absolute left-0 top-1.5 w-6 h-6 rounded-full border-2 ${getEventColor(event.event_type)} flex items-center justify-center z-10`}>
        {getEventIcon(event.event_type)}
      </div>
      
      {/* Content */}
      <div className={`p-4 rounded-xl border ${getEventColor(event.event_type)} transition-all duration-200 hover:scale-[1.01]`}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="font-medium text-[var(--text-primary)]">
              {getEventLabel(event.event_type)}
            </span>
            <span className="text-xs text-[var(--text-muted)]">#{index + 1}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <Clock className="h-3 w-3" />
            <span>{formatDate(event.timestamp)}</span>
            {event.ip_address && (
              <>
                <span>•</span>
                <Globe className="h-3 w-3" />
                <span>{event.ip_address}</span>
              </>
            )}
          </div>
        </div>
        <p className="text-sm text-[var(--text-secondary)] mt-1">{event.message}</p>
        {event.metadata && Object.keys(event.metadata).length > 0 && (
          <details className="mt-2">
            <summary className="text-xs text-[var(--text-muted)] cursor-pointer hover:text-[var(--text-secondary)]">
              View Details
            </summary>
            <pre className="mt-1 text-xs bg-[var(--bg-tertiary)]/20 p-2 rounded-lg overflow-x-auto text-[var(--text-muted)]">
              {JSON.stringify(event.metadata, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

// ============================================================
// MAIN PAGE
// ============================================================

export default function CustomerJourneyPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<JourneyData | null>(null);
  const [selectedTrial, setSelectedTrial] = useState<number | null>(null);

  // ============================================================
  // FETCH JOURNEY DATA
  // ============================================================
  useEffect(() => {
    const fetchJourney = async () => {
      setLoading(true);
      setError(null);

      try {
        const url = `/internal/backend/customers/${encodeURIComponent(customerId)}/journey${selectedTrial ? `?trial_id=${selectedTrial}` : ''}`;
        const response = await fetch(url);
        const result = await response.json();

        if (result.success) {
          setData(result);
        } else {
          setError(result.error || "Failed to load journey data");
        }
      } catch (err) {
        console.error("Journey fetch error:", err);
        setError("Failed to load customer journey. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    if (customerId) {
      fetchJourney();
    }
  }, [customerId, selectedTrial]);

  // ============================================================
  // HELPERS
  // ============================================================
  const formatDate = (date: string) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "text-[var(--api-green-400)] bg-[var(--api-green-500-10)] border-[var(--api-green-500-20)]";
      case "converted": return "text-[var(--api-blue-400)] bg-[var(--api-blue-500-10)] border-[var(--api-blue-500-20)]";
      case "expired": return "text-[var(--api-red-400)] bg-[var(--api-red-500-10)] border-[var(--api-red-500-20)]";
      default: return "text-[var(--text-muted)] bg-[var(--bg-tertiary)]/20 border-[var(--border-color)]";
    }
  };

  // ============================================================
  // RENDER
  // ============================================================
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-8 w-8 text-[var(--api-blue-400)] animate-spin" />
        <span className="text-[var(--text-secondary)] mt-3">Loading customer journey...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="rounded-2xl border border-[var(--api-red-500-20)] bg-[var(--api-red-500-5)] p-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-6 w-6 text-[var(--api-red-400)]" />
            <div>
              <h3 className="font-semibold text-[var(--text-primary)]">Error Loading Journey</h3>
              <p className="text-sm text-[var(--text-secondary)]">{error}</p>
            </div>
          </div>
          <button
            onClick={() => router.push("/internal/api/customers")}
            className="mt-4 flex items-center gap-2 text-sm text-[var(--api-blue-400)] hover:text-blue-300"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Customers
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="text-center py-12">
          <Activity className="h-12 w-12 text-[var(--text-muted)] mx-auto opacity-20" />
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mt-4">No Journey Data Found</h3>
          <p className="text-sm text-[var(--text-secondary)]">This customer has no trial activity</p>
          <button
            onClick={() => router.push("/internal/api/customers")}
            className="mt-4 flex items-center gap-2 text-sm text-[var(--api-blue-400)] hover:text-blue-300 mx-auto"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Customers
          </button>
        </div>
      </div>
    );
  }

  const { customer, trial, journey, all_trials, summary } = data;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/internal/api/customers")}
            className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)]/20 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-[var(--text-secondary)]" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Customer Journey</h1>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              Complete timeline of trial activity
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs px-3 py-1 rounded-full border ${getStatusColor(trial?.status || 'unknown')}`}>
            {trial?.status || 'No Trial'}
          </span>
        </div>
      </div>

      {/* Customer Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-[var(--text-muted)]" />
            <span className="font-medium text-[var(--text-primary)]">{customer.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-[var(--text-muted)]" />
            <span className="text-sm text-[var(--text-secondary)]">{customer.email}</span>
          </div>
          {customer.phone && (
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-[var(--text-muted)]" />
              <span className="text-sm text-[var(--text-secondary)]">{customer.phone}</span>
            </div>
          )}
        </div>
        <div className="space-y-1 md:text-right">
          <div className="flex items-center gap-2 md:justify-end">
            <Package className="h-4 w-4 text-[var(--text-muted)]" />
            <span className="text-sm text-[var(--text-secondary)]">{summary.total_trials} trials total</span>
          </div>
          <div className="flex items-center gap-2 md:justify-end">
            <Calendar className="h-4 w-4 text-[var(--text-muted)]" />
            <span className="text-sm text-[var(--text-secondary)]">Customer since {formatDate(customer.created_at)}</span>
          </div>
          <div className="flex items-center gap-2 md:justify-end">
            <Repeat className="h-4 w-4 text-[var(--text-muted)]" />
            <span className="text-sm text-[var(--text-secondary)]">{summary.converted_trials} converted · {summary.active_trials} active</span>
          </div>
        </div>
      </div>

      {/* Trial Selector */}
      {all_trials.length > 1 && (
        <div className="flex items-center gap-3 flex-wrap p-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5">
          <span className="text-sm font-medium text-[var(--text-secondary)]">Select Trial:</span>
          <div className="flex gap-2 flex-wrap">
            {all_trials.map((t: any) => (
              <button
                key={t.id}
                onClick={() => setSelectedTrial(t.id)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                  selectedTrial === t.id || (!selectedTrial && t.id === trial?.id)
                    ? 'border-[var(--api-blue-500-20)] bg-[var(--api-blue-500-10)] text-[var(--api-blue-400)]'
                    : 'border-[var(--border-color)] bg-[var(--bg-tertiary)]/20 text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30'
                }`}
              >
                {t.product_name || 'Unknown'} - {formatDate(t.started_at)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Trial Details */}
      {trial && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5">
          <div>
            <p className="text-xs text-[var(--text-muted)]">Product</p>
            <p className="font-medium text-[var(--text-primary)]">{trial.product_name}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-muted)]">Plan</p>
            <p className="font-medium text-[var(--text-primary)]">{trial.plan_name}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-muted)]">Hardware</p>
            <code className="text-xs font-mono bg-[var(--bg-tertiary)]/20 px-1.5 py-0.5 rounded text-[var(--text-secondary)]">
              {trial.hardware_id?.slice(0, 12)}...
            </code>
          </div>
          <div>
            <p className="text-xs text-[var(--text-muted)]">Software Version</p>
            <p className="font-medium text-[var(--text-primary)]">v{trial.software_version || 'N/A'}</p>
          </div>
        </div>
      )}

      {/* Journey Timeline */}
      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-[var(--api-cyan-400)]" />
            <h2 className="font-semibold text-[var(--text-primary)]">Journey Timeline</h2>
            <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-tertiary)]/30 px-2 py-0.5 rounded-full">
              {journey.length} events
            </span>
          </div>
        </div>

        {journey.length === 0 ? (
          <div className="text-center py-12 text-[var(--text-muted)]">
            <Activity className="h-8 w-8 opacity-20 mx-auto mb-2" />
            <p className="text-sm">No journey events found</p>
            <p className="text-xs mt-1">Events will appear as the customer uses the trial</p>
          </div>
        ) : (
          <div className="space-y-0">
            {journey.map((event, index) => (
              <JourneyEventItem
                key={index}
                event={event}
                index={index}
                isLast={index === journey.length - 1}
              />
            ))}
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 text-center">
          <p className="text-2xl font-bold text-[var(--text-primary)]">{summary.total_events}</p>
          <p className="text-xs text-[var(--text-muted)]">Total Events</p>
        </div>
        <div className="p-4 rounded-xl border border-[var(--api-green-500-20)] bg-[var(--api-green-500-5)] text-center">
          <p className="text-2xl font-bold text-[var(--api-green-400)]">{summary.active_trials}</p>
          <p className="text-xs text-[var(--text-muted)]">Active Trials</p>
        </div>
        <div className="p-4 rounded-xl border border-[var(--api-blue-500-20)] bg-[var(--api-blue-500-5)] text-center">
          <p className="text-2xl font-bold text-[var(--api-blue-400)]">{summary.converted_trials}</p>
          <p className="text-xs text-[var(--text-muted)]">Converted</p>
        </div>
        <div className="p-4 rounded-xl border border-[var(--api-amber-500-20)] bg-[var(--api-amber-500-5)] text-center">
          <p className="text-2xl font-bold text-[var(--api-amber-400)]">{summary.expired_trials}</p>
          <p className="text-xs text-[var(--text-muted)]">Expired</p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-[var(--text-muted)] pt-4 border-t border-[var(--border-color)]">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span>Journey API: Online</span>
          <span className="text-[var(--text-muted)]/50">•</span>
          <span>v1.0</span>
        </div>
        {journey.length > 0 && (
          <span>Showing {journey.length} events</span>
        )}
      </div>
    </div>
  );
}