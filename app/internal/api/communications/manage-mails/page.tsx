"use client";

// Manage Mails — a centralized mail workspace for the WebSmith Internal API
// Center. It manages the built-in Websmith Mail accounts (no-reply / support /
// sales) and user-configured mailboxes from ONE place, plus their mail.
// RULE 0 / UI-ONLY: every server call reuses the existing backend
// (/internal/backend/communications + /internal/backend/mailboxes). No sending
// (SMTP), receiving (IMAP), queue, schema, auth or notification logic is
// changed or duplicated here.

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Mail, AtSign, Plus, RefreshCw, Loader2, Search, X, Save, Pencil,
  Trash2, Delete, Reply, ArchiveRestore, CheckCheck, MailOpen, Eye, EyeOff,
  Download, FileText, FileImage, FileArchive, FileSpreadsheet,
  FileCode, FileJson, FileAudio, FileVideo, FileType, Presentation,
  Wifi, KeySquare, Ban, Send, Star, Plug, Zap, Archive, ExternalLink,
  AlertTriangle,
} from "lucide-react";
import UniversalEmailDialog from "@/components/internal-api/UniversalEmailDialog";

const API_BASE = "/internal/backend/communications";
const MB_BASE = "/internal/backend/mailboxes";

// ---- Data contracts (mirror of the existing backend responses) ----
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
  mailbox_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  message_count: number;
  attachment_count: number;
  unread_replies: number;
}

interface Mailbox {
  id: string;
  kind: "system" | "mailbox";
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
  auto_reply_template_key: string;
  auto_reply_signature: string;
  queue_size: number;
  last_sync?: string | null;
  last_success?: string | null;
  last_failure?: string | null;
  created_at: string;
  updated_at: string;
  imap_password?: string;
  smtp_password?: string;
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
  conversation: Conversation & { admin_read_at?: string | null; sdk_version?: string; runtime_type?: string };
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

interface SystemAccount {
  id: string;
  name: string;
  email: string;
  display_name: string;
  type: string;
  reply_to: string;
  signature: string;
  is_active: boolean;
  templates: string[];
}

// ---- Provider auto-configuration (same shared presets as the Communication
// Center; UI-only — the backend stores a free provider string). ----
const PROVIDER_PRESETS = [
  {
    key: 'gmail', label: 'Gmail / Google Workspace', match: /gmail\.com|googlemail\.com$/i,
    imap: { host: 'imap.gmail.com', port: 993, secure: true }, smtp: { host: 'smtp.gmail.com', port: 465, secure: true },
    help: { note: 'Gmail requires an App Password when 2-Step Verification is enabled. Use your full Gmail address as the username.' },
  },
  {
    key: 'outlook', label: 'Outlook / Microsoft 365', match: /outlook\.com|hotmail\.com|live\.com|msn\.com|office365\.com|outlook\.co$/i,
    imap: { host: 'outlook.office365.com', port: 993, secure: true }, smtp: { host: 'smtp.office365.com', port: 587, secure: false },
    help: { note: 'Microsoft may require an App Password when multi-factor authentication (MFA) is enabled on the account.' },
  },
  {
    key: 'yahoo', label: 'Yahoo Mail', match: /yahoo\.com|ymail\.com$/i,
    imap: { host: 'imap.mail.yahoo.com', port: 993, secure: true }, smtp: { host: 'smtp.mail.yahoo.com', port: 465, secure: true },
    help: { note: 'Yahoo requires an App Password when two-step verification is enabled on the account.' },
  },
  {
    key: 'zoho', label: 'Zoho Mail', match: /zohomail\.|zoho\.com$/i,
    imap: { host: 'imap.zoho.com', port: 993, secure: true }, smtp: { host: 'smtp.zoho.com', port: 465, secure: true },
    help: { note: 'Zoho requires an App-Specific Password when Two-Factor Authentication (2FA) is enabled for the account.' },
  },
  {
    key: 'icloud', label: 'iCloud Mail', match: /icloud\.com|me\.com$/i,
    imap: { host: 'imap.mail.me.com', port: 993, secure: true }, smtp: { host: 'smtp.mail.me.com', port: 587, secure: false },
    help: { note: 'iCloud requires an App-Specific Password (generated from your Apple Account) to sign in to third-party apps.' },
  },
  {
    key: 'fastmail', label: 'Fastmail', match: /fastmail\.(com|fm)|fastmailbox\.net$/i,
    imap: { host: 'imap.fastmail.com', port: 993, secure: true }, smtp: { host: 'smtp.fastmail.com', port: 465, secure: true },
    help: { note: 'Fastmail requires an App Password for every third-party mail client.' },
  },
  {
    key: 'proton', label: 'Proton Mail (via Bridge)', match: /proton\.(me|mail|ch)$/i,
    imap: { host: '127.0.0.1', port: 1143, secure: false }, smtp: { host: '127.0.0.1', port: 1025, secure: false },
    help: { note: 'Proton Mail works through the Proton Mail Bridge — use the Bridge-generated IMAP/SMTP host, port and credentials shown in the Bridge app.' },
  },
  {
    key: 'custom', label: 'Custom / Other', match: /.*/,
    imap: { host: '', port: 993, secure: true }, smtp: { host: '', port: 465, secure: true },
    help: { note: 'Enter the server settings provided by your email provider.' },
  },
];

const presetForEmail = (email: string): any => {
  const domain = (email || '').split('@')[1] || '';
  return PROVIDER_PRESETS.find(p => p.match.test(domain)) || PROVIDER_PRESETS[PROVIDER_PRESETS.length - 1];
};

const presetForKey = (key: string): any =>
  PROVIDER_PRESETS.find(p => p.key === key) || PROVIDER_PRESETS[PROVIDER_PRESETS.length - 1];

// Fresh form — always BLANK. No default provider, hosts, email or passwords;
// typing the Incoming Email auto-detects the provider and mirrors the address.
const newMailboxForm = () => ({
  provider: '',
  email_address: '',
  display_name: '',
  imap_host: '',
  imap_port: 993,
  imap_secure: true,
  imap_username: '',
  imap_password: '',
  smtp_host: '',
  smtp_port: 465,
  smtp_secure: true,
  smtp_username: '',
  smtp_password: '',
  signature: '',
  auto_reply_enabled: false,
  auto_reply_message: '',
  auto_reply_template_key: '',
  auto_reply_signature: '',
  is_enabled: true,
  is_default_sender: false,
});

const MAILBOX_LABELS: Record<string, { label: string; purpose: string }> = {
  no_reply: { label: 'No-Reply', purpose: 'Automated system emails (OTP, license, payments, notifications).' },
  support: { label: 'Support', purpose: 'Customer support conversations and technical requests.' },
  sales: { label: 'Sales', purpose: 'Sales enquiries and purchase conversations.' },
};

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

const CONV_FOLDERS = [
  { key: 'all', label: 'All' },
  { key: 'inbox', label: 'Inbox' },
  { key: 'waiting', label: 'Waiting' },
  { key: 'sent', label: 'Sent' },
  { key: 'trash', label: 'Trash' },
];

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

// ---- Small shared UI helpers (same visual language as the Communication Center) ----
const inputCls = "w-full px-2.5 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)]/20 text-[var(--text-primary)] text-xs placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500/20";

const iconBtnCls = "p-1.5 rounded-lg border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/40 hover:text-[var(--text-primary)] transition-colors disabled:opacity-40";

const defaultSenderId = (accounts: any[]): string =>
  accounts.find(a => a.is_default && a.is_active)?.id
  || accounts.find(a => a.is_active)?.id
  || accounts[0]?.id || '';

// Default sender for interactive mail (Compose / Reply): never the
// transactional no-reply account — it is reserved for automated system mail.
const interactiveSenderId = (accounts: any[]): string => {
  const interactive = accounts.filter(a => a.is_active && a.type !== 'no_reply' && a.type !== 'no-reply');
  return interactive.find(a => a.is_default)?.id
    || interactive[0]?.id
    || defaultSenderId(accounts);
};

const accountForConversation = (
  conv: any,
  commSettings: any,
  mailboxes: Mailbox[]
): { id: string; kind: string; display_name: string; email: string; is_active: boolean } | null => {
  const mailboxOptions = mailboxes.filter(m => m.is_enabled !== false).map(m => ({
    id: m.id,
    kind: 'mailbox',
    display_name: m.display_name || m.email_address || '',
    email: m.email_address || '',
    is_active: m.is_enabled !== false,
  }));
  const systemAccounts = (commSettings?.mail_accounts || []).filter(a => a.is_active !== false).map(a => ({
    id: a.id,
    kind: 'system',
    display_name: a.display_name || a.name || a.email,
    email: a.email || '',
    is_active: a.is_active !== false,
  }));

  if (conv?.mailbox_id) {
    const mb = mailboxOptions.find(m => m.id === conv.mailbox_id);
    if (mb) return mb;
  }

  const system = systemAccounts.filter(a => a.is_active);
  for (const a of system) {
    const cats = (commSettings?.routing || {}).support_categories ||
      (commSettings?.routing || {}).sales_categories ||
      ['general'];
    if (a.kind === 'system' && a.type === 'support' ? cats.includes(conv?.category) :
        a.kind === 'system' && a.type === 'sales' ? cats.includes(conv?.category) : true) {
      return a;
    }
  }

  return system[0] || null;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] text-[var(--text-muted)] mb-1">{label}</span>
      {children}
    </label>
  );
}

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className={`rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 ${wide ? 'w-[560px]' : 'w-[480px]'} max-w-full mx-4 max-h-[92vh] overflow-y-auto`}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--bg-tertiary)]/50 text-[var(--text-muted)] transition-colors"><X size={14} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

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

const mailboxHealth = (mb: Mailbox) => {
  if (!mb.is_enabled) return { status: 'disabled', label: 'Disabled', color: 'text-gray-400 bg-gray-500/10' };
  if (mb.sync_status === 'syncing') return { status: 'syncing', label: 'Syncing', color: 'text-blue-400 bg-blue-500/10' };
  if (mb.connection_status === 'connected') return { status: 'connected', label: 'Connected', color: 'text-green-400 bg-green-500/10' };
  if (mb.connection_status === 'failed') {
    const err = (mb.last_error || '').toLowerCase();
    if (err.includes('auth') || err.includes('credential') || err.includes('invalid') || err.includes('password') || err.includes('login')) {
      return { status: 'auth_required', label: 'Authentication Required', color: 'text-rose-400 bg-rose-500/10' };
    }
    return { status: 'failed', label: 'Connection Failed', color: 'text-red-400 bg-red-500/10' };
  }
  return { status: 'unknown', label: 'Unknown', color: 'text-gray-400 bg-gray-500/10' };
};

const HEALTH_DOT: Record<string, string> = {
  connected: 'bg-green-400',
  syncing: 'bg-blue-400 animate-pulse',
  auth_required: 'bg-rose-400',
  failed: 'bg-red-400',
  disabled: 'bg-gray-500/50',
  unknown: 'bg-gray-400/50',
};

function InboxEmpty() {
  return (
    <div className="p-2.5 rounded-full bg-[var(--bg-tertiary)]/30 text-[var(--text-muted)]">
      <Mail size={20} />
    </div>
  );
}

export default function ManageMailsPage() {
  // ---- Data ----
  const [commSettings, setCommSettings] = useState<any>(null);
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ---- Selection ----
  const [selected, setSelected] = useState<{ kind: 'system' | 'mailbox'; id: string } | null>(null);
  const [convFolder, setConvFolder] = useState<string>('inbox');
  const [search, setSearch] = useState('');

  // ---- Conversation list / detail ----
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convLoading, setConvLoading] = useState(false);
  const [convError, setConvError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<DetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // ---- Actions / busy ----
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'ok' | 'err' | 'warn'; text: string } | null>(null);

  // ---- Mailbox form ----
  const [showMailboxForm, setShowMailboxForm] = useState(false);
  const [editingMailbox, setEditingMailbox] = useState<Mailbox | null>(null);
  const [mailboxForm, setMailboxForm] = useState<any>({});
  const [mailboxFormError, setMailboxFormError] = useState<string | null>(null);
  const [mailboxTest, setMailboxTest] = useState<{ running: boolean; results: { imap?: { connected: boolean; error?: string }; smtp?: { connected: boolean; error?: string } } | null }>({ running: false, results: null });
  const [showImapPass, setShowImapPass] = useState(false);
  const [showSmtpPass, setShowSmtpPass] = useState(false);

  // ---- System account inline editor ----
  const [editingSystemId, setEditingSystemId] = useState<string | null>(null);
  const [systemDraft, setSystemDraft] = useState<SystemAccount | null>(null);

  // ---- Confirmations ----
  const [showDeleteMailboxConfirm, setShowDeleteMailboxConfirm] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ ids: string[]; count: number; subject?: string } | null>(null);
  const [showEmptyTrashConfirm, setShowEmptyTrashConfirm] = useState(false);
  const [showTestEmail, setShowTestEmail] = useState<string | null>(null);
  const [testEmailTo, setTestEmailTo] = useState('');

  // ---- Universal email dialog ----
  const [emailDialog, setEmailDialog] = useState<{
    isOpen: boolean;
    defaultEmail?: string;
    defaultRecipientName?: string;
    defaultLicenseKey?: string;
    defaultProductId?: string;
    defaultAction?: any;
    conversationId?: string;
    defaultSubject?: string;
    fromAccounts?: { id: string; kind: "system" | "mailbox"; display_name: string; email: string; is_active: boolean; is_default: boolean; type?: string }[];
    defaultFromId?: string;
  }>({ isOpen: false });

  const showToast = useCallback((type: 'ok' | 'err' | 'warn', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const systemAccounts: SystemAccount[] = useMemo(() => commSettings?.mail_accounts || [], [commSettings]);
  const allowEmailDeletion = commSettings?.allow_email_deletion !== false;

  // A system account whose email matches a configured mailbox is operated via
  // that mailbox's integration (conversations carry mailbox_id).
  const matchingMailboxFor = useCallback((acct: SystemAccount | null | undefined): Mailbox | null => {
    if (!acct) return null;
    const lower = (acct.email || '').toLowerCase();
    return mailboxes.find(m => m.email_address.toLowerCase() === lower) || null;
  }, [mailboxes]);

  const accountCategories = useCallback((acct: SystemAccount | null | undefined): string[] => {
    if (!acct) return [];
    const routing = commSettings?.routing || {};
    if (acct.type === 'support') return routing.support_categories || ['support', 'activation', 'renewal', 'reactivation', 'hardware_replacement', 'general'];
    if (acct.type === 'sales') return routing.sales_categories || ['sales'];
    return ['general'];
  }, [commSettings]);

  const selectedSystem = useMemo(() => {
    if (!selected || selected.kind !== 'system') return null;
    return systemAccounts.find(a => a.id === selected.id) || null;
  }, [selected, systemAccounts]);

  const selectedMailbox = useMemo(() => {
    if (!selected || selected.kind !== 'mailbox') return null;
    return mailboxes.find(m => m.id === selected.id) || null;
  }, [selected, mailboxes]);

  // ---- Initial load ----
  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [settingsRes, mbRes] = await Promise.all([
        fetch('/internal/backend/communications/settings', { headers: getAuthHeaders() }),
        fetch(`${MB_BASE}`, { headers: getAuthHeaders() }),
      ]);
      const settingsJson = await settingsRes.json();
      const mbJson = await mbRes.json();
      if (settingsJson.success) setCommSettings(settingsJson.settings);
      if (mbJson.success) setMailboxes(mbJson.data.mailboxes || []);
      else if (!mbJson.success) setError(mbJson.error?.message || 'Failed to load mailboxes');
    } catch {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Default to the first Websmith Mail account once the settings load.
  useEffect(() => {
    if (!selected && systemAccounts.length > 0) {
      setSelected({ kind: 'system', id: systemAccounts[0].id });
    }
  }, [systemAccounts, selected]);

  // ---- Account-scoped conversation load ----
  const loadConversations = useCallback(async () => {
    if (!selected) return;
    setConvLoading(true);
    setConvError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', '1');
      params.set('limit', '100');
      if (convFolder === 'trash') params.set('show_deleted', 'true');
      else if (convFolder === 'inbox') params.set('status', 'open,waiting_customer');
      else if (convFolder === 'waiting') params.set('status', 'waiting_customer');
      else if (convFolder === 'sent') params.set('sent', 'true');
      if (search.trim()) params.set('search', search.trim());

      const res = await fetch(`${API_BASE}/conversations?${params.toString()}`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (!json.success) {
        setConvError(json.error?.message || 'Failed to load conversations');
        setConversations([]);
        return;
      }
      const all: Conversation[] = json.data.conversations || [];
      let scoped: Conversation[];
      if (selected.kind === 'mailbox') {
        scoped = all.filter(c => c.mailbox_id === selected.id);
      } else {
        const acct = systemAccounts.find(a => a.id === selected.id) || null;
        const mb = matchingMailboxFor(acct);
        if (mb) {
          scoped = all.filter(c => c.mailbox_id === mb.id);
        } else {
          const cats = accountCategories(acct);
          scoped = all.filter(c => cats.includes(c.category));
        }
      }
      setConversations(scoped);
    } catch {
      setConvError('Failed to load conversations');
      setConversations([]);
    } finally {
      setConvLoading(false);
    }
  }, [selected, convFolder, search, systemAccounts, matchingMailboxFor, accountCategories]);

  useEffect(() => {
    loadConversations();
    setSelectedIds(new Set());
  }, [loadConversations, selected, convFolder]);

  // ---- Conversation detail ----
  const openConversation = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`${API_BASE}/conversations/${id}`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.success) setDetail(json.data);
      else showToast('err', json.error?.message || 'Failed to load conversation');
    } catch {
      showToast('err', 'Failed to load conversation');
    } finally {
      setDetailLoading(false);
    }
  }, [showToast]);

  const refreshConversations = useCallback(() => {
    loadConversations();
  }, [loadConversations]);

  const patchConversation = useCallback(async (id: string, action: string, okMsg: string) => {
    setBusy(`patch:${action}`);
    try {
      const res = await fetch(`${API_BASE}/conversations/${id}`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('ok', okMsg);
        if (action === 'archive' && detail?.conversation.id === id) setDetail(null);
        if (action === 'restore' && detail?.conversation.id === id) openConversation(id);
        refreshConversations();
      } else {
        showToast('err', json.error?.message || 'Action failed');
      }
    } catch {
      showToast('err', 'Action failed');
    } finally {
      setBusy(null);
    }
  }, [detail, showToast, refreshConversations, openConversation]);

  // Bulk PATCH (one request, real per-row results). Archive excludes trashed
  // conversations and restore only touches trashed ones — the backend decides.
  const patchConversations = useCallback(async (action: string, ids: string[]) => {
    if (ids.length === 0) return;
    setBusy(`patch:${action}`);
    try {
      const res = await fetch(`${API_BASE}/conversations`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ids }),
      });
      const json = await res.json();
      if (json.success) {
        const d = json.data || {};
        const total = d.total ?? ids.length;
        const updated = d.updated ?? 0;
        const failed = d.failed ?? 0;
        const verb = { mark_read: 'marked as read', mark_unread: 'marked as unread', archive: 'archived', restore: 'restored from Trash' }[action as string] || `${action}d`;
        const okMsg = updated === 1 ? `1 conversation ${verb}` : `${updated} conversations ${verb}`;
        if (failed > 0) {
          showToast('warn', `${okMsg}. ${failed} failed (of ${total} selected).`);
        } else {
          showToast('ok', okMsg);
        }
        if (action === 'archive') {
          setSelectedIds(new Set());
          setDetail(null);
        } else if (action === 'restore') {
          setSelectedIds(new Set());
          if (detail) openConversation(detail.conversation.id);
        }
        refreshConversations();
      } else {
        showToast('err', json.error?.message || 'Action failed');
      }
    } catch {
      showToast('err', 'Action failed');
    } finally {
      setBusy(null);
    }
  }, [showToast, refreshConversations, detail, openConversation]);

  const softDelete = useCallback(async (idsOrId: string | string[]) => {
    const ids = Array.isArray(idsOrId) ? idsOrId : [idsOrId];
    if (ids.length === 0) return;
    const initialIds = new Set(selectedIds);
    const targetIds = new Set(ids);
    setBusy('del');
    try {
      let okCount = 0;
      const failed: string[] = [];
      for (const id of ids) {
        try {
          const res = await fetch(`${API_BASE}/conversations/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
          const json = await res.json();
          if (json.success) okCount++;
          else failed.push(id);
        } catch {
          failed.push(id);
        }
      }
      const total = ids.length;
      if (okCount === total) {
        showToast('ok', total === 1 ? 'Conversation moved to Trash' : `${total} conversations moved to Trash`);
      } else if (okCount > 0) {
        showToast('warn', `${okCount} of ${total} conversations moved to Trash. ${failed.length} failed.`);
      } else {
        showToast('err', 'Failed to move conversations to Trash');
      }
      if (detail && targetIds.has(detail.conversation.id)) setDetail(null);
      const nextSel = new Set(initialIds);
      for (const id of targetIds) nextSel.delete(id);
      setSelectedIds(nextSel);
      refreshConversations();
    } catch {
      showToast('err', 'Delete failed');
    } finally {
      setBusy(null);
    }
  }, [detail, showToast, refreshConversations, selectedIds]);

  const restoreConversation = useCallback(async (id: string) => {
    await patchConversation(id, 'restore', 'Conversation restored from Trash');
  }, [patchConversation]);

  const permanentlyDelete = useCallback(async (ids: string[], count: number) => {
    setBusy('permanent-delete');
    try {
      const res = await fetch(`${API_BASE}/conversations?ids=${encodeURIComponent(ids.join(','))}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      if (json.success) {
        showToast('ok', json.data?.message || 'Conversation(s) permanently deleted');
        setShowDeleteConfirm(null);
        if (detail && ids.includes(detail.conversation.id)) setDetail(null);
        setSelectedIds(new Set());
        refreshConversations();
      } else {
        showToast('err', json.error?.message || 'Delete failed');
      }
    } catch {
      showToast('err', 'Delete failed');
    } finally {
      setBusy(null);
    }
  }, [detail, showToast, refreshConversations]);

  const emptyTrash = useCallback(async () => {
    const ids = conversations.map(c => c.id);
    if (ids.length === 0) { setShowEmptyTrashConfirm(false); return; }
    await permanentlyDelete(ids, ids.length);
    setShowEmptyTrashConfirm(false);
  }, [conversations, permanentlyDelete]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ---- Mailbox management actions ----
  const loadMailboxes = useCallback(async () => {
    try {
      const res = await fetch(`${MB_BASE}`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.success) setMailboxes(json.data.mailboxes || []);
    } catch {}
  }, []);

  const mailboxAction = useCallback(async (id: string, endpoint: string, method: 'POST' | 'PATCH' | 'DELETE' = 'POST', body?: any, okMsg?: string) => {
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
        if (selected?.id === id) loadConversations();
      } else {
        showToast('err', json.error?.message || json.message || 'Mailbox action failed');
      }
    } catch {
      showToast('err', 'Mailbox action failed');
    } finally {
      setBusy(null);
    }
  }, [selected, showToast, loadMailboxes, loadConversations]);

  const deleteMailbox = useCallback(async (id: string) => {
    setBusy(`delete:${id}`);
    try {
      const res = await fetch(`${MB_BASE}/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      const json = await res.json();
      if (json.success) {
        showToast('ok', json.message || 'Mailbox removed');
        setShowDeleteMailboxConfirm(null);
        setSelectedIds(new Set());
        await loadMailboxes();
        setSelected(null);
      } else {
        showToast('err', json.error?.message || 'Failed to delete mailbox');
      }
    } catch {
      showToast('err', 'Failed to delete mailbox');
    } finally {
      setBusy(null);
    }
  }, [showToast, loadMailboxes]);

  const sendTestMailboxEmail = useCallback(async () => {
    if (!showTestEmail || !testEmailTo.trim()) return;
    setBusy(`send-test:${showTestEmail}`);
    try {
      const res = await fetch(`${MB_BASE}/${showTestEmail}/send-test`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ to_email: testEmailTo.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('ok', json.message || 'Test email sent');
        setShowTestEmail(null);
        setTestEmailTo('');
      } else {
        showToast('err', json.error?.message || 'Failed to send test email');
      }
    } catch {
      showToast('err', 'Failed to send test email');
    } finally {
      setBusy(null);
    }
  }, [showTestEmail, testEmailTo, showToast]);

  // ---- System account edits (persisted via the communications settings doc) ----
  const persistCommSettings = useCallback(async (payload: any, successMsg?: string) => {
    setBusy('save-comm-settings');
    try {
      const res = await fetch('/internal/backend/communications/settings', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        showToast('ok', successMsg || 'Communication settings saved');
        await loadAll();
      } else {
        showToast('err', json.error?.message || 'Failed to save settings');
      }
    } catch {
      showToast('err', 'Failed to save settings');
    } finally {
      setBusy(null);
    }
  }, [showToast, loadAll]);

  const toggleSystemAccount = useCallback((id: string) => {
    if (!commSettings) return;
    const next = {
      ...commSettings,
      mail_accounts: (commSettings.mail_accounts || []).map((a: any) =>
        a.id === id ? { ...a, is_active: !(a.is_active === true) } : a
      ),
    };
    setCommSettings(next);
    persistCommSettings(next);
  }, [commSettings, persistCommSettings]);

  const saveSystemDraft = useCallback((acct: SystemAccount) => {
    if (!commSettings || !systemDraft) return;
    const next = {
      ...commSettings,
      mail_accounts: (commSettings.mail_accounts || []).map((a: any) =>
        a.id === acct.id ? { ...a, display_name: systemDraft.display_name, reply_to: systemDraft.reply_to, signature: systemDraft.signature } : a
      ),
    };
    setCommSettings(next);
    persistCommSettings(next, 'Mail account updated');
    setEditingSystemId(null);
    setSystemDraft(null);
  }, [commSettings, systemDraft, persistCommSettings]);

  // ---- Mailbox form (blank + auto-detect, connection-tested save) ----
  const openNewMailbox = useCallback(() => {
    setEditingMailbox(null);
    setMailboxForm(newMailboxForm());
    setMailboxFormError(null);
    setMailboxTest({ running: false, results: null });
    setShowMailboxForm(true);
  }, []);

  const openEditMailbox = useCallback((mb: Mailbox) => {
    setEditingMailbox(mb);
    setMailboxForm({
      ...newMailboxForm(),
      provider: mb.provider || '',
      email_address: mb.email_address || '',
      display_name: mb.display_name || '',
      imap_host: mb.imap_host || '',
      imap_port: typeof mb.imap_port === 'number' ? mb.imap_port : 993,
      imap_secure: mb.imap_secure !== false,
      imap_username: mb.imap_username || '',
      imap_password: '********',
      smtp_host: mb.smtp_host || '',
      smtp_port: typeof mb.smtp_port === 'number' ? mb.smtp_port : 465,
      smtp_secure: mb.smtp_secure !== false,
      smtp_username: mb.smtp_username || '',
      smtp_password: '********',
      signature: mb.signature || '',
      auto_reply_enabled: !!mb.auto_reply_enabled,
      auto_reply_message: mb.auto_reply_message || '',
      auto_reply_template_key: mb.auto_reply_template_key || '',
      auto_reply_signature: mb.auto_reply_signature || '',
      is_enabled: mb.is_enabled !== false,
      is_default_sender: !!mb.is_default_sender,
    });
    setMailboxFormError(null);
    setMailboxTest({ running: false, results: null });
    setShowMailboxForm(true);
  }, []);

  // Typing the email auto-detects the provider (server config only) and mirrors
  // the address into the usernames. A username only follows the email while it
  // is empty or still equal to the previous address — a manually-changed
  // username that differs is preserved.
  const handleEmailChange = (value: string) => {
    setMailboxForm((prev: any) => {
      const prevEmail = prev.email_address || '';
      const preset = presetForEmail(value);
      const mirrorsUsername = (current: string) =>
        current === '' || (current && prevEmail && current.toLowerCase() === prevEmail.toLowerCase());
      return {
        ...prev,
        email_address: value,
        provider: preset.key,
        imap_host: preset.imap.host,
        imap_port: preset.imap.port,
        imap_secure: preset.imap.secure,
        smtp_host: preset.smtp.host,
        smtp_port: preset.smtp.port,
        smtp_secure: preset.smtp.secure,
        imap_username: mirrorsUsername(prev.imap_username) ? value : prev.imap_username,
        smtp_username: mirrorsUsername(prev.smtp_username) ? value : prev.smtp_username,
      };
    });
  };

  const handleProviderChange = (key: string) => {
    setMailboxForm((prev: any) => {
      if (key === 'auto') {
        const preset = presetForEmail(prev.email_address);
        return {
          ...prev,
          provider: preset.key,
          imap_host: preset.imap.host,
          imap_port: preset.imap.port,
          imap_secure: preset.imap.secure,
          smtp_host: preset.smtp.host,
          smtp_port: preset.smtp.port,
          smtp_secure: preset.smtp.secure,
        };
      }
      const preset = presetForKey(key);
      return {
        ...prev,
        provider: key,
        imap_host: preset.imap.host,
        imap_port: preset.imap.port,
        imap_secure: preset.imap.secure,
        smtp_host: preset.smtp.host,
        smtp_port: preset.smtp.port,
        smtp_secure: preset.smtp.secure,
      };
    });
  };

  // Incoming password mirrors into outgoing while empty or still equal.
  const handleImapPassword = (value: string) => {
    setMailboxForm((prev: any) => {
      const tracksOutgoing =
        prev.smtp_password === '' || (prev.smtp_password && prev.imap_password && prev.smtp_password === prev.imap_password);
      return {
        ...prev,
        imap_password: value,
        smtp_password: tracksOutgoing ? value : prev.smtp_password,
      };
    });
  };

  // Current-form connection tests (Test Incoming / Test Outgoing / Test Connection).
  const testMailboxForm = async (mode: 'imap' | 'smtp' | 'both') => {
    const missing: string[] = [];
    if (mode !== 'smtp') {
      if (!mailboxForm.imap_host) missing.push('Incoming server');
      if (!mailboxForm.imap_username) missing.push('Incoming username');
      if (!editingMailbox && !mailboxForm.imap_password) missing.push('Incoming password');
    }
    if (mode !== 'imap') {
      if (!mailboxForm.smtp_host) missing.push('Outgoing server');
      if (!mailboxForm.smtp_username) missing.push('Outgoing username');
      if (!editingMailbox && !mailboxForm.smtp_password) missing.push('Outgoing password');
    }
    if (missing.length > 0) {
      setMailboxTest({ running: false, results: null });
      setMailboxFormError(`Please complete the required fields: ${missing.join(', ')}.`);
      return;
    }
    setMailboxTest({ running: true, results: null });
    setMailboxFormError(null);
    try {
      const payload: any = {
        imap_host: mailboxForm.imap_host,
        imap_port: mailboxForm.imap_port,
        imap_secure: mailboxForm.imap_secure,
        imap_username: mailboxForm.imap_username,
        smtp_host: mailboxForm.smtp_host,
        smtp_port: mailboxForm.smtp_port,
        smtp_secure: mailboxForm.smtp_secure,
        smtp_username: mailboxForm.smtp_username,
      };
      if (mailboxForm.imap_password) payload.imap_password = mailboxForm.imap_password;
      if (mailboxForm.smtp_password) payload.smtp_password = mailboxForm.smtp_password;
      if (mode === 'imap' || mode === 'smtp') {
        if (mode === 'imap') {
          payload.smtp_host = '';
          payload.smtp_username = '';
          payload.smtp_password = '';
        } else {
          payload.imap_host = '';
          payload.imap_username = '';
          payload.imap_password = '';
        }
      }
      const res = await fetch(`${MB_BASE}/test-connection`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        setMailboxTest({ running: false, results: json.data });
      } else {
        setMailboxTest({ running: false, results: null });
        setMailboxFormError(json.error?.message || 'Connection test could not be completed.');
      }
    } catch {
      setMailboxTest({ running: false, results: null });
      setMailboxFormError('Connection test could not be completed.');
    }
  };

  const saveMailboxForm = async () => {
    setMailboxFormError(null);
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
        // Never overwrite stored credentials with blank/masked values on edit.
        const protectedKeys = ['imap_password', 'smtp_password'] as const;
        for (const key of protectedKeys) {
          if (payload[key] === '' || payload[key] === '********') delete payload[key];
        }
      }

      // New mailboxes must pass the connection gate before saving (specific
      // reason shown on failure — nothing is saved).
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
            if (v.data?.imap && !v.data.imap.connected) reasons.push(`IMAP: ${v.data.imap.error || 'connection failed'}`);
            if (v.data?.smtp && !v.data.smtp.connected) reasons.push(`SMTP: ${v.data.smtp.error || 'connection failed'}`);
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
        setMailboxForm(newMailboxForm());
        setMailboxFormError(null);
        setMailboxTest({ running: false, results: null });
        await loadMailboxes();
        if (selected) loadConversations();
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

  // ---- Universal email dialog (reply / new email) ----
  const fromAccounts = useMemo(() => {
    const systemAccounts = commSettings?.mail_accounts || [];
    const enabledSystem = systemAccounts.filter(a => a.is_active !== false).map(a => ({
      id: a.id,
      kind: 'system',
      display_name: a.display_name || a.name || a.email,
      email: a.email || '',
      is_active: a.is_active !== false,
      is_default: false,
      type: a.type,
    }));
    const enabledMailboxes = mailboxes.filter(m => m.is_enabled !== false).map(mb => ({
      id: mb.id,
      kind: 'mailbox',
      display_name: mb.display_name || '',
      email: mb.email_address || '',
      is_active: mb.is_enabled !== false,
      is_default: false,
      type: mb.provider,
    }));
    return [...enabledSystem, ...enabledMailboxes];
  }, [commSettings, mailboxes]);

  const openCompose = () => setEmailDialog({ isOpen: true, defaultAction: 'send', fromAccounts, defaultFromId: interactiveSenderId(fromAccounts) });

  const openReply = () => {
    const d = detail;
    const recv = d ? accountForConversation(d.conversation, commSettings, mailboxes) : null;
    // Real recipient name from the customer/conversation record — never a
    // guess; email-like strings (from IMAP-parsed mail) are dropped.
    const recvName = (d?.customer?.name || d?.conversation.customer_name || '').trim();
    const defaultRecipientName = /[@<>]/.test(recvName) ? '' : recvName;
    setEmailDialog({
      isOpen: true,
      defaultEmail: d?.conversation.customer_email || d?.customer?.email || '',
      defaultRecipientName,
      defaultLicenseKey: d?.conversation.license_key || undefined,
      defaultProductId: d?.conversation.product_id || undefined,
      defaultAction: 'send',
      conversationId: d?.conversation.id || undefined,
      defaultSubject: d ? `Re: ${d.conversation.subject || ''}`.trim() : undefined,
      fromAccounts,
      defaultFromId: recv?.id || interactiveSenderId(fromAccounts),
    });
  };

  const providerHelp = presetForKey(mailboxForm.provider || presetForEmail(mailboxForm.email_address).key).help;

  const currentLabel = selectedSystem
    ? (selectedSystem.display_name || selectedSystem.name || selectedSystem.email)
    : selectedMailbox
      ? (selectedMailbox.display_name || selectedMailbox.email_address)
      : 'Select an account';

  const isTrash = convFolder === 'trash';

  return (
    <div className="flex flex-col h-full p-3 manage-mails-ui">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 flex-shrink-0">
            <AtSign className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-[var(--text-primary)] leading-tight truncate">Manage Mails</h1>
            <p className="text-xs text-[var(--text-secondary)] truncate">Mail accounts &amp; conversations</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={openCompose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-medium transition-colors">
            <Zap size={12} /> Compose
          </button>
          <button onClick={loadAll} disabled={busy === 'save-comm-settings'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-color)] text-[11px] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 transition-colors disabled:opacity-50">
            {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Refresh
          </button>
        </div>
      </div>

      {/* 3-pane body */}
      <div className="flex-1 min-h-0 flex rounded-xl border border-[var(--border-color)] overflow-hidden mt-2">
        {/* LEFT — accounts (own sidebar; independently scrollable, Add Mail pinned) */}
        <aside className="w-[240px] flex-shrink-0 flex flex-col min-h-0 border-r border-[var(--border-color)] bg-[var(--bg-tertiary)]/10">
          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-2 py-3 space-y-4">
            {/* Websmith Mail (system accounts) — top */}
            <div>
              <p className="px-2 pb-1 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                <Mail size={10} /> Websmith Mail
              </p>
              <div className="space-y-0.5">
                {systemAccounts.map(acct => {
                  const active = selected?.kind === 'system' && selected.id === acct.id;
                  const bound = matchingMailboxFor(acct);
                  return (
                    <button
                      key={acct.id}
                      onClick={() => { setSelected({ kind: 'system', id: acct.id }); setDetail(null); }}
                      className={`relative w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                        active ? 'bg-blue-500/15 text-blue-400' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-0.5 rounded-full bg-blue-400" />}
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${acct.is_active ? 'bg-green-400' : 'bg-gray-500/40'}`} />
                      <span className="flex-1 min-w-0 text-left">
                        <span className="block text-[10px] text-[var(--text-secondary)] truncate">{acct.display_name || acct.name || acct.email}</span>
                        <span className="block text-[9px] text-[var(--text-muted)] truncate">{acct.email}</span>
                      </span>
                      {!acct.is_active && <span className="text-[8px] uppercase tracking-wider text-gray-500/70 flex-shrink-0">Off</span>}
                      {bound && <span className="text-[8px] uppercase tracking-wider text-blue-400/80 flex-shrink-0">Ready</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mailboxes */}
            <div>
              <p className="px-2 pb-1 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                <Plug size={10} /> Mailboxes
              </p>
              {mailboxes.length === 0 ? (
                <p className="px-2 py-1 text-[9px] text-[var(--text-muted)]">No external mailboxes yet.</p>
              ) : (
                <div className="space-y-0.5">
                  {mailboxes.map(mb => {
                    const active = selected?.kind === 'mailbox' && selected.id === mb.id;
                    const h = mailboxHealth(mb);
                    return (
                      <button
                        key={mb.id}
                        onClick={() => { setSelected({ kind: 'mailbox', id: mb.id }); setDetail(null); }}
                        className={`relative w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                          active ? 'bg-blue-500/15 text-blue-400' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 hover:text-[var(--text-primary)]'
                        }`}
                      >
                        {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-0.5 rounded-full bg-blue-400" />}
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${HEALTH_DOT[h.status] || 'bg-gray-400/50'}`} />
                        <span className="flex-1 min-w-0 text-left">
                          <span className="block text-[10px] text-[var(--text-secondary)] truncate">{mb.display_name || mb.email_address}</span>
                          <span className="block text-[9px] text-[var(--text-muted)] truncate">{mb.email_address}</span>
                        </span>
                        {mb.is_default_sender && <Star size={9} className="text-amber-400 flex-shrink-0 fill-amber-400" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="shrink-0 border-t border-[var(--border-color)] p-2 space-y-1.5">
            <button onClick={openNewMailbox}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-medium text-white transition-all focus:outline-none mail-action-button">
              <Plus size={13} /> Add Mail
            </button>
            <a
              href="/internal/api/communications"
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 transition-colors"
            >
              <ExternalLink size={10} /> Communication Settings
            </a>
          </div>
        </aside>

        {/* MIDDLE — account management + conversation list */}
        <div className="w-[360px] min-w-[300px] flex-shrink-0 flex flex-col border-l border-[var(--border-color)]">
          {/* Account card */}
          <div className="shrink-0 p-3 border-b border-[var(--border-color)]">
            <div className="flex items-start gap-2.5">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 flex-shrink-0">
                <AtSign size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-semibold text-[var(--text-primary)] truncate leading-tight">{currentLabel}</h2>
                <p className="text-[10px] text-[var(--text-secondary)] truncate">{selectedSystem ? selectedSystem.email : selectedMailbox ? selectedMailbox.email_address : 'Choose a mail account'}</p>
              </div>
            </div>

            {/* System account management */}
            {selectedSystem && (
              <div className="mt-2.5 space-y-2">
                <div className="flex items-center gap-2">
                  <Toggle
                    checked={selectedSystem.is_active === true}
                    onChange={() => toggleSystemAccount(selectedSystem.id)}
                    disabled={busy === 'save-comm-settings'}
                  />
                  <span className="text-[10px] text-[var(--text-secondary)]">
                    {selectedSystem.is_active === true ? 'Active' : 'Inactive'}
                  </span>
                  <span className="ml-auto px-2 py-0.5 rounded-full text-[9px] bg-[var(--bg-tertiary)]/40 text-[var(--text-muted)]">
                    {MAILBOX_LABELS[selectedSystem.id]?.purpose || selectedSystem.type}
                  </span>
                </div>

                {matchingMailboxFor(selectedSystem) && (
                  <button
                    onClick={() => { const mb = matchingMailboxFor(selectedSystem); if (mb) { setSelected({ kind: 'mailbox', id: mb.id }); setDetail(null); } }}
                    className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-blue-500/20 bg-blue-500/5 text-[10px] text-blue-400 hover:bg-blue-500/10 transition-colors text-left"
                  >
                    <Plug size={11} /> Managed by an external mailbox — open it
                  </button>
                )}

                {editingSystemId === selectedSystem.id ? (
                  <div className="space-y-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 p-2.5">
                    <Field label="Display Name">
                      <input type="text" name="system-display-name" autoComplete="off" value={systemDraft?.display_name || ''}
                        onChange={e => setSystemDraft(prev => prev ? { ...prev, display_name: e.target.value } : prev)}
                        className={inputCls} />
                    </Field>
                    <Field label="Reply-To Email">
                      <input type="email" name="system-reply-to" autoComplete="off" value={systemDraft?.reply_to || ''}
                        onChange={e => setSystemDraft(prev => prev ? { ...prev, reply_to: e.target.value } : prev)}
                        className={inputCls} />
                    </Field>
                    <Field label="Signature">
                      <textarea rows={3} name="system-signature" autoComplete="off" value={systemDraft?.signature || ''}
                        onChange={e => setSystemDraft(prev => prev ? { ...prev, signature: e.target.value } : prev)}
                        className={`${inputCls} resize-y`} />
                    </Field>
                    <div className="flex gap-2">
                      <button onClick={() => saveSystemDraft(selectedSystem)} disabled={busy === 'save-comm-settings'}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-1">
                        {busy === 'save-comm-settings' ? <><Loader2 size={11} className="animate-spin" /> Saving...</> : <><Save size={11} /> Save</>}
                      </button>
                      <button onClick={() => { setEditingSystemId(null); setSystemDraft(null); }}
                        className="px-3 py-1.5 rounded-lg border border-[var(--border-color)] text-[10px] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 transition-colors">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => { setEditingSystemId(selectedSystem.id); setSystemDraft(selectedSystem); }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--border-color)] text-[10px] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 transition-colors">
                    <Pencil size={11} /> Edit account
                  </button>
                )}
              </div>
            )}

            {/* Mailbox management */}
            {selectedMailbox && (
              <div className="mt-2.5 space-y-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge className={mailboxHealth(selectedMailbox).color}>
                    {mailboxHealth(selectedMailbox).label}
                  </Badge>
                  {selectedMailbox.is_default_sender && (
                    <Badge className="text-amber-400 bg-amber-500/10"><Star size={9} className="fill-amber-400" /> Default</Badge>
                  )}
                  <span className="text-[9px] text-[var(--text-muted)]">{selectedMailbox.provider}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Toggle
                    checked={selectedMailbox.is_enabled !== false}
                    onChange={() => mailboxAction(selectedMailbox.id, selectedMailbox.is_enabled === false ? 'enable' : 'disable', 'POST', undefined, selectedMailbox.is_enabled === false ? 'Mailbox enabled' : 'Mailbox disabled')}
                    disabled={busy === `enable:${selectedMailbox.id}` || busy === `disable:${selectedMailbox.id}`}
                  />
                  <span className="text-[10px] text-[var(--text-secondary)]">{selectedMailbox.is_enabled === false ? 'Disabled' : 'Enabled'}</span>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  <button onClick={() => mailboxAction(selectedMailbox.id, 'sync', 'POST', undefined, 'IMAP sync completed')}
                    disabled={busy === `sync:${selectedMailbox.id}`} className="px-2 py-1.5 rounded-lg border border-[var(--border-color)] text-[10px] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 disabled:opacity-50 flex items-center justify-center gap-1">
                    {busy === `sync:${selectedMailbox.id}` ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />} Sync
                  </button>
                  <button onClick={() => mailboxAction(selectedMailbox.id, 'set-default', 'POST', undefined, 'Default sender updated')}
                    disabled={busy === `set-default:${selectedMailbox.id}` || selectedMailbox.is_default_sender}
                    className="px-2 py-1.5 rounded-lg border border-[var(--border-color)] text-[10px] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 disabled:opacity-50 flex items-center justify-center gap-1">
                    <Star size={11} /> Default
                  </button>
                  <button onClick={() => setShowTestEmail(selectedMailbox.id)}
                    className="px-2 py-1.5 rounded-lg border border-[var(--border-color)] text-[10px] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 flex items-center justify-center gap-1">
                    <Send size={11} /> Test
                  </button>
                  <button onClick={() => openEditMailbox(selectedMailbox)}
                    className="px-2 py-1.5 rounded-lg border border-[var(--border-color)] text-[10px] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 flex items-center justify-center gap-1">
                    <Pencil size={11} /> Edit
                  </button>
                  <button onClick={() => fetch(`${MB_BASE}/${selectedMailbox.id}/test`, { method: 'POST', headers: getAuthHeaders() }).then(r => r.json()).then(j => showToast(j.success ? 'ok' : 'err', j.success ? 'Connection test passed' : j.error?.message || 'Test failed')).catch(() => showToast('err', 'Test failed'))}
                    disabled={busy === `test:${selectedMailbox.id}`}
                    className="px-2 py-1.5 rounded-lg border border-[var(--border-color)] text-[10px] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 disabled:opacity-50 flex items-center justify-center gap-1">
                    {busy === `test:${selectedMailbox.id}` ? <Loader2 size={11} className="animate-spin" /> : <Wifi size={11} />} Connect
                  </button>
                  <button onClick={() => setShowDeleteMailboxConfirm(selectedMailbox.id)}
                    disabled={busy === `delete:${selectedMailbox.id}`}
                    className="px-2 py-1.5 rounded-lg border border-red-500/20 text-[10px] text-red-400 hover:bg-red-500/10 disabled:opacity-50 flex items-center justify-center gap-1">
                    <Ban size={11} /> Remove
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Folder chips + search */}
          <div className="shrink-0 border-b border-[var(--border-color)] p-2 space-y-2">
            <div className="flex items-center gap-1 flex-wrap">
              {CONV_FOLDERS.map(folder => (
                <button key={folder.key}
                  onClick={() => { setConvFolder(folder.key); setDetail(null); }}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${
                    convFolder === folder.key ? 'bg-blue-500/15 text-blue-400' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30'
                  }`}>
                  {folder.label}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search this mailbox..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && loadConversations()}
                className="w-full pl-7 pr-3 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)]/20 text-[var(--text-primary)] text-[11px] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          {/* Conversation list */}
          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
            {convLoading ? (
              <div className="h-full flex items-center justify-center"><Loader2 className="h-5 w-5 text-blue-400 animate-spin" /></div>
            ) : convError ? (
              <p className="p-4 text-[11px] text-red-400">{convError}</p>
            ) : conversations.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 gap-2">
                <InboxEmpty />
                <p className="text-[11px] text-[var(--text-muted)]">No conversations here.</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-color)]">
                {conversations.map(c => {
                  const selectedConv = detail?.conversation.id === c.id;
                  const checked = selectedIds.has(c.id);
                  return (
                    <div key={c.id}
                      onClick={() => openConversation(c.id)}
                      className={`px-3 py-2.5 cursor-pointer transition-colors border-l-2 ${selectedConv ? 'bg-blue-500/10 border-l-blue-400' : 'border-l-transparent hover:bg-[var(--bg-tertiary)]/20'}`}>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onClick={e => e.stopPropagation()}
                          onChange={() => toggleSelect(c.id)}
                          className="accent-blue-500 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[11px] font-medium truncate ${(c.unread_replies || 0) > 0 ? 'text-[var(--text-primary)] font-semibold' : 'text-[var(--text-primary)]'}`}>
                              {c.customer_name || c.customer_email || '(No sender)'}
                            </span>
                            {(c.unread_replies || 0) > 0 && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 flex-shrink-0" />}
                          </div>
                          <p className="text-[11px] text-[var(--text-secondary)] truncate mt-0.5">{c.subject}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <CategoryBadge category={c.category} />
                            <StatusBadge status={c.status} />
                            <span className="ml-auto text-[9px] text-[var(--text-muted)]">{fmtDate(c.updated_at)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* List toolbar (selection-aware) */}
          <div className="shrink-0 border-t border-[var(--border-color)] p-2 flex items-center gap-1.5 flex-wrap">
            {selectedIds.size > 0 && (
              <>
                <button onClick={() => patchConversations('mark_read', Array.from(selectedIds))} disabled={busy !== null} className={iconBtnCls} title="Mark Read"><MailOpen size={13} /></button>
                <button onClick={() => patchConversations('mark_unread', Array.from(selectedIds))} disabled={busy !== null} className={iconBtnCls} title="Mark Unread"><CheckCheck size={13} /></button>
                {!isTrash && (
                  <button onClick={() => softDelete(Array.from(selectedIds))} disabled={busy !== null} className={iconBtnCls} title="Move to Trash"><Trash2 size={13} /></button>
                )}
                {isTrash && (
                  <button onClick={() => patchConversations('restore', Array.from(selectedIds))} disabled={busy !== null} className={iconBtnCls} title="Restore"><ArchiveRestore size={13} /></button>
                )}
                {allowEmailDeletion && !isTrash && (
                  <button onClick={() => setShowDeleteConfirm({ ids: Array.from(selectedIds), count: selectedIds.size })}
                    title="Delete Forever" className={`${iconBtnCls} border-red-500/20 text-red-400 hover:bg-red-500/10`}><Delete size={13} /></button>
                )}
                {isTrash && conversations.length > 0 && allowEmailDeletion && (
                  <button onClick={() => setShowEmptyTrashConfirm(true)} title="Empty Trash" className={`${iconBtnCls} border-red-500/20 text-red-400 hover:bg-red-500/10`}><Trash2 size={13} /></button>
                )}
              </>
            )}
            <span className="ml-auto text-[9px] text-[var(--text-muted)]">{conversations.length} conversation{conversations.length === 1 ? '' : 's'}</span>
          </div>
        </div>
        {/* RIGHT — conversation reader */}
        <div className="flex-1 min-w-0 flex flex-col border-l border-[var(--border-color)] bg-[var(--bg-tertiary)]/5">
          {detailLoading ? (
            <div className="flex-1 flex items-center justify-center"><Loader2 className="h-5 w-5 text-blue-400 animate-spin" /></div>
          ) : !detail ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-2 text-[var(--text-muted)]">
              <AtSign size={28} className="opacity-30" />
              <p className="text-xs">Select a conversation to read it.</p>
            </div>
          ) : (
            <>
              {/* Reader header */}
              <div className="shrink-0 p-3 border-b border-[var(--border-color)]">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)] leading-snug">{detail.conversation.subject}</h3>
                    <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                      {detail.conversation.customer_name || detail.conversation.customer_email || '(No sender)'} · {detail.conversation.customer_email}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <CategoryBadge category={detail.conversation.category} />
                      <StatusBadge status={detail.conversation.status} />
                      {detail.conversation.license_key && (
                        <Badge className="text-purple-400 bg-purple-500/10"><KeySquare size={9} /> {detail.conversation.license_key}</Badge>
                      )}
                    </div>
                  </div>
                  <button onClick={openReply}
                    className="mail-action-button px-3 py-1.5 rounded-lg text-[11px] font-medium text-white flex items-center gap-1.5 shrink-0">
                    <Reply size={12} /> Reply
                  </button>
                </div>
                <div className="flex items-center gap-1 mt-2 flex-wrap">
                  <button onClick={() => patchConversation(detail.conversation.id, 'archive', 'Conversation archived')} className={iconBtnCls} title="Archive"><Archive size={12} /></button>
                  {detail.conversation.deleted_at ? (
                    <button onClick={() => restoreConversation(detail.conversation.id)} className={iconBtnCls} title="Restore from Trash"><ArchiveRestore size={12} /></button>
                  ) : (
                    <button onClick={() => softDelete(detail.conversation.id)} className={iconBtnCls} title="Move to Trash"><Trash2 size={12} /></button>
                  )}
                  {allowEmailDeletion && (
                    <button onClick={() => setShowDeleteConfirm({ ids: [detail.conversation.id], count: 1, subject: detail.conversation.subject })}
                      className={`${iconBtnCls} border-red-500/20 text-red-400 hover:bg-red-500/10`} title="Delete Forever"><Delete size={12} /></button>
                  )}
                </div>
              </div>

              {/* Reader body */}
              <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
                <div className="p-3 space-y-2">
                  {detail.messages.length === 0 ? (
                    <p className="text-[11px] text-[var(--text-muted)] p-4 text-center">No messages in this conversation.</p>
                  ) : detail.messages.map((m: any, i: number) => (
                    <div key={m.id || i}
                      className={`max-w-[88%] rounded-xl border border-[var(--border-color)] p-2.5 ${m.sender_type === 'admin' ? 'ml-auto bg-blue-500/10' : 'bg-[var(--bg-tertiary)]/10'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-medium text-[var(--text-primary)] truncate">{m.sender_name || m.sender_email || (m.sender_type === 'admin' ? 'You' : 'Customer')}</span>
                        <span className="ml-auto text-[9px] text-[var(--text-muted)]">{fmtDate(m.created_at)}</span>
                      </div>
                      <p className="text-[11px] text-[var(--text-secondary)] whitespace-pre-wrap break-words">{m.message}</p>
                      {m.has_attachments && attachmentsFor(detail, m.id).length > 0 && (
                        <div className="mt-2 space-y-1.5">
                          {attachmentsFor(detail, m.id).map(att => <AttachmentCard key={att.id} a={att} />)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {(detail.customer || detail.licenses.length > 0) ? (
                  <div className="mx-3 mb-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)]/50 p-3 space-y-2">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Customer</p>
                    {detail.customer && (
                      <div className="grid grid-cols-2 gap-2 text-[10px] text-[var(--text-secondary)]">
                        <span>Name: <span className="text-[var(--text-primary)]">{detail.customer.name || '—'}</span></span>
                        <span>Company: <span className="text-[var(--text-primary)]">{detail.customer.company || '—'}</span></span>
                        <span>Email: <span className="text-[var(--text-primary)]">{detail.customer.email || '—'}</span></span>
                        <span>Country: <span className="text-[var(--text-primary)]">{detail.customer.country || '—'}</span></span>
                      </div>
                    )}
                    {detail.licenses.length > 0 && (
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">Licenses</p>
                        <div className="space-y-1">
                          {detail.licenses.slice(0, 3).map((lc: any, i: number) => (
                            <div key={i} className="flex items-center gap-2 text-[10px]">
                              <KeySquare size={10} className="text-purple-400 flex-shrink-0" />
                              <span className="truncate font-mono text-[var(--text-primary)]">{lc.license_key}</span>
                              <Badge className="text-purple-400 bg-purple-500/10">{lc.plan_name || lc.product_name}</Badge>
                              <span className="ml-auto text-[var(--text-muted)]">{lc.status}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Toast — always above open modals */}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-[100] flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm shadow-2xl shadow-black/40 ${
          toast.type === 'ok' ? 'border-green-500/30 bg-[var(--bg-secondary)] text-green-400' : toast.type === 'warn' ? 'border-amber-500/30 bg-[var(--bg-secondary)] text-amber-400' : 'border-red-500/30 bg-[var(--bg-secondary)] text-red-400'
        }`}>
          {toast.type === 'ok' ? <CheckCheck size={14} /> : toast.type === 'warn' ? <AlertTriangle size={14} /> : <Ban size={14} />}
          <span className="text-xs">{toast.text}</span>
        </div>
      )}

      {/* Reply / New Email via the shared UniversalEmailDialog */}
      <UniversalEmailDialog
        isOpen={emailDialog.isOpen}
        onClose={() => setEmailDialog({ isOpen: false })}
        onSent={() => { setEmailDialog({ isOpen: false }); refreshConversations(); }}
        defaultEmail={emailDialog.defaultEmail}
        defaultRecipientName={emailDialog.defaultRecipientName}
        defaultLicenseKey={emailDialog.defaultLicenseKey}
        defaultProductId={emailDialog.defaultProductId}
        defaultAction={emailDialog.defaultAction}
        conversationId={emailDialog.conversationId}
        defaultSubject={emailDialog.defaultSubject}
        fromAccounts={emailDialog.fromAccounts}
        defaultFromId={emailDialog.defaultFromId}
      />

      {/* Add / Edit Mailbox modal */}
      {showMailboxForm && (
        <Modal title={editingMailbox ? 'Edit Mailbox' : 'Add Mail'} onClose={() => { setShowMailboxForm(false); setEditingMailbox(null); }} wide>
          <div className="space-y-3">
            <Field label="Provider">
              <select value={mailboxForm.provider} onChange={e => handleProviderChange(e.target.value)}
                className={inputCls}>
                <option value="auto">Auto-detect from email</option>
                {PROVIDER_PRESETS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
            </Field>

            <Field label="Mail Address">
              <input type="email" name="mailbox-email" autoComplete="off" value={mailboxForm.email_address}
                onChange={e => handleEmailChange(e.target.value)}
                placeholder="name@domain.com" className={inputCls} />
            </Field>

            <Field label="Display Name">
              <input type="text" name="mailbox-display-name" autoComplete="off" value={mailboxForm.display_name}
                onChange={e => setMailboxForm((prev: any) => ({ ...prev, display_name: e.target.value }))}
                placeholder="e.g. Support Team" className={inputCls} />
            </Field>

            {/* Provider help — only after a provider is detected/selected */}
            {mailboxForm.provider && mailboxForm.provider !== 'custom' && (
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-2.5 text-[10px] text-[var(--text-secondary)] space-y-1">
                <p>{providerHelp.note}</p>
                <a href="https://support.google.com/accounts/answer/185833" target="_blank" rel="noopener noreferrer"
                  className="text-blue-400 hover:underline inline-flex items-center gap-1">
                  Generate an app password <ExternalLink size={9} />
                </a>
              </div>
            )}

            <div className="rounded-lg border border-dashed border-[var(--border-color)] p-3 space-y-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Incoming Mail (IMAP)</p>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Server">
                  <input type="text" name="mailbox-imap-host" autoComplete="off" value={mailboxForm.imap_host}
                    onChange={e => setMailboxForm((prev: any) => ({ ...prev, imap_host: e.target.value }))}
                    placeholder="imap.example.com" className={inputCls} />
                </Field>
                <Field label="Port">
                  <input type="number" name="mailbox-imap-port" autoComplete="off" value={mailboxForm.imap_port}
                    onChange={e => setMailboxForm((prev: any) => ({ ...prev, imap_port: Number(e.target.value) }))}
                    className={inputCls} />
                </Field>
              </div>
              <div className="flex items-stretch gap-2">
                <Field label="Username">
                  <input type="text" name="mailbox-imap-username" autoComplete="off" value={mailboxForm.imap_username}
                    onChange={e => setMailboxForm((prev: any) => ({ ...prev, imap_username: e.target.value }))}
                    placeholder="user@example.com" className={inputCls} />
                </Field>
                <Field label="Password">
                  <div className="relative">
                    <input type={showImapPass ? 'text' : 'password'} name="mailbox-imap-password" autoComplete="new-password"
                      value={mailboxForm.imap_password}
                      onChange={e => handleImapPassword(e.target.value)}
                      placeholder={editingMailbox ? 'Unchanged' : '••••••••'}
                      className={`${inputCls} pr-8`} />
                    <button type="button" onClick={() => setShowImapPass(v => !v)}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                      {showImapPass ? <EyeOff size={12} /> : <Eye size={12} />}
                    </button>
                  </div>
                </Field>
              </div>
              <label className="flex items-center gap-2 text-[10px] text-[var(--text-secondary)]">
                <input type="checkbox" name="mailbox-imap-secure" checked={mailboxForm.imap_secure !== false}
                  onChange={e => setMailboxForm((prev: any) => ({ ...prev, imap_secure: e.target.checked }))} />
                Use SSL/TLS
              </label>
            </div>

            <div className="rounded-lg border border-dashed border-[var(--border-color)] p-3 space-y-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Outgoing Mail (SMTP)</p>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Server">
                  <input type="text" name="mailbox-smtp-host" autoComplete="off" value={mailboxForm.smtp_host}
                    onChange={e => setMailboxForm((prev: any) => ({ ...prev, smtp_host: e.target.value }))}
                    placeholder="smtp.example.com" className={inputCls} />
                </Field>
                <Field label="Port">
                  <input type="number" name="mailbox-smtp-port" autoComplete="off" value={mailboxForm.smtp_port}
                    onChange={e => setMailboxForm((prev: any) => ({ ...prev, smtp_port: Number(e.target.value) }))}
                    className={inputCls} />
                </Field>
              </div>
              <div className="flex items-stretch gap-2">
                <Field label="Username">
                  <input type="text" name="mailbox-smtp-username" autoComplete="off" value={mailboxForm.smtp_username}
                    onChange={e => setMailboxForm((prev: any) => ({ ...prev, smtp_username: e.target.value }))}
                    placeholder="user@example.com" className={inputCls} />
                </Field>
                <Field label="Password">
                  <div className="relative">
                    <input type={showSmtpPass ? 'text' : 'password'} name="mailbox-smtp-password" autoComplete="new-password"
                      value={mailboxForm.smtp_password}
                      onChange={e => setMailboxForm((prev: any) => ({ ...prev, smtp_password: e.target.value }))}
                      placeholder={editingMailbox ? 'Unchanged' : '••••••••'}
                      className={`${inputCls} pr-8`} />
                    <button type="button" onClick={() => setShowSmtpPass(v => !v)}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                      {showSmtpPass ? <EyeOff size={12} /> : <Eye size={12} />}
                    </button>
                  </div>
                </Field>
              </div>
              <label className="flex items-center gap-2 text-[10px] text-[var(--text-secondary)]">
                <input type="checkbox" name="mailbox-smtp-secure" checked={mailboxForm.smtp_secure !== false}
                  onChange={e => setMailboxForm((prev: any) => ({ ...prev, smtp_secure: e.target.checked }))} />
                Use SSL/TLS
              </label>
            </div>

            {/* Connection tests */}
            <div className="flex items-center gap-2">
              <button onClick={() => testMailboxForm('imap')} disabled={mailboxTest.running}
                className="px-2.5 py-1.5 rounded-lg border border-[var(--border-color)] text-[10px] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 disabled:opacity-50 flex items-center gap-1">
                {mailboxTest.running ? <Loader2 size={11} className="animate-spin" /> : <Wifi size={11} />} Test Incoming
              </button>
              <button onClick={() => testMailboxForm('smtp')} disabled={mailboxTest.running}
                className="px-2.5 py-1.5 rounded-lg border border-[var(--border-color)] text-[10px] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 disabled:opacity-50 flex items-center gap-1">
                {mailboxTest.running ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />} Test Outgoing
              </button>
              <button onClick={() => testMailboxForm('both')} disabled={mailboxTest.running}
                className="px-2.5 py-1.5 rounded-lg border border-blue-500/30 text-[10px] text-blue-400 hover:bg-blue-500/10 disabled:opacity-50 flex items-center gap-1">
                {mailboxTest.running ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />} Test Connection
              </button>
            </div>

            {mailboxTest.results && (
              <div className="space-y-1 text-[10px]">
                {mailboxTest.results.imap && (
                  <p className={mailboxTest.results.imap.connected ? 'text-green-400' : 'text-red-400'}>
                    IMAP: {mailboxTest.results.imap.connected ? 'Connected' : mailboxTest.results.imap.error || 'failed'}
                  </p>
                )}
                {mailboxTest.results.smtp && (
                  <p className={mailboxTest.results.smtp.connected ? 'text-green-400' : 'text-red-400'}>
                    SMTP: {mailboxTest.results.smtp.connected ? 'Connected' : mailboxTest.results.smtp.error || 'failed'}
                  </p>
                )}
              </div>
            )}

            {mailboxFormError && (
              <p className="text-[10px] text-red-400 break-words rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2">{mailboxFormError}</p>
            )}
          </div>

          <div className="flex gap-2 px-5 py-4 border-t border-[var(--border-color)] mt-3 -mx-5 -mb-5 bg-[var(--bg-secondary)] rounded-b-2xl">
            <button onClick={saveMailboxForm} disabled={busy === 'save-mailbox'}
              className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {busy === 'save-mailbox' ? <><Loader2 size={13} className="animate-spin" /> {editingMailbox ? 'Saving changes...' : 'Creating mailbox...'}</> : <><Save size={13} /> {editingMailbox ? 'Save Mailbox' : 'Create Mailbox'}</>}
            </button>
            <button onClick={() => { setShowMailboxForm(false); setEditingMailbox(null); }}
              className="px-4 py-2 rounded-lg border border-[var(--border-color)] text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 transition-colors">Cancel</button>
          </div>
        </Modal>
      )}

      {/* Remove mailbox confirm */}
      {showDeleteMailboxConfirm && (
        <Modal title="Remove Mailbox" onClose={() => setShowDeleteMailboxConfirm(null)}>
          <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
            This permanently removes the mailbox integration and deletes every conversation synced from it
            (messages, attachments, drafts, sync history) along with its IMAP/SMTP credentials. This action cannot be undone.
          </p>
          <div className="flex gap-2 pt-4">
            <button onClick={() => deleteMailbox(showDeleteMailboxConfirm)} disabled={busy === `delete:${showDeleteMailboxConfirm}`}
              className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {busy === `delete:${showDeleteMailboxConfirm}` ? <><Loader2 size={13} className="animate-spin" /> Removing...</> : <><Ban size={13} /> Remove</>}
            </button>
            <button onClick={() => setShowDeleteMailboxConfirm(null)} className="px-4 py-2 rounded-lg border border-[var(--border-color)] text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 transition-colors">Cancel</button>
          </div>
        </Modal>
      )}

      {/* Permanent delete confirm */}
      {showDeleteConfirm && (
        <Modal title={showDeleteConfirm.count === 1 ? 'Delete Conversation?' : `Delete ${showDeleteConfirm.count} Conversations?`} onClose={() => setShowDeleteConfirm(null)}>
          <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
            {showDeleteConfirm.count === 1
              ? <>This will permanently delete <span className="text-[var(--text-primary)] font-medium">&ldquo;{showDeleteConfirm.subject || 'this conversation'}&rdquo;</span> and all related email data — messages, metadata, drafts/replies and unused attachments. This action cannot be undone.</>
              : <>This will permanently delete <span className="text-[var(--text-primary)] font-medium">{showDeleteConfirm.count} conversations</span> and all related email data. This action cannot be undone.</>}
          </p>
          <div className="flex gap-2 pt-4">
            <button onClick={() => permanentlyDelete(showDeleteConfirm.ids, showDeleteConfirm.count)} disabled={busy === 'permanent-delete'}
              className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {busy === 'permanent-delete' ? <><Loader2 size={13} className="animate-spin" /> Deleting...</> : <><Delete size={13} /> Delete Forever</>}
            </button>
            <button onClick={() => setShowDeleteConfirm(null)} disabled={busy === 'permanent-delete'}
              className="px-4 py-2 rounded-lg border border-[var(--border-color)] text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 transition-colors">Cancel</button>
          </div>
        </Modal>
      )}

      {/* Empty trash confirm */}
      {showEmptyTrashConfirm && (
        <Modal title="Empty Trash" onClose={() => setShowEmptyTrashConfirm(false)}>
          <p className="text-[11px] text-[var(--text-secondary)]">
            Permanently delete all {conversations.length} conversation(s) currently in this Trash — messages, attachments and queue records? This cannot be undone.
          </p>
          <div className="flex gap-2 pt-4">
            <button onClick={emptyTrash} disabled={busy === 'permanent-delete'}
              className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {busy === 'permanent-delete' ? <><Loader2 size={13} className="animate-spin" /> Emptying...</> : <><Trash2 size={13} /> Empty Trash</>}
            </button>
            <button onClick={() => setShowEmptyTrashConfirm(false)} className="px-4 py-2 rounded-lg border border-[var(--border-color)] text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 transition-colors">Cancel</button>
          </div>
        </Modal>
      )}

      {/* Send test email modal */}
      {showTestEmail && (
        <Modal title="Send Test Email" onClose={() => { setShowTestEmail(null); setTestEmailTo(''); }}>
          <p className="text-[11px] text-[var(--text-secondary)] mb-2">
            Send a test email through <span className="text-[var(--text-primary)]">{selectedMailbox?.email_address}</span> to verify the SMTP configuration.
          </p>
          <Field label="Recipient">
            <input type="email" name="test-email-to" autoComplete="off" value={testEmailTo}
              onChange={e => setTestEmailTo(e.target.value)} placeholder="you@example.com" className={inputCls} />
          </Field>
          <div className="flex gap-2 pt-4">
            <button onClick={sendTestMailboxEmail} disabled={busy === `send-test:${showTestEmail}` || !testEmailTo.trim()}
              className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {busy === `send-test:${showTestEmail}` ? <><Loader2 size={13} className="animate-spin" /> Sending...</> : <><Send size={13} /> Send Test Email</>}
            </button>
            <button onClick={() => { setShowTestEmail(null); setTestEmailTo(''); }}
              className="px-4 py-2 rounded-lg border border-[var(--border-color)] text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 transition-colors">Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ---- Reader helpers (module scope) ----
function attachmentsFor(detail: DetailData | null, messageId: string): AttachmentRow[] {
  if (!detail) return [];
  return detail.attachments.filter(a => a.message_id === messageId);
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

const fileExtOf = (name: string): string => {
  const i = (name || '').lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1) : '';
};

const typeLabelOf = (name: string, mime: string): string => {
  const ext = fileExtOf(name).toUpperCase();
  if (ext && ext.length <= 5) return ext;
  const m = (mime || '').split(';')[0].split('/');
  return m.length === 2 ? m[1].toUpperCase() || 'FILE' : 'FILE';
};

const typeIconOf = (name: string, mime: string): any => {
  const ext = fileExtOf(name).toLowerCase();
  const m = (mime || '').toLowerCase();
  if (m.startsWith('image/')) return FileImage;
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(ext) || m.includes('zip') || m.includes('compressed') || m.includes('tar')) return FileArchive;
  if (['xls', 'xlsx', 'ods'].includes(ext) || m.includes('spreadsheet') || m.includes('excel') || m.includes('csv')) return FileSpreadsheet;
  if (['ppt', 'pptx', 'odp'].includes(ext) || m.includes('presentation') || m.includes('powerpoint')) return Presentation;
  if (ext === 'json' || m.includes('json')) return FileJson;
  if (['xml', 'html', 'htm', 'css', 'js', 'ts', 'py', 'sh', 'md', 'yaml', 'yml', 'sql', 'log'].includes(ext) || m.includes('xml')) return FileCode;
  if (['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma'].includes(ext) || m.startsWith('audio/')) return FileAudio;
  if (['mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv', 'flv'].includes(ext) || m.startsWith('video/')) return FileVideo;
  if (['doc', 'docx', 'rtf', 'odt', 'txt', 'log', 'md'].includes(ext) || m.includes('word') || m.includes('document') || m.startsWith('text/')) return FileText;
  if (ext === 'pdf' || m.includes('pdf')) return FileText;
  return FileType;
};

function AttachmentCard({ a }: { a: AttachmentRow }) {
  // Download through the internal DB-backed attachment route (durable bytes on
  // serverless); fall back to the legacy public path for old rows.
  const href = a.id ? `${API_BASE}/attachments/${a.id}` : attachmentUrl(a.storage_path || '');
  const Icon = typeIconOf(a.file_name, a.mime_type);
  const label = typeLabelOf(a.file_name, a.mime_type);
  return (
    <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 p-2">
      <div className="flex items-center gap-2 min-w-0">
        <div className="p-1.5 rounded-lg bg-[var(--bg-tertiary)]/40 text-[var(--text-secondary)] flex-shrink-0">
          <Icon size={12} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-medium text-[var(--text-primary)] truncate">{a.file_name}</p>
          <p className="text-[9px] text-[var(--text-muted)] truncate">{label} · {formatSize(a.file_size)}</p>
        </div>
        <a href={href} download={a.file_name} title="Download"
          className="p-1.5 rounded-lg hover:bg-blue-500/10 text-blue-400 transition-colors">
          <Download size={11} />
        </a>
      </div>
    </div>
  );
}