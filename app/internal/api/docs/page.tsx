// FILE: app/internal/api/docs/page.tsx
// PURPOSE: Developer Portal - API documentation and integration guide
// SCOPE: Architecture, Workflow, API Docs, Examples, Error Codes, Webhooks, SDK, Integration Guide, API Explorer
// RULE: UI only - NO database queries, NO business logic
// RULE: Theme variables only - NO hardcoded colors
// FIX: All hardcoded colors replaced with CSS variables

"use client";

import { useState } from "react";
import {
  BookOpen,
  Code,
  Copy,
  Check,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Server,
  Key,
  Shield,
  Zap,
  Cpu,
  Globe,
  Mail,
  Lock,
  Database,
  Cloud,
  Smartphone,
  Monitor,
  Laptop,
  Package,
  Users,
  BarChart3,
  Activity,
  FileText,
  Link2,
  Play,
  Send,
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  Info,
  Terminal,
  Command,
  GitBranch,
  MessageCircle,
  Bookmark,
  Search,
  Menu,
  ArrowRight,
  ArrowUpRight,
  Sparkles,
  Rocket,
  ShieldCheck,
  Fingerprint,
  Clock,
  Calendar,
  DollarSign,
  Percent,
  TrendingUp,
  Layers,
  Grid,
  List,
  Maximize2,
  Minimize2,
} from "lucide-react";

// ============================================================
// TYPES
// ============================================================

interface ApiEndpoint {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  description: string;
  auth: boolean;
  example: string;
  response: string;
}

interface ErrorCode {
  code: number;
  name: string;
  description: string;
  solution: string;
}

interface WebhookEvent {
  event: string;
  description: string;
  payload: string;
}

// ============================================================
// SIDEBAR NAVIGATION
// ============================================================

const navItems = [
  { id: "overview", label: "Overview", icon: <BookOpen size={16} /> },
  { id: "architecture", label: "Architecture", icon: <Server size={16} /> },
  { id: "workflow", label: "Workflow", icon: <GitBranch size={16} /> },
  { id: "api-reference", label: "API Reference", icon: <Code size={16} /> },
  { id: "examples", label: "Examples", icon: <Terminal size={16} /> },
  { id: "error-codes", label: "Error Codes", icon: <AlertCircle size={16} /> },
  { id: "webhooks", label: "Webhooks", icon: <Link2 size={16} /> },
  { id: "sdk", label: "SDK", icon: <Package size={16} /> },
  { id: "integration", label: "Integration Guide", icon: <Rocket size={16} /> },
  { id: "explorer", label: "API Explorer", icon: <Play size={16} /> },
];

// ============================================================
// API ENDPOINTS DATA
// ============================================================

const endpoints: ApiEndpoint[] = [
  {
    method: "POST",
    path: "/api/licenses/generate",
    description: "Generate a new license key",
    auth: true,
    example: `{
  "productId": "prod_123",
  "customerName": "John Doe",
  "customerEmail": "john@example.com",
  "plan": "monthly",
  "maxDevices": 3
}`,
    response: `{
  "success": true,
  "license_key": "WS-XXXX-XXXX-XXXX-XXXX",
  "expiry_date": "2025-12-31T23:59:59Z",
  "message": "License generated successfully"
}`,
  },
  {
    method: "POST",
    path: "/api/licenses/validate",
    description: "Validate a license key",
    auth: false,
    example: `{
  "licenseKey": "WS-XXXX-XXXX-XXXX-XXXX"
}`,
    response: `{
  "success": true,
  "valid": true,
  "message": "License is valid",
  "product": "Websmith API Pro",
  "plan": "monthly",
  "expiry_date": "2025-12-31T23:59:59Z"
}`,
  },
  {
    method: "POST",
    path: "/api/licenses/activate",
    description: "Activate a license on a device",
    auth: true,
    example: `{
  "licenseKey": "WS-XXXX-XXXX-XXXX-XXXX",
  "hardwareId": "HW-1234567890",
  "deviceName": "Production Server",
  "osVersion": "Ubuntu 22.04"
}`,
    response: `{
  "success": true,
  "message": "License activated successfully",
  "activation_id": "act_123456",
  "activated_at": "2024-01-15T10:30:00Z"
}`,
  },
  {
    method: "POST",
    path: "/api/licenses/deactivate",
    description: "Deactivate a license from a device",
    auth: true,
    example: `{
  "licenseKey": "WS-XXXX-XXXX-XXXX-XXXX",
  "hardwareId": "HW-1234567890"
}`,
    response: `{
  "success": true,
  "message": "License deactivated successfully",
  "deactivated_at": "2024-01-15T10:30:00Z"
}`,
  },
  {
    method: "GET",
    path: "/api/licenses/:key",
    description: "Get license details by key",
    auth: true,
    example: "GET /api/licenses/WS-XXXX-XXXX-XXXX-XXXX",
    response: `{
  "success": true,
  "license": {
    "key": "WS-XXXX-XXXX-XXXX-XXXX",
    "product": "Websmith API Pro",
    "customer": "John Doe",
    "email": "john@example.com",
    "plan": "monthly",
    "status": "active",
    "expiry_date": "2025-12-31T23:59:59Z",
    "max_devices": 3,
    "active_devices": 2
  }
}`,
  },
  {
    method: "POST",
    path: "/api/trials/start",
    description: "Start a free trial",
    auth: false,
    example: `{
  "productId": "prod_123",
  "customerName": "Jane Smith",
  "customerEmail": "jane@example.com"
}`,
    response: `{
  "success": true,
  "trial_id": "trial_123456",
  "license_key": "WS-TRIAL-XXXX-XXXX",
  "expiry_date": "2024-02-15T10:30:00Z",
  "message": "Trial started successfully"
}`,
  },
  {
    method: "POST",
    path: "/api/devices/bind",
    description: "Bind a device to a license",
    auth: true,
    example: `{
  "licenseKey": "WS-XXXX-XXXX-XXXX-XXXX",
  "hardwareId": "HW-1234567890",
  "deviceName": "Workstation 1",
  "ipAddress": "192.168.1.100"
}`,
    response: `{
  "success": true,
  "message": "Device bound successfully",
  "device_id": "dev_123456",
  "bound_at": "2024-01-15T10:30:00Z"
}`,
  },
  {
    method: "POST",
    path: "/api/devices/replace",
    description: "Replace a bound device",
    auth: true,
    example: `{
  "licenseKey": "WS-XXXX-XXXX-XXXX-XXXX",
  "oldHardwareId": "HW-1234567890",
  "newHardwareId": "HW-0987654321",
  "newDeviceName": "Workstation 2"
}`,
    response: `{
  "success": true,
  "message": "Device replaced successfully",
  "old_device": "HW-1234567890",
  "new_device": "HW-0987654321",
  "replaced_at": "2024-01-15T10:30:00Z"
}`,
  },
  {
    method: "POST",
    path: "/api/devices/reset",
    description: "Reset all devices for a license",
    auth: true,
    example: `{
  "licenseKey": "WS-XXXX-XXXX-XXXX-XXXX"
}`,
    response: `{
  "success": true,
  "message": "All devices reset successfully",
  "devices_removed": 3,
  "reset_at": "2024-01-15T10:30:00Z"
}`,
  },
  {
    method: "GET",
    path: "/api/dashboard/stats",
    description: "Get dashboard statistics",
    auth: true,
    example: "GET /api/dashboard/stats",
    response: `{
  "success": true,
  "data": {
    "total_licenses": 1250,
    "active_licenses": 850,
    "total_devices": 2100,
    "online_devices": 1800,
    "total_customers": 420,
    "revenue": 45000,
    "growth": 12.5
  }
}`,
  },
];

// ============================================================
// ERROR CODES DATA
// ============================================================

const errorCodes: ErrorCode[] = [
  {
    code: 1001,
    name: "Invalid License Key",
    description: "The provided license key is not recognized or does not exist.",
    solution: "Verify the license key format and ensure it exists in the system.",
  },
  {
    code: 1002,
    name: "License Expired",
    description: "The license has expired and cannot be used.",
    solution: "Renew the license or contact support for assistance.",
  },
  {
    code: 1003,
    name: "License Revoked",
    description: "The license has been revoked by the administrator.",
    solution: "Contact support to investigate why the license was revoked.",
  },
  {
    code: 1004,
    name: "Max Devices Exceeded",
    description: "The license has reached its maximum device limit.",
    solution: "Deactivate unused devices or upgrade the license plan.",
  },
  {
    code: 1005,
    name: "Invalid Hardware ID",
    description: "The hardware ID format is invalid.",
    solution: "Ensure the hardware ID is correctly formatted and unique.",
  },
  {
    code: 1006,
    name: "Device Already Bound",
    description: "The hardware ID is already bound to a license.",
    solution: "Use the replacement endpoint to swap devices.",
  },
  {
    code: 1007,
    name: "Customer Not Found",
    description: "The customer email does not exist in the system.",
    solution: "Create the customer first or verify the email address.",
  },
  {
    code: 1008,
    name: "Product Not Found",
    description: "The product ID does not exist in the system.",
    solution: "Verify the product ID and ensure it is active.",
  },
  {
    code: 2001,
    name: "Invalid API Key",
    description: "The API key provided is invalid or missing.",
    solution: "Generate a new API key from the settings page.",
  },
  {
    code: 2002,
    name: "Rate Limit Exceeded",
    description: "Too many requests in a short period.",
    solution: "Implement exponential backoff and retry.",
  },
  {
    code: 2003,
    name: "Invalid Request Body",
    description: "The request body does not match the expected schema.",
    solution: "Validate the request against the API documentation.",
  },
  {
    code: 2004,
    name: "Unauthorized Access",
    description: "Authentication is required for this endpoint.",
    solution: "Include a valid API key in the Authorization header.",
  },
];

// ============================================================
// WEBHOOK EVENTS DATA
// ============================================================

const webhookEvents: WebhookEvent[] = [
  {
    event: "license.generated",
    description: "Fired when a new license is generated",
    payload: `{
  "event": "license.generated",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "license_key": "WS-XXXX-XXXX-XXXX-XXXX",
    "customer_name": "John Doe",
    "customer_email": "john@example.com",
    "product_id": "prod_123",
    "plan": "monthly",
    "expiry_date": "2025-12-31T23:59:59Z"
  }
}`,
  },
  {
    event: "license.validated",
    description: "Fired when a license is validated",
    payload: `{
  "event": "license.validated",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "license_key": "WS-XXXX-XXXX-XXXX-XXXX",
    "valid": true,
    "hardware_id": "HW-1234567890"
  }
}`,
  },
  {
    event: "device.bound",
    description: "Fired when a device is bound to a license",
    payload: `{
  "event": "device.bound",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "license_key": "WS-XXXX-XXXX-XXXX-XXXX",
    "hardware_id": "HW-1234567890",
    "device_name": "Workstation 1",
    "ip_address": "192.168.1.100"
  }
}`,
  },
  {
    event: "device.replaced",
    description: "Fired when a device is replaced",
    payload: `{
  "event": "device.replaced",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "license_key": "WS-XXXX-XXXX-XXXX-XXXX",
    "old_hardware_id": "HW-1234567890",
    "new_hardware_id": "HW-0987654321"
  }
}`,
  },
  {
    event: "device.reset",
    description: "Fired when all devices are reset for a license",
    payload: `{
  "event": "device.reset",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "license_key": "WS-XXXX-XXXX-XXXX-XXXX",
    "devices_removed": 3
  }
}`,
  },
  {
    event: "license.expiring",
    description: "Fired when a license is about to expire",
    payload: `{
  "event": "license.expiring",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "license_key": "WS-XXXX-XXXX-XXXX-XXXX",
    "days_until_expiry": 7,
    "expiry_date": "2025-12-31T23:59:59Z"
  }
}`,
  },
];

// ============================================================
// COMPONENTS
// ============================================================

interface CodeBlockProps {
  code: string;
  language?: string;
}

function CodeBlock({ code, language = "json" }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative rounded-xl bg-[var(--bg-tertiary)]/30 border border-[var(--border-color)] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-[var(--bg-tertiary)]/20 border-b border-[var(--border-color)]">
        <span className="text-xs text-[var(--text-muted)]">{language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          {copied ? (
            <>
              <Check size={14} className="text-[var(--api-green-400)]" />
              Copied
            </>
          ) : (
            <>
              <Copy size={14} />
              Copy
            </>
          )}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-sm text-[var(--text-primary)] font-mono">
        <code>{code}</code>
      </pre>
    </div>
  );
}

// ============================================================
// METHOD BADGE COMPONENT - FIXED
// ============================================================

interface MethodBadgeProps {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
}

function MethodBadge({ method }: MethodBadgeProps) {
  const colors = {
    GET: "text-[var(--api-green-400)] bg-[var(--api-green-500-10)] border-[var(--api-green-500-20)]",
    POST: "text-[var(--api-blue-400)] bg-[var(--api-blue-500-10)] border-[var(--api-blue-500-20)]",
    PUT: "text-[var(--api-amber-400)] bg-[var(--api-amber-500-10)] border-[var(--api-amber-500-20)]",
    DELETE: "text-[var(--api-red-400)] bg-[var(--api-red-500-10)] border-[var(--api-red-500-20)]",
    PATCH: "text-[var(--api-purple-400)] bg-[var(--api-purple-500-10)] border-[var(--api-purple-500-20)]",
  };

  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded border ${colors[method]}`}>
      {method}
    </span>
  );
}

// ============================================================
// ENDPOINT CARD COMPONENT
// ============================================================

interface EndpointCardProps {
  endpoint: ApiEndpoint;
}

function EndpointCard({ endpoint }: EndpointCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 transition-all duration-200 hover:shadow-lg overflow-hidden">
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-[var(--bg-tertiary)]/10 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <MethodBadge method={endpoint.method} />
        <code className="font-mono text-sm text-[var(--text-primary)] flex-1">{endpoint.path}</code>
        <span className="text-xs text-[var(--text-muted)]">{endpoint.description}</span>
        {endpoint.auth && (
          <span className="text-xs text-[var(--api-amber-400)] bg-[var(--api-amber-500-10)] px-2 py-0.5 rounded border border-[var(--api-amber-500-20)]">
            🔒 Auth
          </span>
        )}
        <button className="p-1 rounded-lg hover:bg-[var(--bg-tertiary)]/50 transition-colors">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-[var(--border-color)] p-4 space-y-4">
          <div>
            <p className="text-sm font-medium text-[var(--text-secondary)] mb-2">Request</p>
            <CodeBlock code={endpoint.example} />
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--text-secondary)] mb-2">Response</p>
            <CodeBlock code={endpoint.response} />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// MAIN DOCS PAGE - FIXED
// ============================================================

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const filteredEndpoints = endpoints.filter(
    (e) =>
      e.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  return (
    <div className="flex gap-6">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? "w-64" : "w-0"
        } flex-shrink-0 transition-all duration-300 overflow-hidden md:w-64`}
      >
        <div className="sticky top-0 space-y-1 py-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-[var(--bg-tertiary)]/30 transition-colors mb-2"
          >
            <Menu size={20} />
          </button>
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => scrollToSection(item.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                activeSection === item.id
                  ? "bg-[var(--api-blue-500-20)] text-[var(--api-blue-400)] border border-[var(--api-blue-500-30)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 hover:text-[var(--text-primary)]"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-12 pb-12">
        {/* Mobile header */}
        <div className="md:hidden flex items-center gap-2">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)]/30 transition-colors"
          >
            <Menu size={20} />
          </button>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Documentation</h1>
        </div>

        {/* Search - FIXED */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search documentation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-3 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--api-blue-500-50)] transition-all"
          />
        </div>

        {/* ============ OVERVIEW ============ */}
        <section id="overview">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-gradient-to-r from-[var(--api-blue-500-20)] to-[var(--api-purple-500-20)]">
              <BookOpen className="h-6 w-6 text-[var(--api-blue-400)]" />
            </div>
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">Overview</h2>
          </div>
          <div className="prose prose-invert max-w-none">
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Welcome to the Websmith API Center documentation. This guide will help you
              integrate with our license management system, enabling you to generate,
              validate, and manage software licenses programmatically.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="rounded-xl border border-[var(--border-color)] p-4 bg-[var(--bg-tertiary)]/10">
                <div className="p-2 rounded-lg bg-[var(--api-blue-500-10)] text-[var(--api-blue-400)] w-fit mb-2">
                  <Key size={20} />
                </div>
                <h4 className="font-semibold text-[var(--text-primary)]">License Management</h4>
                <p className="text-sm text-[var(--text-muted)]">Generate, validate, and manage software licenses</p>
              </div>
              <div className="rounded-xl border border-[var(--border-color)] p-4 bg-[var(--bg-tertiary)]/10">
                <div className="p-2 rounded-lg bg-[var(--api-green-500-10)] text-[var(--api-green-400)] w-fit mb-2">
                  <Cpu size={20} />
                </div>
                <h4 className="font-semibold text-[var(--text-primary)]">Device Management</h4>
                <p className="text-sm text-[var(--text-muted)]">Bind, replace, and reset devices per license</p>
              </div>
              <div className="rounded-xl border border-[var(--border-color)] p-4 bg-[var(--bg-tertiary)]/10">
                <div className="p-2 rounded-lg bg-[var(--api-purple-500-10)] text-[var(--api-purple-400)] w-fit mb-2">
                  <BarChart3 size={20} />
                </div>
                <h4 className="font-semibold text-[var(--text-primary)]">Analytics</h4>
                <p className="text-sm text-[var(--text-muted)]">Track usage, revenue, and system health</p>
              </div>
            </div>
          </div>
        </section>

        {/* ============ ARCHITECTURE ============ */}
        <section id="architecture">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-[var(--api-cyan-500-20)]">
              <Server className="h-6 w-6 text-[var(--api-cyan-400)]" />
            </div>
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">Architecture</h2>
          </div>
          <div className="prose prose-invert max-w-none">
            <p className="text-[var(--text-secondary)] leading-relaxed">
              The API Center follows a three-layer architecture:
            </p>
            <div className="space-y-4 mt-4">
              <div className="rounded-xl border border-[var(--border-color)] p-4 bg-[var(--bg-tertiary)]/10">
                <h4 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-[var(--api-blue-400)]" />
                  UI Layer
                </h4>
                <p className="text-sm text-[var(--text-muted)]">
                  React-based dashboard and management interfaces. No business logic, only display.
                </p>
              </div>
              <div className="rounded-xl border border-[var(--border-color)] p-4 bg-[var(--bg-tertiary)]/10">
                <h4 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
                  <Database className="h-4 w-4 text-[var(--api-green-400)]" />
                  Logic Layer
                </h4>
                <p className="text-sm text-[var(--text-muted)]">
                  Business logic, license generation, validation, device management, and revenue calculation.
                </p>
              </div>
              <div className="rounded-xl border border-[var(--border-color)] p-4 bg-[var(--bg-tertiary)]/10">
                <h4 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
                  <Cloud className="h-4 w-4 text-[var(--api-purple-400)]" />
                  Database Layer
                </h4>
                <p className="text-sm text-[var(--text-muted)]">
                  Neon PostgreSQL for storage, relations, indexes, and audit history.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ============ WORKFLOW ============ */}
        <section id="workflow">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-[var(--api-amber-500-20)]">
              <GitBranch className="h-6 w-6 text-[var(--api-amber-400)]" />
            </div>
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">Workflow</h2>
          </div>
          <div className="prose prose-invert max-w-none">
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Typical workflow for integrating with the API Center:
            </p>
            <div className="space-y-3 mt-4">
              <div className="flex items-start gap-3 p-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--api-blue-500-10)] text-[var(--api-blue-400)] flex items-center justify-center font-bold text-sm">
                  1
                </div>
                <div>
                  <p className="font-medium text-[var(--text-primary)]">Generate License</p>
                  <p className="text-sm text-[var(--text-muted)]">Create a new license for a customer with a specific product and plan</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--api-purple-500-10)] text-[var(--api-purple-400)] flex items-center justify-center font-bold text-sm">
                  2
                </div>
                <div>
                  <p className="font-medium text-[var(--text-primary)]">Validate License</p>
                  <p className="text-sm text-[var(--text-muted)]">Verify license authenticity and status before allowing access</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--api-green-500-10)] text-[var(--api-green-400)] flex items-center justify-center font-bold text-sm">
                  3
                </div>
                <div>
                  <p className="font-medium text-[var(--text-primary)]">Bind Device</p>
                  <p className="text-sm text-[var(--text-muted)]">Associate a device with the license for activation</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--api-amber-500-10)] text-[var(--api-amber-400)] flex items-center justify-center font-bold text-sm">
                  4
                </div>
                <div>
                  <p className="font-medium text-[var(--text-primary)]">Monitor & Manage</p>
                  <p className="text-sm text-[var(--text-muted)]">Track usage, renew licenses, replace devices as needed</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============ API REFERENCE ============ */}
        <section id="api-reference">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-[var(--api-blue-500-20)]">
              <Code className="h-6 w-6 text-[var(--api-blue-400)]" />
            </div>
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">API Reference</h2>
          </div>
          <div className="space-y-3">
            {searchQuery ? (
              filteredEndpoints.length === 0 ? (
                <p className="text-[var(--text-muted)] text-center py-8">No endpoints found matching "{searchQuery}"</p>
              ) : (
                filteredEndpoints.map((endpoint, index) => (
                  <EndpointCard key={index} endpoint={endpoint} />
                ))
              )
            ) : (
              endpoints.map((endpoint, index) => (
                <EndpointCard key={index} endpoint={endpoint} />
              ))
            )}
          </div>
        </section>

        {/* ============ EXAMPLES ============ */}
        <section id="examples">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-[var(--api-green-500-20)]">
              <Terminal className="h-6 w-6 text-[var(--api-green-400)]" />
            </div>
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">Examples</h2>
          </div>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-[var(--text-primary)] mb-2">Generate a License (cURL)</h4>
              <CodeBlock
                language="bash"
                code={`curl -X POST https://YOUR_API_URL/api/licenses/generate \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "productId": "prod_YOUR_PRODUCT",
    "customerName": "John Doe",
    "customerEmail": "john@example.com",
    "plan": "monthly",
    "maxDevices": 3
  }'`}
              />
            </div>
            <div>
              <h4 className="font-semibold text-[var(--text-primary)] mb-2">Validate a License (JavaScript)</h4>
              <CodeBlock
                language="javascript"
                code={`const response = await fetch('https://YOUR_API_URL/api/licenses/validate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    licenseKey: 'WS-XXXX-XXXX-XXXX-XXXX'
  })
});

const data = await response.json();
if (data.valid) {
  console.log('License is valid!');
} else {
  console.log('Invalid license:', data.message);
}`}
              />
            </div>
            <div>
              <h4 className="font-semibold text-[var(--text-primary)] mb-2">Bind a Device (Python)</h4>
              <CodeBlock
                language="python"
                code={`import requests

response = requests.post(
    'https://YOUR_API_URL/api/devices/bind',
    headers={
        'Authorization': 'Bearer YOUR_API_KEY',
        'Content-Type': 'application/json'
    },
    json={
        'licenseKey': 'WS-XXXX-XXXX-XXXX-XXXX',
        'hardwareId': 'HW-1234567890',
        'deviceName': 'Production Server'
    }
)

if response.status_code == 200:
    data = response.json()
    print(f"Device bound: {data['device_id']}")
else:
    print(f"Error: {response.json()['message']}")`}
              />
            </div>
          </div>
        </section>

        {/* ============ ERROR CODES ============ */}
        <section id="error-codes">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-[var(--api-red-500-20)]">
              <AlertCircle className="h-6 w-6 text-[var(--api-red-400)]" />
            </div>
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">Error Codes</h2>
          </div>
          <div className="space-y-2">
            {errorCodes.map((error) => (
              <div
                key={error.code}
                className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 p-4 transition-all duration-200 hover:shadow-lg"
              >
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm font-mono font-bold text-[var(--api-red-400)] bg-[var(--api-red-500-10)] px-2 py-0.5 rounded">
                    {error.code}
                  </span>
                  <h4 className="font-semibold text-[var(--text-primary)]">{error.name}</h4>
                </div>
                <p className="text-sm text-[var(--text-secondary)] mt-1">{error.description}</p>
                <p className="text-sm text-[var(--api-green-400)] mt-1 flex items-center gap-1">
                  <CheckCircle size={14} />
                  {error.solution}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ============ WEBHOOKS ============ */}
        <section id="webhooks">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-[var(--api-purple-500-20)]">
              <Link2 className="h-6 w-6 text-[var(--api-purple-400)]" />
            </div>
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">Webhooks</h2>
          </div>
          <div className="prose prose-invert max-w-none">
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Configure webhook endpoints in settings to receive real-time events.
            </p>
          </div>
          <div className="space-y-4 mt-4">
            {webhookEvents.map((webhook, index) => (
              <div
                key={index}
                className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 p-4 transition-all duration-200 hover:shadow-lg"
              >
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className="text-xs font-medium bg-[var(--api-amber-500-10)] text-[var(--api-amber-400)] px-2 py-0.5 rounded border border-[var(--api-amber-500-20)]">
                    {webhook.event}
                  </span>
                  <span className="text-sm text-[var(--text-secondary)]">{webhook.description}</span>
                </div>
                <CodeBlock code={webhook.payload} />
              </div>
            ))}
          </div>
        </section>

        {/* ============ SDK ============ */}
        <section id="sdk">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-[var(--api-cyan-500-20)]">
              <Package className="h-6 w-6 text-[var(--api-cyan-400)]" />
            </div>
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">SDK</h2>
          </div>
          <div className="prose prose-invert max-w-none">
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Official SDKs are available for popular programming languages:
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="rounded-xl border border-[var(--border-color)] p-4 bg-[var(--bg-tertiary)]/10 text-center">
              <div className="p-2 rounded-lg bg-[var(--api-blue-500-10)] text-[var(--api-blue-400)] mx-auto w-fit">
                <Command size={24} />
              </div>
              <h4 className="font-semibold text-[var(--text-primary)] mt-2">JavaScript/TypeScript</h4>
              <p className="text-sm text-[var(--text-muted)]">npm install @websmith/api</p>
              <button className="mt-2 text-sm text-[var(--api-blue-400)] hover:text-[var(--api-blue-300)] transition-colors">
                View Docs →
              </button>
            </div>
            <div className="rounded-xl border border-[var(--border-color)] p-4 bg-[var(--bg-tertiary)]/10 text-center">
              <div className="p-2 rounded-lg bg-[var(--api-green-500-10)] text-[var(--api-green-400)] mx-auto w-fit">
                <Code size={24} />
              </div>
              <h4 className="font-semibold text-[var(--text-primary)] mt-2">Python</h4>
              <p className="text-sm text-[var(--text-muted)]">pip install websmith-api</p>
              <button className="mt-2 text-sm text-[var(--api-blue-400)] hover:text-[var(--api-blue-300)] transition-colors">
                View Docs →
              </button>
            </div>
            <div className="rounded-xl border border-[var(--border-color)] p-4 bg-[var(--bg-tertiary)]/10 text-center">
              <div className="p-2 rounded-lg bg-[var(--api-red-500-10)] text-[var(--api-red-400)] mx-auto w-fit">
                <Code size={24} />
              </div>
              <h4 className="font-semibold text-[var(--text-primary)] mt-2">Go</h4>
              <p className="text-sm text-[var(--text-muted)]">go get GitHub.com/websmith/api</p>
              <button className="mt-2 text-sm text-[var(--api-blue-400)] hover:text-[var(--api-blue-300)] transition-colors">
                View Docs →
              </button>
            </div>
          </div>
        </section>

        {/* ============ INTEGRATION GUIDE ============ */}
        <section id="integration">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-[var(--api-amber-500-20)]">
              <Rocket className="h-6 w-6 text-[var(--api-amber-400)]" />
            </div>
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">Integration Guide</h2>
          </div>
          <div className="space-y-4">
            <div className="rounded-xl border border-[var(--border-color)] p-4 bg-[var(--bg-tertiary)]/5">
              <h4 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[var(--api-blue-500-10)] text-[var(--api-blue-400)] flex items-center justify-center text-sm font-bold">1</span>
                Get Your API Key
              </h4>
              <p className="text-sm text-[var(--text-muted)] ml-8">
                Navigate to Settings → API Configuration and generate your API key.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border-color)] p-4 bg-[var(--bg-tertiary)]/5">
              <h4 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[var(--api-purple-500-10)] text-[var(--api-purple-400)] flex items-center justify-center text-sm font-bold">2</span>
                Set Up Webhook Endpoint
              </h4>
              <p className="text-sm text-[var(--text-muted)] ml-8">
                Configure a webhook URL to receive real-time license events and status updates.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border-color)] p-4 bg-[var(--bg-tertiary)]/5">
              <h4 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[var(--api-green-500-10)] text-[var(--api-green-400)] flex items-center justify-center text-sm font-bold">3</span>
                Implement License Validation
              </h4>
              <p className="text-sm text-[var(--text-muted)] ml-8">
                Use the validation endpoint to verify licenses before granting access to your software.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border-color)] p-4 bg-[var(--bg-tertiary)]/5">
              <h4 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[var(--api-amber-500-10)] text-[var(--api-amber-400)] flex items-center justify-center text-sm font-bold">4</span>
                Handle Device Binding
              </h4>
              <p className="text-sm text-[var(--text-muted)] ml-8">
                Implement device binding for hardware-based licensing with automatic online/offline tracking.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border-color)] p-4 bg-[var(--bg-tertiary)]/5">
              <h4 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[var(--api-cyan-500-10)] text-[var(--api-cyan-400)] flex items-center justify-center text-sm font-bold">5</span>
                Monitor & Analyze
              </h4>
              <p className="text-sm text-[var(--text-muted)] ml-8">
                Use the analytics dashboard to track license usage, revenue, and system health.
              </p>
            </div>
          </div>
        </section>

        {/* ============ API EXPLORER ============ */}
        <section id="explorer">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-[var(--api-pink-500-20)]">
              <Play className="h-6 w-6 text-[var(--api-pink-400)]" />
            </div>
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">API Explorer</h2>
          </div>
          <div className="prose prose-invert max-w-none">
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Test API endpoints directly from the browser. Select an endpoint, enter parameters, and see the response.
            </p>
          </div>

          {/* Simplified API Explorer - FIXED */}
          <div className="mt-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 p-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <select className="px-3 py-2.5 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--api-blue-500-50)] transition-all text-sm">
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
              </select>
              <input
                type="text"
                placeholder="/api/licenses/validate"
                className="flex-1 px-3 py-2.5 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--api-blue-500-50)] transition-all font-mono text-sm"
              />
              <button className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[var(--api-blue-500)] to-[var(--api-purple-500)] text-[var(--text-primary)] font-medium hover:shadow-lg hover:shadow-[var(--api-blue-500-20)] transition-all">
                <Send size={16} className="inline mr-2" />
                Send
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="p-3 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)]">
                <p className="text-xs text-[var(--text-muted)] mb-1">Request Body</p>
                <CodeBlock
                  language="json"
                  code={`{
  "licenseKey": "WS-XXXX-XXXX-XXXX-XXXX"
}`}
                />
              </div>
              <div className="p-3 rounded-xl bg-[var(--api-green-500-5)] border border-[var(--api-green-500-20)]">
                <p className="text-xs text-[var(--text-muted)] mb-1">Response</p>
                <CodeBlock
                  language="json"
                  code={`{
  "success": true,
  "valid": true,
  "message": "License is valid",
  "product": "Websmith API Pro",
  "plan": "monthly",
  "expiry_date": "2025-12-31T23:59:59Z"
}`}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <div className="border-t border-[var(--border-color)] pt-6 mt-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[var(--text-muted)]">
            <div className="flex items-center gap-4">
              <span>Documentation v1.0.0</span>
              <span>•</span>
              <span>Last updated: June 19, 2026</span>
            </div>
            <div className="flex items-center gap-3">
              <span>Built with ❤️ by Websmith Digital</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}