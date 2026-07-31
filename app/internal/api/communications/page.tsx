"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Mail, Send, Inbox, AlertTriangle, MessageSquare, FileText,
  Settings, Clock, RefreshCw, Loader2, Search, Filter,
  ChevronRight, CheckCircle2, XCircle, Clock3, AlertCircle,
  Eye, Trash2, MoreHorizontal, Users, Tag, ChevronLeft, ChevronRight as ChevronRightIcon,
  Ban, Smartphone, CreditCard, KeyRound, Activity, UserPlus,
  BookOpen, HelpCircle, ShoppingBag, ExternalLink, RotateCcw, Delete,
} from "lucide-react";

const API_BASE = "/internal/backend/communications";

interface Conversation {
  id: string;
  category: string;
  status: string;
  customer_email: string;
  customer_name: string;
  subject: string;
  product_id: string;
  license_key: string | null;
  hardware_id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  message_count: number;
  unread_replies: number;
  last_message_preview?: string | null;
}

interface QueueItem {
  id: string;
  conversation_id: string | null;
  category: string;
  customer_email: string;
  customer_name: string;
  message: string;
  status: string;
  retry_count: number;
  max_retries: number;
  last_error: string | null;
  next_retry_at: string;
  created_at: string;
}

interface DeliveryLog {
  id: string;
  event_type: string;
  channel: string;
  recipient: string;
  subject: string;
  status: string;
  response: string | null;
  error: string | null;
  created_at: string;
}

interface Stats {
  inbox: number;
  sent: number;
  waiting: number;
  failed: number;
  queued: number;
  unread: number;
}

interface PaginatedResponse<T> {
  data?: {
    conversations?: T[];
    queue?: T[];
    logs?: T[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
}

type TabId = 'inbox' | 'sent' | 'failed' | 'conversations' | 'templates' | 'accounts' | 'queue' | 'delivery-logs' | 'settings' | 'trash';

const TABS: { id: TabId; label: string; icon: any; badge?: (s: Stats) => number }[] = [
  { id: 'inbox', label: 'Inbox', icon: Inbox, badge: (s) => s.inbox },
  { id: 'sent', label: 'Sent', icon: Send },
  { id: 'failed', label: 'Failed', icon: AlertTriangle, badge: (s) => s.failed },
  { id: 'conversations', label: 'Conversations', icon: MessageSquare, badge: (s) => s.waiting },
  { id: 'templates', label: 'Templates', icon: FileText },
  { id: 'accounts', label: 'Accounts', icon: Users },
  { id: 'queue', label: 'Queue', icon: Clock, badge: (s) => s.queued },
  { id: 'delivery-logs', label: 'Logs', icon: Activity },
  { id: 'trash', label: 'Trash', icon: Trash2 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const CATEGORY_LABELS: Record<string, string> = {
  support: 'Support', sales: 'Sales', activation: 'Activation',
  renewal: 'Renewal', reactivation: 'Reactivation',
  hardware_replacement: 'Hardware', general: 'General',
};

const CATEGORY_COLORS: Record<string, string> = {
  support: 'text-blue-400 bg-blue-500/10',
  sales: 'text-emerald-400 bg-emerald-500/10',
  activation: 'text-purple-400 bg-purple-500/10',
  renewal: 'text-amber-400 bg-amber-500/10',
  reactivation: 'text-rose-400 bg-rose-500/10',
  hardware_replacement: 'text-cyan-400 bg-cyan-500/10',
  general: 'text-gray-400 bg-gray-500/10',
};

const STATUS_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  open: { label: 'Open', color: 'text-blue-400 bg-blue-500/10', icon: Activity },
  waiting_customer: { label: 'Waiting Customer', color: 'text-amber-400 bg-amber-500/10', icon: Clock3 },
  waiting_support: { label: 'Waiting Support', color: 'text-purple-400 bg-purple-500/10', icon: HelpCircle },
  waiting_sales: { label: 'Waiting Sales', color: 'text-emerald-400 bg-emerald-500/10', icon: ShoppingBag },
  resolved: { label: 'Resolved', color: 'text-green-400 bg-green-500/10', icon: CheckCircle2 },
  closed: { label: 'Closed', color: 'text-gray-400 bg-gray-500/10', icon: XCircle },
};

const QUEUE_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'text-amber-400' },
  sending: { label: 'Sending', color: 'text-blue-400' },
  sent: { label: 'Sent', color: 'text-green-400' },
  failed: { label: 'Failed', color: 'text-red-400' },
};

const LOG_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  sent: { label: 'Sent', color: 'text-green-400' },
  delivered: { label: 'Delivered', color: 'text-blue-400' },
  failed: { label: 'Failed', color: 'text-red-400' },
  opened: { label: 'Opened', color: 'text-purple-400' },
};

const getAuthHeaders = () => {
  const token = localStorage.getItem("api_center_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

function StatsCard({ title, value, icon, color }: { title: string; value: number; icon: any; color: string }) {
  const Icon = icon;
  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 p-4 flex items-center gap-3">
      <div className={`p-2.5 rounded-lg ${color}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-2xl font-bold text-[var(--text-primary)]">{value}</p>
        <p className="text-xs text-[var(--text-secondary)]">{title}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABELS[status] || { label: status, color: 'text-gray-400 bg-gray-500/10', icon: HelpCircle };
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${s.color}`}>
      <Icon size={10} />
      {s.label}
    </span>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const color = CATEGORY_COLORS[category] || 'text-gray-400 bg-gray-500/10';
  const label = CATEGORY_LABELS[category] || category;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}

function QueueStatusBadge({ status }: { status: string }) {
  const s = QUEUE_STATUS_LABELS[status] || { label: status, color: 'text-gray-400' };
  return <span className={`text-xs font-medium ${s.color}`}>{s.label}</span>;
}

function LogStatusBadge({ status }: { status: string }) {
  const s = LOG_STATUS_LABELS[status] || { label: status, color: 'text-gray-400' };
  return <span className={`text-xs font-medium ${s.color}`}>{s.label}</span>;
}

function MailAccountCard({ account, onToggle }: { account: any; onToggle: (id: string, active: boolean) => void }) {
  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${account.is_active ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'}`}>
            <Mail size={16} />
          </div>
          <div>
            <h3 className="font-medium text-[var(--text-primary)] text-sm">{account.display_name}</h3>
            <p className="text-xs text-[var(--text-muted)]">{account.email}</p>
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" checked={account.is_active} onChange={() => onToggle(account.id, !account.is_active)} className="sr-only peer" />
          <div className="w-9 h-5 rounded-full peer peer-checked:bg-green-500 bg-gray-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
        </label>
      </div>
      <div className="text-xs text-[var(--text-muted)] space-y-1">
        <div className="flex items-center gap-2"><Tag size={10} /><span>Type: {account.type}</span></div>
        {account.reply_to && <div className="flex items-center gap-2"><Mail size={10} /><span>Reply-To: {account.reply_to}</span></div>}
        <div className="flex items-center gap-2"><FileText size={10} /><span>{account.templates?.length || 0} templates</span></div>
      </div>
    </div>
  );
}

function TemplateCard({ template, typeLabel }: { template: any; typeLabel: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between p-4 hover:bg-[var(--bg-tertiary)]/20 transition-colors">
        <div className="flex items-center gap-3">
          <span className={`w-2 h-2 rounded-full ${template?.is_active !== false ? 'bg-green-400' : 'bg-gray-400'}`} />
          <div className="text-left">
            <h3 className="font-medium text-[var(--text-primary)] text-sm">{typeLabel}</h3>
            <p className="text-xs text-[var(--text-muted)]">{template?.subject || 'Default template'}</p>
          </div>
        </div>
        <ChevronRightIcon size={14} className={`text-[var(--text-muted)] transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>
      {expanded && template && (
        <div className="px-4 pb-4 border-t border-[var(--border-color)] pt-3 space-y-2">
          <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] p-3 max-h-48 overflow-y-auto">
            <p className="text-xs text-[var(--text-muted)] mb-1">Subject: {template.subject}</p>
            <div className="text-xs text-[var(--text-secondary)]" dangerouslySetInnerHTML={{ __html: template.body?.substring(0, 500) || '' }} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function CommunicationsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('inbox');
  const [stats, setStats] = useState<Stats>({ inbox: 0, sent: 0, waiting: 0, failed: 0, queued: 0, unread: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [logs, setLogs] = useState<DeliveryLog[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [mailAccounts, setMailAccounts] = useState<any[]>([]);
  const [commSettings, setCommSettings] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [templateForm, setTemplateForm] = useState({ subject: '', body: '' });
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [mailAccountForm, setMailAccountForm] = useState<any>(null);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [settingsForm, setSettingsForm] = useState<any>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Conversation | null>(null);
  const [confirmPermanentDelete, setConfirmPermanentDelete] = useState<Conversation | null>(null);
  const [confirmEmptyTrash, setConfirmEmptyTrash] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/conversations/stats`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.success) setStats(json.data);
    } catch {}
  }, []);

  const fetchConversations = useCallback(async (tabId: TabId, p: number = 1) => {
    setLoading(true);
    setError(null);
    try {
      let params = new URLSearchParams();
      params.set('page', p.toString());
      params.set('limit', '50');

      if (tabId === 'inbox') params.set('status', 'open,waiting_customer');
      else if (tabId === 'sent') params.set('status', 'resolved,closed');
      else if (tabId === 'failed') params.set('status', 'waiting_support,waiting_sales');
      else if (tabId === 'trash') params.set('show_deleted', 'true');

      if (tabId === 'conversations') {
        if (statusFilter) params.set('status', statusFilter);
        if (categoryFilter) params.set('category', categoryFilter);
      }

      if (searchQuery) params.set('search', searchQuery);

      const res = await fetch(`${API_BASE}/conversations?${params.toString()}`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.success) {
        setConversations(json.data.conversations || []);
        setTotalPages(json.data.total_pages || 1);
        setPage(json.data.page || 1);
      } else {
        setError(json.error?.message || 'Failed to load');
      }
    } catch {
      setError('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter, categoryFilter]);

  const fetchQueue = useCallback(async (p: number = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', p.toString());
      params.set('limit', '50');
      const res = await fetch(`${API_BASE}/queue?${params.toString()}`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.success) {
        setQueue(json.data.queue || []);
        setTotalPages(json.data.total_pages || 1);
        setPage(json.data.page || 1);
      }
    } catch {
      setError('Failed to load queue');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLogs = useCallback(async (p: number = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', p.toString());
      params.set('limit', '50');
      const res = await fetch(`${API_BASE}/delivery-logs?${params.toString()}`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.success) {
        setLogs(json.data.logs || []);
        setTotalPages(json.data.total_pages || 1);
        setPage(json.data.page || 1);
      }
    } catch {
      setError('Failed to load delivery logs');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/internal/backend/admin/email/templates', { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.success) {
        setTemplates(json.templates || []);
      }
    } catch {
      setError('Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMailAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/settings`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.success) {
        setMailAccounts(json.settings?.mail_accounts || []);
        setCommSettings(json.settings);
      }
    } catch {
      setError('Failed to load mail accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/settings`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.success) {
        setCommSettings(json.settings);
        setSettingsForm(json.settings?.general || {});
      }
    } catch {
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchData = useCallback(() => {
    const tabLoaders: Record<TabId, () => Promise<void>> = {
      inbox: () => fetchConversations('inbox', 1),
      sent: () => fetchConversations('sent', 1),
      failed: () => fetchConversations('failed', 1),
      conversations: () => fetchConversations('conversations', 1),
      trash: () => fetchConversations('trash', 1),
      templates: fetchTemplates,
      accounts: fetchMailAccounts,
      queue: () => fetchQueue(1),
      'delivery-logs': () => fetchLogs(1),
      settings: fetchSettings,
    };
    fetchStats();
    return tabLoaders[activeTab]();
  }, [activeTab, fetchConversations, fetchTemplates, fetchMailAccounts, fetchQueue, fetchLogs, fetchSettings, fetchStats]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    setPage(1);
    setSearchQuery('');
    setStatusFilter('');
    setCategoryFilter('');
    setError(null);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    const tabLoaders: Record<TabId, (p: number) => Promise<void>> = {
      inbox: fetchConversations.bind(null, 'inbox'),
      sent: fetchConversations.bind(null, 'sent'),
      failed: fetchConversations.bind(null, 'failed'),
      conversations: fetchConversations.bind(null, 'conversations'),
      trash: fetchConversations.bind(null, 'trash'),
      templates: fetchTemplates,
      accounts: fetchMailAccounts,
      queue: fetchQueue,
      'delivery-logs': fetchLogs,
      settings: fetchSettings,
    };
    const loader = tabLoaders[activeTab];
    if (loader) loader(newPage);
  };

  const handleSaveTemplate = async (emailType: string) => {
    setSavingTemplate(true);
    try {
      const res = await fetch('/internal/backend/admin/email/templates', {
        method: 'PUT',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_type: emailType, subject: templateForm.subject, body: templateForm.body }),
      });
      const json = await res.json();
      if (json.success) {
        setEditingTemplate(null);
        fetchTemplates();
      }
    } catch {}
    setSavingTemplate(false);
  };

  const handleToggleAccount = async (id: string, active: boolean) => {
    const updated = mailAccounts.map(a => a.id === id ? { ...a, is_active: active } : a);
    setMailAccounts(updated);
    try {
      await fetch(`${API_BASE}/settings`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...commSettings, mail_accounts: updated }),
      });
    } catch {}
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await fetch(`${API_BASE}/settings`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...commSettings, general: settingsForm }),
      });
    } catch {}
    setSavingSettings(false);
  };

  const handleAddAccount = async () => {
    if (!mailAccountForm?.email) return;
    const newAccount = {
      id: `custom_${Date.now()}`,
      name: mailAccountForm.name || 'Custom',
      email: mailAccountForm.email,
      display_name: mailAccountForm.display_name || mailAccountForm.name,
      type: mailAccountForm.type || 'support',
      reply_to: mailAccountForm.reply_to || mailAccountForm.email,
      signature: mailAccountForm.signature || '',
      is_active: true,
      templates: [],
    };
    const updated = [...mailAccounts, newAccount];
    setMailAccounts(updated);
    try {
      await fetch(`${API_BASE}/settings`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...commSettings, mail_accounts: updated }),
      });
      setShowAddAccount(false);
      setMailAccountForm(null);
    } catch {}
  };

  const handleDeleteAccount = async (id: string) => {
    const updated = mailAccounts.filter(a => a.id !== id);
    setMailAccounts(updated);
    try {
      await fetch(`${API_BASE}/settings`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...commSettings, mail_accounts: updated }),
      });
    } catch {}
  };

  const EMAIL_TYPES = [
    { key: 'otp_verification', label: 'OTP Verification' },
    { key: 'trial_started', label: 'Trial Started' },
    { key: 'activation_success', label: 'Activation Success' },
    { key: 'activation_failed', label: 'Activation Failed' },
    { key: 'license_created', label: 'License Created' },
    { key: 'license_renewed', label: 'License Renewed' },
    { key: 'license_expired', label: 'License Expired' },
    { key: 'license_revoked', label: 'License Revoked' },
    { key: 'welcome_customer', label: 'Welcome / Enquiry' },
    { key: 'reactivation_approved', label: 'Reactivation Approved' },
    { key: 'reactivation_rejected', label: 'Reactivation Rejected' },
    { key: 'admin_notification', label: 'Admin Notification' },
    { key: 'support_reply', label: 'Support Reply' },
    { key: 'new_sales_enquiry', label: 'New Sales Enquiry' },
    { key: 'sales_reply', label: 'Sales Reply' },
    { key: 'conversation_created', label: 'Conversation Created' },
    { key: 'device_reset', label: 'Device Reset' },
    { key: 'device_changed', label: 'Device Changed' },
    { key: 'payment_success', label: 'Payment Success' },
    { key: 'subscription_reminder', label: 'Subscription Reminder' },
    { key: 'password_reset', label: 'Password Reset' },
    { key: 'trial_expired', label: 'Trial Expired' },
    { key: 'activation_confirmation', label: 'Activation Confirmation' },
  ];

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  const handleSoftDelete = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`${API_BASE}/conversations/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      if (json.success) {
        setConfirmDelete(null);
        fetchData();
        fetchStats();
      } else {
        setError(json.error?.message || 'Failed to delete conversation');
      }
    } catch {
      setError('Failed to delete conversation');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestore = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`${API_BASE}/conversations/${id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ action: 'restore' }),
      });
      const json = await res.json();
      if (json.success) {
        fetchData();
        fetchStats();
      } else {
        setError(json.error?.message || 'Failed to restore conversation');
      }
    } catch {
      setError('Failed to restore conversation');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePermanentDelete = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`${API_BASE}/conversations/${id}?permanent=true`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      if (json.success) {
        setConfirmPermanentDelete(null);
        fetchData();
        fetchStats();
      } else {
        setError(json.error?.message || 'Failed to permanently delete conversation');
      }
    } catch {
      setError('Failed to permanently delete conversation');
    } finally {
      setActionLoading(null);
    }
  };

  const handleEmptyTrash = async () => {
    setActionLoading('empty-trash');
    try {
      const res = await fetch(`${API_BASE}/conversations?action=empty_trash`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      if (json.success) {
        setConfirmEmptyTrash(false);
        fetchData();
        fetchStats();
      } else {
        setError(json.error?.message || 'Failed to empty trash');
      }
    } catch {
      setError('Failed to empty trash');
    } finally {
      setActionLoading(null);
    }
  };

  const renderConversationRow = (conv: Conversation) => (
    <div
      key={conv.id}
      className="flex items-center gap-4 p-4 border-b border-[var(--border-color)] hover:bg-[var(--bg-tertiary)]/20 transition-colors group"
    >
      <a
        href={`/internal/api/communications/conversations/${conv.id}`}
        className="flex-1 min-w-0"
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-[var(--text-primary)] text-sm truncate">
            {conv.customer_name || 'Unknown'}
          </span>
          {conv.unread_replies > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold">
              {conv.unread_replies}
            </span>
          )}
        </div>
        <p className="text-sm text-[var(--text-secondary)] truncate">
          {conv.subject || '(No subject)'}
        </p>
        <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] mt-0.5">
          <span>{conv.customer_email}</span>
          {conv.product_id && (
            <>
              <span className="w-1 h-1 rounded-full bg-[var(--border-color)]" />
              <span>{conv.product_id}</span>
            </>
          )}
          {conv.license_key && (
            <>
              <span className="w-1 h-1 rounded-full bg-[var(--border-color)]" />
              <code className="text-[10px]">{conv.license_key.substring(0, 20)}</code>
            </>
          )}
        </div>
      </a>
      <div className="flex items-center gap-2 shrink-0">
        <CategoryBadge category={conv.category} />
        <StatusBadge status={conv.status} />
      </div>
      <span className="text-xs text-[var(--text-muted)] shrink-0 w-16 text-right">
        {formatTime(conv.updated_at)}
      </span>
      <div className="flex items-center gap-1 shrink-0">
        {activeTab === 'trash' ? (
          <>
            <button
              onClick={() => handleRestore(conv.id)}
              disabled={actionLoading === conv.id}
              title="Restore"
              className="p-2 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
            >
              {actionLoading === conv.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw size={14} />}
            </button>
            <button
              onClick={() => setConfirmPermanentDelete(conv)}
              disabled={actionLoading === conv.id}
              title="Permanently Delete"
              className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
            >
              <Delete size={14} />
            </button>
          </>
        ) : (
          <button
            onClick={() => setConfirmDelete(conv)}
            disabled={actionLoading === conv.id}
            title="Delete"
            className="p-2 rounded-lg text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-400 transition-colors disabled:opacity-50"
          >
            {actionLoading === conv.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 size={14} />}
          </button>
        )}
      </div>
      <ChevronRightIcon size={14} className="text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </div>
  );

  const renderTable = () => {
    if (loading) return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
        <span className="ml-3 text-[var(--text-secondary)]">Loading...</span>
      </div>
    );

    if (error) return (
      <div className="flex items-center justify-center py-20">
        <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
        <span className="text-[var(--text-secondary)]">{error}</span>
      </div>
    );

    if (conversations.length === 0) return (
      <div className="flex flex-col items-center justify-center py-20 text-[var(--text-muted)]">
        <Inbox size={40} className="mb-3 opacity-30" />
        <p className="text-sm">No conversations found</p>
      </div>
    );

    return (
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 overflow-hidden">
        <div className="divide-y divide-[var(--border-color)]">
          {conversations.map(renderConversationRow)}
        </div>
      </div>
    );
  };

  const renderPagination = () => (
    <div className="flex items-center justify-between pt-4">
      <p className="text-xs text-[var(--text-muted)]">Page {page} of {totalPages}</p>
      <div className="flex items-center gap-1">
        <button onClick={() => handlePageChange(page - 1)} disabled={page <= 1}
          className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)]/50 disabled:opacity-30 transition-colors">
          <ChevronLeft size={14} className="text-[var(--text-muted)]" />
        </button>
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          let p: number;
          if (totalPages <= 5) p = i + 1;
          else if (page <= 3) p = i + 1;
          else if (page >= totalPages - 2) p = totalPages - 4 + i;
          else p = page - 2 + i;
          return (
            <button key={p} onClick={() => handlePageChange(p)}
              className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${p === page ? 'bg-blue-500/20 text-blue-400' : 'text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]/50'}`}>
              {p}
            </button>
          );
        })}
        <button onClick={() => handlePageChange(page + 1)} disabled={page >= totalPages}
          className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)]/50 disabled:opacity-30 transition-colors">
          <ChevronRightIcon size={14} className="text-[var(--text-muted)]" />
        </button>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'inbox':
      case 'sent':
      case 'failed':
      case 'conversations':
      case 'trash':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input type="text" placeholder="Search conversations..."
                  value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && fetchData()}
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/20 text-[var(--text-primary)] text-sm placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>
              {activeTab === 'conversations' && (
                <>
                  <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/20 text-[var(--text-primary)] text-sm">
                    <option value="">All Status</option>
                    <option value="open">Open</option>
                    <option value="waiting_customer">Waiting Customer</option>
                    <option value="waiting_support">Waiting Support</option>
                    <option value="waiting_sales">Waiting Sales</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                  <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/20 text-[var(--text-primary)] text-sm">
                    <option value="">All Categories</option>
                    <option value="support">Support</option>
                    <option value="sales">Sales</option>
                    <option value="activation">Activation</option>
                    <option value="renewal">Renewal</option>
                    <option value="reactivation">Reactivation</option>
                    <option value="hardware_replacement">Hardware</option>
                    <option value="general">General</option>
                  </select>
                </>
              )}
              {activeTab === 'trash' && (
                <button
                  onClick={() => setConfirmEmptyTrash(true)}
                  disabled={conversations.length === 0}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-500/20 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors shrink-0"
                >
                  <Trash2 size={14} /> Empty Trash
                </button>
              )}
              <button onClick={fetchData} className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)]/50 transition-colors">
                <RefreshCw size={16} className="text-[var(--text-muted)]" />
              </button>
            </div>
            {renderTable()}
            {totalPages > 1 && renderPagination()}
          </div>
        );

      case 'queue':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-[var(--text-primary)]">Message Queue ({stats.queued} pending)</h3>
              <button onClick={fetchData} className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)]/50 transition-colors">
                <RefreshCw size={16} className="text-[var(--text-muted)]" />
              </button>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 text-blue-400 animate-spin" /></div>
            ) : queue.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-[var(--text-muted)]">
                <Clock size={40} className="mb-3 opacity-30" />
                <p className="text-sm">Queue is empty</p>
              </div>
            ) : (
              <div className="rounded-xl border border-[var(--border-color)] overflow-hidden">
                <div className="divide-y divide-[var(--border-color)]">
                  {queue.map((item) => (
                    <div key={item.id} className="p-4 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-[var(--text-primary)] text-sm">{item.customer_name || item.customer_email}</span>
                          <CategoryBadge category={item.category} />
                        </div>
                        <p className="text-sm text-[var(--text-secondary)] truncate">{item.message?.substring(0, 150)}</p>
                        {item.last_error && <p className="text-xs text-red-400 mt-0.5">{item.last_error}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <QueueStatusBadge status={item.status} />
                        <p className="text-xs text-[var(--text-muted)] mt-1">Retry {item.retry_count}/{item.max_retries}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case 'delivery-logs':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-[var(--text-primary)]">Email Delivery Logs</h3>
              <button onClick={fetchData} className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)]/50 transition-colors">
                <RefreshCw size={16} className="text-[var(--text-muted)]" />
              </button>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 text-blue-400 animate-spin" /></div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-[var(--text-muted)]">
                <Activity size={40} className="mb-3 opacity-30" />
                <p className="text-sm">No delivery logs yet</p>
              </div>
            ) : (
              <div className="rounded-xl border border-[var(--border-color)] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/10">
                        <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-muted)]">Event</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-muted)]">Recipient</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-muted)]">Subject</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-muted)]">Channel</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-muted)]">Status</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-[var(--text-muted)]">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-color)]">
                      {logs.map((log) => (
                        <tr key={log.id} className="hover:bg-[var(--bg-tertiary)]/10 transition-colors">
                          <td className="px-4 py-3 text-[var(--text-primary)]">{log.event_type}</td>
                          <td className="px-4 py-3 text-[var(--text-secondary)]">{log.recipient}</td>
                          <td className="px-4 py-3 text-[var(--text-secondary)] max-w-[200px] truncate">{log.subject || '-'}</td>
                          <td className="px-4 py-3 text-xs text-[var(--text-muted)]">{log.channel || 'email'}</td>
                          <td className="px-4 py-3"><LogStatusBadge status={log.status} /></td>
                          <td className="px-4 py-3 text-right text-xs text-[var(--text-muted)]">{formatTime(log.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );

      case 'templates':
        return (
          <div className="space-y-4">
            <p className="text-sm text-[var(--text-secondary)]">Manage email notification templates. Changes apply immediately.</p>
            {loading ? (
              <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 text-blue-400 animate-spin" /></div>
            ) : (
              <div className="grid gap-3">
                {EMAIL_TYPES.map(({ key, label }) => {
                  const tmpl = templates.find((t: any) => t.email_type === key);
                  return (
                    <div key={key} className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 overflow-hidden">
                      <div className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                          <span className={`w-2 h-2 rounded-full ${tmpl?.is_active !== false ? 'bg-green-400' : 'bg-gray-400'}`} />
                          <div>
                            <h3 className="font-medium text-[var(--text-primary)] text-sm">{label}</h3>
                            <p className="text-xs text-[var(--text-muted)]">{tmpl?.subject || 'Default'}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setEditingTemplate(editingTemplate === key ? null : key);
                            setTemplateForm({ subject: tmpl?.subject || '', body: tmpl?.body || '' });
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]/50 hover:text-[var(--text-primary)] transition-colors"
                        >
                          {editingTemplate === key ? 'Cancel' : 'Edit'}
                        </button>
                      </div>
                      {editingTemplate === key && (
                        <div className="px-4 pb-4 space-y-3 border-t border-[var(--border-color)] pt-3">
                          <div>
                            <label className="block text-xs text-[var(--text-muted)] mb-1">Subject</label>
                            <input type="text" value={templateForm.subject}
                              onChange={e => setTemplateForm(f => ({ ...f, subject: e.target.value }))}
                              className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm" />
                          </div>
                          <div>
                            <label className="block text-xs text-[var(--text-muted)] mb-1">HTML Body</label>
                            <textarea rows={6} value={templateForm.body}
                              onChange={e => setTemplateForm(f => ({ ...f, body: e.target.value }))}
                              className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm font-mono" />
                          </div>
                          <button onClick={() => handleSaveTemplate(key)} disabled={savingTemplate}
                            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                            {savingTemplate ? <><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Saving...</> : 'Save Template'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );

      case 'accounts':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[var(--text-secondary)]">Configured mail accounts for outgoing communication.</p>
              <button onClick={() => setShowAddAccount(true)} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors">
                Add Account
              </button>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 text-blue-400 animate-spin" /></div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {mailAccounts.map((account: any) => (
                    <div key={account.id} className="relative">
                      <MailAccountCard account={account} onToggle={handleToggleAccount} />
                      <button onClick={() => handleDeleteAccount(account.id)}
                        className="absolute top-2 right-2 p-1 rounded-lg hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
                {showAddAccount && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-6 w-[400px] max-w-full mx-4 space-y-4">
                      <h2 className="text-lg font-semibold text-[var(--text-primary)]">Add Mail Account</h2>
                      <div>
                        <label className="block text-xs text-[var(--text-muted)] mb-1">Name</label>
                        <input type="text" value={mailAccountForm?.name || ''} onChange={e => setMailAccountForm({ ...mailAccountForm, name: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs text-[var(--text-muted)] mb-1">Email Address</label>
                        <input type="email" value={mailAccountForm?.email || ''} onChange={e => setMailAccountForm({ ...mailAccountForm, email: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs text-[var(--text-muted)] mb-1">Display Name</label>
                        <input type="text" value={mailAccountForm?.display_name || ''} onChange={e => setMailAccountForm({ ...mailAccountForm, display_name: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs text-[var(--text-muted)] mb-1">Type</label>
                        <select value={mailAccountForm?.type || 'support'} onChange={e => setMailAccountForm({ ...mailAccountForm, type: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm">
                          <option value="system">System</option>
                          <option value="support">Support</option>
                          <option value="sales">Sales</option>
                          <option value="custom">Custom</option>
                        </select>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button onClick={handleAddAccount} className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">Add</button>
                        <button onClick={() => { setShowAddAccount(false); setMailAccountForm(null); }} className="px-4 py-2 rounded-lg border border-[var(--border-color)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 transition-colors">Cancel</button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        );

      case 'settings':
        return (
          <div className="space-y-6 max-w-2xl">
            <p className="text-sm text-[var(--text-secondary)]">Global communication settings for the platform.</p>
            {loading ? (
              <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 text-blue-400 animate-spin" /></div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 p-4 space-y-4">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">Retry Configuration</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-[var(--text-muted)] mb-1">Max Retry Attempts</label>
                      <input type="number" value={settingsForm?.retry_max_attempts || 5}
                        onChange={e => setSettingsForm((f: any) => ({ ...f, retry_max_attempts: parseInt(e.target.value) || 5 }))}
                        className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-[var(--text-muted)] mb-1">Base Delay (minutes)</label>
                      <input type="number" value={settingsForm?.retry_base_delay_minutes || 1}
                        onChange={e => setSettingsForm((f: any) => ({ ...f, retry_base_delay_minutes: parseInt(e.target.value) || 1 }))}
                        className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm" />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 p-4 space-y-4">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">Attachment Limits</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-[var(--text-muted)] mb-1">Max File Size (MB)</label>
                      <input type="number" value={settingsForm?.attachment_max_size_mb || 10}
                        onChange={e => setSettingsForm((f: any) => ({ ...f, attachment_max_size_mb: parseInt(e.target.value) || 10 }))}
                        className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-[var(--text-muted)] mb-1">Max Per Message</label>
                      <input type="number" value={settingsForm?.attachment_max_per_message || 5}
                        onChange={e => setSettingsForm((f: any) => ({ ...f, attachment_max_per_message: parseInt(e.target.value) || 5 }))}
                        className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm" />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 p-4 space-y-4">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">Auto-Resolve</h3>
                  <div>
                    <label className="block text-xs text-[var(--text-muted)] mb-1">Auto-Resolve After Days</label>
                    <input type="number" value={settingsForm?.auto_resolve_days || 30}
                      onChange={e => setSettingsForm((f: any) => ({ ...f, auto_resolve_days: parseInt(e.target.value) || 30 }))}
                      className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm" />
                  </div>
                </div>

                <button onClick={handleSaveSettings} disabled={savingSettings}
                  className="px-6 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {savingSettings ? <><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Saving...</> : 'Save Settings'}
                </button>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400">
            <Mail className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Communications</h1>
            <p className="text-sm text-[var(--text-secondary)]">Centralized communication center for all conversations</p>
          </div>
        </div>
        <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border-color)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 transition-colors">
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatsCard title="Inbox" value={stats.inbox} icon={Inbox} color="bg-blue-500/10 text-blue-400" />
        <StatsCard title="Waiting" value={stats.waiting} icon={MessageSquare} color="bg-purple-500/10 text-purple-400" />
        <StatsCard title="Sent" value={stats.sent} icon={Send} color="bg-green-500/10 text-green-400" />
        <StatsCard title="Failed" value={stats.failed} icon={AlertTriangle} color="bg-red-500/10 text-red-400" />
        <StatsCard title="Queued" value={stats.queued} icon={Clock} color="bg-amber-500/10 text-amber-400" />
        <StatsCard title="Unread" value={stats.unread} icon={Activity} color="bg-cyan-500/10 text-cyan-400" />
      </div>

      <div className="flex items-center gap-1 border-b border-[var(--border-color)] overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => handleTabChange(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors shrink-0 ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
            {tab.badge && stats && tab.badge(stats) > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold">
                {tab.badge(stats)}
              </span>
            )}
          </button>
        ))}
      </div>

      {renderTabContent()}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-6 w-[400px] max-w-full mx-4 space-y-4">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Delete Conversation</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Move this conversation to the Trash? It can be restored later.
            </p>
            <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 p-3 text-sm">
              <p className="font-medium text-[var(--text-primary)]">{confirmDelete.customer_name || 'Unknown'}</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">{confirmDelete.subject || '(No subject)'}</p>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => handleSoftDelete(confirmDelete.id)} disabled={actionLoading === confirmDelete.id}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {actionLoading === confirmDelete.id ? <><Loader2 className="h-4 w-4 animate-spin" /> Deleting...</> : <><Trash2 size={14} /> Move to Trash</>}
              </button>
              <button onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 rounded-lg border border-[var(--border-color)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permanent delete confirmation modal */}
      {confirmPermanentDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-6 w-[400px] max-w-full mx-4 space-y-4">
            <h2 className="text-lg font-semibold text-red-400">Permanently Delete</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              This will permanently delete this conversation and ALL related messages, attachments, and queue records. This action CANNOT be undone.
            </p>
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm">
              <p className="font-medium text-[var(--text-primary)]">{confirmPermanentDelete.customer_name || 'Unknown'}</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">{confirmPermanentDelete.subject || '(No subject)'}</p>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => handlePermanentDelete(confirmPermanentDelete.id)} disabled={actionLoading === confirmPermanentDelete.id}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {actionLoading === confirmPermanentDelete.id ? <><Loader2 className="h-4 w-4 animate-spin" /> Deleting...</> : <><Delete size={14} /> Delete Forever</>}
              </button>
              <button onClick={() => setConfirmPermanentDelete(null)}
                className="px-4 py-2 rounded-lg border border-[var(--border-color)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty Trash confirmation modal */}
      {confirmEmptyTrash && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-6 w-[400px] max-w-full mx-4 space-y-4">
            <h2 className="text-lg font-semibold text-red-400">Empty Trash</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              This will permanently delete ALL {conversations.length} conversation(s) currently in the Trash, including all related messages, attachments, and queue records. This action CANNOT be undone.
            </p>
            <div className="flex gap-2 pt-2">
              <button onClick={handleEmptyTrash} disabled={actionLoading === 'empty-trash'}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {actionLoading === 'empty-trash' ? <><Loader2 className="h-4 w-4 animate-spin" /> Deleting...</> : <><Trash2 size={14} /> Empty Trash</>}
              </button>
              <button onClick={() => setConfirmEmptyTrash(false)}
                className="px-4 py-2 rounded-lg border border-[var(--border-color)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
