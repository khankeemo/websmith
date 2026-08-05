"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Mail, Send, Inbox, AlertTriangle, MessageSquare, FileText,
  Settings, Clock, RefreshCw, Loader2, Search, Filter,
  CheckCircle2, XCircle, Clock3, AlertCircle,
  Trash2, Users, Tag, CreditCard, KeyRound, Activity,
  HelpCircle, ShoppingBag, RotateCcw, Delete,
  Plus, Pencil, Paperclip, Flag, Archive, Reply, ReplyAll,
  Forward, CheckCheck, MailOpen, AtSign, LifeBuoy, FlaskConical,
  Package, BellRing, ShieldAlert, FilePen, Server, Plug,
  Database, Wrench, History as HistoryIcon, Download, X,
  ChevronDown, ArchiveRestore, MailX, Eye, ChevronLeft,
  UserPlus, BookOpen, Ban, Smartphone, Save,
  Folder, FolderPlus, FolderOpen, FolderCog,
  Sparkles, ShieldCheck, Upload, Wifi, WifiOff, KeySquare,
} from "lucide-react";
import UniversalEmailDialog from "@/components/internal-api/UniversalEmailDialog";

const API_BASE = "/internal/backend/communications";
const MB_BASE = "/internal/backend/mailboxes";

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
  attachment_count: number;
  unread_replies: number;
}

interface Mailbox {
  id: string;
  provider: string;
  email_address: string;
  display_name: string;
  imap_host: string;
  imap_port: number;
  imap_secure: boolean;
  imap_username: string;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_username: string;
  signature: string;
  connection_status: string;
  sync_status: string;
  last_error: string | null;
  is_default_sender: boolean;
  is_enabled: boolean;
  auto_reply_enabled: boolean;
  auto_reply_message: string;
  queue_size: number;
  last_sync?: string | null;
  last_success?: string | null;
  last_failure?: string | null;
  created_at: string;
  updated_at: string;
  imap_password?: string;
  smtp_password?: string;
}

interface QueueItem {
  id: string;
  conversation_id: string | null;
  category: string;
  customer_email: string;
  customer_name: string;
  subject: string;
  message: string;
  status: string;
  retry_count: number;
  max_retries: number;
  last_error: string | null;
  next_retry_at: string;
  created_at: string;
}

interface LogItem {
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

interface HistoryItem {
  id: string;
  event_type: string;
  recipient: string;
  subject: string;
  status: string;
  error: string | null;
  created_at: string;
  license_key: string | null;
  attachments?: { id: string; file_name: string; file_size: number; mime_type: string }[];
}

interface Stats {
  inbox: number;
  sent: number;
  waiting: number;
  failed: number;
  queued: number;
  unread: number;
}

interface AttachmentRow {
  id: string;
  message_id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  storage_path: string;
  uploaded_at: string;
  sender_name: string;
  message_created_at: string;
}

interface DetailData {
  conversation: Conversation & { hardware_id: string; sdk_version?: string; runtime_type?: string; admin_read_at?: string | null };
  messages: any[];
  internal_notes: any[];
  delivery_logs: any[];
  attachments: AttachmentRow[];
  customer: any | null;
  licenses: any[];
  orders: any[];
  payments: any[];
  audit: any[];
}

type ViewKind = 'list' | 'queue' | 'logs' | 'history' | 'mailboxes' | 'settings' | 'empty';

interface FolderDef {
  key: string;
  label: string;
  icon: any;
  section: 'internal' | 'external';
  kind: ViewKind;
  params?: Record<string, string>;
  badgeKey?: keyof Stats;
  emptyNote?: string;
}

interface FolderRow {
  id: string;
  name: string;
  section: 'internal' | 'external';
  kind: string;
  filter_json: string;
  is_system: boolean;
  display_order: number;
  deleted_at: string | null;
}

const FOLDERS: FolderDef[] = [
  // Internal Communications
  { key: 'all', label: 'All', icon: Inbox, section: 'internal', kind: 'list', params: {}, badgeKey: 'unread' },
  { key: 'sales', label: 'Sales', icon: ShoppingBag, section: 'internal', kind: 'list', params: { category: 'sales' } },
  { key: 'support', label: 'Support', icon: LifeBuoy, section: 'internal', kind: 'list', params: { category: 'support' } },
  { key: 'activation', label: 'Activation', icon: KeyRound, section: 'internal', kind: 'list', params: { category: 'activation' } },
  { key: 'renewal', label: 'Renewal', icon: RotateCcw, section: 'internal', kind: 'list', params: { category: 'renewal' } },
  { key: 'reactivation', label: 'Reactivation', icon: Ban, section: 'internal', kind: 'list', params: { category: 'reactivation' } },
  { key: 'hardware', label: 'Hardware', icon: Smartphone, section: 'internal', kind: 'list', params: { category: 'hardware_replacement' } },
  { key: 'trial', label: 'Trial', icon: FlaskConical, section: 'internal', kind: 'list', params: { search: 'trial' } },
  { key: 'payment', label: 'Payment', icon: CreditCard, section: 'internal', kind: 'list', params: { search: 'payment' } },
  { key: 'sdk', label: 'SDK', icon: Package, section: 'internal', kind: 'list', params: { search: 'sdk' } },
  { key: 'customer', label: 'Customer', icon: Users, section: 'internal', kind: 'list', params: { has_customer: 'true' } },
  { key: 'notifications', label: 'Notifications', icon: BellRing, section: 'internal', kind: 'logs' },
  { key: 'email-history', label: 'Universal Email', icon: MailOpen, section: 'internal', kind: 'history' },

  // External Mailboxes
  { key: 'ext-inbox', label: 'Inbox', icon: Inbox, section: 'external', kind: 'list', params: { status: 'open,waiting_customer' }, badgeKey: 'inbox' },
  { key: 'ext-sent', label: 'Sent', icon: Send, section: 'external', kind: 'list', params: { status: 'resolved,closed' }, badgeKey: 'sent' },
  { key: 'ext-draft', label: 'Draft', icon: FilePen, section: 'external', kind: 'empty', emptyNote: 'Draft support is not wired to the backend yet — outbound emails are sent immediately and tracked in Sent / Universal Email.' },
  { key: 'ext-waiting', label: 'Waiting', icon: Clock3, section: 'external', kind: 'list', params: { status: 'waiting_customer' }, badgeKey: 'waiting' },
  { key: 'ext-failed', label: 'Failed', icon: AlertTriangle, section: 'external', kind: 'list', params: { status: 'waiting_support,waiting_sales' }, badgeKey: 'failed' },
  { key: 'ext-queued', label: 'Queued', icon: Clock, section: 'external', kind: 'queue', badgeKey: 'queued' },
  { key: 'ext-spam', label: 'Spam', icon: ShieldAlert, section: 'external', kind: 'empty', emptyNote: 'Spam detection is not wired to the backend yet — no spam folders are collected by the IMAP sync.' },
  { key: 'ext-trash', label: 'Trash', icon: Trash2, section: 'external', kind: 'list', params: { show_deleted: 'true' } },
  { key: 'mailboxes', label: 'Mailboxes', icon: AtSign, section: 'external', kind: 'mailboxes' },
];

const SETTINGS_DEF: FolderDef = {
  key: 'settings',
  label: 'Communication Settings',
  icon: Settings,
  section: 'internal',
  kind: 'settings',
};

const NAV_GROUPS: { key: string; label: string; icon: any }[] = [
  { key: 'internal', label: 'Internal Communications', icon: MessageSquare },
  { key: 'universal', label: 'Universal Email', icon: MailOpen },
  { key: 'external', label: 'External Mailboxes', icon: AtSign },
  { key: 'mailboxes', label: 'Mailboxes', icon: Mail },
];

const groupFor = (def: FolderDef): string => {
  if (def.key === 'email-history') return 'universal';
  if (def.key === 'mailboxes') return 'mailboxes';
  return def.section;
};

// ---- Provider auto-configuration (UI-only; backend stores a free string) ----
interface ProviderPreset {
  key: string;
  label: string;
  match: RegExp;
  imap: { host: string; port: number; secure: boolean };
  smtp: { host: string; port: number; secure: boolean };
}

const PROVIDER_PRESETS: ProviderPreset[] = [
  { key: 'gmail', label: 'Gmail / Google Workspace', match: /gmail\.com|googlemail\.com$/i, imap: { host: 'imap.gmail.com', port: 993, secure: true }, smtp: { host: 'smtp.gmail.com', port: 465, secure: true } },
  { key: 'outlook', label: 'Outlook / Microsoft 365', match: /outlook\.com|hotmail\.com|live\.com|msn\.com|office365\.com|outlook\.co$/i, imap: { host: 'outlook.office365.com', port: 993, secure: true }, smtp: { host: 'smtp.office365.com', port: 587, secure: false } },
  { key: 'yahoo', label: 'Yahoo Mail', match: /yahoo\.com|ymail\.com$/i, imap: { host: 'imap.mail.yahoo.com', port: 993, secure: true }, smtp: { host: 'smtp.mail.yahoo.com', port: 465, secure: true } },
  { key: 'zoho', label: 'Zoho Mail', match: /zohomail\.|zoho\.com$/i, imap: { host: 'imap.zoho.com', port: 993, secure: true }, smtp: { host: 'smtp.zoho.com', port: 465, secure: true } },
  { key: 'icloud', label: 'iCloud Mail', match: /icloud\.com|me\.com$/i, imap: { host: 'imap.mail.me.com', port: 993, secure: true }, smtp: { host: 'smtp.mail.me.com', port: 587, secure: false } },
  { key: 'fastmail', label: 'Fastmail', match: /fastmail\.(com|fm)|fastmailbox\.net$/i, imap: { host: 'imap.fastmail.com', port: 993, secure: true }, smtp: { host: 'smtp.fastmail.com', port: 465, secure: true } },
  { key: 'proton', label: 'Proton Mail (via Bridge)', match: /proton\.(me|mail|ch)$/i, imap: { host: '127.0.0.1', port: 1143, secure: false }, smtp: { host: '127.0.0.1', port: 1025, secure: false } },
  { key: 'custom', label: 'Custom / Other', match: /.*/, imap: { host: '', port: 993, secure: true }, smtp: { host: '', port: 465, secure: true } },
];

const presetForEmail = (email: string): ProviderPreset => {
  const domain = (email || '').split('@')[1] || '';
  return PROVIDER_PRESETS.find(p => p.match.test(domain)) || PROVIDER_PRESETS[PROVIDER_PRESETS.length - 1];
};

const presetForKey = (key: string): ProviderPreset =>
  PROVIDER_PRESETS.find(p => p.key === key) || PROVIDER_PRESETS[PROVIDER_PRESETS.length - 1];

const MAILBOX_LABELS: Record<string, { label: string; purpose: string }> = {
  no_reply: { label: 'No-Reply', purpose: 'Automated system emails (OTP, license, payments, notifications).' },
  support: { label: 'Support', purpose: 'Customer support conversations and technical requests.' },
  sales: { label: 'Sales', purpose: 'Sales enquiries and purchase conversations.' },
};

const MB_FIELD_LABELS: Record<string, string> = {
  provider: 'Provider',
  email_address: 'Mail Address',
  display_name: 'Display Name',
  imap_host: 'Incoming Mail Server (IMAP)',
  imap_port: 'Incoming Mail Port',
  imap_secure: 'Incoming Encryption',
  imap_username: 'Incoming Username',
  imap_password: 'Incoming Password',
  smtp_host: 'Outgoing Mail Server (SMTP)',
  smtp_port: 'Outgoing Mail Port',
  smtp_secure: 'Outgoing Encryption',
  smtp_username: 'Outgoing Username',
  smtp_password: 'Outgoing Password',
  signature: 'Email Signature',
  auto_reply_enabled: 'Auto-reply',
  auto_reply_message: 'Auto-reply Message',
  is_enabled: 'Enabled',
  is_default_sender: 'Default Sender',
};

const mailboxHealth = (mb: Mailbox): { status: 'online' | 'offline' | 'auth_failed' | 'syncing' | 'unknown'; label: string; color: string } => {
  if (!mb.is_enabled) return { status: 'unknown', label: 'Disabled', color: 'text-gray-400 bg-gray-500/10' };
  if (mb.sync_status === 'syncing') return { status: 'syncing', label: 'Syncing', color: 'text-blue-400 bg-blue-500/10' };
  if (mb.connection_status === 'connected') return { status: 'online', label: 'Online', color: 'text-green-400 bg-green-500/10' };
  if (mb.connection_status === 'failed') {
    const err = (mb.last_error || '').toLowerCase();
    if (err.includes('auth') || err.includes('credential') || err.includes('invalid') || err.includes('password') || err.includes('login')) {
      return { status: 'auth_failed', label: 'Auth Failed', color: 'text-rose-400 bg-rose-500/10' };
    }
    return { status: 'offline', label: 'Offline', color: 'text-red-400 bg-red-500/10' };
  }
  return { status: 'unknown', label: 'Unknown', color: 'text-gray-400 bg-gray-500/10' };
};

const HEALTH_ICONS: Record<string, any> = {
  online: Wifi, offline: AlertTriangle, auth_failed: KeySquare, syncing: RefreshCw, unknown: Ban,
};

function HealthBadge({ h }: { h: { status: string; label: string; color: string } }) {
  const Icon = HEALTH_ICONS[h.status] || Ban;
  return <Badge className={h.color}><Icon size={10} className="inline" /> {h.label}</Badge>;
}

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

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  open: { label: 'Open', color: 'text-blue-400 bg-blue-500/10' },
  waiting_customer: { label: 'Waiting Customer', color: 'text-amber-400 bg-amber-500/10' },
  waiting_support: { label: 'Waiting Support', color: 'text-purple-400 bg-purple-500/10' },
  waiting_sales: { label: 'Waiting Sales', color: 'text-emerald-400 bg-emerald-500/10' },
  resolved: { label: 'Resolved', color: 'text-green-400 bg-green-500/10' },
  closed: { label: 'Closed', color: 'text-gray-400 bg-gray-500/10' },
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

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const attachmentUrl = (p: string) => {
  if (/^https?:\/\//.test(p)) return p;
  const idx = p.indexOf('public');
  if (idx >= 0) return p.slice(idx + 6).replace(/\\/g, '/');
  return p.replace(/\\/g, '/');
};

const priorityOf = (status: string) => {
  if (status === 'waiting_support' || status === 'waiting_sales') return { label: 'High', color: 'text-red-400', dot: 'bg-red-400' };
  if (status === 'open' || status === 'waiting_customer') return { label: 'Medium', color: 'text-amber-400', dot: 'bg-amber-400' };
  return { label: 'Low', color: 'text-gray-400', dot: 'bg-gray-400' };
};

function Badge({ children, className }: { children: React.ReactNode; className: string }) {
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap ${className}`}>{children}</span>;
}

function CategoryBadge({ category }: { category: string }) {
  return <Badge className={CATEGORY_COLORS[category] || 'text-gray-400 bg-gray-500/10'}>{CATEGORY_LABELS[category] || category}</Badge>;
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABELS[status] || { label: status, color: 'text-gray-400 bg-gray-500/10' };
  return <Badge className={s.color}>{s.label}</Badge>;
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onChange}
      aria-checked={checked}
      role="switch"
      className={`relative inline-flex h-4.5 w-8 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${checked ? 'bg-blue-500' : 'bg-gray-500/30'}`}
    >
      <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : 'translate-x-1'}`} />
    </button>
  );
}

export default function CommunicationsPage() {
  const [stats, setStats] = useState<Stats>({ inbox: 0, sent: 0, waiting: 0, failed: 0, queued: 0, unread: 0 });
  const [activeFolder, setActiveFolder] = useState<string>('ext-inbox');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [readFilter, setReadFilter] = useState<'all' | 'unread' | 'read'>('all');

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<DetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedMailbox, setSelectedMailbox] = useState<Mailbox | null>(null);
  const [mailboxDetail, setMailboxDetail] = useState<{ mailbox: any; sync_logs: any[] } | null>(null);
  const [selectedQueueItem, setSelectedQueueItem] = useState<QueueItem | null>(null);
  const [selectedLog, setSelectedLog] = useState<LogItem | null>(null);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<HistoryItem | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [showFilter, setShowFilter] = useState(false);

  const displayConversations = useMemo(() => {
    if (readFilter === 'all') return conversations;
    return conversations.filter(c => readFilter === 'unread' ? (c.unread_replies || 0) > 0 : !(c.unread_replies || 0));
  }, [conversations, readFilter]);

  const [emailDialog, setEmailDialog] = useState<{
    isOpen: boolean;
    defaultEmail?: string;
    defaultLicenseKey?: string;
    defaultProductId?: string;
    defaultProductName?: string;
    defaultAction?: 'send' | 'history' | 'buy-license' | 'activate' | 'renew' | 'reactivation' | 'device-replacement' | 'support' | 'general';
  }>({ isOpen: false });

  const [showMailboxForm, setShowMailboxForm] = useState(false);
  const [editingMailbox, setEditingMailbox] = useState<Mailbox | null>(null);
  const [mailboxForm, setMailboxForm] = useState<any>({});
  const [mailboxFormError, setMailboxFormError] = useState<string | null>(null);
  const [showTrashConfirm, setShowTrashConfirm] = useState(false);
  const [showDeleteMailboxConfirm, setShowDeleteMailboxConfirm] = useState<string | null>(null);
  const [testEmailTo, setTestEmailTo] = useState('');
  const [commSettings, setCommSettings] = useState<any>(null);
  const [commSettingsLoading, setCommSettingsLoading] = useState(false);
  const [commSettingsDirty, setCommSettingsDirty] = useState(false);
  const [commMailboxes, setCommMailboxes] = useState<Mailbox[]>([]);
  const [editAccountId, setEditAccountId] = useState<string | null>(null);
  const [accountDraft, setAccountDraft] = useState<any>(null);

  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [showFolderManager, setShowFolderManager] = useState(false);
  const [deletedFolders, setDeletedFolders] = useState<FolderRow[]>([]);
  const [renamingFolder, setRenamingFolder] = useState<{ id: string; name: string } | null>(null);
  const [folderForm, setFolderForm] = useState<{ name: string; section: 'internal' | 'external'; status: string; category: string; search: string }>({
    name: '', section: 'internal', status: '', category: '', search: '',
  });

  const folderDefFor = useCallback((row: FolderRow): FolderDef => {
    const sys = FOLDERS.find(f => f.key === row.id);
    let params: Record<string, string> = {};
    try { params = JSON.parse(row.filter_json || '{}'); } catch {}
    if (sys) {
      return {
        ...sys,
        label: row.name || sys.label,
        kind: (['list', 'queue', 'logs', 'history', 'mailboxes', 'empty'].includes(row.kind) ? row.kind : sys.kind) as ViewKind,
        params,
      };
    }
    return {
      key: row.id,
      label: row.name,
      icon: Folder,
      section: row.section === 'external' ? 'external' : 'internal',
      kind: (['list', 'queue', 'logs', 'history', 'mailboxes', 'empty'].includes(row.kind) ? row.kind : 'list') as ViewKind,
      params,
    };
  }, []);

  const loadFolders = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/folders`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.success) setFolders(json.data.folders || []);
      const del = await fetch(`${API_BASE}/folders?include_deleted=1`, { headers: getAuthHeaders() });
      const delJson = await del.json();
      if (delJson.success) setDeletedFolders((delJson.data.folders || []).filter((f: FolderRow) => f.deleted_at));
    } catch {}
  }, []);

  const activeFolderDef = useMemo(() => {
    if (activeFolder === 'settings') return SETTINGS_DEF;
    const row = folders.find(f => f.id === activeFolder);
    if (row) return folderDefFor(row);
    return FOLDERS.find(f => f.key === activeFolder) || FOLDERS[0];
  }, [activeFolder, folders, folderDefFor]);
  const isTrash = activeFolder === 'ext-trash';

  const showToast = useCallback((type: 'ok' | 'err', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const createFolder = useCallback(async () => {
    if (!folderForm.name.trim()) { showToast('err', 'Folder name is required'); return; }
    setBusy('create-folder');
    try {
      const filter: Record<string, string> = {};
      if (folderForm.status) filter.status = folderForm.status;
      if (folderForm.category) filter.category = folderForm.category;
      if (folderForm.search.trim()) filter.search = folderForm.search.trim();
      const res = await fetch(`${API_BASE}/folders`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: folderForm.name.trim(), section: folderForm.section, filter }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('ok', `Folder "${folderForm.name.trim()}" created`);
        setShowFolderManager(false);
        setFolderForm({ name: '', section: 'internal', status: '', category: '', search: '' });
        await loadFolders();
        handleFolderChange(json.data.folder.id);
      } else {
        showToast('err', json.error?.message || 'Failed to create folder');
      }
    } catch {
      showToast('err', 'Failed to create folder');
    } finally {
      setBusy(null);
    }
  }, [folderForm, loadFolders, showToast]);

  const renameFolder = useCallback(async (id: string, name: string) => {
    if (!name.trim()) { showToast('err', 'Folder name is required'); return; }
    setBusy(`rename-folder:${id}`);
    try {
      const res = await fetch(`${API_BASE}/folders/${id}`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      const json = await res.json();
      if (json.success) showToast('ok', 'Folder renamed');
      else showToast('err', json.error?.message || 'Failed to rename folder');
      await loadFolders();
    } catch {
      showToast('err', 'Failed to rename folder');
    } finally {
      setBusy(null);
      setRenamingFolder(null);
    }
  }, [loadFolders, showToast]);

  const deleteFolder = useCallback(async (id: string) => {
    setBusy(`delete-folder:${id}`);
    try {
      const res = await fetch(`${API_BASE}/folders/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      const json = await res.json();
      if (json.success) {
        showToast('ok', json.message || 'Folder deleted');
        if (activeFolder === id) handleFolderChange('ext-inbox');
      } else {
        showToast('err', json.error?.message || 'Failed to delete folder');
      }
      await loadFolders();
    } catch {
      showToast('err', 'Failed to delete folder');
    } finally {
      setBusy(null);
    }
  }, [activeFolder, loadFolders, showToast]);

  const restoreFolder = useCallback(async (id: string) => {
    setBusy(`restore-folder:${id}`);
    try {
      const res = await fetch(`${API_BASE}/folders/${id}`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore' }),
      });
      const json = await res.json();
      if (json.success) showToast('ok', 'Folder restored');
      else showToast('err', json.error?.message || 'Failed to restore folder');
      await loadFolders();
    } catch {
      showToast('err', 'Failed to restore folder');
    } finally {
      setBusy(null);
    }
  }, [loadFolders, showToast]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/conversations/stats`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.success) setStats(json.data);
    } catch {}
  }, []);

  const loadConversations = useCallback(async (folder: FolderDef, search: string, statusF: string, categoryF: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', '1');
      params.set('limit', '100');
      if (folder.params?.status) params.set('status', folder.params.status);
      if (folder.params?.category) params.set('category', folder.params.category);
      if (folder.params?.search) params.set('search', folder.params.search);
      if (folder.params?.has_customer) params.set('has_customer', 'true');
      if (folder.params?.show_deleted) params.set('show_deleted', 'true');
      if (statusF) params.set('status', statusF);
      if (categoryF) params.set('category', categoryF);
      if (search) params.set('search', search);
      const res = await fetch(`${API_BASE}/conversations?${params.toString()}`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.success) {
        setConversations(json.data.conversations || []);
      } else {
        setError(json.error?.message || 'Failed to load');
      }
    } catch {
      setError('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/queue?limit=100`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.success) setQueue(json.data.queue || []);
    } catch {
      setError('Failed to load queue');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/delivery-logs?limit=100`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.success) setLogs(json.data.logs || []);
    } catch {
      setError('Failed to load delivery logs');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/internal/backend/admin/communication/history?limit=100', { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.success) setHistory(json.data || []);
      else setError(json.error || 'Failed to load email history');
    } catch {
      setError('Failed to load email history');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMailboxes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${MB_BASE}`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.success) setMailboxes(json.data.mailboxes || []);
    } catch {
      setError('Failed to load mailboxes');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCommsSettings = useCallback(async () => {
    setCommSettingsLoading(true);
    try {
      const [settingsRes, mbRes] = await Promise.all([
        fetch('/internal/backend/communications/settings', { headers: getAuthHeaders() }),
        fetch(`${MB_BASE}`, { headers: getAuthHeaders() }),
      ]);
      const settingsJson = await settingsRes.json();
      if (settingsJson.success) setCommSettings(settingsJson.settings);
      const mbJson = await mbRes.json();
      if (mbJson.success) setCommMailboxes(mbJson.data.mailboxes || []);
    } catch {} finally {
      setCommSettingsLoading(false);
    }
  }, []);

  const saveCommsSettings = useCallback(async () => {
    if (!commSettings) return;
    setBusy('save-comm-settings');
    try {
      const res = await fetch('/internal/backend/communications/settings', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(commSettings),
      });
      const json = await res.json();
      if (json.success) {
        showToast('ok', 'Communication settings saved');
        setCommSettingsDirty(false);
      } else {
        showToast('err', json.error?.message || 'Failed to save settings');
      }
    } catch {
      showToast('err', 'Failed to save settings');
    } finally {
      setBusy(null);
    }
  }, [commSettings, showToast]);

  const setCommGeneral = useCallback((key: string, value: any) => {
    setCommSettings((prev: any) => prev ? { ...prev, general: { ...prev.general, [key]: value } } : prev);
    setCommSettingsDirty(true);
  }, []);

  const setCommAccount = useCallback((id: string, key: string, value: any) => {
    setCommSettings((prev: any) => prev ? {
      ...prev,
      mail_accounts: (prev.mail_accounts || []).map((a: any) => a.id === id ? { ...a, [key]: value } : a),
    } : prev);
    setCommSettingsDirty(true);
  }, []);

  // Persist a settings payload immediately (used by the system-account toggles
  // and inline edits so they take effect without a separate Save click).
  const persistCommSettings = useCallback(async (payload: any) => {
    setBusy('save-comm-settings');
    try {
      const res = await fetch('/internal/backend/communications/settings', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        showToast('ok', 'Communication settings saved');
        setCommSettingsDirty(false);
        await loadCommsSettings();
      } else {
        showToast('err', json.error?.message || 'Failed to save settings');
      }
    } catch {
      showToast('err', 'Failed to save settings');
    } finally {
      setBusy(null);
    }
  }, [showToast, loadCommsSettings]);

  // Toggle a built-in system mail account (support / sales / no-reply).
  // Backed by the real `settings.communications.mail_accounts[].is_active`
  // flag — never a hardcoded/fake state. Saves immediately.
  const toggleSystemAccount = useCallback((id: string) => {
    setCommSettings((prev: any) => {
      if (!prev) return prev;
      const next: any = {
        ...prev,
        mail_accounts: (prev.mail_accounts || []).map((a: any) =>
          a.id === id ? { ...a, is_active: !(a.is_active === true) } : a
        ),
      };
      setCommSettingsDirty(true);
      persistCommSettings(next);
      return next;
    });
  }, [persistCommSettings]);

  const saveAccountDraft = useCallback((id: string, draft: any) => {
    setCommSettings((prev: any) => {
      if (!prev) return prev;
      const next: any = {
        ...prev,
        mail_accounts: (prev.mail_accounts || []).map((a: any) =>
          a.id === id ? { ...a, display_name: draft.display_name, reply_to: draft.reply_to, signature: draft.signature } : a
        ),
      };
      setCommSettingsDirty(true);
      persistCommSettings(next);
      return next;
    });
  }, [persistCommSettings]);

  // Live auto-sync (no cron on serverless): process queue + pull IMAP for every
  // enabled mailbox on a timer, and refresh immediately whenever the tab regains
  // focus so counts never appear stale. No cached/hardcoded unread values — every
  // value is refetched from the backend (which is the single source of truth).
  useEffect(() => {
    const runAutoSync = async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      try {
        const headers = getAuthHeaders();
        await fetch(`${API_BASE}/queue/process`, { method: 'POST', headers });
        const mbRes = await fetch(`${MB_BASE}`, { headers });
        const mbJson = await mbRes.json();
        const enabled = (mbJson.data?.mailboxes || []).filter((m: any) => m.is_enabled);
        await Promise.all(enabled.map((m: any) =>
          fetch(`${MB_BASE}/${m.id}/sync`, { method: 'POST', headers }).catch(() => {})
        ));
        fetchStats();
        if (activeFolderDef.kind === 'list') loadConversations(activeFolderDef, searchQuery, statusFilter, categoryFilter);
        else if (activeFolderDef.kind === 'mailboxes') loadMailboxes();
        else if (activeFolderDef.kind === 'settings') loadCommsSettings();
      } catch {}
    };
    const iv = setInterval(runAutoSync, 45000);
    const onVisible = () => { if (typeof document !== 'undefined' && !document.hidden) runAutoSync(); };
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(iv); if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible); };
  }, [activeFolderDef, searchQuery, statusFilter, categoryFilter, loadConversations, loadMailboxes, loadCommsSettings, fetchStats]);

  const syncAllMailboxes = useCallback(async () => {
    setBusy('sync-all');
    try {
      let synced = 0;
      for (const mb of mailboxes.filter(m => m.is_enabled)) {
        const res = await fetch(`${MB_BASE}/${mb.id}/sync`, { method: 'POST', headers: getAuthHeaders() });
        const json = await res.json();
        if (json.success) synced++;
      }
      showToast('ok', `${synced} mailbox(es) synced`);
      await loadMailboxes();
    } catch {
      showToast('err', 'Mailbox sync failed');
    } finally {
      setBusy(null);
    }
  }, [mailboxes, loadMailboxes, showToast]);

  const refreshCurrent = useCallback(() => {
    const row = folders.find(x => x.id === activeFolder);
    const f = activeFolder === 'settings' ? SETTINGS_DEF : (row ? folderDefFor(row) : (FOLDERS.find(x => x.key === activeFolder) || FOLDERS[0]));
    if (f.kind === 'list') loadConversations(f, searchQuery, statusFilter, categoryFilter);
    else if (f.kind === 'queue') loadQueue();
    else if (f.kind === 'logs') loadLogs();
    else if (f.kind === 'history') loadHistory();
    else if (f.kind === 'mailboxes') loadMailboxes();
    else if (f.kind === 'settings') loadCommsSettings();
    fetchStats();
  }, [activeFolder, folders, folderDefFor, searchQuery, statusFilter, categoryFilter, loadConversations, loadQueue, loadLogs, loadHistory, loadMailboxes, loadCommsSettings, fetchStats]);

  // Phase 5: deliver queued emails via the default sender mailbox SMTP
  const processQueue = useCallback(async () => {
    setBusy('process-queue');
    try {
      const res = await fetch(`${API_BASE}/queue/process`, { method: 'POST', headers: getAuthHeaders() });
      const json = await res.json();
      if (json.success) {
        if (json.delivered > 0) showToast('ok', `${json.delivered} queued email(s) delivered via SMTP`);
        else if (json.no_mailbox && json.processed > 0) showToast('err', 'No default sender mailbox configured — queue not processed');
      }
    } catch {}
    finally {
      setBusy(null);
      refreshCurrent();
    }
  }, [refreshCurrent, showToast]);

  useEffect(() => { refreshCurrent(); }, [refreshCurrent]);

  useEffect(() => { loadFolders(); }, [loadFolders]);

  useEffect(() => {
    const iv = setInterval(fetchStats, 15000);
    return () => clearInterval(iv);
  }, [fetchStats]);

  const handleFolderChange = (key: string) => {
    setActiveFolder(key);
    setSelectedIds(new Set());
    setDetail(null);
    setSelectedMailbox(null);
    setMailboxDetail(null);
    setSelectedQueueItem(null);
    setSelectedLog(null);
    setSelectedHistoryItem(null);
    setError(null);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === conversations.length && conversations.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(conversations.map(c => c.id)));
    }
  };

  const openDetail = async (id: string) => {
    setSelectedIds(prev => { const next = new Set(prev); next.add(id); return next; });
    setDetailLoading(true);
    try {
      const res = await fetch(`${API_BASE}/conversations/${id}`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.success) {
        setDetail(json.data);
        if ((json.data.conversation?.unread_replies || 0) > 0) {
          await fetch(`${API_BASE}/conversations/${id}`, {
            method: 'PATCH',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'mark_read' }),
          });
          setDetail((prev: DetailData | null) => prev ? { ...prev, conversation: { ...prev.conversation, unread_replies: 0 } } : prev);
          setConversations(prev => prev.map(c => c.id === id ? { ...c, unread_replies: 0 } : c));
          fetchStats();
          refreshCurrent();
        }
      } else {
        setError(json.error?.message || 'Failed to load conversation');
      }
    } catch {
      setError('Failed to load conversation');
    } finally {
      setDetailLoading(false);
    }
  };

  const patchConversation = async (action: string, ids: string[], okMsg: string) => {
    setBusy(action);
    try {
      let ok = true;
      for (const id of ids) {
        const res = await fetch(`${API_BASE}/conversations/${id}`, {
          method: 'PATCH',
          headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        });
        const json = await res.json();
        if (!json.success) { ok = false; showToast('err', json.error?.message || 'Action failed'); }
      }
      if (ok) {
        showToast('ok', okMsg);
        setDetail(null);
        refreshCurrent();
      }
    } catch {
      showToast('err', 'Action failed');
    } finally {
      setBusy(null);
    }
  };

  const softDeleteSelected = async () => {
    const ids = Array.from(selectedIds);
    setBusy('delete');
    try {
      let ok = true;
      for (const id of ids) {
        const res = await fetch(`${API_BASE}/conversations/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
        const json = await res.json();
        if (!json.success) { ok = false; showToast('err', json.error?.message || 'Delete failed'); }
      }
      if (ok) { showToast('ok', `${ids.length} conversation(s) moved to Trash`); setDetail(null); refreshCurrent(); }
    } catch {
      showToast('err', 'Delete failed');
    } finally {
      setBusy(null);
    }
  };

  const restoreSelected = async () => {
    const ids = Array.from(selectedIds);
    setBusy('restore');
    try {
      for (const id of ids) {
        await fetch(`${API_BASE}/conversations/${id}`, {
          method: 'PATCH',
          headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'restore' }),
        });
      }
      showToast('ok', `${ids.length} conversation(s) restored`);
      refreshCurrent();
    } catch {
      showToast('err', 'Restore failed');
    } finally {
      setBusy(null);
    }
  };

  const emptyTrash = async () => {
    setBusy('empty-trash');
    try {
      const res = await fetch(`${API_BASE}/conversations?action=empty_trash`, { method: 'DELETE', headers: getAuthHeaders() });
      const json = await res.json();
      if (json.success) { showToast('ok', json.data?.message || 'Trash emptied'); setShowTrashConfirm(false); refreshCurrent(); }
      else showToast('err', json.error?.message || 'Failed to empty trash');
    } catch {
      showToast('err', 'Failed to empty trash');
    } finally {
      setBusy(null);
    }
  };

  const openCompose = () => {
    setEmailDialog({ isOpen: true, defaultAction: 'send' });
  };

  const openReply = (to?: string, action?: 'support' | 'general') => {
    const d = detail;
    const target = to || d?.conversation.customer_email || (d?.customer?.email as string) || '';
    const act = action || (d?.conversation.category === 'support' ? 'support' : 'general');
    setEmailDialog({
      isOpen: true,
      defaultEmail: target,
      defaultLicenseKey: d?.conversation.license_key || undefined,
      defaultProductId: d?.conversation.product_id || undefined,
      defaultAction: act,
    });
  };

  const openForward = () => {
    const d = detail;
    setEmailDialog({
      isOpen: true,
      defaultAction: 'send',
      defaultLicenseKey: d?.conversation.license_key || undefined,
      defaultProductId: d?.conversation.product_id || undefined,
    });
  };

  const selectedConversation = useMemo(
    () => conversations.find(c => c.id === (Array.from(selectedIds)[0] || '')) || null,
    [conversations, selectedIds]
  );

  // ---- Mailbox actions ----
  const loadMailboxDetail = async (id: string) => {
    setSelectedMailbox(mailboxes.find(m => m.id === id) || null);
    try {
      const res = await fetch(`${MB_BASE}/${id}`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.success) setMailboxDetail(json.data);
    } catch {}
  };

  const mailboxAction = async (id: string, endpoint: string, method: 'POST' | 'PATCH' | 'DELETE' = 'POST', body?: any, okMsg?: string) => {
    setBusy(`${endpoint}:${id}`);
    try {
      const res = await fetch(`${MB_BASE}/${id}/${endpoint}`, {
        method,
        headers: { ...getAuthHeaders(), ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const json = await res.json();
      if (json.success) {
        if (okMsg) showToast('ok', okMsg);
        await loadMailboxes();
        if (selectedMailbox?.id === id) await loadMailboxDetail(id);
      } else {
        showToast('err', json.error?.message || json.message || 'Mailbox action failed');
      }
    } catch {
      showToast('err', 'Mailbox action failed');
    } finally {
      setBusy(null);
    }
  };

  const saveMailbox = async () => {
    setMailboxFormError(null);

    // Client-side validation — mirror the backend's required fields so the
    // administrator sees exactly what is missing before any request is sent.
    const missing: string[] = [];
    const requiredLabels: [string, string][] = [
      ['email_address', 'Mail address'],
      ['imap_host', 'Incoming mail server'],
      ['imap_username', 'Incoming username'],
      ['smtp_host', 'Outgoing mail server'],
      ['smtp_username', 'Outgoing username'],
    ];
    for (const [key, label] of requiredLabels) {
      if (!mailboxForm[key]?.toString().trim()) missing.push(label);
    }
    if (!editingMailbox) {
      if (!mailboxForm.imap_password?.toString()) missing.push('Incoming password');
      if (!mailboxForm.smtp_password?.toString()) missing.push('Outgoing password');
    }
    if (missing.length > 0) {
      const msg = `Please complete the required fields: ${missing.join(', ')}.`;
      setMailboxFormError(msg);
      showToast('err', msg);
      return;
    }

    setBusy('save-mailbox');
    try {
      const payload = { ...mailboxForm };
      if (editingMailbox) {
        // Never overwrite stored credentials with blank values on edit.
        const protectedKeys = ['imap_password', 'smtp_password'] as const;
        for (const key of protectedKeys) {
          if (payload[key] === '' || payload[key] === '********') delete payload[key];
        }
      }

      // Connection verification — verify SMTP + IMAP credentials before saving.
      // New mailboxes must pass; on failure the specific reason is shown and
      // nothing is saved.
      if (!editingMailbox) {
        try {
          const vRes = await fetch(`${MB_BASE}/test-connection`, {
            method: 'POST',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const v = await vRes.json();
          if (v.success) {
            const reasons: string[] = [];
            if (v.data?.imap && !v.data.imap.connected) {
              reasons.push(`IMAP: ${v.data.imap.error || 'connection failed'}`);
            }
            if (v.data?.smtp && !v.data.smtp.connected) {
              reasons.push(`SMTP: ${v.data.smtp.error || 'connection failed'}`);
            }
            if (reasons.length > 0) {
              const msg = `Connection verification failed — ${reasons.join('; ')}.`;
              setMailboxFormError(msg);
              showToast('err', msg);
              return;
            }
          } else {
            const msg = v.error?.message || 'Connection verification failed.';
            setMailboxFormError(msg);
            showToast('err', msg);
            return;
          }
        } catch {
          const msg = 'Connection verification could not be completed.';
          setMailboxFormError(msg);
          showToast('err', msg);
          return;
        }
      }

      const res = await fetch(editingMailbox ? `${MB_BASE}/${editingMailbox.id}` : `${MB_BASE}`, {
        method: editingMailbox ? 'PATCH' : 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        showToast('ok', json.message || (editingMailbox ? 'Mailbox updated.' : 'Mailbox created successfully.'));
        setShowMailboxForm(false);
        setEditingMailbox(null);
        setMailboxForm({});
        setMailboxFormError(null);
        await loadMailboxes();
      } else {
        const msg = json.error?.message || json.message || 'Failed to save mailbox.';
        setMailboxFormError(msg);
        showToast('err', msg);
      }
    } catch {
      const msg = 'Failed to save mailbox.';
      setMailboxFormError(msg);
      showToast('err', msg);
    } finally {
      setBusy(null);
    }
  };

  const deleteMailbox = async (id: string) => {
    setBusy(`delete:${id}`);
    try {
      const res = await fetch(`${MB_BASE}/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      const json = await res.json();
      if (json.success) {
        showToast('ok', json.message || 'Mailbox deleted');
        setShowDeleteMailboxConfirm(null);
        setSelectedMailbox(null);
        setMailboxDetail(null);
        await loadMailboxes();
      } else {
        showToast('err', json.error?.message || 'Failed to delete mailbox');
      }
    } catch {
      showToast('err', 'Failed to delete mailbox');
    } finally {
      setBusy(null);
    }
  };

  const sendTestEmail = async (id: string) => {
    if (!testEmailTo) return;
    setBusy(`send-test:${id}`);
    try {
      const res = await fetch(`${MB_BASE}/${id}/send-test`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ to_email: testEmailTo }),
      });
      const json = await res.json();
      if (json.success) showToast('ok', json.message || 'Test email sent');
      else showToast('err', json.error?.message || 'Failed to send test email');
    } catch {
      showToast('err', 'Failed to send test email');
    } finally {
      setBusy(null);
    }
  };

  // ---- Toolbar rendering ----
  const renderToolbar = () => {
    const hasSelection = selectedIds.size > 0;
    const btn = 'p-2 rounded-lg hover:bg-[var(--bg-tertiary)]/50 transition-colors disabled:opacity-30 disabled:hover:bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]';
    return (
      <div className="flex items-center gap-1 flex-wrap rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 px-2 py-1.5">
        <button onClick={openCompose} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors">
          <Mail size={13} /> New Email
        </button>
        <div className="w-px h-5 bg-[var(--border-color)] mx-1" />
        <button
          onClick={() => openReply()}
          disabled={!hasSelection}
          title="Reply"
          className={btn}
        >
          <Reply size={14} />
        </button>
        <button
          onClick={() => openReply()}
          disabled={!hasSelection}
          title="Reply All"
          className={btn}
        >
          <ReplyAll size={14} />
        </button>
        <button
          onClick={openForward}
          disabled={!hasSelection}
          title="Forward"
          className={btn}
        >
          <Forward size={14} />
        </button>
        <div className="w-px h-5 bg-[var(--border-color)] mx-1" />
        <button
          onClick={() => patchConversation('archive', Array.from(selectedIds), 'Conversation(s) archived')}
          disabled={!hasSelection || isTrash}
          title="Archive"
          className={btn}
        >
          <Archive size={14} />
        </button>
        <button
          onClick={isTrash ? restoreSelected : softDeleteSelected}
          disabled={!hasSelection}
          title={isTrash ? 'Restore' : 'Delete'}
          className={btn}
        >
          {isTrash ? <ArchiveRestore size={14} /> : <Trash2 size={14} />}
        </button>
        <button
          onClick={() => patchConversation('mark_read', Array.from(selectedIds), 'Marked as read')}
          disabled={!hasSelection || isTrash}
          title="Mark Read"
          className={btn}
        >
          <MailOpen size={14} />
        </button>
        <button
          onClick={() => patchConversation('mark_unread', Array.from(selectedIds), 'Marked as unread')}
          disabled={!hasSelection || isTrash}
          title="Mark Unread"
          className={btn}
        >
          <CheckCheck size={14} />
        </button>
        <div className="w-px h-5 bg-[var(--border-color)] mx-1" />
        <button onClick={refreshCurrent} title="Refresh" className={btn}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
        <div className="relative flex-1 min-w-[140px] max-w-xs ml-auto">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && refreshCurrent()}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)]/20 text-[var(--text-primary)] text-xs placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <button onClick={() => setShowFilter(!showFilter)} title="Filter" className={`p-2 rounded-lg transition-colors ${showFilter ? 'bg-blue-500/15 text-blue-400' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/50'}`}>
          <Filter size={14} />
        </button>
        {showFilter && (
          <div className="absolute right-2 top-full mt-1 z-30 w-64 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-2xl shadow-black/40 p-3 space-y-2">
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); }} className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)]/20 text-[var(--text-primary)] text-xs">
              <option value="">All Status</option>
              <option value="open">Open</option>
              <option value="waiting_customer">Waiting Customer</option>
              <option value="waiting_support">Waiting Support</option>
              <option value="waiting_sales">Waiting Sales</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
            <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); }} className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)]/20 text-[var(--text-primary)] text-xs">
              <option value="">All Categories</option>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button onClick={() => { setStatusFilter(''); setCategoryFilter(''); }} className="w-full text-center text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">Clear filters</button>
          </div>
        )}
      </div>
    );
  };

  // ---- Status cards (always visible) ----
  const statusCards: { key: keyof Stats; label: string; icon: any; color: string }[] = [
    { key: 'inbox', label: 'Inbox', icon: Inbox, color: 'bg-blue-500/10 text-blue-400' },
    { key: 'waiting', label: 'Waiting', icon: MessageSquare, color: 'bg-purple-500/10 text-purple-400' },
    { key: 'sent', label: 'Sent', icon: Send, color: 'bg-green-500/10 text-green-400' },
    { key: 'failed', label: 'Failed', icon: AlertTriangle, color: 'bg-red-500/10 text-red-400' },
    { key: 'queued', label: 'Queued', icon: Clock, color: 'bg-amber-500/10 text-amber-400' },
    { key: 'unread', label: 'Unread', icon: MailOpen, color: 'bg-cyan-500/10 text-cyan-400' },
  ];

  // ---- Sidebar (email-client navigation, database-driven folders) ----
  const renderSidebar = () => (
    <aside className="w-60 flex-shrink-0 flex flex-col min-h-0 border-r border-[var(--border-color)] bg-[var(--bg-tertiary)]/10">
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-5 scrollbar-thin">
        <div className="px-2 flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
            <Mail className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-[var(--text-primary)] leading-tight truncate">Mail</p>
            <p className="text-[9px] text-[var(--text-muted)]">Websmith Communications</p>
          </div>
        </div>
        {NAV_GROUPS.map(group => {
          const groupFolders = folders.filter(f => groupFor(folderDefFor(f)) === group.key);
          if (groupFolders.length === 0) return null;
          const GroupIcon = group.icon;
          return (
            <div key={group.key}>
              <p className="px-2 mb-1.5 flex items-center gap-1.5 text-[9px] font-bold tracking-widest text-[var(--text-muted)] uppercase">
                <GroupIcon size={10} /> {group.label}
              </p>
              <div className="space-y-0.5">
                {groupFolders.map(row => {
                  const def = folderDefFor(row);
                  const Icon = def.icon;
                  const active = activeFolder === row.id;
                  const badge = def.badgeKey ? stats[def.badgeKey] : 0;
                  return (
                    <button
                      key={row.id}
                      onClick={() => handleFolderChange(row.id)}
                      className={`relative w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                        active ? 'bg-blue-500/15 text-blue-400' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-0.5 rounded-full bg-blue-400" />}
                      <Icon size={14} className="flex-shrink-0" />
                      <span className="flex-1 text-left truncate">{def.label}</span>
                      {!row.is_system && <FolderOpen size={10} className="flex-shrink-0 opacity-40" />}
                      {badge > 0 && (
                        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${row.id === 'all' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-blue-500/20 text-blue-400'}`}>{badge}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        <div className="pt-2 border-t border-[var(--border-color)] space-y-0.5">
          <button
            onClick={() => handleFolderChange('settings')}
            className={`relative w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
              activeFolder === 'settings' ? 'bg-blue-500/15 text-blue-400' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 hover:text-[var(--text-primary)]'
            }`}
          >
            {activeFolder === 'settings' && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-0.5 rounded-full bg-blue-400" />}
            <Settings size={14} className="flex-shrink-0" />
            <span className="flex-1 text-left truncate">Communication Settings</span>
          </button>
          <button onClick={() => setShowFolderManager(true)}
            className="w-full flex items-center justify-center gap-2 px-2.5 py-2 rounded-lg border border-dashed border-[var(--border-color)] text-[11px] text-[var(--text-secondary)] hover:text-blue-400 hover:border-blue-500/40 hover:bg-blue-500/5 transition-colors">
            <FolderPlus size={13} /> New Folder
          </button>
        </div>
      </div>
    </aside>
  );

  // ---- Center panel ----
  const renderListTable = () => {
    if (loading) return <div className="flex-1 flex items-center justify-center"><Loader2 className="h-6 w-6 text-blue-400 animate-spin" /></div>;
    if (error) return <div className="flex-1 flex flex-col items-center justify-center gap-2 text-[var(--text-muted)]"><AlertCircle className="h-6 w-6 text-red-400" /><p className="text-xs">{error}</p></div>;
    if (displayConversations.length === 0) return (
      <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)]">
        <Inbox size={32} className="mb-2 opacity-30" />
        <p className="text-xs">{readFilter === 'all' ? 'No conversations found' : readFilter === 'unread' ? 'No unread conversations' : 'No read conversations'}</p>
      </div>
    );
    return (
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border-color)] sticky top-0 z-10 bg-[var(--bg-primary)]">
          <input type="checkbox" checked={selectedIds.size === conversations.length && conversations.length > 0} onChange={toggleSelectAll} className="accent-blue-500" />
          <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">{displayConversations.length} conversation(s)</span>
          {selectedIds.size > 0 && <span className="text-[10px] text-blue-400 ml-auto">{selectedIds.size} selected</span>}
        </div>
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/20">
          {(['all', 'unread', 'read'] as const).map(f => (
            <button key={f} onClick={() => setReadFilter(f)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors ${readFilter === f ? 'bg-blue-500/20 text-blue-400' : 'text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]/40'}`}>
              {f === 'all' ? 'All' : f === 'unread' ? `Unread (${conversations.filter(c => (c.unread_replies || 0) > 0).length})` : `Read (${conversations.filter(c => !(c.unread_replies || 0)).length})`}
            </button>
          ))}
        </div>
        <div className="divide-y divide-[var(--border-color)]">
          {displayConversations.map(conv => {
            const sel = selectedIds.has(conv.id);
            const prio = priorityOf(conv.status);
            const unread = (conv.unread_replies || 0) > 0;
            const sender = conv.customer_name || conv.customer_email || 'Unknown';
            const initial = (sender.trim()[0] || '?').toUpperCase();
            return (
              <div
                key={conv.id}
                onClick={() => openDetail(conv.id)}
                className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${sel ? 'bg-blue-500/10' : unread ? 'hover:bg-[var(--bg-tertiary)]/20 bg-[var(--bg-tertiary)]/5' : 'hover:bg-[var(--bg-tertiary)]/20'}`}
              >
                <div className="w-5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={sel} onChange={() => toggleSelect(conv.id)} className="accent-blue-500" />
                </div>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${unread ? 'bg-blue-500/20 text-blue-400' : 'bg-[var(--bg-tertiary)]/40 text-[var(--text-secondary)]'}`}>
                  {initial}
                </div>
                <div className="w-40 flex-shrink-0 min-w-0">
                  <p className={`text-xs truncate ${unread ? 'text-[var(--text-primary)] font-semibold' : 'text-[var(--text-secondary)]'}`}>{sender}</p>
                  <p className="text-[10px] text-[var(--text-muted)] truncate">{conv.customer_email}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {unread && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />}
                    <p className={`text-xs truncate ${unread ? 'text-[var(--text-primary)] font-semibold' : 'text-[var(--text-secondary)]'}`}>{conv.subject || '(No subject)'}</p>
                    <CategoryBadge category={conv.category} />
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)] truncate mt-0.5">
                    {conv.product_id ? `Product ${conv.product_id}` : ''}{conv.product_id && conv.license_key ? ' · ' : ''}{conv.license_key || ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {conv.attachment_count > 0 && <Paperclip size={12} className="text-[var(--text-muted)]" />}
                  <StatusBadge status={conv.status} />
                  <span className={`text-[10px] font-medium flex items-center gap-1 ${prio.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${prio.dot}`} /> {prio.label}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] whitespace-nowrap w-16 text-right">{new Date(conv.updated_at).toLocaleDateString()}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderQueueList = () => {
    if (loading) return <div className="flex-1 flex items-center justify-center"><Loader2 className="h-6 w-6 text-blue-400 animate-spin" /></div>;
    return (
      <div className="flex flex-col min-h-0 h-full">
        <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-color)] shrink-0">
          <p className="text-xs text-[var(--text-muted)]">{queue.length} queued message(s) — delivered via default sender mailbox SMTP</p>
          <button onClick={processQueue} disabled={busy === 'process-queue'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-medium transition-colors disabled:opacity-50">
            {busy === 'process-queue' ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Process Queue
          </button>
        </div>
        {queue.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)]">
            <Clock size={32} className="mb-2 opacity-30" />
            <p className="text-xs">Queue is empty</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            <div className="divide-y divide-[var(--border-color)]">
              {queue.map(item => (
                <button
                  key={item.id}
                  onClick={() => setSelectedQueueItem(item)}
                  className={`w-full text-left px-3 py-2.5 hover:bg-[var(--bg-tertiary)]/20 transition-colors ${selectedQueueItem?.id === item.id ? 'bg-blue-500/10' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${QUEUE_STATUS_LABELS[item.status]?.color || 'text-gray-400'}`}>{QUEUE_STATUS_LABELS[item.status]?.label || item.status}</span>
                    <CategoryBadge category={item.category} />
                    <span className="text-[10px] text-[var(--text-muted)] ml-auto">Retry {item.retry_count}/{item.max_retries}</span>
                  </div>
                  <p className="text-xs text-[var(--text-primary)] truncate mt-1">{item.customer_name || item.customer_email} — {item.subject || '(no subject)'}</p>
                  {item.last_error && <p className="text-[10px] text-red-400 truncate mt-0.5">{item.last_error}</p>}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderLogsList = () => {
    if (loading) return <div className="flex-1 flex items-center justify-center"><Loader2 className="h-6 w-6 text-blue-400 animate-spin" /></div>;
    if (logs.length === 0) return (
      <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)]">
        <Activity size={32} className="mb-2 opacity-30" />
        <p className="text-xs">No delivery logs yet</p>
      </div>
    );
    return (
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="divide-y divide-[var(--border-color)]">
          {logs.map(log => (
            <button
              key={log.id}
              onClick={() => setSelectedLog(log)}
              className={`w-full text-left px-3 py-2.5 hover:bg-[var(--bg-tertiary)]/20 transition-colors ${selectedLog?.id === log.id ? 'bg-blue-500/10' : ''}`}
            >
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium ${LOG_STATUS_LABELS[log.status]?.color || 'text-gray-400'}`}>{LOG_STATUS_LABELS[log.status]?.label || log.status}</span>
                <span className="text-[10px] text-[var(--text-muted)]">{log.channel || 'email'}</span>
                <span className="text-[10px] text-[var(--text-muted)] ml-auto">{new Date(log.created_at).toLocaleString()}</span>
              </div>
              <p className="text-xs text-[var(--text-primary)] truncate mt-1">{log.recipient} — {log.subject || '(no subject)'}</p>
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderHistoryList = () => {
    if (loading) return <div className="flex-1 flex items-center justify-center"><Loader2 className="h-6 w-6 text-blue-400 animate-spin" /></div>;
    if (history.length === 0) return (
      <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)]">
        <MailOpen size={32} className="mb-2 opacity-30" />
        <p className="text-xs">No emails sent yet</p>
      </div>
    );
    return (
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="divide-y divide-[var(--border-color)]">
          {history.map(item => (
            <button
              key={item.id}
              onClick={() => setSelectedHistoryItem(item)}
              className={`w-full text-left px-3 py-2.5 hover:bg-[var(--bg-tertiary)]/20 transition-colors ${selectedHistoryItem?.id === item.id ? 'bg-blue-500/10' : ''}`}
            >
              <div className="flex items-center gap-2">
                <Badge className="text-gray-400 bg-gray-500/10">{item.event_type}</Badge>
                <span className={`text-xs font-medium ${LOG_STATUS_LABELS[item.status]?.color || 'text-gray-400'}`}>{LOG_STATUS_LABELS[item.status]?.label || item.status}</span>
                {(item.attachments?.length || 0) > 0 && <span className="flex items-center gap-0.5 text-[10px] text-[var(--text-muted)]"><Paperclip size={10} />{item.attachments!.length}</span>}
                <span className="text-[10px] text-[var(--text-muted)] ml-auto">{new Date(item.created_at).toLocaleString()}</span>
              </div>
              <p className="text-xs text-[var(--text-primary)] truncate mt-1">{item.recipient} — {item.subject || '(no subject)'}</p>
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderMailboxGrid = () => {
    if (loading) return <div className="flex-1 flex items-center justify-center"><Loader2 className="h-6 w-6 text-blue-400 animate-spin" /></div>;
    if (mailboxes.length === 0) return (
      <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)] gap-3">
        <AtSign size={32} className="opacity-30" />
        <p className="text-xs">No mailboxes configured</p>
        <button onClick={() => { setEditingMailbox(null); setMailboxForm({ provider: 'custom', imap_port: 993, smtp_port: 465, imap_secure: true, smtp_secure: true }); setMailboxFormError(null); setShowMailboxForm(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors">
          <Plus size={13} /> Add Mailbox
        </button>
      </div>
    );
    const online = mailboxes.filter(m => m.is_enabled && mailboxHealth(m).status === 'online').length;
    const authFailed = mailboxes.filter(m => mailboxHealth(m).status === 'auth_failed').length;
    const syncing = mailboxes.filter(m => m.sync_status === 'syncing').length;
    const failed = mailboxes.filter(m => m.last_failure && (!m.last_success || m.last_failure > m.last_success)).length;
    const lastSync = mailboxes
      .map(m => m.last_sync)
      .filter(Boolean)
      .sort()
      .pop();
    const fmtAgo = (iso?: string | null) => {
      if (!iso) return 'never';
      const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
      if (s < 60) return 'just now';
      if (s < 3600) return `${Math.floor(s / 60)}m ago`;
      if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
      return `${Math.floor(s / 86400)}d ago`;
    };
    const overview = [
      { label: 'Mailboxes', value: mailboxes.length, icon: AtSign, cls: 'text-blue-400' },
      { label: 'Online', value: online, icon: Wifi, cls: 'text-green-400' },
      { label: 'Auth Failed', value: authFailed, icon: KeySquare, cls: 'text-red-400' },
      { label: 'Syncing', value: syncing, icon: RefreshCw, cls: 'text-amber-400' },
      { label: 'Last Sync', value: fmtAgo(lastSync), icon: Clock, cls: 'text-[var(--text-muted)]' },
    ];
    return (
      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-[var(--text-muted)]">{mailboxes.length} mailbox(es) — IMAP receive + SMTP send</p>
          <div className="flex items-center gap-1.5">
            <button onClick={syncAllMailboxes} disabled={busy === 'sync-all'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-color)] text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 transition-colors disabled:opacity-50">
              {busy === 'sync-all' ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Sync All
            </button>
            <button onClick={() => { setEditingMailbox(null); setMailboxForm({ provider: 'custom', imap_port: 993, smtp_port: 465, imap_secure: true, smtp_secure: true }); setMailboxFormError(null); setShowMailboxForm(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors">
              <Plus size={13} /> Add Mailbox
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {overview.map(card => (
            <div key={card.label} className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                <card.icon size={11} className={card.cls} /> {card.label}
              </div>
              <p className={`text-lg font-bold mt-1 ${card.cls}`}>{card.value}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-2">
          {mailboxes.map(mb => {
            const h = mailboxHealth(mb);
            const busyKey = (e: string) => busy === `${e}:${mb.id}`;
            return (
              <div
                key={mb.id}
                onClick={() => loadMailboxDetail(mb.id)}
                className={`cursor-pointer rounded-xl border p-3 transition-colors ${selectedMailbox?.id === mb.id ? 'border-blue-500/40 bg-blue-500/10' : 'border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 hover:bg-[var(--bg-tertiary)]/20'}`}
              >
                <div className="flex items-center gap-2">
                  <HealthBadge h={h} />
                  <span className="text-xs font-medium text-[var(--text-primary)] truncate">{mb.display_name || mb.email_address}</span>
                  {mb.is_default_sender && <Badge className="text-blue-400 bg-blue-500/10">Default Sender</Badge>}
                  <span className="ml-auto flex items-center gap-2">
                    {mb.sync_status === 'syncing' && <Loader2 size={12} className="animate-spin text-blue-400" />}
                    <Toggle checked={mb.is_enabled !== false} onChange={() => mailboxAction(mb.id, mb.is_enabled ? 'disable' : 'enable', 'POST', undefined, mb.is_enabled ? 'Mailbox disabled' : 'Mailbox enabled')} />
                  </span>
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] truncate mt-1.5">{mb.email_address}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[10px] text-[var(--text-muted)]">
                  <span className="flex items-center gap-1"><Wifi size={10} className={mb.imap_secure ? 'text-green-400' : 'text-amber-400'} /> IMAP {mb.imap_host}:{mb.imap_port}</span>
                  <span className="flex items-center gap-1"><Send size={10} className={mb.smtp_secure ? 'text-green-400' : 'text-amber-400'} /> SMTP {mb.smtp_host}:{mb.smtp_port}</span>
                  {mb.queue_size > 0 && <span className="flex items-center gap-1 text-amber-400"><Clock size={10} /> {mb.queue_size} queued</span>}
                  <span>Sync {fmtAgo(mb.last_sync)}</span>
                  <span>Sent {fmtAgo(mb.last_success)}</span>
                  {mb.last_error && <span className="flex items-center gap-1 text-red-400 truncate max-w-[200px]"><AlertTriangle size={10} /> {mb.last_error}</span>}
                </div>
                <div className="flex items-center gap-1.5 mt-2">
                  <button onClick={(e) => { e.stopPropagation(); mailboxAction(mb.id, 'test', 'POST', undefined, 'Connection test completed'); }} disabled={busyKey('test')}
                    className="flex items-center gap-1 px-2 py-1 rounded-md border border-[var(--border-color)] text-[10px] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 disabled:opacity-50">
                    {busyKey('test') ? <Loader2 size={10} className="animate-spin" /> : <ShieldCheck size={10} />} Test
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); mailboxAction(mb.id, 'sync', 'POST', undefined, 'IMAP sync completed'); }} disabled={busyKey('sync')}
                    className="flex items-center gap-1 px-2 py-1 rounded-md border border-[var(--border-color)] text-[10px] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 disabled:opacity-50">
                    {busyKey('sync') ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />} Sync
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setEditingMailbox(mb); setMailboxForm({ provider: mb.provider || 'custom', email_address: mb.email_address, display_name: mb.display_name, imap_host: mb.imap_host, imap_port: mb.imap_port, imap_secure: mb.imap_secure, imap_username: mb.imap_username, smtp_host: mb.smtp_host, smtp_port: mb.smtp_port, smtp_secure: mb.smtp_secure, smtp_username: mb.smtp_username, signature: mb.signature, auto_reply_enabled: mb.auto_reply_enabled, auto_reply_message: mb.auto_reply_message, imap_password: '', smtp_password: '' }); setMailboxFormError(null); setShowMailboxForm(true); }}
                    className="flex items-center gap-1 px-2 py-1 rounded-md border border-[var(--border-color)] text-[10px] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30">
                    <Pencil size={10} /> Edit
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setShowDeleteMailboxConfirm(mb.id); }} disabled={busy === `delete:${mb.id}`}
                    className="flex items-center gap-1 px-2 py-1 rounded-md border border-red-500/20 text-[10px] text-red-400 hover:bg-red-500/10 disabled:opacity-50">
                    <Trash2 size={10} /> Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderSettings = () => {
    if (commSettingsLoading) return <div className="flex-1 flex items-center justify-center"><Loader2 className="h-6 w-6 text-blue-400 animate-spin" /></div>;
    if (!commSettings) return (
      <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)] px-6 text-center">
        <Settings size={32} className="mb-2 opacity-30" />
        <p className="text-xs">No communication settings available.</p>
      </div>
    );
    const g = commSettings.general || {};
    const num = (key: string) =>
      <input type="number" min={0} value={g[key] ?? ''} onChange={e => setCommGeneral(key, parseInt(e.target.value) || 0)}
        className={inputCls} />;
    return (
      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-3">
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5">
          <div className="px-3 py-2 border-b border-[var(--border-color)]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">General</p>
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Queue retry, attachment and auto-resolve behaviour.</p>
          </div>
          <div className="p-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Max retry attempts">{num('retry_max_attempts')}</Field>
              <Field label="Retry base delay (minutes)">{num('retry_base_delay_minutes')}</Field>
              <Field label="Attachment max size (MB)">{num('attachment_max_size_mb')}</Field>
              <Field label="Attachments per message">{num('attachment_max_per_message')}</Field>
              <Field label="Auto-resolve after (days)">{num('auto_resolve_days')}</Field>
              <Field label="Default template language">
                <input type="text" value={g.default_template_language || ''} onChange={e => setCommGeneral('default_template_language', e.target.value)} className={inputCls} />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              <input type="checkbox" checked={g.bcc_admin_on_all === true} onChange={e => setCommGeneral('bcc_admin_on_all', e.target.checked)} className="accent-blue-500" />
              BCC admin on all outgoing emails
            </label>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5">
          <div className="px-3 py-2 border-b border-[var(--border-color)]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Routing</p>
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Which categories are handled by support vs sales accounts.</p>
          </div>
          <div className="p-3 space-y-2">
            <div>
              <p className="text-[10px] text-[var(--text-muted)] mb-1">Support categories</p>
              <div className="flex flex-wrap gap-1.5">
                {(commSettings.routing?.support_categories || []).map((c: string) => <span key={c} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-400">{CATEGORY_LABELS[c] || c}</span>)}
              </div>
            </div>
            <div>
              <p className="text-[10px] text-[var(--text-muted)] mb-1">Sales categories</p>
              <div className="flex flex-wrap gap-1.5">
                {(commSettings.routing?.sales_categories || []).map((c: string) => <span key={c} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400">{CATEGORY_LABELS[c] || c}</span>)}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5">
          <div className="px-3 py-2 border-b border-[var(--border-color)]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Mail Accounts ({commSettings.mail_accounts?.length || 0})</p>
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">System sender identities used for transactional and inbound routing.</p>
          </div>
          <div className="p-3 space-y-2">
            {(commSettings.mail_accounts || []).map((a: any) => (
              <div key={a.id} className="rounded-lg border border-[var(--border-color)] p-2.5">
                <div className="flex items-center gap-2">
                  <AtSign size={11} className="text-[var(--text-muted)] flex-shrink-0" />
                  <span className="text-xs text-[var(--text-primary)] font-medium truncate">{a.display_name || a.name}</span>
                  <Badge className={a.is_active ? 'text-green-400 bg-green-500/10' : 'text-gray-400 bg-gray-500/10'}>{a.is_active ? 'Active' : 'Inactive'}</Badge>
                  <span className="ml-auto text-[10px] text-[var(--text-muted)]">{a.type}</span>
                </div>
                <p className="text-[10px] text-[var(--text-secondary)] truncate mt-1">{a.email}</p>
                {a.reply_to && <p className="text-[10px] text-[var(--text-muted)]">Reply-To: {a.reply_to}</p>}
                {a.signature && <p className="text-[10px] text-[var(--text-muted)] whitespace-pre-wrap break-words mt-0.5">{a.signature}</p>}
                <p className="text-[10px] text-[var(--text-muted)] mt-1">Templates: {(a.templates || []).join(', ') || '-'}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5">
          <div className="px-3 py-2 border-b border-[var(--border-color)]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Mailbox Status ({commMailboxes.length})</p>
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Per-mailbox IMAP/SMTP connection, sync and queue status.</p>
          </div>
          <div className="p-3 space-y-2">
            {commMailboxes.length === 0 && <p className="text-xs text-[var(--text-muted)]">No mailboxes configured yet — add them under the Mailboxes folder.</p>}
            {commMailboxes.map((mb: Mailbox) => (
              <div key={mb.id} className="rounded-lg border border-[var(--border-color)] p-2.5">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${mb.is_enabled ? 'bg-green-400' : 'bg-gray-400'}`} />
                  <span className="text-xs text-[var(--text-primary)] font-medium truncate">{mb.display_name || mb.email_address}</span>
                  {mb.is_default_sender && <Badge className="text-blue-400 bg-blue-500/10">Default Sender</Badge>}
                  {!mb.is_enabled && <Badge className="text-gray-400 bg-gray-500/10">Disabled</Badge>}
                </div>
                <p className="text-[10px] text-[var(--text-secondary)] truncate mt-1">{mb.email_address}</p>
                <div className="grid grid-cols-2 gap-1.5 text-[10px] text-[var(--text-muted)] mt-1.5">
                  <span className="flex items-center gap-1">
                    <Database size={10} /> IMAP: <span className={mb.connection_status === 'connected' ? 'text-green-400' : mb.connection_status === 'failed' ? 'text-red-400' : ''}>{mb.connection_status || 'unknown'}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Server size={10} /> SMTP: {mb.smtp_host || '-'}{mb.smtp_port ? `:${mb.smtp_port}` : ''}
                  </span>
                  <span className="flex items-center gap-1">
                    <RefreshCw size={10} /> Sync: {mb.sync_status || 'never'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={10} /> Queue: {mb.queue_size ?? 0}
                  </span>
                </div>
                {mb.last_error && <p className="text-[10px] text-red-400 break-words mt-1">{mb.last_error}</p>}
              </div>
            ))}
          </div>
        </div>

        <div className="sticky bottom-0 bg-[var(--bg-primary)]/95 backdrop-blur-sm pt-2 pb-1">
          <button onClick={saveCommsSettings} disabled={!commSettingsDirty || busy === 'save-comm-settings'}
            className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors disabled:opacity-50">
            {busy === 'save-comm-settings' ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {commSettingsDirty ? 'Save Changes' : 'Saved'}
          </button>
        </div>
      </div>
    );
  };

  const renderSettingsAccounts = () => {
    if (commSettingsLoading) return <div className="flex-1 flex items-center justify-center"><Loader2 className="h-6 w-6 text-blue-400 animate-spin" /></div>;
    if (!commSettings) return <div className="flex-1 flex items-center justify-center text-[var(--text-muted)] text-center px-6 text-xs">Communication settings load here.</div>;
    const accounts = commSettings.mail_accounts || [];
    const fmtSync = (iso?: string | null) => {
      if (!iso) return 'never';
      const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
      if (s < 60) return 'just now';
      if (s < 3600) return `${Math.floor(s / 60)}m ago`;
      if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
      return `${Math.floor(s / 86400)}d ago`;
    };
    return (
      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-3">
        <div className="flex items-center justify-between px-1">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">System Mail Accounts</p>
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Built-in sender routing accounts. Toggles persist via the real backend configuration.</p>
          </div>
          <button onClick={() => { setEditAccountId(null); setAccountDraft(null); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-color)] text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 transition-colors">
            <RefreshCw size={12} /> Refresh
          </button>
        </div>

        {accounts.length === 0 && <p className="text-xs text-[var(--text-muted)] px-1">No mail accounts configured.</p>}

        {accounts.map((a: any) => {
          const isActive = a.is_active === true;
          const matching = (commMailboxes || []).find(m => m.email_address.toLowerCase() === String(a.email || '').toLowerCase()) || null;
          const h = matching ? mailboxHealth(matching) : null;
          const editing = editAccountId === a.id;
          return (
            <div key={a.id} className={`rounded-xl border p-3 transition-colors ${isActive ? 'border-[var(--border-color)] bg-[var(--bg-tertiary)]/5' : 'border-gray-500/20 bg-[var(--bg-tertiary)]/5 opacity-80'}`}>
              {/* Header: identity + status + toggle */}
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-[var(--text-primary)] truncate">{a.display_name || a.name}</span>
                    <Badge className={isActive ? 'text-green-400 bg-green-500/10' : 'text-gray-400 bg-gray-500/10'}>{isActive ? 'Active' : 'Inactive'}</Badge>
                    <Badge className="text-purple-400 bg-purple-500/10">System</Badge>
                    <span className="text-[10px] text-[var(--text-muted)]">{a.type}</span>
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 flex items-center gap-1"><AtSign size={10} className="text-[var(--text-muted)]" />{a.email}</p>
                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Purpose: {MAILBOX_LABELS[String(a.id).replace(/-/g, '_')]?.purpose || (a.type === 'sales' ? 'Sales enquiries and purchase conversations.' : a.type === 'support' ? 'Customer support conversations.' : 'Automated system emails (OTP, license, payments, notifications).')}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
                    Status: <Toggle checked={isActive} onChange={() => toggleSystemAccount(a.id)} disabled={busy === 'save-comm-settings'} />
                  </div>
                  {busy === 'save-comm-settings' && <Loader2 size={11} className="animate-spin text-blue-400" />}
                </div>
              </div>

              {/* Connection / sync status (real mailbox row when present, else honest "n/a") */}
              <div className="grid grid-cols-2 gap-1.5 text-[10px] text-[var(--text-muted)] mt-2">
                <span className="flex items-center gap-1">
                  <Database size={10} className="text-blue-400" /> IMAP:
                  {matching ? <span className={matching.connection_status === 'connected' ? 'text-green-400' : matching.connection_status === 'failed' ? 'text-red-400' : ''}>{matching.connection_status || 'unknown'}</span> : <span className="text-[var(--text-muted)]">n/a (native)</span>}
                </span>
                <span className="flex items-center gap-1">
                  <Server size={10} className="text-emerald-400" /> SMTP:
                  {matching ? <span>{matching.smtp_host || '-'}{matching.smtp_port ? `:${matching.smtp_port}` : ''}</span> : <span className="text-[var(--text-muted)]">n/a (native)</span>}
                </span>
                <span className="flex items-center gap-1">
                  <RefreshCw size={10} className="text-amber-400" /> Sync:
                  {matching ? <span>{fmtSync(matching.last_sync)}</span> : <span className="text-[var(--text-muted)]">n/a (native)</span>}
                </span>
                <span className="flex items-center gap-1">
                  <Activity size={10} className="text-purple-400" /> Health:
                  {h ? <HealthBadge h={h} /> : <span className="text-[var(--text-muted)]">system (no external mailbox)</span>}
                </span>
              </div>
              {matching?.last_error && <p className="text-[10px] text-red-400 break-words mt-1">{matching.last_error}</p>}

              {/* Inline edit */}
              {editing && (
                <div className="mt-2 rounded-lg border border-[var(--border-color)] p-2 space-y-2">
                  <Field label="Display Name"><input type="text" value={accountDraft?.display_name ?? a.display_name} onChange={e => setAccountDraft({ ...(accountDraft || a), display_name: e.target.value })} className={inputCls} /></Field>
                  <Field label="Reply-To"><input type="email" value={accountDraft?.reply_to ?? a.reply_to} onChange={e => setAccountDraft({ ...(accountDraft || a), reply_to: e.target.value })} className={inputCls} /></Field>
                  <Field label="Signature"><textarea rows={2} value={accountDraft?.signature ?? a.signature} onChange={e => setAccountDraft({ ...(accountDraft || a), signature: e.target.value })} className={inputCls} /></Field>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => saveAccountDraft(a.id, { display_name: accountDraft?.display_name ?? a.display_name, reply_to: accountDraft?.reply_to ?? a.reply_to, signature: accountDraft?.signature ?? a.signature })} disabled={busy === 'save-comm-settings'}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-medium disabled:opacity-50">
                      {busy === 'save-comm-settings' ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />} Save
                    </button>
                    <button onClick={() => setEditAccountId(null)} className="px-2.5 py-1 rounded-lg border border-[var(--border-color)] text-[10px] text-[var(--text-secondary)]">Cancel</button>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-1.5 mt-2">
                <button onClick={() => { setEditAccountId(editing ? null : a.id); setAccountDraft(null); }}
                  className="flex items-center gap-1 px-2 py-1 rounded-md border border-[var(--border-color)] text-[10px] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30">
                  <Pencil size={10} /> Edit
                </button>
                <button onClick={() => matching
                  ? fetch(`${MB_BASE}/${matching.id}/test`, { method: 'POST', headers: getAuthHeaders() }).then(r => r.json()).then(j => showToast(j.success ? 'ok' : 'err', j.success ? 'Connection test passed' : j.error?.message || 'Test failed')).catch(() => showToast('err', 'Test failed'))
                  : showToast('ok', 'Native system account — no external SMTP/IMAP to test.')}
                  disabled={busy === 'save-comm-settings'}
                  className="flex items-center gap-1 px-2 py-1 rounded-md border border-[var(--border-color)] text-[10px] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 disabled:opacity-50">
                  <ShieldCheck size={10} /> Test
                </button>
                <button onClick={() => matching
                  ? fetch(`${MB_BASE}/${matching.id}/sync`, { method: 'POST', headers: getAuthHeaders() }).then(r => r.json()).then(j => { showToast(j.success ? 'ok' : 'err', j.success ? 'IMAP sync completed' : j.error?.message || 'Sync failed'); if (j.success) loadCommsSettings(); }).catch(() => showToast('err', 'Sync failed'))
                  : showToast('ok', 'Native system account — no external IMAP mailbox to sync.')}
                  disabled={busy === 'save-comm-settings'}
                  className="flex items-center gap-1 px-2 py-1 rounded-md border border-[var(--border-color)] text-[10px] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 disabled:opacity-50">
                  <RefreshCw size={10} /> Sync
                </button>
              </div>
            </div>
          );
        })}

        <p className="text-[10px] text-[var(--text-muted)] px-1 pt-1 leading-relaxed">System accounts are routing identities controlled by the backend ({commMailboxes.length} external mailbox(es) configured). External IMAP/SMTP mailboxes are managed under the Mailboxes folder.</p>
      </div>
    );
  };

  const renderEmptyFolder = () => (
    <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)] px-6 text-center">
      <ShieldAlert size={28} className="mb-2 opacity-30" />
      <p className="text-xs leading-relaxed max-w-sm">{activeFolderDef.emptyNote}</p>
    </div>
  );

  const renderCenter = () => {
    switch (activeFolderDef.kind) {
      case 'queue': return renderQueueList();
      case 'logs': return renderLogsList();
      case 'history': return renderHistoryList();
      case 'mailboxes': return renderMailboxGrid();
      case 'settings': return renderSettings();
      case 'empty': return renderEmptyFolder();
      default: return renderListTable();
    }
  };

  // ---- Right panel ----
  const renderConversationDetail = () => {
    if (detailLoading) return <div className="flex-1 flex items-center justify-center"><Loader2 className="h-6 w-6 text-blue-400 animate-spin" /></div>;
    if (!detail) return (
      <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)] px-6 text-center">
        <MessageSquare size={28} className="mb-2 opacity-30" />
        <p className="text-xs">Select a conversation to view the thread, customer, license, payments and audit history.</p>
      </div>
    );
    const conv = detail.conversation;
    return (
      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-3">
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 p-3">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] leading-snug">{conv.subject || '(No subject)'}</h3>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <CategoryBadge category={conv.category} />
                <StatusBadge status={conv.status} />
                {conv.unread_replies > 0 && <Badge className="bg-blue-500/20 text-blue-400">{conv.unread_replies} unread</Badge>}
              </div>
            </div>
            <div className="flex gap-1 shrink-0">
              <button onClick={() => openReply()} title="Reply" className="p-1.5 rounded-lg hover:bg-blue-500/10 text-blue-400 transition-colors"><Reply size={13} /></button>
              <button onClick={openForward} title="Forward" className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)]/50 text-[var(--text-secondary)] transition-colors"><Forward size={13} /></button>
            </div>
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-2 space-y-0.5">
            <p>From: <span className="text-[var(--text-secondary)]">{conv.customer_name || 'Unknown'} &lt;{conv.customer_email}&gt;</span></p>
            {conv.product_id && <p>Product: <span className="text-[var(--text-secondary)]">{conv.product_id}</span></p>}
            {conv.license_key && <p>License: <code className="text-[10px] text-[var(--text-secondary)]">{conv.license_key}</code></p>}
            {conv.hardware_id && <p>Hardware: <code className="text-[10px] text-[var(--text-secondary)]">{conv.hardware_id}</code></p>}
            <p>Created: {new Date(conv.created_at).toLocaleString()} · Updated: {new Date(conv.updated_at).toLocaleString()}</p>
          </div>
        </div>

        {/* Thread */}
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5">
          <p className="px-3 py-2 border-b border-[var(--border-color)] text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Thread ({detail.messages.length})</p>
          <div className="p-3 space-y-2">
            {detail.messages.length === 0 && <p className="text-xs text-[var(--text-muted)] text-center py-3">No messages</p>}
            {detail.messages.map((m: any) => (
              <div key={m.id} className={`rounded-lg p-2.5 text-xs ${m.sender_type === 'customer' ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-[var(--bg-tertiary)]/30 border border-[var(--border-color)]'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-medium text-[var(--text-primary)]">{m.sender_name || (m.sender_type === 'customer' ? 'Customer' : 'Support')}</span>
                  <span className="text-[10px] text-[var(--text-muted)]">{new Date(m.created_at).toLocaleString()}</span>
                  {m.email_sent && <span className="text-[9px] text-green-400 ml-auto">sent</span>}
                </div>
                <p className="text-[var(--text-secondary)] whitespace-pre-wrap break-words">{m.message}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Attachments */}
        {detail.attachments.length > 0 && (
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5">
            <p className="px-3 py-2 border-b border-[var(--border-color)] text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Attachments ({detail.attachments.length})</p>
            <div className="p-3 space-y-1.5">
              {detail.attachments.map(a => (
                <a key={a.id} href={attachmentUrl(a.storage_path)} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--bg-tertiary)]/30 transition-colors group">
                  <Paperclip size={12} className="text-[var(--text-muted)] flex-shrink-0" />
                  <span className="text-xs text-[var(--text-secondary)] truncate flex-1">{a.file_name}</span>
                  <span className="text-[10px] text-[var(--text-muted)]">{formatSize(a.file_size)}</span>
                  <Download size={11} className="text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Customer */}
        {detail.customer && (
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5">
            <p className="px-3 py-2 border-b border-[var(--border-color)] text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Customer</p>
            <div className="p-3 text-xs text-[var(--text-secondary)] space-y-1">
              <p><span className="text-[var(--text-muted)]">Name:</span> {detail.customer.name || '-'}</p>
              <p><span className="text-[var(--text-muted)]">Email:</span> {detail.customer.email || '-'}</p>
              <p><span className="text-[var(--text-muted)]">Company:</span> {detail.customer.company || '-'}</p>
              <p><span className="text-[var(--text-muted)]">Phone:</span> {detail.customer.phone || detail.customer.mobile || '-'}</p>
              <p><span className="text-[var(--text-muted)]">Location:</span> {[detail.customer.city, detail.customer.state, detail.customer.country].filter(Boolean).join(', ') || '-'}</p>
            </div>
          </div>
        )}

        {/* Licenses */}
        {detail.licenses.length > 0 && (
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5">
            <p className="px-3 py-2 border-b border-[var(--border-color)] text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Licenses ({detail.licenses.length})</p>
            <div className="p-3 space-y-2">
              {detail.licenses.map((l: any) => (
                <div key={l.license_key} className="rounded-lg border border-[var(--border-color)] p-2">
                  <div className="flex items-center gap-2">
                    <KeyRound size={11} className="text-[var(--text-muted)] flex-shrink-0" />
                    <code className="text-[10px] text-[var(--text-secondary)] truncate">{l.license_key}</code>
                    <span className="ml-auto"><Badge className={l.status === 'active' ? 'text-green-400 bg-green-500/10' : l.status === 'trial' ? 'text-amber-400 bg-amber-500/10' : 'text-gray-400 bg-gray-500/10'}>{l.status || '-'}</Badge></span>
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)] mt-1">{l.product_name || l.product_id || ''}{l.plan_name ? ` · ${l.plan_name}` : ''}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">Expires: {l.expiry_date ? new Date(l.expiry_date).toLocaleDateString() : '-'}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Orders + Payments */}
        {detail.orders.length > 0 && (
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5">
            <p className="px-3 py-2 border-b border-[var(--border-color)] text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Orders & Payments ({detail.orders.length})</p>
            <div className="p-3 space-y-2">
              {detail.orders.map((o: any) => {
                const pays = detail.payments.filter((p: any) => p.order_id === o.id);
                return (
                  <div key={o.id} className="rounded-lg border border-[var(--border-color)] p-2">
                    <div className="flex items-center gap-2">
                      <ShoppingBag size={11} className="text-[var(--text-muted)] flex-shrink-0" />
                      <span className="text-xs text-[var(--text-primary)]">{o.order_number || o.id}</span>
                      <span className="ml-auto"><Badge className="text-emerald-400 bg-emerald-500/10">{o.status || '-'}</Badge></span>
                    </div>
                    <p className="text-[10px] text-[var(--text-muted)] mt-1">{o.payment_gateway || ''} · {new Date(o.created_at).toLocaleDateString()} · Total {o.total ?? o.subtotal ?? 0} {o.currency || 'USD'}</p>
                    {pays.map((p: any) => (
                      <p key={p.id} className="text-[10px] text-[var(--text-secondary)] mt-0.5 flex items-center gap-1">
                        <CreditCard size={10} className="text-[var(--text-muted)]" /> Payment {p.status || '-'} · {p.amount || 0} {p.currency || ''} · {p.paid_at ? new Date(p.paid_at).toLocaleDateString() : '-'}
                      </p>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Delivery logs */}
        {detail.delivery_logs.length > 0 && (
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5">
            <p className="px-3 py-2 border-b border-[var(--border-color)] text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Delivery Logs ({detail.delivery_logs.length})</p>
            <div className="p-3 space-y-1.5">
              {detail.delivery_logs.map((q: any) => (
                <div key={q.id} className="text-[10px] text-[var(--text-secondary)] flex items-center gap-2">
                  <span className={`font-medium ${QUEUE_STATUS_LABELS[q.status]?.color || 'text-gray-400'}`}>{QUEUE_STATUS_LABELS[q.status]?.label || q.status}</span>
                  <span className="text-[var(--text-muted)] truncate">{q.last_error || (q.subject || '') || new Date(q.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Audit history */}
        {detail.audit.length > 0 && (
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5">
            <p className="px-3 py-2 border-b border-[var(--border-color)] text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Audit History ({detail.audit.length})</p>
            <div className="p-3 space-y-1.5">
              {detail.audit.map((a: any, i: number) => (
                <div key={i} className="flex items-start gap-2 text-[10px]">
                  <HistoryIcon size={11} className="text-[var(--text-muted)] mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[var(--text-secondary)] break-words">{a.message}</p>
                    <p className="text-[var(--text-muted)]">{new Date(a.timestamp).toLocaleString()} · {a.event_type}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Internal notes */}
        {detail.internal_notes.length > 0 && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5">
            <p className="px-3 py-2 border-b border-amber-500/20 text-[10px] font-bold uppercase tracking-wider text-amber-400">Internal Notes ({detail.internal_notes.length})</p>
            <div className="p-3 space-y-2">
              {detail.internal_notes.map((m: any) => (
                <div key={m.id} className="text-xs">
                  <p className="text-[var(--text-secondary)] whitespace-pre-wrap break-words">{m.message}</p>
                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{m.sender_name} · {new Date(m.created_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderQueueDetail = () => {
    if (!selectedQueueItem) return <div className="flex-1 flex items-center justify-center text-[var(--text-muted)] text-center px-6 text-xs">Select a queued message to see details, errors and retry progress.</div>;
    const item = selectedQueueItem;
    return (
      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-3">
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 p-3">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-amber-400" />
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">{item.subject || '(No subject)'}</h3>
          </div>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <CategoryBadge category={item.category} />
            <span className={`text-xs font-medium ${QUEUE_STATUS_LABELS[item.status]?.color || 'text-gray-400'}`}>{QUEUE_STATUS_LABELS[item.status]?.label || item.status}</span>
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-2 space-y-0.5">
            <p>To: <span className="text-[var(--text-secondary)]">{item.customer_name || ''} &lt;{item.customer_email}&gt;</span></p>
            <p>Attempts: {item.retry_count}/{item.max_retries}</p>
            <p>Next retry: {item.next_retry_at ? new Date(item.next_retry_at).toLocaleString() : '-'}</p>
            <p>Created: {new Date(item.created_at).toLocaleString()}</p>
          </div>
          {item.last_error && (
            <div className="mt-2 rounded-lg border border-red-500/20 bg-red-500/5 p-2 text-[11px] text-red-400 break-words">{item.last_error}</div>
          )}
        </div>
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">Message</p>
          <p className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap break-words">{item.message}</p>
        </div>
        {item.conversation_id && (
          <button onClick={() => openDetail(item.conversation_id!)} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border-color)] text-xs text-blue-400 hover:bg-blue-500/10 transition-colors">
            <MessageSquare size={12} /> Open Conversation
          </button>
        )}
      </div>
    );
  };

  const renderLogDetail = () => {
    if (!selectedLog) return <div className="flex-1 flex items-center justify-center text-[var(--text-muted)] text-center px-6 text-xs">Select a delivery log entry to inspect details.</div>;
    const log = selectedLog;
    return (
      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-3">
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 p-3">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-blue-400" />
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">{log.event_type}</h3>
          </div>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-medium ${LOG_STATUS_LABELS[log.status]?.color || 'text-gray-400'}`}>{LOG_STATUS_LABELS[log.status]?.label || log.status}</span>
            <span className="text-[10px] text-[var(--text-muted)]">{log.channel || 'email'}</span>
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-2 space-y-0.5">
            <p>Recipient: <span className="text-[var(--text-secondary)]">{log.recipient}</span></p>
            <p>Subject: <span className="text-[var(--text-secondary)]">{log.subject || '-'}</span></p>
            <p>Time: {new Date(log.created_at).toLocaleString()}</p>
          </div>
          {log.error && <div className="mt-2 rounded-lg border border-red-500/20 bg-red-500/5 p-2 text-[11px] text-red-400 break-words">{log.error}</div>}
          {log.response && <div className="mt-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)]/30 p-2 text-[11px] text-[var(--text-secondary)] break-words">{log.response}</div>}
        </div>
      </div>
    );
  };

  const renderHistoryDetail = () => {
    if (!selectedHistoryItem) return <div className="flex-1 flex items-center justify-center text-[var(--text-muted)] text-center px-6 text-xs">Select an email to see its delivery status and attachments.</div>;
    const item = selectedHistoryItem;
    return (
      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-3">
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 p-3">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{item.subject || '(No subject)'}</h3>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <Badge className="text-gray-400 bg-gray-500/10">{item.event_type}</Badge>
            <span className={`text-xs font-medium ${LOG_STATUS_LABELS[item.status]?.color || 'text-gray-400'}`}>{LOG_STATUS_LABELS[item.status]?.label || item.status}</span>
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-2 space-y-0.5">
            <p>To: <span className="text-[var(--text-secondary)]">{item.recipient}</span></p>
            {item.license_key && <p>License: <code className="text-[10px] text-[var(--text-secondary)]">{item.license_key}</code></p>}
            <p>Time: {new Date(item.created_at).toLocaleString()}</p>
          </div>
          {item.error && <div className="mt-2 rounded-lg border border-red-500/20 bg-red-500/5 p-2 text-[11px] text-red-400 break-words">{item.error}</div>}
        </div>
        {item.attachments && item.attachments.length > 0 && (
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5">
            <p className="px-3 py-2 border-b border-[var(--border-color)] text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Attachments ({item.attachments.length})</p>
            <div className="p-3 space-y-1.5">
              {item.attachments.map(a => (
                <div key={a.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--bg-tertiary)]/30">
                  <Paperclip size={12} className="text-[var(--text-muted)] flex-shrink-0" />
                  <span className="text-xs text-[var(--text-secondary)] truncate flex-1">{a.file_name}</span>
                  <span className="text-[10px] text-[var(--text-muted)]">{formatSize(a.file_size)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderMailboxDetail = () => {
    if (!selectedMailbox) return <div className="flex-1 flex items-center justify-center text-[var(--text-muted)] text-center px-6 text-xs">Select a mailbox to test the connection, run a manual sync, view sync logs, or edit it.</div>;
    const mb = mailboxDetail?.mailbox || selectedMailbox;
    const busyKey = (e: string) => busy === `${e}:${selectedMailbox.id}`;
    return (
      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-3">
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 p-3">
          <div className="flex items-center gap-2">
            <AtSign size={14} className="text-blue-400" />
            <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">{mb.display_name || mb.email_address}</h3>
            {mb.is_default_sender && <Badge className="text-blue-400 bg-blue-500/10">Default</Badge>}
          </div>
          <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">{mb.email_address}</p>
          <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px] text-[var(--text-muted)]">
            <span className="flex items-center gap-1"><Server size={10} /> {mb.provider || '-'}</span>
            <span className={`flex items-center gap-1 ${mb.connection_status === 'connected' ? 'text-green-400' : mb.connection_status === 'failed' ? 'text-red-400' : ''}`}><Database size={10} /> {mb.connection_status || 'unknown'}</span>
            <span className="flex items-center gap-1"><Plug size={10} /> {mb.is_enabled ? 'Enabled' : 'Disabled'}</span>
            <span className="flex items-center gap-1"><Wrench size={10} /> sync: {mb.sync_status || 'never'}</span>
          </div>
          {mb.last_error && <div className="mt-2 rounded-lg border border-red-500/20 bg-red-500/5 p-2 text-[10px] text-red-400 break-words">{mb.last_error}</div>}
          <div className="mt-3 flex flex-wrap gap-1.5">
            <button onClick={() => mailboxAction(selectedMailbox.id, 'test', 'POST', undefined, 'Connection test completed')} disabled={busyKey('test')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-medium transition-colors disabled:opacity-50">
              {busyKey('test') ? <Loader2 size={11} className="animate-spin" /> : <Activity size={11} />} Test Connection
            </button>
            <button onClick={() => mailboxAction(selectedMailbox.id, 'sync', 'POST', undefined, 'IMAP sync completed')} disabled={busyKey('sync')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 text-[11px] font-medium transition-colors disabled:opacity-50">
              {busyKey('sync') ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />} Sync Now
            </button>
            <button onClick={() => mailboxAction(selectedMailbox.id, selectedMailbox.is_enabled ? 'disable' : 'enable', 'POST', undefined, selectedMailbox.is_enabled ? 'Mailbox disabled' : 'Mailbox enabled')} disabled={busyKey('disable') || busyKey('enable')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 text-[11px] font-medium transition-colors disabled:opacity-50">
              {selectedMailbox.is_enabled ? <MailX size={11} /> : <CheckCheck size={11} />} {selectedMailbox.is_enabled ? 'Disable' : 'Enable'}
            </button>
            <button onClick={() => mailboxAction(selectedMailbox.id, 'set-default', 'POST', undefined, 'Default sender updated')} disabled={busyKey('set-default') || mb.is_default_sender}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 text-[11px] font-medium transition-colors disabled:opacity-50">
              <Flag size={11} /> Set Default
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">Send Test Email</p>
          <div className="flex gap-1.5">
            <input type="email" placeholder="recipient@example.com" value={testEmailTo} onChange={e => setTestEmailTo(e.target.value)}
              className="flex-1 px-2.5 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)]/20 text-[var(--text-primary)] text-[11px] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            <button onClick={() => sendTestEmail(selectedMailbox.id)} disabled={busyKey('send-test') || !testEmailTo}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-medium transition-colors disabled:opacity-50">
              {busyKey('send-test') ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />} Send
            </button>
          </div>
        </div>

        {mailboxDetail?.sync_logs && mailboxDetail.sync_logs.length > 0 && (
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5">
            <p className="px-3 py-2 border-b border-[var(--border-color)] text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Sync Logs ({mailboxDetail.sync_logs.length})</p>
            <div className="p-3 space-y-1.5">
              {mailboxDetail.sync_logs.map((l: any) => (
                <div key={l.id} className="text-[10px] text-[var(--text-secondary)] flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${l.status === 'completed' ? 'bg-green-400' : l.status === 'running' ? 'bg-blue-400' : 'bg-red-400'}`} />
                  <span className="truncate">{l.messages_fetched != null ? `${l.messages_fetched} fetched · ${l.messages_new != null ? l.messages_new + ' new' : ''}${l.messages_updated != null ? ' · ' + l.messages_updated + ' updated' : ''}` : (l.error_message || l.status)}</span>
                  <span className="ml-auto text-[var(--text-muted)] shrink-0">{new Date(l.started_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-1.5">
          <button onClick={() => { setEditingMailbox({ ...selectedMailbox, imap_password: '', smtp_password: '' }); setMailboxForm({
            provider: mb.provider, email_address: mb.email_address, display_name: mb.display_name,
            imap_host: mb.imap_host, imap_port: mb.imap_port, imap_secure: mb.imap_secure, imap_username: mb.imap_username,
            smtp_host: mb.smtp_host, smtp_port: mb.smtp_port, smtp_secure: mb.smtp_secure, smtp_username: mb.smtp_username,
            signature: mb.signature, is_enabled: mb.is_enabled, is_default_sender: mb.is_default_sender,
            auto_reply_enabled: mb.auto_reply_enabled, auto_reply_message: mb.auto_reply_message,
          }); setMailboxFormError(null); setShowMailboxForm(true); }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 text-[11px] font-medium transition-colors">
            <Pencil size={11} /> Edit
          </button>
          <button onClick={() => setShowDeleteMailboxConfirm(selectedMailbox.id)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 text-[11px] font-medium transition-colors">
            <Trash2 size={11} /> Delete
          </button>
        </div>
      </div>
    );
  };

  const renderRightPanel = () => {
    switch (activeFolderDef.kind) {
      case 'queue': return renderQueueDetail();
      case 'logs': return renderLogDetail();
      case 'history': return renderHistoryDetail();
      case 'mailboxes': return renderMailboxDetail();
      case 'settings': return renderSettingsAccounts();
      case 'empty': return <div className="flex-1" />;
      default: return renderConversationDetail();
    }
  };

  return (
    <div className="flex flex-col h-full gap-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[var(--text-primary)] leading-tight">Communication Center</h1>
            <p className="text-xs text-[var(--text-secondary)]">{activeFolderDef.label}</p>
          </div>
        </div>
        {isTrash && conversations.length > 0 && (
          <button onClick={() => setShowTrashConfirm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/20 text-[11px] text-red-400 hover:bg-red-500/10 transition-colors">
            <Trash2 size={12} /> Empty Trash
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div className="relative">{renderToolbar()}</div>

      {/* Pinned status cards — always visible */}
      <div className="grid grid-cols-6 gap-2">
        {statusCards.map(card => {
          const Icon = card.icon;
          const cardFolderMap: Record<string, string> = { inbox: 'ext-inbox', waiting: 'ext-waiting', sent: 'ext-sent', failed: 'ext-failed', queued: 'ext-queued', unread: 'all' };
          return (
            <button key={card.key} onClick={() => handleFolderChange(cardFolderMap[card.key])}
              className="flex items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 px-3 py-2 hover:bg-[var(--bg-tertiary)]/20 transition-colors">
              <span className={`p-1.5 rounded-lg ${card.color}`}><Icon size={13} /></span>
              <span className="flex-1 text-left min-w-0">
                <span className="block text-[10px] text-[var(--text-muted)] truncate">{card.label}</span>
                <span className="block text-sm font-bold text-[var(--text-primary)] leading-tight">{stats[card.key]}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* 3-panel body */}
      <div className="flex-1 min-h-0 flex rounded-xl border border-[var(--border-color)] overflow-hidden">
        {renderSidebar()}
        <div className="flex-1 min-w-0 flex flex-col">
          {renderCenter()}
        </div>
        <div className="w-[380px] flex-shrink-0 flex flex-col border-l border-[var(--border-color)]">
          {renderRightPanel()}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-[100] flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm shadow-2xl shadow-black/40 ${
          toast.type === 'ok' ? 'border-green-500/30 bg-[var(--bg-secondary)] text-green-400' : 'border-red-500/30 bg-[var(--bg-secondary)] text-red-400'
        }`}>
          {toast.type === 'ok' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          <span className="text-xs">{toast.text}</span>
        </div>
      )}

      {/* Universal Email Dialog */}
      <UniversalEmailDialog
        isOpen={emailDialog.isOpen}
        onClose={() => setEmailDialog({ isOpen: false })}
        onSent={() => { setEmailDialog({ isOpen: false }); refreshCurrent(); }}
        defaultEmail={emailDialog.defaultEmail}
        defaultLicenseKey={emailDialog.defaultLicenseKey}
        defaultProductId={emailDialog.defaultProductId}
        defaultProductName={emailDialog.defaultProductName}
        defaultAction={emailDialog.defaultAction}
      />

      {/* Folder manager modal */}
      {showFolderManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] w-[560px] max-w-full mx-4 max-h-[90vh] overflow-y-auto scrollbar-thin">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)] sticky top-0 bg-[var(--bg-secondary)] z-10">
              <h2 className="text-base font-semibold text-[var(--text-primary)]">Manage Folders</h2>
              <button onClick={() => setShowFolderManager(false)} className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)]/50 text-[var(--text-muted)] transition-colors"><X size={15} /></button>
            </div>
            <div className="p-5 space-y-5">
              {/* New folder */}
              <div className="space-y-3 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--api-blue-400)] flex items-center gap-1.5"><FolderPlus size={12} /> New Folder</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Folder Name *">
                    <input type="text" value={folderForm.name} onChange={e => setFolderForm({ ...folderForm, name: e.target.value })}
                      className={inputCls} placeholder="e.g. VIP Customers" onKeyDown={e => e.key === 'Enter' && createFolder()} />
                  </Field>
                  <Field label="Section">
                    <select value={folderForm.section} onChange={e => setFolderForm({ ...folderForm, section: e.target.value as 'internal' | 'external' })} className={inputCls}>
                      <option value="internal">Internal Communications</option>
                      <option value="external">External Mailboxes</option>
                    </select>
                  </Field>
                  <Field label="Status filter">
                    <select value={folderForm.status} onChange={e => setFolderForm({ ...folderForm, status: e.target.value })} className={inputCls}>
                      <option value="">All Status</option>
                      <option value="open">Open</option>
                      <option value="waiting_customer">Waiting Customer</option>
                      <option value="waiting_support">Waiting Support</option>
                      <option value="waiting_sales">Waiting Sales</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                      <option value="draft">Draft</option>
                      <option value="spam">Spam</option>
                    </select>
                  </Field>
                  <Field label="Category filter">
                    <select value={folderForm.category} onChange={e => setFolderForm({ ...folderForm, category: e.target.value })} className={inputCls}>
                      <option value="">All Categories</option>
                      {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </Field>
                </div>
                <Field label="Search keyword (optional)">
                  <input type="text" value={folderForm.search} onChange={e => setFolderForm({ ...folderForm, search: e.target.value })}
                    className={inputCls} placeholder="e.g. enterprise" />
                </Field>
                <button onClick={createFolder} disabled={busy === 'create-folder' || !folderForm.name.trim()}
                  className="w-full px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {busy === 'create-folder' ? <><Loader2 size={13} className="animate-spin" /> Creating...</> : <><FolderPlus size={13} /> Create Folder</>}
                </button>
              </div>

              {/* Active folders */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2 flex items-center gap-1.5"><FolderCog size={12} /> Folders ({folders.length})</p>
                <div className="space-y-1.5 max-h-56 overflow-y-auto scrollbar-thin">
                  {folders.map(row => {
                    const def = folderDefFor(row);
                    return (
                      <div key={row.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)]/10 border border-[var(--border-color)]">
                        <Folder size={13} className="text-blue-400 shrink-0" />
                        {renamingFolder?.id === row.id ? (
                          <>
                            <input type="text" value={renamingFolder.name} onChange={e => setRenamingFolder({ id: row.id, name: e.target.value })}
                              onKeyDown={e => { if (e.key === 'Enter') renameFolder(row.id, renamingFolder.name); if (e.key === 'Escape') setRenamingFolder(null); }}
                              autoFocus className={`${inputCls} flex-1`} />
                            <button onClick={() => renameFolder(row.id, renamingFolder.name)} disabled={busy === `rename-folder:${row.id}`}
                              className="px-2 py-1 rounded-lg bg-blue-600 text-white text-[10px] font-medium transition-colors disabled:opacity-50"><Save size={11} /></button>
                            <button onClick={() => setRenamingFolder(null)} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]/50 transition-colors"><X size={12} /></button>
                          </>
                        ) : (
                          <>
                            <span className="flex-1 text-xs text-[var(--text-primary)] truncate">{def.label}</span>
                            {row.is_system
                              ? <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] px-1.5 py-0.5 rounded-full bg-[var(--bg-tertiary)]/40">system</span>
                              : (
                                <div className="flex items-center gap-0.5">
                                  <button onClick={() => setRenamingFolder({ id: row.id, name: def.label })} title="Rename"
                                    className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-blue-400 hover:bg-[var(--bg-tertiary)]/50 transition-colors"><Pencil size={11} /></button>
                                  <button onClick={() => deleteFolder(row.id)} disabled={busy === `delete-folder:${row.id}`} title="Delete"
                                    className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"><Trash2 size={11} /></button>
                                </div>
                              )}
                          </>
                        )}
                      </div>
                    );
                  })}
                  {folders.length === 0 && <p className="text-xs text-[var(--text-muted)] text-center py-3">No folders yet — create one above.</p>}
                </div>
              </div>

              {/* Deleted folders (restore) */}
              {deletedFolders.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2 flex items-center gap-1.5"><ArchiveRestore size={12} /> Deleted — Restore ({deletedFolders.length})</p>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto scrollbar-thin">
                    {deletedFolders.map(row => (
                      <div key={row.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/5 border border-red-500/20 opacity-80">
                        <FolderOpen size={13} className="text-[var(--text-muted)] shrink-0" />
                        <span className="flex-1 text-xs text-[var(--text-primary)] line-through decoration-[var(--text-muted)]/50">{row.name}</span>
                        <button onClick={() => restoreFolder(row.id)} disabled={busy === `restore-folder:${row.id}`}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-emerald-500/30 text-emerald-400 text-[10px] font-medium hover:bg-emerald-500/10 transition-colors disabled:opacity-50">
                          {busy === `restore-folder:${row.id}` ? <Loader2 size={11} className="animate-spin" /> : <ArchiveRestore size={11} />} Restore
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mailbox form modal */}
      {showMailboxForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] w-[560px] max-w-full mx-4 max-h-[90vh] overflow-y-auto scrollbar-thin">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)] sticky top-0 bg-[var(--bg-secondary)] z-10">
              <h2 className="text-base font-semibold text-[var(--text-primary)]">{editingMailbox ? 'Edit Mailbox' : 'Add Mailbox'}</h2>
              <button onClick={() => { setShowMailboxForm(false); setEditingMailbox(null); setMailboxFormError(null); }} className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)]/50 text-[var(--text-muted)] transition-colors"><X size={15} /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Provider">
                  <select value={mailboxForm.provider || 'custom'} onChange={e => {
                    const p = presetForKey(e.target.value);
                    setMailboxForm((prev: any) => ({
                      ...prev,
                      provider: p.key,
                      imap_host: p.imap.host || prev.imap_host,
                      imap_port: p.imap.port,
                      imap_secure: p.imap.secure,
                      smtp_host: p.smtp.host || prev.smtp_host,
                      smtp_port: p.smtp.port,
                      smtp_secure: p.smtp.secure,
                    }));
                  }} className={inputCls}>
                    {PROVIDER_PRESETS.filter(p => p.key !== 'custom').map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                    <option value="custom">Custom / Other (manual)</option>
                  </select>
                </Field>
                <Field label="Mail Address *">
                  <input type="email" value={mailboxForm.email_address || ''} onChange={e => {
                    const email = e.target.value;
                    const detected = presetForEmail(email);
                    setMailboxForm((prev: any) => {
                      const next: any = { ...prev, email_address: email };
                      if (detected.key !== 'custom' && prev.provider !== 'custom') {
                        next.provider = detected.key;
                        next.imap_host = detected.imap.host;
                        next.imap_port = detected.imap.port;
                        next.imap_secure = detected.imap.secure;
                        next.smtp_host = detected.smtp.host;
                        next.smtp_port = detected.smtp.port;
                        next.smtp_secure = detected.smtp.secure;
                      }
                      return next;
                    });
                  }} className={inputCls} placeholder="admin@gmail.com" />
                </Field>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => {
                  const detected = presetForEmail(mailboxForm.email_address || '');
                  if (detected.key === 'custom') { showToast('err', 'Unknown provider — enter server settings manually.'); return; }
                  setMailboxForm((prev: any) => ({
                    ...prev,
                    provider: detected.key,
                    imap_host: detected.imap.host,
                    imap_port: detected.imap.port,
                    imap_secure: detected.imap.secure,
                    smtp_host: detected.smtp.host,
                    smtp_port: detected.smtp.port,
                    smtp_secure: detected.smtp.secure,
                  }));
                  showToast('ok', `Auto-detected ${detected.label} settings.`);
                }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-blue-500/30 text-[11px] text-blue-400 hover:bg-blue-500/10 transition-colors">
                  <Sparkles size={12} /> Detect Server Settings
                </button>
                <span className="text-[10px] text-[var(--text-muted)]">Auto-fills IMAP/SMTP for Gmail, Outlook / Microsoft 365, Yahoo, Zoho, Proton, iCloud, Fastmail.</span>
              </div>
              <Field label="Display Name">
                <input type="text" value={mailboxForm.display_name || ''} onChange={e => setMailboxForm({ ...mailboxForm, display_name: e.target.value })}
                  className={inputCls} placeholder="Support Team" />
              </Field>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] pt-1">Incoming Mail (IMAP)</p>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Incoming Mail Server *"><input type="text" value={mailboxForm.imap_host || ''} onChange={e => setMailboxForm({ ...mailboxForm, imap_host: e.target.value })} className={inputCls} placeholder="imap.example.com" /></Field>
                <Field label="Incoming Mail Port">
                  <input type="number" value={mailboxForm.imap_port ?? 993} onChange={e => setMailboxForm({ ...mailboxForm, imap_port: parseInt(e.target.value) || 993 })} className={inputCls} />
                </Field>
                <Field label="Encryption">
                  <select value={mailboxForm.imap_secure !== false ? 'true' : 'false'} onChange={e => setMailboxForm({ ...mailboxForm, imap_secure: e.target.value === 'true' })} className={inputCls}>
                    <option value="true">SSL / TLS</option>
                    <option value="false">None</option>
                  </select>
                </Field>
                <Field label="Incoming Username *"><input type="text" value={mailboxForm.imap_username || ''} onChange={e => setMailboxForm({ ...mailboxForm, imap_username: e.target.value })} className={inputCls} placeholder="user@example.com" /></Field>
                <Field label="Incoming Password *"><input type="password" value={mailboxForm.imap_password || ''} onChange={e => setMailboxForm({ ...mailboxForm, imap_password: e.target.value })} className={inputCls} placeholder={editingMailbox ? '•••••••• (unchanged — leave blank to keep)' : ''} /></Field>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] pt-1">Outgoing Mail (SMTP)</p>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Outgoing Mail Server *"><input type="text" value={mailboxForm.smtp_host || ''} onChange={e => setMailboxForm({ ...mailboxForm, smtp_host: e.target.value })} className={inputCls} placeholder="smtp.example.com" /></Field>
                <Field label="Outgoing Mail Port">
                  <input type="number" value={mailboxForm.smtp_port ?? 465} onChange={e => setMailboxForm({ ...mailboxForm, smtp_port: parseInt(e.target.value) || 465 })} className={inputCls} />
                </Field>
                <Field label="Encryption">
                  <select value={mailboxForm.smtp_secure !== false ? 'true' : 'false'} onChange={e => setMailboxForm({ ...mailboxForm, smtp_secure: e.target.value === 'true' })} className={inputCls}>
                    <option value="true">SSL / TLS</option>
                    <option value="false">None</option>
                  </select>
                </Field>
                <Field label="Outgoing Username *"><input type="text" value={mailboxForm.smtp_username || ''} onChange={e => setMailboxForm({ ...mailboxForm, smtp_username: e.target.value })} className={inputCls} /></Field>
                <Field label="Outgoing Password *"><input type="password" value={mailboxForm.smtp_password || ''} onChange={e => setMailboxForm({ ...mailboxForm, smtp_password: e.target.value })} className={inputCls} placeholder={editingMailbox ? '•••••••• (unchanged — leave blank to keep)' : ''} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                  <input type="checkbox" checked={mailboxForm.is_default_sender === true} onChange={e => setMailboxForm({ ...mailboxForm, is_default_sender: e.target.checked })} className="accent-blue-500" />
                  Default sender
                </label>
                <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                  <input type="checkbox" checked={mailboxForm.is_enabled !== false} onChange={e => setMailboxForm({ ...mailboxForm, is_enabled: e.target.checked })} className="accent-blue-500" />
                  Enabled
                </label>
              </div>
              <Field label="Email Signature">
                <textarea rows={2} value={mailboxForm.signature || ''} onChange={e => setMailboxForm({ ...mailboxForm, signature: e.target.value })} className={`${inputCls} resize-none`} />
              </Field>
              <div className="space-y-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 p-3">
                <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                  <input type="checkbox" checked={mailboxForm.auto_reply_enabled === true} onChange={e => setMailboxForm({ ...mailboxForm, auto_reply_enabled: e.target.checked })} className="accent-blue-500" />
                  Enable auto-reply for incoming mail
                </label>
                <textarea rows={3} value={mailboxForm.auto_reply_message || ''} onChange={e => setMailboxForm({ ...mailboxForm, auto_reply_message: e.target.value })}
                  placeholder="Auto-reply message sent to new incoming conversations (e.g. Thanks for your message — we will get back to you within 24 hours.)"
                  className={`${inputCls} resize-none`} />
              </div>
              {mailboxFormError && (
                <p className="text-xs text-red-400 break-words rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2">{mailboxFormError}</p>
              )}
            </div>
            <div className="flex gap-2 px-5 py-4 border-t border-[var(--border-color)] sticky bottom-0 bg-[var(--bg-secondary)]">
              <button onClick={saveMailbox} disabled={busy === 'save-mailbox'}
                className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {busy === 'save-mailbox' ? <><Loader2 size={13} className="animate-spin" /> {editingMailbox ? 'Saving changes...' : 'Creating mailbox...'}</> : <><Save size={13} /> {editingMailbox ? 'Save Changes' : 'Create Mailbox'}</>}
              </button>
              <button onClick={() => { setShowMailboxForm(false); setEditingMailbox(null); setMailboxFormError(null); }}
                className="px-4 py-2 rounded-lg border border-[var(--border-color)] text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Trash confirm */}
      {showTrashConfirm && (
        <Modal title="Empty Trash" onClose={() => setShowTrashConfirm(false)}>
          <p className="text-sm text-[var(--text-secondary)]">Permanently delete all {conversations.length} conversation(s) in Trash, including messages, attachments and queue records? This cannot be undone.</p>
          <div className="flex gap-2 pt-4">
            <button onClick={emptyTrash} disabled={busy === 'empty-trash'}
              className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {busy === 'empty-trash' ? <><Loader2 size={13} className="animate-spin" /> Emptying...</> : <><Delete size={13} /> Empty Trash</>}
            </button>
            <button onClick={() => setShowTrashConfirm(false)} className="px-4 py-2 rounded-lg border border-[var(--border-color)] text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 transition-colors">Cancel</button>
          </div>
        </Modal>
      )}

      {/* Delete mailbox confirm */}
      {showDeleteMailboxConfirm && (
        <Modal title="Delete Mailbox" onClose={() => setShowDeleteMailboxConfirm(null)}>
          <p className="text-sm text-[var(--text-secondary)]">Permanently delete this mailbox and its sync logs? IMAP/SMTP credentials cannot be recovered.</p>
          <div className="flex gap-2 pt-4">
            <button onClick={() => deleteMailbox(showDeleteMailboxConfirm)} disabled={busy === `delete:${showDeleteMailboxConfirm}`}
              className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {busy === `delete:${showDeleteMailboxConfirm}` ? <><Loader2 size={13} className="animate-spin" /> Deleting...</> : <><Trash2 size={13} /> Delete</>}
            </button>
            <button onClick={() => setShowDeleteMailboxConfirm(null)} className="px-4 py-2 rounded-lg border border-[var(--border-color)] text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 transition-colors">Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

const inputCls = "w-full px-2.5 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)]/20 text-[var(--text-primary)] text-xs placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500/20";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] text-[var(--text-muted)] mb-1">{label}</span>
      {children}
    </label>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 w-[420px] max-w-full mx-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--bg-tertiary)]/50 text-[var(--text-muted)] transition-colors"><X size={14} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
