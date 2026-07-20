// FILE: app/internal/api/analytics/page.tsx
// PURPOSE: Business Intelligence & Reporting Center - READ ONLY
// SCOPE: Revenue Analytics, Product Analytics, License Analytics,
//        Customer Analytics, Hardware Analytics, Validation Analytics,
//        Trial Analytics, Business Insights, Trial Conversion Analytics,
//        License Health Analytics
// RULE: NO operational actions - READ ONLY
// RULE: NO management actions - Reporting only
// RULE: Theme variables only - NO hardcoded colors
// FIXED: Safe array operations - prevents "Reduce of empty array" error
// UPGRADED: Added Trial Conversion Analytics, License Health Widgets

"use client";

import { useState, useEffect } from "react";
import {
  TrendingUp,
  DollarSign,
  KeyRound,
  Package,
  Cpu,
  Users,
  FlaskConical,
  ShieldCheck,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Loader2,
  AlertCircle,
  BarChart3,
  PieChart,
  Calendar,
  Download,
  Award,
  Rocket,
  Target,
  Zap,
  Crown,
  Star,
  TrendingDown,
  Activity,
  Monitor,
  Server,
  Globe,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  LineChart,
  AreaChart,
  Repeat,
  Link2,
  HardDrive,
  Smartphone,
  Laptop,
  Layers,
  Sparkles,
} from "lucide-react";

// ============================================================
// TYPES - READ ONLY
// ============================================================

interface RevenueData {
  success: boolean;
  period: string;
  summary: {
    total_revenue: number;
    total_licenses_sold: number;
    current_period_revenue: number;
    current_period_licenses: number;
    previous_period_revenue: number;
    revenue_growth_percent: number;
  };
  by_product: Array<{
    product_id: string;
    product_name: string;
    revenue: number;
    licenses_sold: number;
  }>;
  monthly_trend: Array<{
    month: string;
    month_name: string;
    revenue: number;
    licenses: number;
  }>;
  currency: string;
}

interface DashboardStats {
  success: boolean;
  total_licenses: number;
  active_licenses: number;
  expired_licenses: number;
  revoked_licenses: number;
  active_trials: number;
  online_devices_24h: number;
  database: string;
  license_health?: {
    total: number;
    active: number;
    inactive: number;
    expired: number;
    revoked: number;
  };
  converted_trials?: number;
  trial_conversion_rate?: number;
  trials_by_status?: {
    active: number;
    expired: number;
    converted: number;
  };
  total_templates?: number;
  total_activations?: number;
  recent_conversions?: Array<{
    hardware_id: string;
    license_key: string;
    customer_name: string;
    customer_email: string;
    product_name: string;
    converted_at: string;
  }>;
}

interface ProductStats {
  success: boolean;
  products: Array<{
    product_id: string;
    name: string;
    version: string;
    price: number;
    is_active: boolean;
    license_stats: {
      total: number;
      active: number;
      expired: number;
      revoked: number;
    };
    hardware_stats: {
      total_activations: number;
      online_devices_24h: number;
      utilization_rate_percent: number;
    };
    trial_stats: {
      active_trials: number;
      converted_trials: number;
      conversion_rate_percent: number;
    };
    revenue: number;
  }>;
  summary: {
    total_products: number;
    total_licenses_all_products: number;
    total_active_licenses: number;
    total_revenue: number;
  };
}

interface CustomerData {
  success: boolean;
  data: Array<{
    id: string;
    name: string;
    email: string;
    total_licenses: number;
    active_licenses: number;
    expired_licenses: number;
    revoked_licenses: number;
    license_keys: string[];
  }>;
  count: number;
}

interface HardwareDevice {
  id: number;
  hardware_id: string;
  device_name: string;
  online_status: "online" | "offline";
  last_seen: string;
  license_key: string;
}

// ============================================================
// SAFE ARRAY HELPERS
// ============================================================

function safeBest<T>(arr: T[] | undefined, getValue: (item: T) => number): T | null {
  if (!arr || arr.length === 0) return null;
  return arr.reduce((a, b) => getValue(a) > getValue(b) ? a : b);
}

function safeWorst<T>(arr: T[] | undefined, getValue: (item: T) => number): T | null {
  if (!arr || arr.length === 0) return null;
  return arr.reduce((a, b) => getValue(a) < getValue(b) ? a : b);
}

function safeSum<T>(arr: T[] | undefined, getValue: (item: T) => number): number {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((sum, item) => sum + getValue(item), 0);
}

function safeCount<T>(arr: T[] | undefined, predicate: (item: T) => boolean): number {
  if (!arr || arr.length === 0) return 0;
  return arr.filter(predicate).length;
}

function safeAverage<T>(arr: T[] | undefined, getValue: (item: T) => number): number {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((sum, item) => sum + getValue(item), 0) / arr.length;
}

// ============================================================
// COMPONENTS
// ============================================================

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  subtitle?: string;
  color?: "blue" | "green" | "purple" | "cyan" | "amber" | "pink" | "indigo" | "red";
}

function MetricCard({ title, value, icon, trend, subtitle, color = "blue" }: MetricCardProps) {
  const colorClasses: Record<string, string> = {
    blue: "border-[var(--api-blue-500-20)] bg-[var(--api-blue-500-5)]",
    green: "border-[var(--api-green-500-20)] bg-[var(--api-green-500-5)]",
    purple: "border-[var(--api-purple-500-20)] bg-[var(--api-purple-500-5)]",
    cyan: "border-[var(--api-cyan-500-20)] bg-[var(--api-cyan-500-5)]",
    amber: "border-[var(--api-amber-500-20)] bg-[var(--api-amber-500-5)]",
    red: "border-[var(--api-red-500-20)] bg-[var(--api-red-500-5)]",
    pink: "border-[var(--api-pink-500-20)] bg-[var(--api-pink-500-5)]",
    indigo: "border-[var(--api-indigo-500-20)] bg-[var(--api-indigo-500-5)]",
  };

  const iconColors: Record<string, string> = {
    blue: "text-[var(--api-blue-400)]",
    green: "text-[var(--api-green-400)]",
    purple: "text-[var(--api-purple-400)]",
    cyan: "text-[var(--api-cyan-400)]",
    amber: "text-[var(--api-amber-400)]",
    red: "text-[var(--api-red-400)]",
    pink: "text-[var(--api-pink-400)]",
    indigo: "text-[var(--api-indigo-400)]",
  };

  return (
    <div className={`rounded-2xl border ${colorClasses[color]} p-5 backdrop-blur-sm transition-all duration-200 hover:scale-[1.02] hover:shadow-lg`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`${iconColors[color]}`}>{icon}</div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs ${trend.isPositive ? "text-[var(--api-green-400)]" : "text-[var(--api-red-400)]"}`}>
            {trend.isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            <span>{Math.abs(trend.value).toFixed(1)}%</span>
          </div>
        )}
      </div>
      <p className="text-sm text-[var(--text-secondary)]">{title}</p>
      <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">{value}</p>
      {subtitle && <p className="text-xs text-[var(--text-muted)] mt-1">{subtitle}</p>}
    </div>
  );
}

interface InsightCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description: string;
  color?: "blue" | "green" | "purple" | "cyan" | "amber" | "pink" | "indigo" | "red";
}

function InsightCard({ title, value, icon, description, color = "blue" }: InsightCardProps) {
  const colorClasses: Record<string, string> = {
    blue: "border-[var(--api-blue-500-20)] bg-[var(--api-blue-500-5)]",
    green: "border-[var(--api-green-500-20)] bg-[var(--api-green-500-5)]",
    purple: "border-[var(--api-purple-500-20)] bg-[var(--api-purple-500-5)]",
    cyan: "border-[var(--api-cyan-500-20)] bg-[var(--api-cyan-500-5)]",
    amber: "border-[var(--api-amber-500-20)] bg-[var(--api-amber-500-5)]",
    red: "border-[var(--api-red-500-20)] bg-[var(--api-red-500-5)]",
    pink: "border-[var(--api-pink-500-20)] bg-[var(--api-pink-500-5)]",
    indigo: "border-[var(--api-indigo-500-20)] bg-[var(--api-indigo-500-5)]",
  };

  const iconColors: Record<string, string> = {
    blue: "text-[var(--api-blue-400)] bg-[var(--api-blue-500-10)]",
    green: "text-[var(--api-green-400)] bg-[var(--api-green-500-10)]",
    purple: "text-[var(--api-purple-400)] bg-[var(--api-purple-500-10)]",
    cyan: "text-[var(--api-cyan-400)] bg-[var(--api-cyan-500-10)]",
    amber: "text-[var(--api-amber-400)] bg-[var(--api-amber-500-10)]",
    red: "text-[var(--api-red-400)] bg-[var(--api-red-500-10)]",
    pink: "text-[var(--api-pink-400)] bg-[var(--api-pink-500-10)]",
    indigo: "text-[var(--api-indigo-400)] bg-[var(--api-indigo-500-10)]",
  };

  return (
    <div className={`rounded-2xl border ${colorClasses[color]} p-5 backdrop-blur-sm transition-all duration-200 hover:shadow-lg`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`rounded-xl p-2 ${iconColors[color]}`}>
          {icon}
        </div>
        <span className="text-2xl font-bold text-[var(--text-primary)]">{value}</span>
      </div>
      <p className="font-medium text-[var(--text-primary)]">{title}</p>
      <p className="text-xs text-[var(--text-muted)] mt-1">{description}</p>
    </div>
  );
}

// ============================================================
// CONVERSION ITEM COMPONENT
// ============================================================

interface ConversionItemProps {
  conversion: {
    hardware_id: string;
    license_key: string;
    customer_name: string;
    customer_email: string;
    product_name: string;
    converted_at: string;
  };
}

function ConversionItem({ conversion }: ConversionItemProps) {
  const formatDate = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (hours < 1) return "Just now";
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 hover:bg-[var(--bg-tertiary)]/10 transition-all">
      <div className="p-2 rounded-lg bg-[var(--api-green-500-10)]">
        <CheckCircle className="h-4 w-4 text-[var(--api-green-400)]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-[var(--text-primary)]">{conversion.customer_name}</span>
          <span className="text-xs text-[var(--text-muted)]">{conversion.customer_email}</span>
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-[var(--text-muted)] flex-wrap">
          <span className="font-mono">{conversion.license_key}</span>
          <span>→</span>
          <span>{conversion.product_name}</span>
          <span className="text-[var(--api-green-400)]">●</span>
          <span>{formatDate(conversion.converted_at)}</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MAIN ANALYTICS PAGE
// ============================================================

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<"month" | "quarter" | "year">("month");
  const [revenueData, setRevenueData] = useState<RevenueData | null>(null);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [productStats, setProductStats] = useState<ProductStats | null>(null);
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);
  const [hardwareDevices, setHardwareDevices] = useState<HardwareDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const API_BASE = "/internal/backend";

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);

    try {
      const [
        revenueRes,
        dashboardRes,
        statsRes,
        customersRes,
        hardwareRes,
      ] = await Promise.all([
        fetch(`${API_BASE}/admin/revenue?period=${period}`),
        fetch(`${API_BASE}/admin/dashboard`),
        fetch(`${API_BASE}/admin/stats/products`),
        fetch(`${API_BASE}/customers`),
        fetch(`${API_BASE}/hardware`),
      ]);

      const [
        revenueResult,
        dashboardResult,
        statsResult,
        customersResult,
        hardwareResult,
      ] = await Promise.all([
        revenueRes.json(),
        dashboardRes.json(),
        statsRes.json(),
        customersRes.json(),
        hardwareRes.json(),
      ]);

      if (revenueResult.success) setRevenueData(revenueResult);
      if (dashboardResult.success) setDashboardStats(dashboardResult);
      if (statsResult.success) setProductStats(statsResult);
      if (customersResult.success) setCustomerData(customersResult);
      if (hardwareResult.success) setHardwareDevices(hardwareResult.data || []);

      setLastUpdated(new Date());
    } catch (err) {
      console.error("Analytics fetch error:", err);
      setError("Failed to load analytics data. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const downloadReport = () => {
    const report = {
      generated_at: new Date().toISOString(),
      period,
      revenue: revenueData,
      dashboard: dashboardStats,
      product_stats: productStats,
      customers: customerData,
      hardware: hardwareDevices,
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics_report_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Derived data
  const totalRevenue = revenueData?.summary?.total_revenue || 0;
  const revenueGrowth = revenueData?.summary?.revenue_growth_percent || 0;
  const totalLicenses = dashboardStats?.total_licenses || 0;
  const activeLicenses = dashboardStats?.active_licenses || 0;
  const expiredLicenses = dashboardStats?.expired_licenses || 0;
  const revokedLicenses = dashboardStats?.revoked_licenses || 0;
  const totalCustomers = customerData?.count || 0;
  const totalHardware = hardwareDevices.length || 0;
  const onlineHardware = safeCount(hardwareDevices, (d) => d.online_status === "online");
  const offlineHardware = totalHardware - onlineHardware;
  const activeTrials = dashboardStats?.active_trials || 0;

  // NEW: License Health
  const licenseHealth = dashboardStats?.license_health || {
    total: 0,
    active: 0,
    inactive: 0,
    expired: 0,
    revoked: 0,
  };

  // NEW: Trial Conversion Analytics
  const convertedTrials = dashboardStats?.converted_trials || 0;
  const trialConversionRate = dashboardStats?.trial_conversion_rate || 0;
  const trialsByStatus = dashboardStats?.trials_by_status || {
    active: 0,
    expired: 0,
    converted: 0,
  };
  const totalTemplates = dashboardStats?.total_templates || 0;
  const totalActivations = dashboardStats?.total_activations || 0;
  const recentConversions = dashboardStats?.recent_conversions || [];

  // Product metrics
  const products = productStats?.products || [];
  const bestProduct = safeBest(products, (p) => p.revenue);
  const worstProduct = safeWorst(products, (p) => p.revenue);
  const highestActivationProduct = safeBest(products, (p) => p.hardware_stats.total_activations);
  const highestConversionProduct = safeBest(products, (p) => p.trial_stats.conversion_rate_percent);
  const topCustomer = safeBest(customerData?.data, (c) => c.total_licenses);

  const avgConversionRate = products.length > 0 
    ? safeAverage(products, (p) => p.trial_stats.conversion_rate_percent) 
    : 0;

  if (loading && !revenueData) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 text-[var(--api-blue-400)] animate-spin" />
        <span className="ml-3 text-[var(--text-secondary)]">Loading analytics...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Analytics Dashboard</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Business intelligence & reporting center — Read only
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)]/20 p-1">
            <button
              onClick={() => setPeriod("month")}
              className={`px-3 py-1.5 text-sm rounded-md transition-all ${
                period === "month"
                  ? "bg-[var(--api-blue-500-20)] text-[var(--api-blue-400)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setPeriod("quarter")}
              className={`px-3 py-1.5 text-sm rounded-md transition-all ${
                period === "quarter"
                  ? "bg-[var(--api-blue-500-20)] text-[var(--api-blue-400)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              Quarter
            </button>
            <button
              onClick={() => setPeriod("year")}
              className={`px-3 py-1.5 text-sm rounded-md transition-all ${
                period === "year"
                  ? "bg-[var(--api-blue-500-20)] text-[var(--api-blue-400)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              Year
            </button>
          </div>

          <button
            onClick={fetchAnalytics}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 hover:text-[var(--text-primary)] transition-all disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>

          <button
            onClick={downloadReport}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 text-sm text-[var(--api-blue-400)] hover:bg-[var(--api-blue-500-20)] transition-all"
          >
            <Download size={14} />
            Export
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-2xl border border-[var(--api-red-500-20)] bg-[var(--api-red-500-5)] p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-[var(--api-red-400)]" />
            <p className="text-[var(--api-red-400)] text-sm">{error}</p>
            <button onClick={fetchAnalytics} className="ml-auto text-sm text-[var(--api-blue-400)] hover:text-blue-300">
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* ============================================================
           NEW: LICENSE HEALTH ANALYTICS
      ============================================================ */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-[var(--api-blue-400)]" />
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">License Health Analytics</h2>
          <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-tertiary)]/30 px-2 py-0.5 rounded-full">
            Real-time
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <MetricCard
            title="Total Licenses"
            value={formatNumber(licenseHealth.total)}
            icon={<KeyRound className="h-5 w-5" />}
            color="purple"
          />
          <MetricCard
            title="Active"
            value={formatNumber(licenseHealth.active)}
            icon={<CheckCircle className="h-5 w-5" />}
            subtitle={`${licenseHealth.total > 0 ? Math.round((licenseHealth.active / licenseHealth.total) * 100) : 0}% of total`}
            color="green"
          />
          <MetricCard
            title="Inactive"
            value={formatNumber(licenseHealth.inactive)}
            icon={<AlertCircle className="h-5 w-5" />}
            color="amber"
          />
          <MetricCard
            title="Expired"
            value={formatNumber(licenseHealth.expired)}
            icon={<AlertTriangle className="h-5 w-5" />}
            color="red"
          />
          <MetricCard
            title="Revoked"
            value={formatNumber(licenseHealth.revoked)}
            icon={<XCircle className="h-5 w-5" />}
            color="red"
          />
        </div>

        {/* License Health Bar */}
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 p-4">
          <div className="flex h-3 rounded-full overflow-hidden bg-[var(--bg-tertiary)]/20">
            {licenseHealth.total > 0 && (
              <>
                <div 
                  className="bg-[var(--api-green-400)] transition-all duration-500"
                  style={{ width: `${(licenseHealth.active / licenseHealth.total) * 100}%` }}
                />
                <div 
                  className="bg-[var(--api-amber-400)] transition-all duration-500"
                  style={{ width: `${(licenseHealth.inactive / licenseHealth.total) * 100}%` }}
                />
                <div 
                  className="bg-[var(--api-red-400)] transition-all duration-500"
                  style={{ width: `${((licenseHealth.expired + licenseHealth.revoked) / licenseHealth.total) * 100}%` }}
                />
              </>
            )}
          </div>
          <div className="flex gap-4 mt-2 text-xs text-[var(--text-muted)]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[var(--api-green-400)]" /> Active</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[var(--api-amber-400)]" /> Inactive</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[var(--api-red-400)]" /> Expired/Revoked</span>
          </div>
        </div>
      </section>

      {/* ============================================================
           NEW: TRIAL CONVERSION ANALYTICS
      ============================================================ */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Repeat className="h-5 w-5 text-[var(--api-purple-400)]" />
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">Trial Conversion Analytics</h2>
          <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-tertiary)]/30 px-2 py-0.5 rounded-full">
            Conversion Tracking
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <MetricCard
            title="Active Trials"
            value={formatNumber(trialsByStatus.active)}
            icon={<FlaskConical className="h-5 w-5" />}
            color="pink"
          />
          <MetricCard
            title="Expired Trials"
            value={formatNumber(trialsByStatus.expired)}
            icon={<AlertTriangle className="h-5 w-5" />}
            color="amber"
          />
          <MetricCard
            title="Converted Trials"
            value={formatNumber(trialsByStatus.converted)}
            icon={<CheckCircle className="h-5 w-5" />}
            color="green"
          />
          <MetricCard
            title="Conversion Rate"
            value={`${trialConversionRate}%`}
            icon={<Target className="h-5 w-5" />}
            color="purple"
          />
          <MetricCard
            title="Trial Templates"
            value={formatNumber(totalTemplates)}
            icon={<Layers className="h-5 w-5" />}
            color="indigo"
          />
        </div>

        {/* Recent Conversions */}
        {recentConversions.length > 0 && (
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-[var(--text-secondary)]">Recent Trial Conversions</span>
              <span className="text-xs text-[var(--text-muted)]">{recentConversions.length} latest</span>
            </div>
            <div className="space-y-2">
              {recentConversions.map((conversion, index) => (
                <ConversionItem key={index} conversion={conversion} />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ============================================================
           SECTION 1: REVENUE ANALYTICS
      ============================================================ */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-[var(--api-green-400)]" />
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">Revenue Analytics</h2>
          <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-tertiary)]/30 px-2 py-0.5 rounded-full">
            {period}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Revenue"
            value={formatCurrency(totalRevenue)}
            icon={<DollarSign className="h-5 w-5" />}
            trend={{ value: revenueGrowth, isPositive: revenueGrowth >= 0 }}
            subtitle={`${formatNumber(revenueData?.summary?.total_licenses_sold || 0)} licenses sold`}
            color="green"
          />
          <MetricCard
            title={`Revenue (${period})`}
            value={formatCurrency(revenueData?.summary?.current_period_revenue || 0)}
            icon={<TrendingUp className="h-5 w-5" />}
            subtitle={`${formatNumber(revenueData?.summary?.current_period_licenses || 0)} new licenses`}
            color="blue"
          />
          <MetricCard
            title="Revenue Growth"
            value={`${revenueGrowth >= 0 ? "+" : ""}${revenueGrowth.toFixed(1)}%`}
            icon={revenueGrowth >= 0 ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
            color={revenueGrowth >= 0 ? "green" : "red"}
            subtitle={`vs previous ${period}`}
          />
          <MetricCard
            title="Best Revenue Product"
            value={bestProduct?.name || "N/A"}
            icon={<Crown className="h-5 w-5" />}
            subtitle={bestProduct ? formatCurrency(bestProduct.revenue) : "No data"}
            color="amber"
          />
        </div>

        {revenueData?.monthly_trend && revenueData.monthly_trend.length > 0 && (
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <LineChart className="h-5 w-5 text-[var(--api-blue-400)]" />
                <h3 className="font-semibold text-[var(--text-primary)]">Revenue Trend</h3>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="text-[var(--text-secondary)]">Revenue</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-[var(--text-secondary)]">Licenses</span>
                </div>
              </div>
            </div>
            <div className="flex items-end justify-between gap-2 h-64">
              {revenueData.monthly_trend.map((month, idx) => {
                const maxRevenue = Math.max(...revenueData.monthly_trend.map(m => m.revenue), 1);
                const maxLicenses = Math.max(...revenueData.monthly_trend.map(m => m.licenses), 1);
                const revenueHeight = (month.revenue / maxRevenue) * 200;
                const licensesHeight = (month.licenses / maxLicenses) * 200;

                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                    <div className="relative w-full flex justify-center gap-1 h-52">
                      <div
                        className="w-8 bg-blue-500/30 rounded-t transition-all hover:bg-blue-500/70 hover:scale-105"
                        style={{ height: `${revenueHeight}px`, alignSelf: "flex-end" }}
                      />
                      <div
                        className="w-8 bg-green-500/30 rounded-t transition-all hover:bg-green-500/70 hover:scale-105"
                        style={{ height: `${licensesHeight}px`, alignSelf: "flex-end" }}
                      />
                    </div>
                    <span className="text-xs text-[var(--text-muted)]">{month.month_name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* ============================================================
           SECTION 2: LICENSE ANALYTICS (Enhanced)
      ============================================================ */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-[var(--api-purple-400)]" />
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">License Analytics</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Licenses"
            value={formatNumber(totalLicenses)}
            icon={<KeyRound className="h-5 w-5" />}
            color="purple"
          />
          <MetricCard
            title="Active Licenses"
            value={formatNumber(activeLicenses)}
            icon={<CheckCircle className="h-5 w-5" />}
            subtitle={`${totalLicenses > 0 ? Math.round((activeLicenses / totalLicenses) * 100) : 0}% of total`}
            color="green"
          />
          <MetricCard
            title="Expired Licenses"
            value={formatNumber(expiredLicenses)}
            icon={<AlertTriangle className="h-5 w-5" />}
            color="amber"
          />
          <MetricCard
            title="Revoked Licenses"
            value={formatNumber(revokedLicenses)}
            icon={<XCircle className="h-5 w-5" />}
            color="red"
          />
        </div>
      </section>

      {/* ============================================================
           SECTION 3: CUSTOMER ANALYTICS
      ============================================================ */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-[var(--api-cyan-400)]" />
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">Customer Analytics</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Customers"
            value={formatNumber(totalCustomers)}
            icon={<Users className="h-5 w-5" />}
            color="cyan"
          />
          <MetricCard
            title="Licenses/Customer"
            value={totalCustomers > 0 ? (totalLicenses / totalCustomers).toFixed(1) : "0"}
            icon={<Package className="h-5 w-5" />}
            color="blue"
          />
          <MetricCard
            title="Active Customers"
            value={formatNumber(safeCount(customerData?.data, (c) => c.active_licenses > 0))}
            icon={<Activity className="h-5 w-5" />}
            color="green"
          />
          <MetricCard
            title="Top Customer"
            value={topCustomer?.name || "N/A"}
            icon={<Crown className="h-5 w-5" />}
            color="amber"
          />
        </div>
      </section>

      {/* ============================================================
           SECTION 4: HARDWARE ANALYTICS
      ============================================================ */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Cpu className="h-5 w-5 text-[var(--api-indigo-400)]" />
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">Hardware Analytics</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Activations"
            value={formatNumber(totalActivations || totalHardware)}
            icon={<Cpu className="h-5 w-5" />}
            color="indigo"
          />
          <MetricCard
            title="Total Devices"
            value={formatNumber(totalHardware)}
            icon={<HardDrive className="h-5 w-5" />}
            color="purple"
          />
          <MetricCard
            title="Online Devices"
            value={formatNumber(onlineHardware)}
            icon={<Monitor className="h-5 w-5" />}
            subtitle={`${totalHardware > 0 ? Math.round((onlineHardware / totalHardware) * 100) : 0}% online`}
            color="green"
          />
          <MetricCard
            title="Offline Devices"
            value={formatNumber(offlineHardware)}
            icon={<XCircle className="h-5 w-5" />}
            color="red"
          />
        </div>
      </section>

      {/* ============================================================
           SECTION 5: PRODUCT PERFORMANCE
      ============================================================ */}
      {productStats && productStats.products && productStats.products.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-[var(--api-blue-400)]" />
            <h2 className="text-xl font-semibold text-[var(--text-primary)]">Product Performance</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {productStats.products.map((product) => (
              <div
                key={product.product_id}
                className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 p-4 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-[var(--text-primary)]">{product.name}</h4>
                    <p className="text-xs text-[var(--text-muted)]">v{product.version}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    product.is_active
                      ? 'bg-[var(--api-green-500-10)] text-[var(--api-green-400)] border border-[var(--api-green-500-20)]'
                      : 'bg-[var(--api-red-500-10)] text-[var(--api-red-400)] border border-[var(--api-red-500-20)]'
                  }`}>
                    {product.is_active ? "Active" : "Inactive"}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs text-[var(--text-muted)]">Revenue</p>
                    <p className="text-sm font-semibold text-[var(--api-green-400)]">{formatCurrency(product.revenue)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--text-muted)]">Licenses</p>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{formatNumber(product.license_stats.total)}</p>
                    <div className="flex gap-1 text-[10px]">
                      <span className="text-[var(--api-green-400)]">{product.license_stats.active} active</span>
                      <span className="text-[var(--api-red-400)]">{product.license_stats.expired} expired</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--text-muted)]">Conversion</p>
                    <p className="text-sm font-semibold text-[var(--api-amber-400)]">{product.trial_stats.conversion_rate_percent}%</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ============================================================
           SECTION 6: BUSINESS INSIGHTS
      ============================================================ */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5 text-[var(--api-amber-400)]" />
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">Business Insights</h2>
          <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-tertiary)]/30 px-2 py-0.5 rounded-full">
            Intelligence Only
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <InsightCard
            title="Best Revenue Product"
            value={bestProduct?.name || "N/A"}
            icon={<Star className="h-5 w-5" />}
            description={bestProduct ? `${formatCurrency(bestProduct.revenue)} revenue · ${formatNumber(bestProduct.license_stats.total)} licenses` : "No data"}
            color="amber"
          />
          <InsightCard
            title="Highest Activation Product"
            value={highestActivationProduct?.name || "N/A"}
            icon={<Zap className="h-5 w-5" />}
            description={highestActivationProduct ? `${formatNumber(highestActivationProduct.hardware_stats.total_activations)} activations · ${highestActivationProduct.hardware_stats.utilization_rate_percent}% utilization` : "No data"}
            color="blue"
          />
          <InsightCard
            title="Highest Trial Conversion"
            value={highestConversionProduct?.name || "N/A"}
            icon={<Rocket className="h-5 w-5" />}
            description={highestConversionProduct ? `${highestConversionProduct.trial_stats.conversion_rate_percent}% conversion rate` : "No data"}
            color="green"
          />
          <InsightCard
            title="Total Revenue Growth"
            value={`${revenueGrowth >= 0 ? "+" : ""}${revenueGrowth.toFixed(1)}%`}
            icon={revenueGrowth >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
            description={`${revenueGrowth >= 0 ? "Growing" : "Declining"} ${period} over ${period}`}
            color={revenueGrowth >= 0 ? "green" : "red"}
          />
          <InsightCard
            title="Active License Rate"
            value={`${totalLicenses > 0 ? Math.round((activeLicenses / totalLicenses) * 100) : 0}%`}
            icon={<Target className="h-5 w-5" />}
            description={`${formatNumber(activeLicenses)} active of ${formatNumber(totalLicenses)} total`}
            color="purple"
          />
          <InsightCard
            title="Device Online Rate"
            value={`${totalHardware > 0 ? Math.round((onlineHardware / totalHardware) * 100) : 0}%`}
            icon={<Globe className="h-5 w-5" />}
            description={`${formatNumber(onlineHardware)} online of ${formatNumber(totalHardware)} total`}
            color="cyan"
          />
        </div>
      </section>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-[var(--text-muted)] pt-4 border-t border-[var(--border-color)]">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span>Analytics API: Online</span>
          <span className="text-[var(--text-muted)]/50">•</span>
          <span>Read Only</span>
          <span className="text-[var(--text-muted)]/50">•</span>
          <span>v1.0</span>
        </div>
        {lastUpdated && (
          <div className="flex items-center gap-2">
            <Calendar size={12} />
            <span>Last updated: {lastUpdated.toLocaleString()}</span>
          </div>
        )}
      </div>
    </div>
  );
}