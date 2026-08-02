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

type ViewKind = 'list' | 'queue' | 'logs' | 'history' | 'mailboxes' | 'empty';

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

export default function CommunicationsPage() {
  const [stats, setStats] = useState<Stats>({ inbox: 0, sent: 0, waiting: 0, failed: 0, queued: 0, unread: 0 });
  const [activeFolder, setActiveFolder] = useState<string>('ext-inbox');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

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
  const [showTrashConfirm, setShowTrashConfirm] = useState(false);
  const [showDeleteMailboxConfirm, setShowDeleteMailboxConfirm] = useState<string | null>(null);
  const [testEmailTo, setTestEmailTo] = useState('');

  const activeFolderDef = useMemo(() => FOLDERS.find(f => f.key === activeFolder) || FOLDERS[0], [activeFolder]);
  const isTrash = activeFolder === 'ext-trash';

  const showToast = useCallback((type: 'ok' | 'err', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  }, []);

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

  // Client-driven auto-sync (no cron on serverless): process queue + pull IMAP
  // for every enabled mailbox once per minute while the page is visible.
  useEffect(() => {
    const runAutoSync = async () => {
      if (document.hidden) return;
      try {
        const token = localStorage.getItem("api_center_token");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        await fetch(`${API_BASE}/queue/process`, { method: 'POST', headers });
        const mbRes = await fetch(`${MB_BASE}`, { headers });
        const mbJson = await mbRes.json();
        const enabled = (mbJson.data?.mailboxes || []).filter((m: any) => m.is_enabled);
        await Promise.all(enabled.map((m: any) =>
          fetch(`${MB_BASE}/${m.id}/sync`, { method: 'POST', headers }).catch(() => {})
        ));
        fetchStats();
        if (activeFolderDef.kind === 'list') loadConversations(activeFolderDef, searchQuery, statusFilter, categoryFilter);
      } catch {}
    };
    const iv = setInterval(runAutoSync, 60000);
    return () => clearInterval(iv);
  }, [activeFolderDef, searchQuery, statusFilter, categoryFilter, loadConversations, fetchStats]);

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
    const f = FOLDERS.find(x => x.key === activeFolder) || FOLDERS[0];
    if (f.kind === 'list') loadConversations(f, searchQuery, statusFilter, categoryFilter);
    else if (f.kind === 'queue') loadQueue();
    else if (f.kind === 'logs') loadLogs();
    else if (f.kind === 'history') loadHistory();
    else if (f.kind === 'mailboxes') loadMailboxes();
    fetchStats();
  }, [activeFolder, searchQuery, statusFilter, categoryFilter, loadConversations, loadQueue, loadLogs, loadHistory, loadMailboxes, fetchStats]);

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

  useEffect(() => {
    const iv = setInterval(fetchStats, 30000);
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
    setBusy('save-mailbox');
    try {
      const res = await fetch(editingMailbox ? `${MB_BASE}/${editingMailbox.id}` : `${MB_BASE}`, {
        method: editingMailbox ? 'PATCH' : 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(mailboxForm),
      });
      const json = await res.json();
      if (json.success) {
        showToast('ok', json.message || (editingMailbox ? 'Mailbox updated' : 'Mailbox created'));
        setShowMailboxForm(false);
        setEditingMailbox(null);
        setMailboxForm({});
        await loadMailboxes();
      } else {
        showToast('err', json.error?.message || json.message || 'Failed to save mailbox');
      }
    } catch {
      showToast('err', 'Failed to save mailbox');
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

  // ---- Sidebar ----
  const renderSidebar = () => (
    <aside className="w-52 flex-shrink-0 flex flex-col min-h-0 border-r border-[var(--border-color)]">
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4 scrollbar-thin">
        {(['internal', 'external'] as const).map(section => (
          <div key={section}>
            <p className="px-2 mb-1.5 text-[10px] font-bold tracking-widest text-[var(--text-muted)] uppercase">
              {section === 'internal' ? 'Internal Communications' : 'External Mailboxes'}
            </p>
            <div className="space-y-0.5">
              {FOLDERS.filter(f => f.section === section).map(folder => {
                const Icon = folder.icon;
                const active = activeFolder === folder.key;
                const badge = folder.badgeKey ? stats[folder.badgeKey] : 0;
                return (
                  <button
                    key={folder.key}
                    onClick={() => handleFolderChange(folder.key)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                      active ? 'bg-blue-500/15 text-blue-400' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <Icon size={14} className="flex-shrink-0" />
                    <span className="flex-1 text-left truncate">{folder.label}</span>
                    {badge > 0 && (
                      <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${folder.key === 'all' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-blue-500/20 text-blue-400'}`}>{badge}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );

  // ---- Center panel ----
  const renderListTable = () => {
    if (loading) return <div className="flex-1 flex items-center justify-center"><Loader2 className="h-6 w-6 text-blue-400 animate-spin" /></div>;
    if (error) return <div className="flex-1 flex flex-col items-center justify-center gap-2 text-[var(--text-muted)]"><AlertCircle className="h-6 w-6 text-red-400" /><p className="text-xs">{error}</p></div>;
    if (conversations.length === 0) return (
      <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)]">
        <Inbox size={32} className="mb-2 opacity-30" />
        <p className="text-xs">No conversations found</p>
      </div>
    );
    return (
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10 bg-[var(--bg-primary)]">
            <tr className="border-b border-[var(--border-color)] text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
              <th className="px-2 py-2 w-8">
                <input type="checkbox" checked={selectedIds.size === conversations.length && conversations.length > 0} onChange={toggleSelectAll} className="accent-blue-500" />
              </th>
              <th className="text-left px-2 py-2 w-16">Status</th>
              <th className="text-left px-2 py-2 w-32">Sender</th>
              <th className="text-left px-2 py-2 min-w-[140px]">Subject</th>
              <th className="text-left px-2 py-2 w-24">Category</th>
              <th className="text-left px-2 py-2 w-28">Customer</th>
              <th className="text-left px-2 py-2 w-24">Product</th>
              <th className="text-left px-2 py-2 w-20">Date</th>
              <th className="text-center px-2 py-2 w-10">Att</th>
              <th className="text-left px-2 py-2 w-20">Priority</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-color)]">
            {conversations.map(conv => {
              const sel = selectedIds.has(conv.id);
              const prio = priorityOf(conv.status);
              return (
                <tr
                  key={conv.id}
                  onClick={() => openDetail(conv.id)}
                  className={`cursor-pointer transition-colors ${sel ? 'bg-blue-500/10' : 'hover:bg-[var(--bg-tertiary)]/20'} ${conv.unread_replies > 0 ? 'font-medium' : ''}`}
                >
                  <td className="px-2 py-2.5" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={sel} onChange={() => toggleSelect(conv.id)} className="accent-blue-500" />
                  </td>
                  <td className="px-2 py-2.5"><StatusBadge status={conv.status} /></td>
                  <td className="px-2 py-2.5 text-[var(--text-primary)] truncate max-w-[120px]">{conv.customer_name || 'Unknown'}</td>
                  <td className="px-2 py-2.5 text-[var(--text-secondary)] truncate max-w-[220px]">
                    <span className="inline-flex items-center gap-1.5">
                      {conv.unread_replies > 0 && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />}
                      {conv.subject || '(No subject)'}
                    </span>
                  </td>
                  <td className="px-2 py-2.5"><CategoryBadge category={conv.category} /></td>
                  <td className="px-2 py-2.5 text-[var(--text-secondary)] truncate max-w-[130px]">{conv.customer_email}</td>
                  <td className="px-2 py-2.5 text-[var(--text-muted)] truncate max-w-[100px]">{conv.product_id || '-'}</td>
                  <td className="px-2 py-2.5 text-[var(--text-muted)] whitespace-nowrap">{new Date(conv.updated_at).toLocaleDateString()}</td>
                  <td className="px-2 py-2.5 text-center">
                    {conv.attachment_count > 0 ? <Paperclip size={12} className="inline text-[var(--text-secondary)]" /> : <span className="text-[var(--text-muted)]/40">-</span>}
                  </td>
                  <td className="px-2 py-2.5">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${prio.color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${prio.dot}`} /> {prio.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
        <button onClick={() => { setEditingMailbox(null); setMailboxForm({ provider: 'custom', imap_port: 993, smtp_port: 465, imap_secure: true, smtp_secure: true }); setShowMailboxForm(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors">
          <Plus size={13} /> Add Mailbox
        </button>
      </div>
    );
    return (
      <div className="flex-1 overflow-y-auto scrollbar-thin p-3">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-[var(--text-muted)]">{mailboxes.length} mailbox(es) — IMAP receive + SMTP send</p>
          <div className="flex items-center gap-1.5">
            <button onClick={syncAllMailboxes} disabled={busy === 'sync-all'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-color)] text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 transition-colors disabled:opacity-50">
              {busy === 'sync-all' ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Sync All
            </button>
            <button onClick={() => { setEditingMailbox(null); setMailboxForm({ provider: 'custom', imap_port: 993, smtp_port: 465, imap_secure: true, smtp_secure: true }); setShowMailboxForm(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors">
              <Plus size={13} /> Add Mailbox
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2">
          {mailboxes.map(mb => (
            <button
              key={mb.id}
              onClick={() => loadMailboxDetail(mb.id)}
              className={`text-left rounded-xl border p-3 transition-colors ${selectedMailbox?.id === mb.id ? 'border-blue-500/40 bg-blue-500/10' : 'border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 hover:bg-[var(--bg-tertiary)]/20'}`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${mb.is_enabled ? 'bg-green-400' : 'bg-gray-400'}`} />
                <span className="text-xs font-medium text-[var(--text-primary)] truncate">{mb.display_name || mb.email_address}</span>
                {mb.is_default_sender && <Badge className="text-blue-400 bg-blue-500/10">Default Sender</Badge>}
                <span className="ml-auto flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
                  {mb.connection_status === 'connected' ? 'Connected' : (mb.connection_status || 'Unknown')}
                  {mb.sync_status === 'syncing' && <Loader2 size={10} className="animate-spin text-blue-400" />}
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] truncate mt-1">{mb.email_address}</p>
              <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{mb.provider} · IMAP {mb.imap_host}:{mb.imap_port} · SMTP {mb.smtp_host}:{mb.smtp_port}</p>
            </button>
          ))}
        </div>
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
            signature: mb.signature, is_enabled: mb.is_enabled,
          }); setShowMailboxForm(true); }}
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
      case 'empty': return <div className="flex-1" />;
      default: return renderConversationDetail();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] gap-2">
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
        <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm shadow-2xl shadow-black/40 ${
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
        defaultEmail={emailDialog.defaultEmail}
        defaultLicenseKey={emailDialog.defaultLicenseKey}
        defaultProductId={emailDialog.defaultProductId}
        defaultProductName={emailDialog.defaultProductName}
        defaultAction={emailDialog.defaultAction}
      />

      {/* Mailbox form modal */}
      {showMailboxForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] w-[560px] max-w-full mx-4 max-h-[90vh] overflow-y-auto scrollbar-thin">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)] sticky top-0 bg-[var(--bg-secondary)] z-10">
              <h2 className="text-base font-semibold text-[var(--text-primary)]">{editingMailbox ? 'Edit Mailbox' : 'Add Mailbox'}</h2>
              <button onClick={() => { setShowMailboxForm(false); setEditingMailbox(null); }} className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)]/50 text-[var(--text-muted)] transition-colors"><X size={15} /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Provider">
                  <select value={mailboxForm.provider || 'custom'} onChange={e => setMailboxForm({ ...mailboxForm, provider: e.target.value })}
                    className={inputCls}>
                    <option value="gmail">Gmail / Google Workspace</option>
                    <option value="outlook">Outlook / Microsoft 365</option>
                    <option value="yahoo">Yahoo</option>
                    <option value="zoho">Zoho</option>
                    <option value="custom">Custom / Other</option>
                  </select>
                </Field>
                <Field label="Email Address *">
                  <input type="email" value={mailboxForm.email_address || ''} onChange={e => setMailboxForm({ ...mailboxForm, email_address: e.target.value })}
                    className={inputCls} placeholder="support@yourdomain.com" />
                </Field>
              </div>
              <Field label="Display Name">
                <input type="text" value={mailboxForm.display_name || ''} onChange={e => setMailboxForm({ ...mailboxForm, display_name: e.target.value })}
                  className={inputCls} placeholder="Support Team" />
              </Field>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] pt-1">IMAP (receive)</p>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Host *"><input type="text" value={mailboxForm.imap_host || ''} onChange={e => setMailboxForm({ ...mailboxForm, imap_host: e.target.value })} className={inputCls} placeholder="imap.example.com" /></Field>
                <Field label="Port">
                  <input type="number" value={mailboxForm.imap_port ?? 993} onChange={e => setMailboxForm({ ...mailboxForm, imap_port: parseInt(e.target.value) || 993 })} className={inputCls} />
                </Field>
                <Field label="Secure">
                  <select value={mailboxForm.imap_secure !== false ? 'true' : 'false'} onChange={e => setMailboxForm({ ...mailboxForm, imap_secure: e.target.value === 'true' })} className={inputCls}>
                    <option value="true">SSL / TLS</option>
                    <option value="false">None</option>
                  </select>
                </Field>
                <Field label="Username *"><input type="text" value={mailboxForm.imap_username || ''} onChange={e => setMailboxForm({ ...mailboxForm, imap_username: e.target.value })} className={inputCls} placeholder="user@example.com" /></Field>
                <Field label="Password *"><input type="password" value={mailboxForm.imap_password || ''} onChange={e => setMailboxForm({ ...mailboxForm, imap_password: e.target.value })} className={inputCls} placeholder={editingMailbox ? '•••••••• (unchanged)' : ''} /></Field>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] pt-1">SMTP (send)</p>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Host *"><input type="text" value={mailboxForm.smtp_host || ''} onChange={e => setMailboxForm({ ...mailboxForm, smtp_host: e.target.value })} className={inputCls} placeholder="smtp.example.com" /></Field>
                <Field label="Port">
                  <input type="number" value={mailboxForm.smtp_port ?? 465} onChange={e => setMailboxForm({ ...mailboxForm, smtp_port: parseInt(e.target.value) || 465 })} className={inputCls} />
                </Field>
                <Field label="Secure">
                  <select value={mailboxForm.smtp_secure !== false ? 'true' : 'false'} onChange={e => setMailboxForm({ ...mailboxForm, smtp_secure: e.target.value === 'true' })} className={inputCls}>
                    <option value="true">SSL / TLS</option>
                    <option value="false">None</option>
                  </select>
                </Field>
                <Field label="Username *"><input type="text" value={mailboxForm.smtp_username || ''} onChange={e => setMailboxForm({ ...mailboxForm, smtp_username: e.target.value })} className={inputCls} /></Field>
                <Field label="Password *"><input type="password" value={mailboxForm.smtp_password || ''} onChange={e => setMailboxForm({ ...mailboxForm, smtp_password: e.target.value })} className={inputCls} placeholder={editingMailbox ? '•••••••• (unchanged)' : ''} /></Field>
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
              {error && <p className="text-xs text-red-400">{error}</p>}
            </div>
            <div className="flex gap-2 px-5 py-4 border-t border-[var(--border-color)] sticky bottom-0 bg-[var(--bg-secondary)]">
              <button onClick={saveMailbox} disabled={busy === 'save-mailbox'}
                className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {busy === 'save-mailbox' ? <><Loader2 size={13} className="animate-spin" /> Saving...</> : <><Save size={13} /> {editingMailbox ? 'Save Changes' : 'Create Mailbox'}</>}
              </button>
              <button onClick={() => { setShowMailboxForm(false); setEditingMailbox(null); }}
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
