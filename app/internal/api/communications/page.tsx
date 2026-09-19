"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Mail, Send, Inbox, AlertTriangle, MessageSquare, FileText,
  Settings, Clock, RefreshCw, Loader2, Search, Filter,
  CheckCircle2, XCircle, Clock3, AlertCircle,
  Trash2, Users, CreditCard, KeyRound, Activity,
  HelpCircle, ShoppingBag, RotateCcw, Delete,
  Plus, Pencil, Paperclip, Flag, Archive, Reply, ReplyAll,
  Forward, CheckCheck, MailOpen, AtSign, LifeBuoy, FlaskConical,
  Package, BellRing, ShieldAlert, FilePen, Server, Plug,
  Database, Wrench, History as HistoryIcon, Download, X,
  ArchiveRestore, MailX, Eye,
  BookOpen, Ban, Smartphone, Save,
  Folder, FolderPlus, FolderOpen, FolderCog,
  Sparkles, ShieldCheck, Wifi, KeySquare,
  FileImage, FileArchive, FileSpreadsheet, Presentation, FileJson,
  FileCode, FileAudio, FileVideo, FileType,
  Signature, ExternalLink, EyeOff, StickyNote, PenLine, BookMarked, Zap,
  ChevronDown,
} from "lucide-react";
import UniversalEmailDialog from "@/components/internal-api/UniversalEmailDialog";

const API_BASE = "/internal/backend/communications";
const MB_BASE = "/internal/backend/mailboxes";
const TEMPLATES_BASE = "/internal/backend/admin/email/templates";
const REPLY_BASE = "/internal/backend/admin/communication/reply";

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

// Unified mail-account identity used by the From dropdown and the receiving-
// account context in the reader. Always derived from the real configured
// accounts (system mail_accounts + external mailboxes) — never hardcoded.
interface MailSenderAccount {
  id: string;
  kind: 'system' | 'mailbox';
  display_name: string;
  email: string;
  is_active: boolean;
  is_default: boolean;
  type?: string;
}

const buildSenderAccounts = (commSettings: any, mailboxes: Mailbox[]): MailSenderAccount[] => {
  const accounts: MailSenderAccount[] = [];
  for (const a of (commSettings?.mail_accounts || [])) {
    if (!a?.id) continue;
    accounts.push({
      id: String(a.id),
      kind: 'system',
      display_name: a.display_name || a.name || '',
      email: a.email || '',
      is_active: a.is_active !== false,
      is_default: !!a.is_default_sender,
      type: a.type,
    });
  }
  for (const mb of mailboxes) {
    accounts.push({
      id: mb.id,
      kind: 'mailbox',
      display_name: mb.display_name || '',
      email: mb.email_address || '',
      is_active: mb.is_enabled !== false,
      is_default: !!mb.is_default_sender,
      type: mb.provider,
    });
  }
  return accounts;
};

const defaultSenderId = (accounts: MailSenderAccount[]): string =>
  accounts.find(a => a.is_default && a.is_active)?.id
  || accounts.find(a => a.is_active)?.id
  || accounts[0]?.id || '';

// Default sender for interactive mail (Compose / Reply / Forward): never the
// transactional no-reply account — it is reserved for automated system mail
// (OTP, license, payment, notifications). Falls back to any active account
// only when no human-facing sender exists.
const interactiveSenderId = (accounts: MailSenderAccount[]): string => {
  const interactive = accounts.filter(a => a.is_active && a.type !== 'no_reply' && a.type !== 'no-reply');
  return interactive.find(a => a.is_default)?.id
    || interactive[0]?.id
    || defaultSenderId(accounts);
};

// Category routing per system account — mirrors the documented routing
// (support_categories / sales_categories / general), used to derive the
// receiving account of a conversation that has no mailbox integration.
const systemAccountCategories = (commSettings: any, acct: any): string[] => {
  const routing = commSettings?.routing || {};
  if (acct?.type === 'support') return routing.support_categories || ['support', 'activation', 'renewal', 'reactivation', 'hardware_replacement', 'general'];
  if (acct?.type === 'sales') return routing.sales_categories || ['sales'];
  return ['general'];
};

// The mail account a conversation was received in: a mailbox integration wins
// (conv.mailbox_id), otherwise the system account that owns the category.
const accountForConversation = (
  conv: any,
  commSettings: any,
  mailboxes: Mailbox[]
): MailSenderAccount | null => {
  const all = buildSenderAccounts(commSettings, mailboxes);
  const enabled = all.filter(a => {
    if (a.kind === 'system') return a.is_active !== false;
    if (a.kind === 'mailbox') return mailboxes.find(m => m.id === a.id)?.is_enabled !== false;
    return true;
  });
  if (conv?.mailbox_id) {
    const mb = enabled.find(a => a.kind === 'mailbox' && a.id === conv.mailbox_id);
    if (mb) return mb;
  }
  const system = enabled.filter(a => a.kind === 'system');
  for (const a of system) {
    const acct = (commSettings?.mail_accounts || []).find((x: any) => String(x.id) === a.id);
    if (systemAccountCategories(commSettings, acct).includes(conv?.category)) return a;
  }
  return system.find(a => a.is_active) || system[0] || null;
};

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
  trash: number;
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

interface EmailTemplate {
  email_type: string;
  subject: string;
  body: string;
  plain_text: string;
  is_active: boolean;
  updated_at: string;
}

interface SignatureItem {
  id: string;
  name: string;
  content: string;
  is_default: boolean;
  enabled: boolean;
}

type ViewKind = 'list' | 'queue' | 'logs' | 'history' | 'mailboxes' | 'settings' | 'templates' | 'signatures' | 'auto-reply' | 'empty';

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
  // Sent — a real outbound view STRICTLY scoped to this section: a conversation
  // qualifies when it carries a delivered admin email (the same real "Sent"
  // filter as the Mail Sent folder), and the default source restriction applies
  // so Categories/Labels Sent lists SYSTEM sent mail (mailbox_id IS NULL) only.
  { key: 'sent', label: 'Sent', icon: Send, section: 'internal', kind: 'list', params: { sent: 'true' }, badgeKey: 'sent' },
  { key: 'notifications', label: 'Notifications', icon: BellRing, section: 'internal', kind: 'logs' },
  { key: 'email-history', label: 'Universal Email', icon: MailOpen, section: 'internal', kind: 'history' },
  { key: 'int-trash', label: 'Trash', icon: Trash2, section: 'internal', kind: 'list', params: { show_deleted: 'true' }, badgeKey: 'trash' },

  // External Mailboxes
  { key: 'ext-inbox', label: 'Inbox', icon: Inbox, section: 'external', kind: 'list', params: { status: 'open,waiting_customer' }, badgeKey: 'inbox' },
  { key: 'ext-sent', label: 'Sent', icon: Send, section: 'external', kind: 'list', params: { sent: 'true' }, badgeKey: 'sent' },
  { key: 'ext-draft', label: 'Draft', icon: FilePen, section: 'external', kind: 'list', params: { status: 'draft' }, emptyNote: 'Draft support is not wired to the backend yet — outbound emails are sent immediately and tracked in Sent / Universal Email.' },
  { key: 'ext-waiting', label: 'Waiting', icon: Clock3, section: 'external', kind: 'list', params: { status: 'waiting_customer' }, badgeKey: 'waiting' },
  { key: 'ext-failed', label: 'Failed', icon: AlertTriangle, section: 'external', kind: 'list', params: { status: 'waiting_support,waiting_sales' }, badgeKey: 'failed' },
  { key: 'ext-queued', label: 'Queued', icon: Clock, section: 'external', kind: 'queue', badgeKey: 'queued' },
  { key: 'ext-spam', label: 'Spam', icon: ShieldAlert, section: 'external', kind: 'list', params: { status: 'spam' }, emptyNote: 'Spam detection is not wired to the backend yet — no spam folders are collected by the IMAP sync.' },
  { key: 'ext-trash', label: 'Trash', icon: Trash2, section: 'external', kind: 'list', params: { show_deleted: 'true' }, badgeKey: 'trash' },
  { key: 'mailboxes', label: 'Mailboxes', icon: AtSign, section: 'external', kind: 'mailboxes' },
];

// Fresh mailbox form — provider presets auto-populate the server config
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

const SETTINGS_DEF: FolderDef = {
  key: 'settings',
  label: 'Communication Settings',
  icon: Settings,
  section: 'internal',
  kind: 'settings',
};

const TEMPLATES_DEF: FolderDef = { key: 'templates', label: 'Templates', icon: BookMarked, section: 'internal', kind: 'templates' };
const SIGNATURES_DEF: FolderDef = { key: 'signatures', label: 'Signatures', icon: Signature, section: 'internal', kind: 'signatures' };
const AUTO_REPLY_DEF: FolderDef = { key: 'auto-reply', label: 'Auto Reply', icon: Zap, section: 'internal', kind: 'auto-reply' };

// ---- Folder chips shown above the email list (middle pane) ----
const FOLDER_CHIPS: { key: string; label: string; badgeKey?: keyof Stats }[] = [
  { key: 'ext-inbox', label: 'Inbox', badgeKey: 'inbox' },
  { key: 'ext-waiting', label: 'Waiting', badgeKey: 'waiting' },
  { key: 'ext-sent', label: 'Sent', badgeKey: 'sent' },
  { key: 'ext-failed', label: 'Failed', badgeKey: 'failed' },
  { key: 'ext-queued', label: 'Queued', badgeKey: 'queued' },
  { key: 'all', label: 'Unread', badgeKey: 'unread' },
  { key: 'ext-draft', label: 'Drafts' },
  { key: 'ext-spam', label: 'Spam' },
  { key: 'ext-trash', label: 'Trash', badgeKey: 'trash' },
  { key: 'int-trash', label: 'Universal Trash', badgeKey: 'trash' },
];

// ---- Provider auto-configuration (single shared provider config —
// server settings + official authentication help links). UI-only; the
// backend stores a free provider string. ----
interface ProviderPreset {
  key: string;
  label: string;
  match: RegExp;
  imap: { host: string; port: number; secure: boolean };
  smtp: { host: string; port: number; secure: boolean };
  help: {
    note: string;
    appPassword?: { label: string; url: string };
    instructions?: { label: string; url: string };
  };
}

const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    key: 'gmail', label: 'Gmail / Google Workspace', match: /gmail\.com|googlemail\.com$/i,
    imap: { host: 'imap.gmail.com', port: 993, secure: true }, smtp: { host: 'smtp.gmail.com', port: 465, secure: true },
    help: {
      note: 'Gmail requires an App Password when 2-Step Verification is enabled. Use your full Gmail address as the username.',
      appPassword: { label: 'Generate Google App Password', url: 'https://support.google.com/accounts/answer/185833' },
      instructions: { label: 'Google instructions', url: 'https://support.google.com/mail/answer/7126229' },
    },
  },
  {
    key: 'outlook', label: 'Outlook / Microsoft 365', match: /outlook\.com|hotmail\.com|live\.com|msn\.com|office365\.com|outlook\.co$/i,
    imap: { host: 'outlook.office365.com', port: 993, secure: true }, smtp: { host: 'smtp.office365.com', port: 587, secure: false },
    help: {
      note: 'Microsoft may require an App Password when multi-factor authentication (MFA) is enabled on the account.',
      appPassword: { label: 'Microsoft App Password instructions', url: 'https://support.microsoft.com/en-us/accounts-billing/manage/how-to-get-and-use-app-passwords' },
    },
  },
  {
    key: 'yahoo', label: 'Yahoo Mail', match: /yahoo\.com|ymail\.com$/i,
    imap: { host: 'imap.mail.yahoo.com', port: 993, secure: true }, smtp: { host: 'smtp.mail.yahoo.com', port: 465, secure: true },
    help: {
      note: 'Yahoo requires an App Password when two-step verification is enabled on the account.',
      appPassword: { label: 'Generate Yahoo App Password', url: 'https://help.yahoo.com/kb/create-party-passwords-sln15241.html' },
      instructions: { label: 'Yahoo instructions', url: 'https://help.yahoo.com/kb/new-mail-for-desktop/SLN27791.html' },
    },
  },
  {
    key: 'zoho', label: 'Zoho Mail', match: /zohomail\.|zoho\.com$/i,
    imap: { host: 'imap.zoho.com', port: 993, secure: true }, smtp: { host: 'smtp.zoho.com', port: 465, secure: true },
    help: {
      note: 'Zoho requires an App-Specific Password when Two-Factor Authentication (2FA) is enabled for the account.',
      appPassword: { label: 'Generate Zoho App-Specific Password', url: 'https://www.zoho.com/mail/help/adminconsole/two-factor-authentication.html' },
      instructions: { label: 'Zoho IMAP/SMTP instructions', url: 'https://www.zoho.com/mail/help/imap-access.html' },
    },
  },
  {
    key: 'icloud', label: 'iCloud Mail', match: /icloud\.com|me\.com$/i,
    imap: { host: 'imap.mail.me.com', port: 993, secure: true }, smtp: { host: 'smtp.mail.me.com', port: 587, secure: false },
    help: {
      note: 'iCloud requires an App-Specific Password (generated from your Apple Account) to sign in to third-party apps.',
      appPassword: { label: 'Generate Apple App-Specific Password', url: 'https://support.apple.com/en-us/102654' },
    },
  },
  {
    key: 'fastmail', label: 'Fastmail', match: /fastmail\.(com|fm)|fastmailbox\.net$/i,
    imap: { host: 'imap.fastmail.com', port: 993, secure: true }, smtp: { host: 'smtp.fastmail.com', port: 465, secure: true },
    help: {
      note: 'Fastmail requires an App Password for every third-party mail client.',
      appPassword: { label: 'Create Fastmail App Password', url: 'https://www.fastmail.help/hc/en-us/articles/360058752854-App-passwords' },
    },
  },
  {
    key: 'proton', label: 'Proton Mail (via Bridge)', match: /proton\.(me|mail|ch)$/i,
    imap: { host: '127.0.0.1', port: 1143, secure: false }, smtp: { host: '127.0.0.1', port: 1025, secure: false },
    help: {
      note: 'Proton Mail works through the Proton Mail Bridge — use the Bridge-generated IMAP/SMTP host, port and credentials shown in the Bridge app.',
      instructions: { label: 'Proton Mail Bridge setup', url: 'https://proton.me/support/mail-bridge' },
    },
  },
  {
    key: 'custom', label: 'Custom / Other', match: /.*/,
    imap: { host: '', port: 993, secure: true }, smtp: { host: '', port: 465, secure: true },
    help: { note: 'Enter the server settings provided by your email provider.' },
  },
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

// UI display names for the built-in Websmith Mail accounts (Websmith Mail
// section in Communications Setting). Presentation-only — the backend values
// stay untouched. Keyed like MAILBOX_LABELS (id with dashes → underscores).
const SYSTEM_ACCOUNT_UI_LABELS: Record<string, string> = {
  no_reply: 'Websmith Authentications',
  support: 'Websmith Support Team',
  sales: 'Websmith Sales Team',
};

const systemAccountUiLabel = (a: any): string =>
  SYSTEM_ACCOUNT_UI_LABELS[String(a.id).replace(/-/g, '_')] || a.display_name || a.name || a.email;

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

// Status badges (spec): Connected / Syncing / Authentication Required /
// Connection Failed / Disabled.
const mailboxHealth = (mb: Mailbox): { status: 'connected' | 'failed' | 'auth_required' | 'syncing' | 'disabled' | 'unknown'; label: string; color: string } => {
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

const HEALTH_ICONS: Record<string, any> = {
  connected: Wifi, failed: AlertTriangle, auth_required: KeySquare, syncing: RefreshCw, disabled: Ban, unknown: Ban,
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

// Internal API fetches must NOT follow the proxy's 307 → login redirect: the
// browser would receive the login page HTML and res.json() would throw a
// confusing "Failed to load conversations". When the Internal API session
// (api_center_token) is missing/expired the proxy redirects to the two-step
// login — detect that redirect here and send the admin back through login
// with the current location preserved so they continue where they left off.
const internalFetch = async (url: string, init?: RequestInit): Promise<Response> => {
  const res = await fetch(url, { ...init, redirect: 'manual' });
  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get('location') || '';
    if (loc.includes('/internal/api/auth/login')) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/internal/api/auth/login?next=${next}`;
      throw new Error('Internal API session expired');
    }
  }
  return res;
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

// ---- Template helpers ----
const templateTextOf = (t: EmailTemplate | undefined | null): string => {
  if (!t) return '';
  if (t.plain_text) return t.plain_text;
  return (t.body || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

// ---- Attachment preview support (image / PDF / text) ----
type PreviewKind = 'image' | 'pdf' | 'text' | 'none';

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

const typeIconOf = (name: string, mime: string) => {
  const ext = fileExtOf(name).toLowerCase();
  const m = (mime || '').toLowerCase();
  if (m.startsWith('image/')) return FileImage;
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(ext) || m.includes('zip') || m.includes('compressed') || m.includes('tar')) return FileArchive;
  if (['xls', 'xlsx', 'ods'].includes(ext) || m.includes('spreadsheet') || m.includes('excel') || m.includes('csv')) return FileSpreadsheet;
  if (['ppt', 'pptx', 'odp'].includes(ext) || m.includes('presentation') || m.includes('powerpoint')) return Presentation;
  if (ext === 'json' || m.includes('json')) return FileJson;
  if (['xml', 'html', 'htm', 'css', 'js', 'ts', 'py', 'sh', 'md', 'yaml', 'yml', 'sql', 'log'].includes(ext) || m.includes('xml')) return FileCode;
  if (['doc', 'docx', 'rtf', 'odt', 'txt', 'log', 'md'].includes(ext) || m.includes('word') || m.includes('document') || m.startsWith('text/')) return FileText;
  if (['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma'].includes(ext) || m.startsWith('audio/')) return FileAudio;
  if (['mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv', 'flv'].includes(ext) || m.startsWith('video/')) return FileVideo;
  if (ext === 'pdf' || m.includes('pdf')) return FileText;
  return FileType;
};

const previewKindOf = (name: string, mime: string): PreviewKind => {
  const m = (mime || '').toLowerCase();
  const ext = fileExtOf(name).toLowerCase();
  if (m.startsWith('image/')) return 'image';
  if (m === 'application/pdf' || m === 'application/x-pdf' || m.endsWith('/pdf') || ext === 'pdf') return 'pdf';
  if (m.startsWith('text/') || m.includes('json') || m.includes('xml') || m.includes('csv')) return 'text';
  if (['txt', 'json', 'xml', 'csv', 'log', 'md', 'html', 'htm', 'yaml', 'yml', 'ini', 'conf', 'env', 'rtf'].includes(ext)) return 'text';
  return 'none';
};

function AttachmentPreview({ a, href, kind }: { a: AttachmentRow; href: string; kind: PreviewKind }) {
  const [text, setText] = useState<string | null>(null);
  const [textError, setTextError] = useState<string | null>(null);
  useEffect(() => {
    if (kind !== 'text') return;
    let cancelled = false;
    setText(null);
    setTextError(null);
    fetch(href)
      .then(r => { if (!r.ok) throw new Error('Failed to load'); return r.text(); })
      .then(t => { if (!cancelled) setText(t); })
      .catch(() => { if (!cancelled) setTextError('Preview could not be loaded. Use Download instead.'); });
    return () => { cancelled = true; };
  }, [href, kind]);
  return (
    <div className="mt-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] overflow-hidden">
      {kind === 'image' && <img src={href} alt={a.file_name} className="max-h-72 w-auto mx-auto object-contain" />}
      {kind === 'pdf' && <iframe src={href} title={a.file_name} className="w-full h-72" />}
      {kind === 'text' && (
        textError ? <p className="text-[10px] text-red-400 p-3">{textError}</p>
        : text === null ? <div className="p-4 flex justify-center"><Loader2 className="h-4 w-4 text-blue-400 animate-spin" /></div>
        : <pre className="max-h-72 overflow-auto p-3 text-[11px] text-[var(--text-secondary)] whitespace-pre-wrap break-words">{text}</pre>
      )}
      {kind === 'none' && <p className="text-[10px] text-[var(--text-muted)] p-3">No inline preview available for this file type.</p>}
    </div>
  );
}

function AttachmentCard({ a }: { a: AttachmentRow }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  // Download through the internal DB-backed attachment route (durable bytes on
  // serverless); fall back to the legacy public path for old rows.
  const href = a.id ? `${API_BASE}/attachments/${a.id}` : attachmentUrl(a.storage_path || '');
  const kind = previewKindOf(a.file_name, a.mime_type);
  const Icon = typeIconOf(a.file_name, a.mime_type);
  const label = typeLabelOf(a.file_name, a.mime_type);
  const toggleable = kind === 'pdf' || kind === 'text';
  return (
    <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 p-2.5">
      <div className="flex items-center gap-2 min-w-0">
        <div className={`p-1.5 rounded-lg flex-shrink-0 ${kind === 'image' ? 'bg-blue-500/10 text-blue-400' : 'bg-[var(--bg-tertiary)]/40 text-[var(--text-secondary)]'}`}>
          <Icon size={13} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium text-[var(--text-primary)] truncate">{a.file_name}</p>
          <p className="text-[9px] text-[var(--text-muted)] truncate">{label} · {formatSize(a.file_size)}</p>
        </div>
        {toggleable && (
          <button onClick={() => setPreviewOpen(p => !p)}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)]/40 text-[var(--text-secondary)] transition-colors"
            title={previewOpen ? 'Hide preview' : 'Preview'}>
            {previewOpen ? <Eye size={12} /> : <BookOpen size={12} />}
          </button>
        )}
        <a href={href} download={a.file_name} title="Download"
          className="p-1.5 rounded-lg hover:bg-blue-500/10 text-blue-400 transition-colors">
          <Download size={12} />
        </a>
      </div>
      {kind === 'image' && <AttachmentPreview a={a} href={href} kind="image" />}
      {toggleable && previewOpen && <AttachmentPreview a={a} href={href} kind={kind} />}
      {kind === 'none' && <p className="text-[9px] text-[var(--text-muted)] mt-1.5">Preview not available for this format — use Download.</p>}
    </div>
  );
}

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
  // Stats are fetched per source (system vs mailbox) so the Websmith
  // Communications badges and the Mail badges never mix counts.
  const emptyStats = { inbox: 0, sent: 0, waiting: 0, failed: 0, queued: 0, unread: 0, trash: 0 };
  const [systemStats, setSystemStats] = useState<Stats>(emptyStats);
  const [mailboxStats, setMailboxStats] = useState<Stats>(emptyStats);
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
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
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
  const [toast, setToast] = useState<{ type: 'ok' | 'err' | 'warn'; text: string } | null>(null);
  const [showFilter, setShowFilter] = useState(false);
  // Compact account-filter dropdown: narrows the current folder to ONE
  // configured account (system mail account or mailbox). "All" restores the
  // existing unfiltered behavior. Reuses accountScope so list/counts/search
  // stay consistent with the selection.
  const [accountFilterOpen, setAccountFilterOpen] = useState(false);

  const displayConversations = useMemo(() => {
    if (readFilter === 'all') return conversations;
    return conversations.filter(c => readFilter === 'unread' ? (c.unread_replies || 0) > 0 : !(c.unread_replies || 0));
  }, [conversations, readFilter]);

  const [emailDialog, setEmailDialog] = useState<{
    isOpen: boolean;
    defaultEmail?: string;
    defaultRecipientName?: string;
    defaultLicenseKey?: string;
    defaultProductId?: string;
    defaultProductName?: string;
    defaultAction?: 'send' | 'history' | 'buy-license' | 'activate' | 'renew' | 'reactivation' | 'device-replacement' | 'support' | 'general';
    fromAccounts?: MailSenderAccount[];
    defaultFromId?: string;
    conversationId?: string;
    defaultSubject?: string;
    defaultMessage?: string;
    defaultCc?: string;
    defaultBcc?: string;
  }>({ isOpen: false });

  const [showMailboxForm, setShowMailboxForm] = useState(false);
  const [editingMailbox, setEditingMailbox] = useState<Mailbox | null>(null);
  const [mailboxForm, setMailboxForm] = useState<any>({});
  const [mailboxFormError, setMailboxFormError] = useState<string | null>(null);
  const [mailboxTest, setMailboxTest] = useState<{ running: boolean; results: { imap?: { connected: boolean; error?: string }; smtp?: { connected: boolean; error?: string } } | null }>({ running: false, results: null });
  const [autoReplyDrafts, setAutoReplyDrafts] = useState<Record<string, { auto_reply_enabled: boolean; auto_reply_template_key: string; auto_reply_signature: string; auto_reply_message: string }>>({});
  const [showImapPass, setShowImapPass] = useState(false);
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [showTrashConfirm, setShowTrashConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ ids: string[]; count: number; subject?: string } | null>(null);
  const [showDeleteMailboxConfirm, setShowDeleteMailboxConfirm] = useState<string | null>(null);
  const [testEmailTo, setTestEmailTo] = useState('');
  const [testMailDraft, setTestMailDraft] = useState<Record<string, string>>({});
  const [commSettings, setCommSettings] = useState<any>(null);
  const [commSettingsLoading, setCommSettingsLoading] = useState(false);
  const [commSettingsDirty, setCommSettingsDirty] = useState(false);
  const [commMailboxes, setCommMailboxes] = useState<Mailbox[]>([]);
  const [editAccountId, setEditAccountId] = useState<string | null>(null);
  const [accountDraft, setAccountDraft] = useState<any>(null);

  // Latest-value refs: loadConversations reads these so its identity stays
  // stable — loaded data must never re-trigger the refreshCurrent effect,
  // otherwise opening the Communications Setting workspace spins an endless
  // reload loop that keeps flipping the loading flags and unmounting tabs.
  const commSettingsRef = useRef<any>(null);
  const mailboxesRef = useRef<Mailbox[]>([]);
  useEffect(() => { commSettingsRef.current = commSettings; }, [commSettings]);
  useEffect(() => { mailboxesRef.current = mailboxes; }, [mailboxes]);

  // The Settings workspace's Mailbox Status card reads commMailboxes — keep it
  // in sync with the single live mailboxes source (one fetch, no duplicates).
  useEffect(() => { setCommMailboxes(mailboxes); }, [mailboxes]);

  // Auto-sync in-flight guard: a slow IMAP sweep (mailboxes or native) must
  // never overlap with the next 2s tick — parallel syncs would pile up IMAP
  // connections and make the whole Communications Center feel slow.
  const autoSyncInFlight = useRef(false);

  // Stats in-flight guard: the 2s receive sweep and the 15s poll can overlap
  // when a sweep is slow — a second overlapping stats request is dropped, the
  // next tick picks the fresh numbers up anyway.
  const statsInFlight = useRef(false);

  // Native mail-account cache: the settings document (support/sales/no-reply
  // config) changes rarely, so the 2s receive sweep reads the cached account
  // list and only refetches the settings endpoint every 30s — one settings
  // request instead of one every 2 seconds.
  const nativeAccountsCacheRef = useRef<{ fetchedAt: number; accounts: any[] }>({ fetchedAt: 0, accounts: [] });

  // Communications Setting workspace — section navigation (single destination,
  // no duplicate sidebar entries for templates/signatures/auto-reply/mailboxes).
  type SettingsSection = 'general' | 'accounts' | 'mailboxes' | 'templates' | 'signatures' | 'auto-reply';
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('general');

  // Account-scoped mail (Mail/Websmith Mail/Mailboxes navigation) + reply From
  const [accountScope, setAccountScope] = useState<{ kind: 'system' | 'mailbox'; id: string } | null>(null);
  const [composerFromId, setComposerFromId] = useState('');

  const senderAccounts = useMemo(() => {
    const all = buildSenderAccounts(commSettings, mailboxes);
    return all.filter(a => {
      if (a.kind === 'system') return a.is_active !== false;
      if (a.kind === 'mailbox') return mailboxes.find(m => m.id === a.id)?.is_enabled !== false;
      return true;
    });
  }, [commSettings, mailboxes]);
  const scopeLabel = useMemo(() => {
    if (!accountScope) return null;
    const acct = senderAccounts.find(a => a.id === accountScope.id);
    return acct ? (acct.display_name || acct.email) : null;
  }, [accountScope, senderAccounts]);

  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [showFolderManager, setShowFolderManager] = useState(false);
  const [deletedFolders, setDeletedFolders] = useState<FolderRow[]>([]);
  const [renamingFolder, setRenamingFolder] = useState<{ id: string; name: string } | null>(null);
  const [folderForm, setFolderForm] = useState<{ name: string; section: 'internal' | 'external'; status: string; category: string; search: string }>({
    name: '', section: 'internal', status: '', category: '', search: '',
  });

  // ---- Reply composer (right pane) ----
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerText, setComposerText] = useState('');
  const [composerInternal, setComposerInternal] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);

  // ---- Templates / Signatures panels ----
  const [templateSearch, setTemplateSearch] = useState('');
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [templateDraft, setTemplateDraft] = useState<EmailTemplate | null>(null);
  const [signatureForm, setSignatureForm] = useState<{ open: boolean; id: string | null; name: string; content: string; enabled: boolean }>({ open: false, id: null, name: '', content: '', enabled: true });

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
      const res = await internalFetch(`${API_BASE}/folders`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.success) setFolders(json.data.folders || []);
      const del = await internalFetch(`${API_BASE}/folders?include_deleted=1`, { headers: getAuthHeaders() });
      const delJson = await del.json();
      if (delJson.success) setDeletedFolders((delJson.data.folders || []).filter((f: FolderRow) => f.deleted_at));
    } catch {}
  }, []);

  const activeFolderDef = useMemo((): FolderDef => {
    if (activeFolder === 'settings') return SETTINGS_DEF;
    if (activeFolder === 'templates') return TEMPLATES_DEF;
    if (activeFolder === 'signatures') return SIGNATURES_DEF;
    if (activeFolder === 'auto-reply') return AUTO_REPLY_DEF;
    const row = folders.find(f => f.id === activeFolder);
    if (row) return folderDefFor(row);
    return FOLDERS.find(f => f.key === activeFolder) || FOLDERS[0];
  }, [activeFolder, folders, folderDefFor]);
  const isTrash = activeFolder === 'ext-trash' || activeFolder === 'int-trash';

  const showToast = useCallback((type: 'ok' | 'err' | 'warn', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 5000);
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
    // Never run two overlapping stats requests — the 2s receive sweep, the
    // 15s poll and post-action refreshes all call this; overlapping responses
    // would race and could render stale counts. Dropped requests are harmless
    // because the next tick re-polls.
    if (statsInFlight.current) return;
    statsInFlight.current = true;
    // Strict source separation: systemStats = Websmith Communications mail only,
    // mailboxStats = configured mailbox mail only. Badges never mix sources.
    const systemScope = accountScope?.kind === 'system' ? accountScope : null;
    const mailboxScope = accountScope?.kind === 'mailbox' ? accountScope : null;

    const buildUrl = (source: string, scope: { kind: 'system' | 'mailbox'; id: string } | null) => {
      let url = `${API_BASE}/conversations/stats?source=${source}`;
      if (scope?.kind === 'mailbox') {
        url += `&mailbox_id=${encodeURIComponent(scope.id)}`;
      } else if (scope?.kind === 'system') {
        const acct = (commSettingsRef.current?.mail_accounts || []).find((a: any) => String(a.id) === scope.id);
        const cats = systemAccountCategories(commSettingsRef.current, acct);
        if (cats.length > 0) url += `&category=${encodeURIComponent(cats.join(','))}`;
      }
      return url;
    };

    const systemUrl = buildUrl('system', systemScope);
    const mailboxUrl = buildUrl('mailbox', mailboxScope);
    try {
      const [sysRes, mbRes] = await Promise.all([
        internalFetch(systemUrl, { headers: getAuthHeaders() }),
        internalFetch(mailboxUrl, { headers: getAuthHeaders() }),
      ]);
      const [sysJson, mbJson] = await Promise.all([sysRes.json(), mbRes.json()]);
      if (sysJson.success) setSystemStats(sysJson.data);
      if (mbJson.success) setMailboxStats(mbJson.data);
    } catch {} finally {
      statsInFlight.current = false;
    }
  }, [accountScope, commSettingsRef, mailboxesRef, showToast]);

  const loadConversations = useCallback(async (
    folder: FolderDef,
    search: string,
    statusF: string,
    categoryF: string,
    scope?: { kind: 'system' | 'mailbox'; id: string } | null,
    opts?: { silent?: boolean }
  ) => {
    // Silent refreshes (background auto-sync, post-action refresh) update the
    // list WITHOUT flipping the loading spinner — a mutation already applied
    // the change optimistically, and the 2s receive timer must never flash the
    // whole list back to "Loading..." every tick.
    const silent = opts?.silent === true;
    if (!silent) { setLoading(true); setError(null); }
    try {
      const params = new URLSearchParams();
      params.set('page', '1');
      params.set('limit', '100');
      // Strict source separation: internal (Websmith Communications) folders
      // list system mail only (mailbox_id IS NULL); external (Mail) folders
      // list configured mailbox mail only (mailbox_id IS NOT NULL). Sent is
      // NO exception — Categories/Labels Sent lists system sent mail and Mail
      // Sent lists mailbox sent mail, never mixed or shared.
      params.set('source', folder.section === 'external' ? 'mailbox' : 'system');
      if (folder.params?.status) params.set('status', folder.params.status);
      if (folder.params?.category) params.set('category', folder.params.category);
      if (folder.params?.search) params.set('search', folder.params.search);
      if (folder.params?.has_customer) params.set('has_customer', 'true');
      if (folder.params?.show_deleted) params.set('show_deleted', 'true');
      if (folder.params?.sent) params.set('sent', 'true');
      if (statusF) params.set('status', statusF);
      if (categoryF) params.set('category', categoryF);
      if (search) params.set('search', search);

      // Account-scoped mail: a mailbox narrows by its integration id; a system
      // account routes by its category list (never by a mailbox, so a system
      // account can never pull mailbox-owned mail into the system section).
      if (scope?.kind === 'mailbox') {
        params.set('mailbox_id', scope.id);
      } else if (scope?.kind === 'system') {
        const acct = (commSettingsRef.current?.mail_accounts || []).find((a: any) => String(a.id) === scope.id);
        params.set('category', systemAccountCategories(commSettingsRef.current, acct).join(','));
      }

      const res = await internalFetch(`${API_BASE}/conversations?${params.toString()}`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.success) {
        setConversations(json.data.conversations || []);
      } else if (!silent) {
        setError(json.error?.message || 'Failed to load');
      }
    } catch {
      if (!silent) setError('Failed to load conversations');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const loadQueue = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (!silent) { setLoading(true); setError(null); }
    try {
      const res = await internalFetch(`${API_BASE}/queue?limit=100`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.success) setQueue(json.data.queue || []);
    } catch {
      if (!silent) setError('Failed to load queue');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const loadLogs = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (!silent) { setLoading(true); setError(null); }
    try {
      const res = await internalFetch(`${API_BASE}/delivery-logs?limit=100`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.success) setLogs(json.data.logs || []);
    } catch {
      if (!silent) setError('Failed to load delivery logs');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (!silent) { setLoading(true); setError(null); }
    try {
      const res = await internalFetch('/internal/backend/admin/communication/history?limit=100', { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.success) setHistory(json.data || []);
      else if (!silent) setError(json.error || 'Failed to load email history');
    } catch {
      if (!silent) setError('Failed to load email history');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const loadMailboxes = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (!silent) { setLoading(true); setError(null); }
    try {
      const res = await internalFetch(`${MB_BASE}`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.success) setMailboxes(json.data.mailboxes || []);
    } catch {
      if (!silent) setError('Failed to load mailboxes');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const loadTemplates = useCallback(async () => {
    try {
      const res = await internalFetch(`${TEMPLATES_BASE}`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.success) setTemplates(json.templates || []);
    } catch {}
  }, []);

  const loadCommsSettings = useCallback(async () => {
    setCommSettingsLoading(true);
    try {
      const res = await internalFetch('/internal/backend/communications/settings', { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.success) setCommSettings(json.settings);
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

  // Persist a settings payload immediately (used by the system-account toggles,
  // inline edits and signature management so they take effect without a
  // separate Save click).
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
          a.id === id ? { ...a, display_name: draft.display_name, email: draft.email, reply_to: draft.reply_to, signature: draft.signature } : a
        ),
      };
      setCommSettingsDirty(true);
      persistCommSettings(next);
      return next;
    });
  }, [persistCommSettings]);

  // The three built-in Websmith Mail accounts (no-reply / support / sales) are
  // app-config defaults and are NEVER deleted — they can only be disabled.
  const isProtectedSystemAccount = (a: any) =>
    ['no_reply', 'support', 'sales'].includes(String(a?.id || '').replace(/-/g, '_'));

  // Add a new Websmith Mail account (a system sender identity). UI-only: the
  // entry is added to the settings document and persisted through the existing
  // communications/settings endpoint — no brand-new backend logic.
  const addSystemAccount = useCallback(() => {
    if (!commSettings) return;
    const acct = {
      id: `sys-${Date.now().toString(36).toLowerCase()}`,
      type: 'general',
      display_name: 'New Mail Account',
      name: '',
      email: '',
      is_active: true,
      is_default_sender: false,
      reply_to: '',
      signature: '',
      templates: [],
    };
    const next: any = { ...commSettings, mail_accounts: [...(commSettings.mail_accounts || []), acct] };
    setCommSettings(next);
    setEditAccountId(acct.id);
    setAccountDraft(acct);
    setCommSettingsDirty(true);
    persistCommSettings(next);
  }, [commSettings, persistCommSettings]);

  // Delete a user-added Websmith Mail account. The built-in system accounts
  // (no_reply / support / sales) are protected — attempts show a toast and
  // never reach the backend.
  const deleteSystemAccount = useCallback((id: string) => {
    if (!commSettings) return;
    const target = (commSettings.mail_accounts || []).find((a: any) => a.id === id);
    if (!target) return;
    if (isProtectedSystemAccount(target)) {
      showToast('err', `"${systemAccountUiLabel(target)}" is a built-in system account and cannot be deleted — disable it instead.`);
      return;
    }
    if (!confirm(`Delete mail account "${systemAccountUiLabel(target) || target.email}"? This removes it from the sender identities.`)) return;
    if (editAccountId === id) setEditAccountId(null);
    const next: any = {
      ...commSettings,
      mail_accounts: (commSettings.mail_accounts || []).filter((a: any) => a.id !== id),
    };
    setCommSettings(next);
    setCommSettingsDirty(true);
    persistCommSettings(next);
  }, [commSettings, showToast, persistCommSettings, editAccountId]);

  // ---- Signatures (stored in communication settings) ----
  const signatures: SignatureItem[] = commSettings?.signatures || [];

  // Admin toggle for the Mail Delete feature — the backend enforces this
  // independently, the UI only mirrors it (buttons hidden while disabled).
  const allowEmailDeletion = commSettings?.allow_email_deletion !== false;

  const toggleAllowEmailDeletion = useCallback(() => {
    setCommSettings((prev: any) => {
      if (!prev) return prev;
      const next: any = { ...prev, allow_email_deletion: !(prev.allow_email_deletion !== false) };
      setCommSettingsDirty(true);
      persistCommSettings(next);
      return next;
    });
  }, [persistCommSettings]);

  const addSignature = useCallback((name: string, content: string, enabled: boolean = true) => {
    if (!commSettings) return;
    const sig: SignatureItem = {
      id: `SIG-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`,
      name: name.trim() || 'Untitled signature',
      content: content.trim(),
      is_default: signatures.length === 0,
      enabled,
    };
    setCommSettings((prev: any) => {
      if (!prev) return prev;
      const next: any = { ...prev, signatures: [...(prev.signatures || []), sig] };
      setCommSettingsDirty(true);
      persistCommSettings(next, 'Signature created successfully');
      return next;
    });
  }, [commSettings, signatures.length, persistCommSettings]);

  const updateSignature = useCallback((id: string, name: string, content: string, enabled: boolean = true) => {
    setCommSettings((prev: any) => {
      if (!prev) return prev;
      const next: any = {
        ...prev,
        signatures: (prev.signatures || []).map((s: SignatureItem) =>
          s.id === id ? { ...s, name: name.trim() || s.name, content: content.trim(), enabled } : s
        ),
      };
      setCommSettingsDirty(true);
      persistCommSettings(next);
      return next;
    });
  }, [persistCommSettings]);

  const deleteSignature = useCallback(async (id: string) => {
    setCommSettings((prev: any) => {
      if (!prev) return prev;
      const list = (prev.signatures || []).filter((s: SignatureItem) => s.id !== id);
      const next: any = {
        ...prev,
        signatures: list.length > 0 && !list.some((s: SignatureItem) => s.is_default)
          ? list.map((s: SignatureItem, i: number) => i === 0 ? { ...s, is_default: true } : s)
          : list,
      };
      setCommSettingsDirty(true);
      persistCommSettings(next);
      return next;
    });
    // Spec 2.6: clear auto_reply_signature on mailboxes referencing the deleted signature
    try {
      const mbRes = await fetch(`${MB_BASE}`, { headers: getAuthHeaders() });
      const mbJson = await mbRes.json();
      if (mbJson.success && mbJson.data) {
        for (const mb of mbJson.data) {
          if (mb.auto_reply_signature === id) {
            await fetch(`${MB_BASE}/${mb.id}`, {
              method: 'PATCH',
              headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
              body: JSON.stringify({ auto_reply_signature: '' }),
            });
          }
        }
      }
    } catch {
      // Non-fatal: server will gracefully handle unknown ID anyway
    }
  }, [persistCommSettings]);

  const setDefaultSignature = useCallback((id: string) => {
    setCommSettings((prev: any) => {
      if (!prev) return prev;
      const next: any = {
        ...prev,
        signatures: (prev.signatures || []).map((s: SignatureItem) => ({ ...s, is_default: s.id === id })),
      };
      setCommSettingsDirty(true);
      persistCommSettings(next);
      return next;
    });
  }, [persistCommSettings]);

  const assignSignatureToMailbox = useCallback(async (mailboxId: string, sig: SignatureItem) => {
    if (sig.enabled === false) {
      showToast('err', 'Cannot assign a disabled signature — enable it first');
      return;
    }
    setBusy(`assign-sig:${mailboxId}`);
    try {
      const res = await fetch(`${MB_BASE}/${mailboxId}`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature: sig.content }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('ok', `Signature "${sig.name}" assigned to mailbox`);
        await loadMailboxes();
      } else {
        showToast('err', json.error?.message || 'Failed to assign signature');
      }
    } catch {
      showToast('err', 'Failed to assign signature');
    } finally {
      setBusy(null);
    }
  }, [loadMailboxes, showToast]);

  // ---- Templates ----
  const updateTemplate = useCallback(async (draft: EmailTemplate) => {
    setBusy('save-template');
    try {
      const res = await fetch(`${TEMPLATES_BASE}`, {
        method: 'PUT',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_type: draft.email_type, subject: draft.subject, body: draft.body, plain_text: draft.plain_text, is_active: draft.is_active }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('ok', `Template "${draft.email_type}" saved`);
        setEditingTemplate(null);
        setTemplateDraft(null);
        await loadTemplates();
      } else {
        showToast('err', json.error || 'Failed to save template');
      }
    } catch {
      showToast('err', 'Failed to save template');
    } finally {
      setBusy(null);
    }
  }, [loadTemplates, showToast]);

  // Insert a template into the reply composer (does NOT send).
  const insertTemplateIntoComposer = useCallback((key: string) => {
    const t = templates.find(x => x.email_type === key);
    const text = templateTextOf(t);
    if (!text) { showToast('err', 'Template is empty — edit it first.'); return; }
    // Templates open the SAME universal composer with the template content
    // pre-filled — the reply composer and the template panel share one UI.
    const d = detail;
    const recv = d ? accountForConversation(d.conversation, commSettings, mailboxes) : null;
    setEmailDialog({
      isOpen: true,
      defaultAction: 'send',
      defaultEmail: d?.conversation.customer_email || undefined,
      defaultLicenseKey: d?.conversation.license_key || undefined,
      defaultProductId: d?.conversation.product_id || undefined,
      fromAccounts: senderAccounts,
      defaultFromId: recv?.id || defaultSenderId(senderAccounts),
      conversationId: d?.conversation.id || undefined,
      defaultSubject: t?.subject || undefined,
      defaultMessage: text,
    });
    showToast('ok', `Template "${t?.email_type || key}" loaded into the composer — edit before sending.`);
  }, [templates, detail, commSettings, mailboxes, senderAccounts, showToast]);

  // ---- Internal note send (inline mini-composer; notes are NOT email, so
  // they never route through the universal mail composer) ----
  const sendReply = useCallback(async () => {
    const convId = detail?.conversation.id;
    if (!convId || !composerText.trim() || !composerInternal) return;
    setBusy('composer-send');
    setComposerError(null);
    try {
      const adminName = commSettings?.mail_accounts?.find((a: any) => a.type === 'support')?.display_name || 'Admin';
      const payload: Record<string, any> = {
        conversation_id: convId,
        message: composerText.trim(),
        sender_name: adminName,
        is_internal: true,
      };
      const res = await fetch(`${REPLY_BASE}`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        showToast('ok', 'Internal note added');
        setComposerText('');
        setComposerOpen(false);
        setComposerInternal(false);
        await openDetail(convId);
        refreshCurrent(true);
        fetchStats();
      } else {
        const msg = json.error?.message || json.error || 'Failed to add internal note.';
        setComposerError(msg);
        showToast('err', msg);
      }
    } catch {
      const msg = 'Failed to add internal note.';
      setComposerError(msg);
      showToast('err', msg);
    } finally {
      setBusy(null);
    }
  }, [detail, composerText, commSettings, showToast]);

  // Live auto-sync (no cron on serverless): process queue + pull IMAP for every
  // enabled mailbox on a timer, and refresh immediately whenever the tab regains
  // focus so counts never appear stale.
  useEffect(() => {
    const runAutoSync = async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      if (autoSyncInFlight.current) return;
      autoSyncInFlight.current = true;
      try {
        const headers = getAuthHeaders();
        await fetch(`${API_BASE}/queue/process`, { method: 'POST', headers });
        const mbRes = await fetch(`${MB_BASE}`, { headers });
        const mbJson = await mbRes.json();
        const allMailboxes = mbJson.data?.mailboxes || [];
        // Avoid re-rendering the whole Communications Center when the mailbox
        // list is unchanged — the 2s receive sweep must never churn the UI.
        setMailboxes(prev => {
          if (prev.length === allMailboxes.length && prev.every((m, i) => {
            const n = allMailboxes[i];
            return m.id === n.id && m.email_address === n.email_address
              && m.connection_status === n.connection_status
              && m.sync_status === n.sync_status
              && m.is_enabled === n.is_enabled
              && m.is_default_sender === n.is_default_sender
              && m.last_error === n.last_error
              && m.last_sync === n.last_sync
              && m.last_success === n.last_success
              && m.last_failure === n.last_failure;
          })) return prev;
          return allMailboxes;
        });
        const enabled = allMailboxes.filter((m: any) => m.is_enabled);
        await Promise.all(enabled.map((m: any) =>
          fetch(`${MB_BASE}/${m.id}/sync`, { method: 'POST', headers }).catch(() => {})
        ));

        // --- Sync native system accounts (support@ / sales@) ---
        // These are configured in the communication settings document, NOT in
        // the mailboxes table. The sync route's nativeReceiveAccount handler
        // reads IMAP credentials from env vars (MAIL_*_IMAP_*) and routes by
        // category. The settings are read from the REAL settings endpoint
        // (GET /communications/settings returns { success, settings }) — never
        // the communications index route, which has no settings payload. The
        // account list is cached for 30s so the sweep does not hammer the
        // settings endpoint every 2 seconds.
        let mailAccounts = nativeAccountsCacheRef.current.accounts;
        if (Date.now() - nativeAccountsCacheRef.current.fetchedAt > 30000) {
          try {
            const settingsRes = await fetch(`${API_BASE}/settings`, { headers });
            const settingsJson = await settingsRes.json();
            mailAccounts = settingsJson?.settings?.mail_accounts || [];
            nativeAccountsCacheRef.current = { fetchedAt: Date.now(), accounts: mailAccounts };
          } catch {}
        }
        for (const acct of mailAccounts) {
          if (acct.type && ['support', 'sales'].includes(acct.type) && acct.is_active) {
            const syncId = acct.id;
            if (syncId) {
              await fetch(`${MB_BASE}/${syncId}/sync`, { method: 'POST', headers }).catch(() => {});
            }
          }
        }

        // The receive timer updates the visible list + counts SILENTLY — the
        // list must never flash back to "Loading..." every 2 seconds, and the
        // mailbox/native IMAP sweeps (the receive path) never re-trigger it.
        fetchStats();
        if (activeFolderDef.kind === 'list') loadConversations(activeFolderDef, searchQuery, statusFilter, categoryFilter, accountScope, { silent: true });
        else if (activeFolderDef.kind === 'settings') loadCommsSettings();
      } catch {} finally {
        autoSyncInFlight.current = false;
      }
    };
    const iv = setInterval(runAutoSync, 2000);
    const onVisible = () => { if (typeof document !== 'undefined' && !document.hidden) runAutoSync(); };
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(iv); if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible); };
  }, [activeFolderDef, searchQuery, statusFilter, categoryFilter, accountScope, loadConversations, loadMailboxes, loadCommsSettings, fetchStats]);

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

  const refreshCurrent = useCallback((silent = false) => {
    const row = folders.find(x => x.id === activeFolder);
    const f = activeFolder === 'settings' ? SETTINGS_DEF
      : activeFolder === 'templates' ? TEMPLATES_DEF
      : activeFolder === 'signatures' ? SIGNATURES_DEF
      : activeFolder === 'auto-reply' ? AUTO_REPLY_DEF
      : (row ? folderDefFor(row) : (FOLDERS.find(x => x.key === activeFolder) || FOLDERS[0]));
    const silentOpt = silent ? { silent: true } : undefined;
    if (f.kind === 'list') loadConversations(f, searchQuery, statusFilter, categoryFilter, accountScope, silentOpt);
    else if (f.kind === 'queue') loadQueue(silentOpt);
    else if (f.kind === 'logs') loadLogs(silentOpt);
    else if (f.kind === 'history') loadHistory(silentOpt);
    else if (f.kind === 'settings') { loadCommsSettings(); loadMailboxes(silentOpt); loadTemplates(); }
    else if (f.kind === 'templates') loadTemplates();
    else if (f.kind === 'auto-reply' || f.kind === 'signatures') loadMailboxes(silentOpt);
    fetchStats();
  }, [activeFolder, folders, folderDefFor, searchQuery, statusFilter, categoryFilter, accountScope, loadConversations, loadQueue, loadLogs, loadHistory, loadMailboxes, loadCommsSettings, loadTemplates, fetchStats]);

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
      refreshCurrent(true);
    }
  }, [refreshCurrent, showToast]);

  useEffect(() => { refreshCurrent(); }, [refreshCurrent]);

  useEffect(() => { loadFolders(); }, [loadFolders]);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  // Load mailboxes on mount so the Mailboxes section + From dropdowns are
  // populated immediately (no need to visit the mailboxes view first).
  useEffect(() => { loadMailboxes(); }, [loadMailboxes]);

  // Load settings + signatures + mailboxes on mount so the composer's Signature
  // dropdown and mailbox form options are populated from the start
  useEffect(() => { loadCommsSettings(); }, [loadCommsSettings]);

  useEffect(() => {
    const iv = setInterval(fetchStats, 15000);
    return () => clearInterval(iv);
  }, [fetchStats]);

  const handleFolderChange = (key: string) => {
    // Re-clicking the already-open folder must never double-fetch: clear the
    // reader/selection and refresh SILENTLY so the same list is not reloaded
    // twice with a full loading flash.
    if (key === activeFolder) {
      setSelectedIds(new Set());
      setDetail(null);
      setSelectedQueueItem(null);
      setSelectedLog(null);
      setSelectedHistoryItem(null);
      setError(null);
      setComposerOpen(false);
      refreshCurrent(true);
      return;
    }
    setActiveFolder(key);
    setSelectedIds(new Set());
    setDetail(null);
    setSelectedMailbox(null);
    setMailboxDetail(null);
    setSelectedQueueItem(null);
    setSelectedLog(null);
    setSelectedHistoryItem(null);
    setError(null);
    setComposerOpen(false);
    const row = folders.find(x => x.id === key);
    const f = key === 'settings' ? SETTINGS_DEF
      : key === 'templates' ? TEMPLATES_DEF
      : key === 'signatures' ? SIGNATURES_DEF
      : key === 'auto-reply' ? AUTO_REPLY_DEF
      : (row ? folderDefFor(row) : (FOLDERS.find(x => x.key === key) || FOLDERS[0]));
    // Strict separation: keep an account scope only when it belongs to the
    // section being opened (a mailbox inside Mail, a system account inside
    // Websmith Communications). Any mismatch clears it so mailbox mail can
    // never appear in the system section and system mail can never appear in
    // the Mail section.
    const keepScope = (accountScope?.kind === 'mailbox' && f.section === 'external')
      || (accountScope?.kind === 'system' && f.section === 'internal');
    if (!keepScope) setAccountScope(null);
    if (f.kind === 'list') loadConversations(f, searchQuery, statusFilter, categoryFilter, accountScope);
    else if (f.kind === 'queue') loadQueue();
    else if (f.kind === 'logs') loadLogs();
    else if (f.kind === 'history') loadHistory();
    else if (f.kind === 'settings') { loadCommsSettings(); loadMailboxes(); loadTemplates(); }
    else if (f.kind === 'templates') loadTemplates();
    else if (f.kind === 'auto-reply' || f.kind === 'signatures') loadMailboxes();
    fetchStats();
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
        const recv = accountForConversation(json.data.conversation, commSettings, mailboxes);
        setComposerFromId(
          recv && recv.is_active ? recv.id : defaultSenderId(senderAccounts)
        );
        if ((json.data.conversation?.unread_replies || 0) > 0) {
          await fetch(`${API_BASE}/conversations/${id}`, {
            method: 'PATCH',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'mark_read' }),
          });
          setDetail((prev: DetailData | null) => prev ? { ...prev, conversation: { ...prev.conversation, unread_replies: 0 } } : prev);
          setConversations(prev => prev.map(c => c.id === id ? { ...c, unread_replies: 0 } : c));
          fetchStats();
          refreshCurrent(true);
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

  // Bulk conversation state change (Mark Read / Mark Unread / Archive /
  // Restore) against the REAL database via one collection PATCH. Reports the
  // real number of conversations updated and any failures — the UI never
  // claims success the backend did not confirm.
  const patchConversations = async (action: string, ids: string[], okMsg: string) => {
    if (!ids || ids.length === 0 || busy !== null) return;
    const idList = Array.from(new Set(ids));
    setBusy(`patch:${action}`);
    // Clear the selection immediately: every listed item is being acted on,
    // and a second submit would double-fire the same operation.
    setSelectedIds(new Set());
    try {
      const res = await fetch(`${API_BASE}/conversations`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ids: idList }),
      });
      const json = await res.json();
      if (json.success) {
        const updated = json.data?.updated ?? 0;
        const failed = json.data?.failed ?? 0;
        // Apply the confirmed result to the visible list instantly, then let
        // the authoritative re-fetch settle any remaining rows.
        if (action === 'mark_read') {
          setConversations(prev => prev.map(c => idList.includes(c.id) ? { ...c, unread_replies: 0 } : c));
        } else if (action === 'mark_unread') {
          setConversations(prev => prev.map(c => idList.includes(c.id) ? { ...c, unread_replies: Math.max(1, c.unread_replies || 1) } : c));
        } else if (action === 'archive' || action === 'restore') {
          // Archive moves a row out of inbox-type views; restore moves it out
          // of Trash — the authoritative list re-fetch does the rest.
        }
        if (action === 'archive') setDetail(null);
        refreshCurrent(true);
        fetchStats();
        if (failed > 0) {
          showToast('warn', `${updated} conversation(s) ${okMsg.toLowerCase()}. ${failed} failed.`);
        } else {
          showToast('ok', updated === 1
            ? (action === 'mark_read' ? 'Conversation marked as read.' : action === 'mark_unread' ? 'Conversation marked as unread.' : okMsg)
            : `${updated} conversation(s) ${okMsg.toLowerCase()}.`);
        }
      } else {
        showToast('err', json.error?.message || 'Action failed');
      }
    } catch {
      showToast('err', 'Action failed');
    } finally {
      setBusy(null);
    }
  };

  const softDeleteSelected = async () => {
    if (busy !== null) return;
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBusy('delete');
    // Clear the selection + close the reader up-front so a second click can
    // never re-submit the same ids while the operation is running.
    setSelectedIds(new Set());
    setDetail(null);
    try {
      let succeeded = 0;
      let firstError = '';
      const doneIds: string[] = [];
      for (const id of ids) {
        const res = await fetch(`${API_BASE}/conversations/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
        const json = await res.json();
        if (json.success) {
          succeeded++;
          doneIds.push(id);
        } else if (!firstError) {
          firstError = json.error?.message || 'Delete failed';
        }
      }
      // Remove the CONFIRMED deleted conversations from the visible list right
      // away (they are now in Trash server-side), then re-fetch the
      // authoritative list + stats. A failed row stays visible — it was never
      // deleted, so hiding it locally would be a lie.
      if (doneIds.length > 0) {
        setConversations(prev => prev.filter(c => !doneIds.includes(c.id)));
      }
      refreshCurrent(true);
      fetchStats();
      const failed = ids.length - succeeded;
      if (failed === 0) {
        showToast('ok', succeeded === 1 ? 'Conversation deleted successfully.' : `${succeeded} conversations deleted successfully.`);
      } else if (succeeded > 0) {
        showToast('warn', `${succeeded} of ${ids.length} conversations deleted successfully. ${failed} failed.`);
      } else {
        showToast('err', firstError || 'Failed to delete conversation. Please try again.');
      }
    } catch {
      showToast('err', 'Failed to delete conversation. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const restoreSelected = async () => {
    if (busy !== null) return;
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBusy('restore');
    setSelectedIds(new Set());
    try {
      const res = await fetch(`${API_BASE}/conversations`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore', ids }),
      });
      const json = await res.json();
      if (json.success) {
        const updated = json.data?.updated ?? 0;
        const failed = json.data?.failed ?? 0;
        if (updated > 0) {
          setConversations(prev => prev.filter(c => !ids.includes(c.id)));
        }
        refreshCurrent(true);
        fetchStats();
        if (failed > 0) {
          showToast('warn', `${updated} conversation(s) restored successfully. ${failed} failed.`);
        } else {
          showToast('ok', updated === 1 ? 'Conversation restored successfully.' : `${updated} conversations restored successfully.`);
        }
      } else {
        showToast('err', json.error?.message || 'Conversation could not be restored.');
      }
    } catch {
      showToast('err', 'Conversation could not be restored.');
    } finally {
      setBusy(null);
    }
  };

  const emptyTrash = async () => {
    setBusy('empty-trash');
    try {
      // Strict source separation: the Universal/System Trash (int-trash) empties
      // ONLY system mail (mailbox_id IS NULL); the Mailbox Trash (ext-trash)
      // empties ONLY mailbox mail — and only the selected mailbox when one is
      // account-scoped. The two trashes never mix.
      const trashIsSystem = activeFolder === 'int-trash';
      let url = `${API_BASE}/conversations?action=empty_trash&source=${trashIsSystem ? 'system' : 'mailbox'}`;
      if (!trashIsSystem && accountScope?.kind === 'mailbox') {
        url += `&mailbox_id=${encodeURIComponent(accountScope.id)}`;
      } else if (trashIsSystem && accountScope?.kind === 'system') {
        const acct = (commSettingsRef.current?.mail_accounts || []).find((a: any) => String(a.id) === accountScope.id);
        const cats = systemAccountCategories(commSettingsRef.current, acct);
        if (cats.length > 0) url += `&category=${encodeURIComponent(cats.join(','))}`;
      }
      const res = await fetch(url, { method: 'DELETE', headers: getAuthHeaders() });
      const json = await res.json();
      if (json.success) {
        showToast('ok', json.data?.message || 'Trash emptied');
        setShowTrashConfirm(false);
        setSelectedIds(new Set());
        setDetail(null);
        refreshCurrent(true);
        fetchStats();
      }
      else showToast('err', json.error?.message || 'Failed to empty trash');
    } catch {
      showToast('err', 'Failed to empty trash');
    } finally {
      setBusy(null);
    }
  };

  // Permanent deletion (Mail Delete feature). The backend checks the
  // "Allow Email Deletion" setting itself — a 403 here means the admin toggle
  // is off, even if the button was somehow still reachable.
  const permanentlyDeleteConversations = async (ids: string[]) => {
    if (!ids || ids.length === 0) return;
    setBusy('permanent-delete');
    try {
      const url = ids.length === 1
        ? `${API_BASE}/conversations/${encodeURIComponent(ids[0])}?permanent=true`
        : `${API_BASE}/conversations?ids=${encodeURIComponent(ids.join(','))}`;
      const res = await fetch(url, { method: 'DELETE', headers: getAuthHeaders() });
      const json = await res.json();
      if (json.success) {
        showToast('ok', json.data?.message || `${ids.length} conversation(s) permanently deleted`);
        setShowDeleteConfirm(null);
        setDetail(null);
        setSelectedIds(prev => {
          const next = new Set(prev);
          ids.forEach(id => next.delete(id));
          return next;
        });
        setConversations(prev => prev.filter(c => !ids.includes(c.id)));
        refreshCurrent(true);
        fetchStats();
      } else {
        showToast('err', json.error?.message || 'Failed to delete conversation');
      }
    } catch {
      showToast('err', 'Failed to delete conversation');
    } finally {
      setBusy(null);
    }
  };

  const openCompose = () => {
    setEmailDialog({
      isOpen: true,
      defaultAction: 'send',
      fromAccounts: senderAccounts,
      defaultFromId: interactiveSenderId(senderAccounts),
    });
  };

  // ---- Universal composer for Reply / Reply All / Forward ----
  // ONE composer for every email flow: New Email, Reply, Reply All and
  // Forward all open the same UniversalEmailDialog. The reader's inline
  // composer is reserved for internal notes only (notes are not email).
  const threadContextFor = (d: DetailData | null): string => {
    if (!d) return '';
    const lines: string[] = [];
    for (const m of d.messages || []) {
      const who = m.sender_name || (m.sender_type === 'customer' ? 'Customer' : 'Support');
      lines.push(`On ${new Date(m.created_at).toLocaleString()} ${who} wrote:\n${m.message}`);
    }
    return lines.join('\n\n');
  };

  // Real recipient name for Reply/Reply All — from the customer record or the
  // conversation row. Never a guess; email-like strings ("name <a@b.c>" or a
  // bare address from IMAP-parsed mail) are dropped so the name field never
  // receives an address.
  const recipientNameFor = (d: DetailData | null): string => {
    const name = (d?.customer?.name || d?.conversation.customer_name || '').trim();
    return /[@<>]/.test(name) ? '' : name;
  };

  const openReply = (to?: string, _action?: 'support' | 'general', replyAll?: boolean) => {
    const d = detail;
    const target = to || d?.conversation.customer_email || (d?.customer?.email as string) || '';
    const recv = d ? accountForConversation(d.conversation, commSettings, mailboxes) : null;
    setEmailDialog({
      isOpen: true,
      defaultEmail: target,
      defaultRecipientName: recipientNameFor(d),
      defaultLicenseKey: d?.conversation.license_key || undefined,
      defaultProductId: d?.conversation.product_id || undefined,
      defaultAction: 'send',
      fromAccounts: senderAccounts,
      defaultFromId: recv?.id || interactiveSenderId(senderAccounts),
      conversationId: d?.conversation.id || undefined,
      defaultSubject: d ? `Re: ${d.conversation.subject || ''}`.trim() : undefined,
      defaultMessage: d ? `\n\n---\n${threadContextFor(d)}` : undefined,
      // Reply All keeps the receiving account in the loop (CC) so the original
      // recipient that the customer emailed stays part of the conversation.
      defaultCc: replyAll && recv?.email ? recv.email : '',
      defaultBcc: '',
    });
  };

  const openForward = () => {
    const d = detail;
    const recv = d ? accountForConversation(d.conversation, commSettings, mailboxes) : null;
    setEmailDialog({
      isOpen: true,
      defaultAction: 'send',
      defaultLicenseKey: d?.conversation.license_key || undefined,
      defaultProductId: d?.conversation.product_id || undefined,
      fromAccounts: senderAccounts,
      defaultFromId: recv?.id || interactiveSenderId(senderAccounts),
      defaultSubject: d ? `Fwd: ${d.conversation.subject || ''}`.trim() : undefined,
      defaultMessage: d ? `---------- Forwarded message ----------\nFrom: ${d.conversation.customer_name || 'Unknown'} <${d.conversation.customer_email}>\nDate: ${new Date(d.conversation.created_at).toLocaleString()}\nSubject: ${d.conversation.subject || ''}\n\n${threadContextFor(d)}` : undefined,
    });
  };

  // ---- Email-reader quick actions (UI-only; reuse the existing PATCH/DELETE/POST endpoints) ----
  const readerAction = async (action: string, okMsg: string) => {
    const id = detail?.conversation.id;
    if (!id) return;
    setBusy(`reader:${action}`);
    try {
      const res = await fetch(`${API_BASE}/conversations/${id}`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('ok', okMsg);
        if (action === 'mark_unread') {
          setDetail((prev: DetailData | null) => prev ? { ...prev, conversation: { ...prev.conversation, unread_replies: 1 } } : prev);
          setConversations(prev => prev.map(c => c.id === id ? { ...c, unread_replies: 1 } : c));
        } else if (action === 'archive') {
          setDetail(null);
        }
        fetchStats();
        refreshCurrent(true);
      } else {
        showToast('err', json.error?.message || 'Action failed');
      }
    } catch {
      showToast('err', 'Action failed');
    } finally {
      setBusy(null);
    }
  };

  const trashConversation = async () => {
    const id = detail?.conversation.id;
    if (!id || busy === 'reader:trash') return;
    setBusy('reader:trash');
    try {
      const res = await fetch(`${API_BASE}/conversations/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      const json = await res.json();
      if (json.success) {
        showToast('ok', 'Conversation moved to Trash');
        setDetail(null);
        setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
        setConversations(prev => prev.filter(c => c.id !== id));
        refreshCurrent(true);
        fetchStats();
      } else {
        showToast('err', json.error?.message || 'Delete failed');
      }
    } catch {
      showToast('err', 'Delete failed');
    } finally {
      setBusy(null);
    }
  };

  const retryConversation = async () => {
    const id = detail?.conversation.id;
    if (!id) return;
    setBusy('reader:retry');
    try {
      const res = await fetch(`${API_BASE}/conversations/${id}`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retry' }),
      });
      const json = await res.json();
      if (json.success) showToast('ok', json.data?.message || 'Failed messages queued for retry');
      else showToast('err', json.error?.message || 'Retry failed');
    } catch {
      showToast('err', 'Retry failed');
    } finally {
      setBusy(null);
    }
  };

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

  // Test the CURRENT form values (Test Incoming / Test Outgoing / Test
  // Connection) — reuses the existing test-connection endpoint.
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
        // One-sided test: run the shared endpoint with only one side filled —
        // blank the other side's credentials so only the requested test runs.
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

  const saveMailbox = async () => {
    setMailboxFormError(null);

    // Client-side validation — mirror the backend's required fields.
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
        setMailboxForm(newMailboxForm());
        setMailboxFormError(null);
        setMailboxTest({ running: false, results: null });
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

  // ---- Auto-reply save (mailbox PATCH — new template/signature fields) ----
  const saveAutoReply = useCallback(async (mb: Mailbox) => {
    setBusy(`auto-reply:${mb.id}`);
    try {
      const res = await fetch(`${MB_BASE}/${mb.id}`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auto_reply_enabled: mb.auto_reply_enabled,
          auto_reply_template_key: mb.auto_reply_template_key || '',
          auto_reply_signature: mb.auto_reply_signature || '',
          auto_reply_message: mb.auto_reply_message || '',
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('ok', `Auto-reply saved for ${mb.email_address}`);
        await loadMailboxes();
      } else {
        showToast('err', json.error?.message || 'Failed to save auto-reply');
      }
    } catch {
      showToast('err', 'Failed to save auto-reply');
    } finally {
      setBusy(null);
    }
  }, [loadMailboxes, showToast]);

  // Seed auto-reply drafts from the mailboxes (keeps in-progress edits on reload)
  useEffect(() => {
    setAutoReplyDrafts(prev => {
      const next = { ...prev };
      mailboxes.forEach(mb => {
        if (!next[mb.id]) {
          next[mb.id] = {
            auto_reply_enabled: !!mb.auto_reply_enabled,
            auto_reply_template_key: mb.auto_reply_template_key || '',
            auto_reply_signature: mb.auto_reply_signature || '',
            auto_reply_message: mb.auto_reply_message || '',
          };
        }
      });
      return next;
    });
  }, [mailboxes]);

  // ---- Toolbar rendering ----
  const renderToolbar = () => {
    const hasSelection = selectedIds.size > 0;
    const btn = 'p-2 rounded-lg hover:bg-[var(--bg-tertiary)]/50 transition-colors disabled:opacity-30 disabled:hover:bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]';
    // Compute enabled accounts for the selector — strict separation: inside the
    // Websmith Communications section only system accounts (support@/sales@/
    // no-reply@) are offered; inside Mail only configured mailboxes. A system
    // account can never select a mailbox and vice versa.
    const enabledAccounts = useMemo(() => {
      const isExternal = activeFolderDef.section === 'external';
      if (isExternal) {
        return mailboxes
          .filter(m => m.is_enabled !== false)
          .map(m => ({
            id: m.id,
            kind: 'mailbox' as const,
            display_name: m.display_name || m.email_address || '',
            email: m.email_address || '',
            is_active: m.is_enabled !== false,
          }));
      }
      return (commSettings?.mail_accounts || [])
        .filter(a => a.is_active !== false)
        .map(a => ({
          id: a.id,
          kind: 'system' as const,
          display_name: a.display_name || a.name || '',
          email: a.email || '',
          is_active: a.is_active !== false,
        }));
    }, [commSettings, mailboxes, activeFolderDef]);

    // Account filter options for the dropdown — ALL configured accounts
    // (system mail_accounts + enabled external mailboxes), derived from the
    // real backend data, never hardcoded. The dropdown is section-agnostic:
    // selecting any account narrows the current folder to that account's mail.
    const accountFilterOptions = [
      ...(commSettings?.mail_accounts || [])
        .filter((a: any) => a?.id && a.is_active !== false)
        .map((a: any) => ({
          id: String(a.id),
          kind: 'system' as const,
          label: a.display_name || a.name || a.email || 'System Account',
          email: a.email || '',
          is_active: a.is_active !== false,
        })),
      ...mailboxes
        .filter(m => m.is_enabled !== false)
        .map(m => ({
          id: m.id,
          kind: 'mailbox' as const,
          label: m.display_name || m.email_address || 'Mailbox',
          email: m.email_address || '',
          is_active: m.is_enabled !== false,
        })),
    ];
    const systemFilterOptions = accountFilterOptions.filter(o => o.kind === 'system');
    const mailboxFilterOptions = accountFilterOptions.filter(o => o.kind === 'mailbox');

    const selectAccountFilter = (o: { kind: 'system' | 'mailbox'; id: string } | null) => {
      setAccountScope(o);
      setAccountFilterOpen(false);
    };

    return (
      <div className="flex items-center gap-1 flex-wrap rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 px-2 py-1.5">
        <button onClick={openCompose} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors">
          <Mail size={13} /> Compose
        </button>
        <div className="w-px h-5 bg-[var(--border-color)] mx-1" />
        <button
          onClick={() => openReply()}
          disabled={!hasSelection && !detail}
          title="Reply"
          className={btn}
        >
          <Reply size={14} />
        </button>
        <button
          onClick={() => openReply(undefined, undefined, true)}
          disabled={!hasSelection && !detail}
          title="Reply All"
          className={btn}
        >
          <ReplyAll size={14} />
        </button>
        <button
          onClick={openForward}
          disabled={!hasSelection && !detail}
          title="Forward"
          className={btn}
        >
          <Forward size={14} />
        </button>
        <div className="w-px h-5 bg-[var(--border-color)] mx-1" />
        <button
          onClick={() => patchConversations('archive', Array.from(selectedIds), 'archived')}
          disabled={!hasSelection || isTrash || busy !== null}
          title="Archive"
          className={btn}
        >
          {busy === 'patch:archive' ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />}
        </button>
        <button
          onClick={isTrash ? restoreSelected : softDeleteSelected}
          disabled={!hasSelection || busy !== null}
          title={isTrash ? 'Restore' : 'Delete'}
          className={btn}
        >
          {busy === 'restore' || busy === 'delete' ? <Loader2 size={14} className="animate-spin" /> : isTrash ? <ArchiveRestore size={14} /> : <Trash2 size={14} />}
        </button>
        {hasSelection && allowEmailDeletion && (
          <button
            onClick={() => setShowDeleteConfirm({ ids: Array.from(selectedIds), count: selectedIds.size })}
            disabled={busy !== null}
            title="Delete Forever"
            className={`${btn} hover:bg-red-500/15 hover:text-red-400`}
          >
            {busy === 'permanent-delete' ? <Loader2 size={14} className="animate-spin" /> : <Delete size={14} />}
          </button>
        )}
        <button
          onClick={() => patchConversations('mark_read', Array.from(selectedIds), 'marked as read')}
          disabled={!hasSelection || isTrash || busy !== null}
          title="Mark Read"
          className={btn}
        >
          {busy === 'patch:mark_read' ? <Loader2 size={14} className="animate-spin" /> : <MailOpen size={14} />}
        </button>
        <button
          onClick={() => patchConversations('mark_unread', Array.from(selectedIds), 'marked as unread')}
          disabled={!hasSelection || isTrash || busy !== null}
          title="Mark Unread"
          className={btn}
        >
          {busy === 'patch:mark_unread' ? <Loader2 size={14} className="animate-spin" /> : <CheckCheck size={14} />}
        </button>
        <div className="w-px h-5 bg-[var(--border-color)] mx-1" />
        <button onClick={() => refreshCurrent()} title="Refresh" className={btn}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
        {/* Account filter dropdown — compact card-style control matching the
            Inbox/Waiting/Sent chips. "All Mail" restores the unfiltered
            behavior; selecting a configured account (system mail account or
            mailbox) narrows the current folder + search to that account only. */}
        <div className="relative">
          <button
            onClick={() => setAccountFilterOpen(o => !o)}
            title="Filter by email account"
            className={`flex items-center gap-1.5 pl-2.5 pr-2 py-1 rounded-full text-[10px] font-medium whitespace-nowrap border transition-colors ${accountScope ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/40 hover:text-[var(--text-primary)]'}`}
          >
            {accountScope
              ? <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
              : <Users size={11} className="flex-shrink-0" />}
            <span className="truncate max-w-[140px]">{scopeLabel || 'All Mail'}</span>
            <ChevronDown size={11} className={`flex-shrink-0 transition-transform ${accountFilterOpen ? 'rotate-180' : ''}`} />
          </button>
          {accountFilterOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setAccountFilterOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-50 w-72 max-h-80 overflow-y-auto rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-2xl shadow-black/40 p-1.5 space-y-0.5 scrollbar-thin">
                <button
                  onClick={() => selectAccountFilter(null)}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] transition-colors ${!accountScope ? 'bg-blue-500/15 text-blue-400' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/40 hover:text-[var(--text-primary)]'}`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-400 flex-shrink-0" />
                  <span className="flex-1 text-left font-medium">All Mail</span>
                </button>
                {systemFilterOptions.length > 0 && (
                  <>
                    <p className="px-2.5 pt-1.5 pb-0.5 text-[9px] font-bold tracking-widest text-[var(--text-muted)] uppercase">System Mail Accounts</p>
                    {systemFilterOptions.map(o => (
                      <button
                        key={o.id}
                        onClick={() => selectAccountFilter({ kind: 'system', id: o.id })}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] transition-colors ${accountScope?.kind === 'system' && accountScope.id === o.id ? 'bg-blue-500/15 text-blue-400' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/40 hover:text-[var(--text-primary)]'}`}
                      >
                        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${o.is_active ? 'bg-green-400' : 'bg-gray-500/30'}`} />
                        <span className="flex-1 text-left min-w-0">
                          <span className="block truncate font-medium">{o.label}</span>
                          {o.email && <span className="block truncate text-[10px] text-[var(--text-muted)]">{o.email}</span>}
                        </span>
                      </button>
                    ))}
                  </>
                )}
                {mailboxFilterOptions.length > 0 && (
                  <>
                    <p className="px-2.5 pt-1.5 pb-0.5 text-[9px] font-bold tracking-widest text-[var(--text-muted)] uppercase">Mailbox Accounts</p>
                    {mailboxFilterOptions.map(o => (
                      <button
                        key={o.id}
                        onClick={() => selectAccountFilter({ kind: 'mailbox', id: o.id })}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] transition-colors ${accountScope?.kind === 'mailbox' && accountScope.id === o.id ? 'bg-blue-500/15 text-blue-400' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/40 hover:text-[var(--text-primary)]'}`}
                      >
                        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${o.is_active ? 'bg-green-400' : 'bg-gray-500/30'}`} />
                        <span className="flex-1 text-left min-w-0">
                          <span className="block truncate font-medium">{o.label}</span>
                          {o.email && <span className="block truncate text-[10px] text-[var(--text-muted)]">{o.email}</span>}
                        </span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            </>
          )}
        </div>
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
        {/* Account selector pills */}
        <div className="flex items-center gap-1.5 pt-1.5">
          {enabledAccounts.map((acct) => {
            const isSelected = accountScope?.kind === acct.kind && accountScope?.id === acct.id;
            return (
              <button
                key={acct.id}
                onClick={() => setAccountScope(acct.kind === 'system' ? { kind: 'system', id: acct.id } : { kind: 'mailbox', id: acct.id })}
                className={`relative inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[9px] font-medium transition-colors ${isSelected ? 'bg-blue-500/20 text-blue-400' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 hover:text-[var(--text-primary)]'}`}
              >
                <span className={isSelected ? 'absolute left-0 top-1/2 -translate-y-1/2 h-4 w-0.5 rounded-full bg-blue-400' : ''}>
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${acct.is_active ? 'bg-green-400' : 'bg-gray-500/30'}`} />
                  <span className="truncate max-w-xs">{acct.display_name || acct.email}</span>
                </span>
              </button>
            );
          })}
        </div>
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

  // ---- Sidebar (Mail folders + Categories/Labels + Communications Setting) ----
  const renderSidebar = () => {
    const folderBtn = (def: FolderDef, badgeKey?: keyof Stats, extra?: any, statsSource: Stats = systemStats) => {
      const Icon = def.icon;
      const active = activeFolder === def.key;
      const badge = badgeKey ? statsSource[badgeKey] : 0;
      return (
        <button
          key={def.key}
          onClick={() => handleFolderChange(def.key)}
          className={`relative w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
            active ? 'bg-blue-500/15 text-blue-400' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 hover:text-[var(--text-primary)]'
          }`}
        >
          {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-0.5 rounded-full bg-blue-400" />}
          <Icon size={14} className="flex-shrink-0" />
          <span className="flex-1 text-left truncate">{def.label}</span>
          {extra}
          {badge > 0 && (
            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${def.key === 'all' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-blue-500/20 text-blue-400'}`}>{badge}</span>
          )}
        </button>
      );
    };

    const groupLabel = (text: string, icon?: any) => {
      const GIcon = icon;
      return (
        <p className="px-2 mb-1 flex items-center gap-1.5 text-[9px] font-bold tracking-widest text-[var(--text-muted)] uppercase">
          {GIcon && <GIcon size={10} />} {text}
          {accountScope && (text === 'Mail') && scopeLabel && (
            <span className="ml-auto flex items-center gap-1 text-[9px] font-medium normal-case text-blue-400">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" /> {scopeLabel}
            </span>
          )}
        </p>
      );
    };

    const mailFolders = ['ext-inbox', 'ext-sent', 'ext-draft', 'ext-waiting', 'ext-failed', 'ext-queued', 'ext-spam', 'ext-trash']
      .map(k => folders.find(f => f.id === k) ? folderDefFor(folders.find(f => f.id === k)!) : (FOLDERS.find(f => f.key === k) || null))
      .filter((f): f is FolderDef => !!f);

    const internalFolders = ['all', 'sales', 'support', 'activation', 'renewal', 'reactivation', 'hardware', 'trial', 'payment', 'sdk', 'customer', 'sent', 'notifications', 'email-history', 'int-trash']
      .map(k => folders.find(f => f.id === k) ? folderDefFor(folders.find(f => f.id === k)!) : (FOLDERS.find(f => f.key === k) || null))
      .filter((f): f is FolderDef => !!f);

    const settingsActive = activeFolder === 'settings';

    return (
      <aside className="w-[240px] flex-shrink-0 flex flex-col min-h-0 border-r border-[var(--border-color)] bg-[var(--bg-tertiary)]/10">
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-2 py-3 space-y-4">
          <div className="px-2 flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
              <Mail className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-[var(--text-primary)] leading-tight truncate">Websmith Communications</p>
              <p className="text-[9px] text-[var(--text-muted)]">Communication Center</p>
            </div>
          </div>

          {/* Categories / Labels — system-wide conversation categories (shown FIRST) */}
          <div>
            {groupLabel('Categories / Labels')}
            <div className="space-y-0.5">
              {internalFolders.map(def => {
                // Strict source separation: Categories/Labels Sent shows the
                // SYSTEM sent count only (systemStats.sent) — mailbox sent
                // mail lives in the Mail → Sent folder alone.
                return folderBtn(def, def.badgeKey as keyof Stats | undefined, undefined, systemStats);
              })}
            </div>
          </div>

          {/* Mail — the email folders (Inbox/Sent/Draft/Waiting/Failed/Queued/Spam/Trash) */}
          <div>
            {groupLabel('Mail')}
            <div className="space-y-0.5">
              {mailFolders.map(def => {
                // Strict source separation: Mail Sent shows the MAILBOX sent
                // count only (mailboxStats.sent) — system sent mail lives in
                // the Categories/Labels → Sent folder alone.
                return folderBtn(def, def.badgeKey as keyof Stats | undefined, undefined, mailboxStats);
              })}
            </div>
          </div>
        </div>

        {/* Bottom — Communications Setting + Manage Folder only */}
        <div className="shrink-0 border-t border-[var(--border-color)] px-2 py-2 space-y-0.5">
          <button
            onClick={() => handleFolderChange('settings')}
            title="System communication settings, Websmith Mail accounts, Mailbox management, Templates, Signatures and Auto Reply"
            className={`relative w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
              settingsActive ? 'bg-blue-500/15 text-blue-400' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 hover:text-[var(--text-primary)]'
            }`}
          >
            {settingsActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-0.5 rounded-full bg-blue-400" />}
            <Settings size={14} className="flex-shrink-0" />
            <span className="flex-1 text-left truncate">Communications Setting</span>
          </button>
          <button
            onClick={() => setShowFolderManager(true)}
            title="Create, rename, delete and restore conversation folders"
            className="relative w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 hover:text-[var(--text-primary)] transition-colors"
          >
            <FolderCog size={14} className="flex-shrink-0" />
            <span className="flex-1 text-left truncate">Manage Folder</span>
          </button>
        </div>
      </aside>
    );
  };

  // ---- Middle pane: folder chips + email list ----
  const renderFolderChips = () => (
    <div className="flex items-center gap-1 px-3 py-1.5 border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/20 shrink-0 overflow-x-auto scrollbar-thin">
      {FOLDER_CHIPS.map(chip => {
        const active = activeFolder === chip.key;
        const badge = chip.badgeKey ? (
          chip.key === 'all' || chip.key === 'int-trash' ? systemStats[chip.badgeKey]
            : mailboxStats[chip.badgeKey]
        ) : 0;
        return (
          <button key={chip.key} onClick={() => handleFolderChange(chip.key)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium whitespace-nowrap transition-colors ${active ? 'bg-blue-500/20 text-blue-400' : 'text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]/40 hover:text-[var(--text-primary)]'}`}>
            {chip.label}
            {badge > 0 && <span className="px-1 rounded-full bg-blue-500/20 text-blue-400 text-[9px] font-bold">{badge}</span>}
          </button>
        );
      })}
      <button onClick={() => setShowFilter(!showFilter)} title="Filter"
        className={`p-1 rounded-lg transition-colors ${showFilter ? 'bg-blue-500/15 text-blue-400' : 'text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]/40'}`}>
        <Filter size={11} />
      </button>
    </div>
  );

  const renderMiddle = () => {
    if (activeFolderDef.kind === 'list') {
      return (
        <div className="flex flex-col min-h-0 h-full">
          {renderFolderChips()}
          {renderListTable()}
        </div>
      );
    }
    switch (activeFolderDef.kind) {
      case 'queue': return renderQueueList();
      case 'logs': return renderLogsList();
      case 'history': return renderHistoryList();
      case 'mailboxes': return renderMailboxGrid();
      case 'settings': return renderSettings();
      case 'templates': return renderTemplatesList();
      case 'signatures': return renderSignaturesList();
      case 'auto-reply': return renderAutoReplyList();
      case 'empty': return renderEmptyFolder();
      default: return renderListTable();
    }
  };

  // ---- Conversation list (middle pane, email-client style) ----
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
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border-color)] shrink-0">
          <input type="checkbox" checked={selectedIds.size === conversations.length && conversations.length > 0} onChange={toggleSelectAll} className="accent-blue-500" />
          <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">{displayConversations.length} conversation(s)</span>
          {selectedIds.size > 0 && <span className="text-[10px] text-blue-400 ml-auto">{selectedIds.size} selected</span>}
        </div>
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/20 shrink-0">
          {(['all', 'unread', 'read'] as const).map(f => (
            <button key={f} onClick={() => setReadFilter(f)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors ${readFilter === f ? 'bg-blue-500/20 text-blue-400' : 'text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]/40'}`}>
              {f === 'all' ? 'All' : f === 'unread' ? `Unread (${conversations.filter(c => (c.unread_replies || 0) > 0).length})` : `Read (${conversations.filter(c => !(c.unread_replies || 0)).length})`}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin divide-y divide-[var(--border-color)]">
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
                className={`flex items-start gap-3 px-3 py-2.5 cursor-pointer transition-colors ${sel ? 'bg-blue-500/10' : unread ? 'hover:bg-[var(--bg-tertiary)]/20 bg-[var(--bg-tertiary)]/5' : 'hover:bg-[var(--bg-tertiary)]/20'}`}
              >
                <div className="w-5 flex-shrink-0 mt-0.5" onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={sel} onChange={() => toggleSelect(conv.id)} className="accent-blue-500" />
                </div>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${unread ? 'bg-blue-500/20 text-blue-400' : 'bg-[var(--bg-tertiary)]/40 text-[var(--text-secondary)]'}`}>
                  {initial}
                </div>
                <div className="flex-1 min-w-0">
                  {/* Line 1 — sender name + unread indicator */}
                  <div className="flex items-center gap-2 min-w-0">
                    <p className={`text-xs truncate min-w-0 ${unread ? 'text-[var(--text-primary)] font-semibold' : 'text-[var(--text-secondary)]'}`}>{sender}</p>
                    {unread && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" title="Unread" />}
                  </div>
                  {/* Line 2 — sender email */}
                  <p className="text-[10px] text-[var(--text-muted)] truncate mt-0.5">{conv.customer_email}</p>
                  {/* Line 3 — subject / content */}
                  <p className={`text-xs truncate mt-1 ${unread ? 'text-[var(--text-primary)] font-medium' : 'text-[var(--text-secondary)]'}`}>{conv.subject || '(No subject)'}</p>
                  {/* Line 4 — category / priority / attachments / date (reserved slots, never overlap) */}
                  <div className="flex items-center gap-3 mt-1.5 min-w-0">
                    <CategoryBadge category={conv.category} />
                    <span className={`text-[10px] font-medium flex items-center gap-1 flex-shrink-0 whitespace-nowrap ${prio.color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${prio.dot}`} /> {prio.label}
                    </span>
                    {conv.attachment_count > 0 && (
                      <span className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] flex-shrink-0">
                        <Paperclip size={10} /> {conv.attachment_count}
                      </span>
                    )}
                    {conv.product_id || conv.license_key ? (
                      <span className="text-[9px] text-[var(--text-muted)] truncate min-w-0">
                        {conv.product_id ? `Product ${conv.product_id}` : ''}{conv.product_id && conv.license_key ? ' · ' : ''}{conv.license_key || ''}
                      </span>
                    ) : null}
                    <span className="ml-auto text-[10px] text-[var(--text-muted)] whitespace-nowrap flex-shrink-0 pl-2">{new Date(conv.updated_at).toLocaleDateString()}</span>
                  </div>
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
    return (
      <div className="flex flex-col min-h-0 h-full">
        {/* System Email / Universal Email header — the dedicated Send action.
            Sends through the SAME existing backend (admin/communication/send)
            with the configured system sender (From dropdown, never no-reply by
            default); the send is recorded in Sent (email_sent=true) and the
            history + Sent badge refresh immediately via the dialog onSent. */}
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/20 shrink-0">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Universal Email · System Email History</p>
            <p className="text-[10px] text-[var(--text-muted)] truncate mt-0.5">All outbound system emails with delivery status</p>
          </div>
          <button onClick={openCompose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-medium transition-colors shrink-0">
            <Send size={12} /> Send Email
          </button>
        </div>
        {history.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)]">
            <MailOpen size={32} className="mb-2 opacity-30" />
            <p className="text-xs">No emails sent yet</p>
          </div>
        ) : (
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
        )}
      </div>
    );
  };

  const renderMailboxGrid = () => {
    if (loading) return <div className="flex-1 flex items-center justify-center"><Loader2 className="h-6 w-6 text-blue-400 animate-spin" /></div>;
    if (mailboxes.length === 0) return (
      <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)] gap-3">
        <AtSign size={32} className="opacity-30" />
        <p className="text-xs">No mailboxes configured</p>
        <button onClick={() => { setEditingMailbox(null); setMailboxForm(newMailboxForm()); setMailboxFormError(null); setMailboxTest({ running: false, results: null }); setShowMailboxForm(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors">
          <Plus size={13} /> Add Mailbox
        </button>
      </div>
    );
    const fmtAgo = (iso?: string | null) => {
      if (!iso) return 'never';
      const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
      if (s < 60) return 'just now';
      if (s < 3600) return `${Math.floor(s / 60)}m ago`;
      if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
      return `${Math.floor(s / 86400)}d ago`;
    };
    return (
      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-3">
        <div className="flex items-center justify-between gap-2 px-1 flex-wrap">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Mailboxes — External IMAP/SMTP</p>
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{mailboxes.length} external mailbox(es) — real IMAP receive + SMTP send</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={() => { setEditingMailbox(null); setMailboxForm(newMailboxForm()); setMailboxFormError(null); setMailboxTest({ running: false, results: null }); setShowMailboxForm(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors">
              <Plus size={13} /> Add Mailbox
            </button>
          </div>
        </div>
        <div className="space-y-2">
          {mailboxes.map(mb => {
            const h = mailboxHealth(mb);
            const isEnabled = mb.is_enabled !== false;
            const busyKey = (e: string) => busy === `${e}:${mb.id}`;
            const label = mb.display_name || mb.email_address || 'Mailbox';
            return (
              <div
                key={mb.id}
                onClick={() => loadMailboxDetail(mb.id)}
                className={`rounded-xl border p-3 transition-colors cursor-pointer ${selectedMailbox?.id === mb.id ? 'border-blue-500/40 bg-blue-500/10' : isEnabled ? 'border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 hover:bg-[var(--bg-tertiary)]/20' : 'border-gray-500/20 bg-[var(--bg-tertiary)]/5 opacity-80'}`}
              >
                {/* Header: identity + status + Enable/Disable toggle */}
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${isEnabled ? 'bg-blue-500/20 text-blue-400' : 'bg-[var(--bg-tertiary)]/40 text-[var(--text-secondary)]'}`}>
                    {(label || 'M').trim()[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-[var(--text-primary)] truncate">{label}</span>
                      <Badge className={h.color}>{h.label}</Badge>
                      <Badge className="text-purple-400 bg-purple-500/10">Mailbox</Badge>
                      {mb.is_default_sender && <Badge className="text-blue-400 bg-blue-500/10">Default Sender</Badge>}
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 flex items-center gap-1 min-w-0">
                      <AtSign size={10} className="text-[var(--text-muted)] flex-shrink-0" />
                      <span className="truncate">{mb.email_address || '(no email set)'}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] shrink-0">
                    <span className="hidden sm:inline">Enabled</span>
                    <Toggle checked={isEnabled} onChange={() => mailboxAction(mb.id, isEnabled ? 'disable' : 'enable', 'POST', undefined, isEnabled ? 'Mailbox disabled' : 'Mailbox enabled')} />
                  </div>
                </div>

                {/* Purpose */}
                <p className="text-[10px] text-[var(--text-muted)] mt-2">Purpose: External IMAP/SMTP mailbox.</p>

                {/* Connection / sync status */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 text-[10px] text-[var(--text-muted)] mt-2">
                  <span className="flex items-center gap-1">
                    <Database size={10} className="text-blue-400 flex-shrink-0" /> IMAP:
                    <span className="truncate">{mb.imap_host || '-'}{mb.imap_port ? `:${mb.imap_port}` : ''}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Server size={10} className="text-emerald-400 flex-shrink-0" /> SMTP:
                    <span className="truncate">{mb.smtp_host || '-'}{mb.smtp_port ? `:${mb.smtp_port}` : ''}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <RefreshCw size={10} className="text-amber-400 flex-shrink-0" /> Sync:
                    <span>{fmtAgo(mb.last_sync)}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Activity size={10} className="text-purple-400 flex-shrink-0" /> Health:
                    <HealthBadge h={h} />
                  </span>
                </div>
                {mb.last_error && <p className="text-[10px] text-red-400 break-words mt-1">{mb.last_error}</p>}

                {/* Actions: Test / Sync / Set Default / Edit / Delete */}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  <button onClick={(e) => { e.stopPropagation(); mailboxAction(mb.id, 'test', 'POST', undefined, 'Connection test completed'); }} disabled={busyKey('test')}
                    className="flex items-center gap-1 px-2 py-1 rounded-md border border-[var(--border-color)] text-[10px] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 disabled:opacity-50">
                    {busyKey('test') ? <Loader2 size={10} className="animate-spin" /> : <ShieldCheck size={10} />} Test
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); mailboxAction(mb.id, 'sync', 'POST', undefined, 'IMAP sync completed'); }} disabled={busyKey('sync')}
                    className="flex items-center gap-1 px-2 py-1 rounded-md border border-[var(--border-color)] text-[10px] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 disabled:opacity-50">
                    {busyKey('sync') ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />} Sync
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); mailboxAction(mb.id, 'set-default', 'POST', undefined, 'Default sender updated'); }} disabled={busyKey('set-default') || mb.is_default_sender}
                    className="flex items-center gap-1 px-2 py-1 rounded-md border border-[var(--border-color)] text-[10px] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 disabled:opacity-50">
                    {busyKey('set-default') ? <Loader2 size={10} className="animate-spin" /> : <Flag size={10} />} Set Default
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setEditingMailbox(mb); setMailboxForm({ provider: mb.provider || 'custom', email_address: mb.email_address, display_name: mb.display_name, imap_host: mb.imap_host, imap_port: mb.imap_port, imap_secure: mb.imap_secure, imap_username: mb.imap_username, smtp_host: mb.smtp_host, smtp_port: mb.smtp_port, smtp_secure: mb.smtp_secure, smtp_username: mb.smtp_username, signature: mb.signature, is_enabled: isEnabled, is_default_sender: mb.is_default_sender === true, auto_reply_enabled: mb.auto_reply_enabled, auto_reply_message: mb.auto_reply_message, auto_reply_template_key: mb.auto_reply_template_key, auto_reply_signature: mb.auto_reply_signature, imap_password: '', smtp_password: '' }); setMailboxFormError(null); setMailboxTest({ running: false, results: null }); setShowMailboxForm(true); }}
                    className="flex items-center gap-1 px-2 py-1 rounded-md border border-[var(--border-color)] text-[10px] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30">
                    <Pencil size={10} /> Edit
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setShowDeleteMailboxConfirm(mb.id); }} disabled={busy === `delete:${mb.id}`}
                    className="flex items-center gap-1 px-2 py-1 rounded-md border border-red-500/20 text-[10px] text-red-400 hover:bg-red-500/10 disabled:opacity-50">
                    <Trash2 size={10} /> Delete
                  </button>
                </div>

                {/* Send test email */}
                <div className="flex items-center gap-1.5 mt-2" onClick={e => e.stopPropagation()}>
                  <input
                    type="email"
                    placeholder="Send test email to..."
                    value={testMailDraft[mb.id] || ''}
                    onChange={e => setTestMailDraft(prev => ({ ...prev, [mb.id]: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter' && testMailDraft[mb.id]?.trim()) mailboxAction(mb.id, 'send-test', 'POST', { to_email: testMailDraft[mb.id].trim() }, 'Test email sent'); }}
                    className="flex-1 min-w-0 px-2.5 py-1.5 rounded-md border border-[var(--border-color)] bg-[var(--bg-tertiary)]/20 text-[var(--text-primary)] text-[10px] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  <button onClick={() => { mailboxAction(mb.id, 'send-test', 'POST', { to_email: testMailDraft[mb.id]?.trim() }, 'Test email sent'); setTestMailDraft(prev => ({ ...prev, [mb.id]: '' })); }}
                    disabled={busyKey('send-test') || !testMailDraft[mb.id]?.trim()}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-medium transition-colors disabled:opacity-50 shrink-0">
                    {busyKey('send-test') ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />} Send Test Email
                  </button>
                </div>

                {/* Expanded detail when this card is selected (click the card) */}
                {selectedMailbox?.id === mb.id && mailboxDetail?.sync_logs && mailboxDetail.sync_logs.length > 0 && (
                  <div className="mt-2 rounded-lg border border-[var(--border-color)] p-2.5" onClick={e => e.stopPropagation()}>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">Sync Logs ({mailboxDetail.sync_logs.length})</p>
                    <div className="space-y-1">
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
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ---- Communications Setting workspace (single consolidated configuration
  // destination: General + Websmith Mail accounts + Mailbox management +
  // Templates + Signatures + Auto Reply). No duplicate navigation entries and
  // no duplicate controls — the old Manage Mails/Templates/Signatures/Auto
  // Reply sidebar destinations all resolve here. ----
  const renderSettingsWorkspace = () => {
    const tabs: { key: SettingsSection; label: string; icon: any }[] = [
      { key: 'general', label: 'General', icon: Settings },
      { key: 'accounts', label: 'Websmith Mail', icon: AtSign },
      { key: 'mailboxes', label: 'Mailboxes', icon: Inbox },
      { key: 'templates', label: 'Templates', icon: BookMarked },
      { key: 'signatures', label: 'Signatures', icon: Signature },
      { key: 'auto-reply', label: 'Auto Reply', icon: Zap },
    ];
    return (
      <div className="flex flex-col min-h-0 w-full">
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/20 shrink-0 overflow-x-auto scrollbar-thin">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const active = settingsSection === tab.key;
            return (
              <button key={tab.key} onClick={() => setSettingsSection(tab.key)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium whitespace-nowrap transition-colors ${active ? 'bg-blue-500/20 text-blue-400' : 'text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]/40 hover:text-[var(--text-primary)]'}`}>
                <Icon size={12} /> {tab.label}
              </button>
            );
          })}
        </div>
        <div className="flex-1 min-h-0 flex">
          {settingsSection === 'general' && renderSettings()}
          {settingsSection === 'accounts' && renderSettingsAccounts()}
          {settingsSection === 'mailboxes' && (
            <div className="flex-1 min-w-0 flex flex-col">{renderMailboxGrid()}</div>
          )}
          {settingsSection === 'templates' && (
            <>
              <div className="w-[300px] min-w-[260px] flex-shrink-0 flex flex-col border-r border-[var(--border-color)]">{renderTemplatesList()}</div>
              <div className="flex-1 min-w-0 flex flex-col">{renderTemplateEditor()}</div>
            </>
          )}
          {settingsSection === 'signatures' && (
            <>
              <div className="w-[300px] min-w-[260px] flex-shrink-0 flex flex-col border-r border-[var(--border-color)]">{renderSignaturesList()}</div>
              <div className="flex-1 min-w-0 flex flex-col">{renderSignatureEditor()}</div>
            </>
          )}
          {settingsSection === 'auto-reply' && renderAutoReplyList()}
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

        <div className="rounded-xl border border-red-500/20 bg-red-500/5">
          <div className="px-3 py-2 border-b border-[var(--border-color)]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-red-400">Email Deletion</p>
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Controls permanent conversation/email deletion across the Communication Center.</p>
          </div>
          <div className="p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-[var(--text-primary)] font-medium">Allow Email Deletion</p>
              <p className="text-[10px] text-[var(--text-secondary)] mt-0.5 leading-relaxed">
                When enabled, admins can permanently delete conversations (messages, metadata, drafts and unused attachments).
                When disabled, Delete Forever controls are hidden <span className="text-[var(--text-muted)]">and the backend rejects every delete request</span>.
              </p>
            </div>
            <Toggle checked={allowEmailDeletion} onChange={toggleAllowEmailDeletion} />
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
                  <span className="text-xs text-[var(--text-primary)] font-medium truncate">{systemAccountUiLabel(a)}</span>
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
            {commMailboxes.length === 0 && <p className="text-xs text-[var(--text-muted)]">No mailboxes configured yet — add them under Mailboxes.</p>}
            {commMailboxes.map((mb: Mailbox) => (
              <div key={mb.id} className="rounded-lg border border-[var(--border-color)] p-2.5">
                <div className="flex items-center gap-2">
                  <HealthBadge h={mailboxHealth(mb)} />
                  <span className="text-xs text-[var(--text-primary)] font-medium truncate">{mb.display_name || mb.email_address}</span>
                  {mb.is_default_sender && <Badge className="text-blue-400 bg-blue-500/10">Default Sender</Badge>}
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
        <div className="flex items-center justify-between gap-2 px-1 flex-wrap">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Websmith Mail — System Accounts</p>
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Company-managed sender routing accounts. Toggles persist via the real backend configuration.</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={addSystemAccount}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors">
              <Plus size={13} /> Add Mail Account
            </button>
            <button onClick={() => loadCommsSettings()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-color)] text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 transition-colors">
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
        </div>

        {accounts.length === 0 && <p className="text-xs text-[var(--text-muted)] px-1">No mail accounts configured.</p>}

        {accounts.map((a: any) => {
          const isActive = a.is_active === true;
          const matching = (commMailboxes || []).find(m => m.email_address.toLowerCase() === String(a.email || '').toLowerCase()) || null;
          const h = matching ? mailboxHealth(matching) : null;
          const editing = editAccountId === a.id;
          return (
            <div key={a.id} className={`rounded-xl border p-3 transition-colors ${isActive ? 'border-[var(--border-color)] bg-[var(--bg-tertiary)]/5' : 'border-gray-500/20 bg-[var(--bg-tertiary)]/5 opacity-80'}`}>
              {/* Header: identity + status + Enable/Disable toggle */}
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${isActive ? 'bg-blue-500/20 text-blue-400' : 'bg-[var(--bg-tertiary)]/40 text-[var(--text-secondary)]'}`}>
                  {(systemAccountUiLabel(a) || 'A').trim()[0]?.toUpperCase() || '?'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-[var(--text-primary)] truncate">{systemAccountUiLabel(a)}</span>
                    <Badge className={isActive ? 'text-green-400 bg-green-500/10' : 'text-gray-400 bg-gray-500/10'}>{isActive ? 'Active' : 'Inactive'}</Badge>
                    <Badge className="text-purple-400 bg-purple-500/10">System</Badge>
                    {a.is_default_sender && <Badge className="text-blue-400 bg-blue-500/10">Default Sender</Badge>}
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 flex items-center gap-1 min-w-0">
                    <AtSign size={10} className="text-[var(--text-muted)] flex-shrink-0" />
                    <span className="truncate">{a.email || '(no email set)'}</span>
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] shrink-0">
                  <span className="hidden sm:inline">Enabled</span>
                  <Toggle checked={isActive} onChange={() => toggleSystemAccount(a.id)} disabled={busy === 'save-comm-settings'} />
                  {busy === 'save-comm-settings' && <Loader2 size={11} className="animate-spin text-blue-400" />}
                </div>
              </div>

              {/* Purpose */}
              <p className="text-[10px] text-[var(--text-muted)] mt-2">Purpose: {MAILBOX_LABELS[String(a.id).replace(/-/g, '_')]?.purpose || (a.type === 'sales' ? 'Sales enquiries and purchase conversations.' : a.type === 'support' ? 'Customer support conversations.' : 'Automated system emails (OTP, license, payments, notifications).')}</p>

              {/* Connection / sync status (real mailbox row when present, else honest "n/a") */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 text-[10px] text-[var(--text-muted)] mt-2">
                <span className="flex items-center gap-1">
                  <Database size={10} className="text-blue-400 flex-shrink-0" /> IMAP:
                  {matching ? <span className={matching.connection_status === 'connected' ? 'text-green-400' : matching.connection_status === 'failed' ? 'text-red-400' : ''}>{matching.connection_status || 'unknown'}</span> : <span className="text-[var(--text-muted)]">n/a (native)</span>}
                </span>
                <span className="flex items-center gap-1">
                  <Server size={10} className="text-emerald-400 flex-shrink-0" /> SMTP:
                  {matching ? <span className="truncate">{matching.smtp_host || '-'}{matching.smtp_port ? `:${matching.smtp_port}` : ''}</span> : <span className="text-[var(--text-muted)]">n/a (native)</span>}
                </span>
                <span className="flex items-center gap-1">
                  <RefreshCw size={10} className="text-amber-400 flex-shrink-0" /> Sync:
                  {matching ? <span>{fmtSync(matching.last_sync)}</span> : <span className="text-[var(--text-muted)]">n/a (native)</span>}
                </span>
                <span className="flex items-center gap-1">
                  <Activity size={10} className="text-purple-400 flex-shrink-0" /> Health:
                  {h ? <HealthBadge h={h} /> : <span className="text-[var(--text-muted)]">system (no external mailbox)</span>}
                </span>
              </div>
              {matching?.last_error && <p className="text-[10px] text-red-400 break-words mt-1">{matching.last_error}</p>}

              {/* Inline edit */}
              {editing && (
                <div className="mt-2 rounded-lg border border-[var(--border-color)] p-2 space-y-2">
                  <Field label="Display Name"><input type="text" value={accountDraft?.display_name ?? a.display_name} onChange={e => setAccountDraft({ ...(accountDraft || a), display_name: e.target.value })} className={inputCls} /></Field>
                  <Field label="Email"><input type="email" value={accountDraft?.email ?? a.email} onChange={e => setAccountDraft({ ...(accountDraft || a), email: e.target.value })} className={inputCls} /></Field>
                  <Field label="Reply-To"><input type="email" value={accountDraft?.reply_to ?? a.reply_to} onChange={e => setAccountDraft({ ...(accountDraft || a), reply_to: e.target.value })} className={inputCls} /></Field>
                  <Field label="Signature"><textarea rows={2} value={accountDraft?.signature ?? a.signature} onChange={e => setAccountDraft({ ...(accountDraft || a), signature: e.target.value })} className={inputCls} /></Field>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => saveAccountDraft(a.id, { display_name: accountDraft?.display_name ?? a.display_name, email: accountDraft?.email ?? a.email, reply_to: accountDraft?.reply_to ?? a.reply_to, signature: accountDraft?.signature ?? a.signature })} disabled={busy === 'save-comm-settings'}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-medium disabled:opacity-50">
                      {busy === 'save-comm-settings' ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />} Save
                    </button>
                    <button onClick={() => setEditAccountId(null)} className="px-2.5 py-1 rounded-lg border border-[var(--border-color)] text-[10px] text-[var(--text-secondary)]">Cancel</button>
                  </div>
                </div>
              )}

              {/* Actions: Edit / Test / Sync / Delete */}
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
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
                <button onClick={() => deleteSystemAccount(a.id)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] transition-colors ${isProtectedSystemAccount(a) ? 'border-gray-500/20 text-[var(--text-muted)] cursor-not-allowed' : 'border-red-500/20 text-red-400 hover:bg-red-500/10'}`}
                  title={isProtectedSystemAccount(a) ? 'Built-in system accounts cannot be deleted — disable them instead' : 'Delete this mail account'}>
                  <Trash2 size={10} /> Delete
                </button>
              </div>
            </div>
          );
        })}

        <p className="text-[10px] text-[var(--text-muted)] px-1 pt-1 leading-relaxed">System accounts are routing identities controlled by the backend ({commMailboxes.length} external mailbox(es) configured). External IMAP/SMTP mailboxes are managed under the Mailboxes section.</p>
      </div>
    );
  };

  // ---- Templates panel ----
  const renderTemplatesList = () => {
    if (loading) return <div className="flex-1 flex items-center justify-center"><Loader2 className="h-6 w-6 text-blue-400 animate-spin" /></div>;
    const filtered = templates.filter(t =>
      !templateSearch.trim() ||
      t.email_type.toLowerCase().includes(templateSearch.toLowerCase()) ||
      (t.subject || '').toLowerCase().includes(templateSearch.toLowerCase())
    );
    return (
      <div className="flex flex-col min-h-0 h-full">
        <div className="px-3 py-2 border-b border-[var(--border-color)] shrink-0 space-y-2">
          <p className="text-xs text-[var(--text-muted)]">{templates.length} templates — insert into the reply composer or use for auto-reply.</p>
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input type="text" placeholder="Search templates..." value={templateSearch} onChange={e => setTemplateSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)]/20 text-[var(--text-primary)] text-xs placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin divide-y divide-[var(--border-color)]">
          {filtered.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)] py-10">
              <BookMarked size={28} className="mb-2 opacity-30" />
              <p className="text-xs">No templates found</p>
            </div>
          )}
          {filtered.map(t => (
            <button
              key={t.email_type}
              onClick={() => { setEditingTemplate(t); setTemplateDraft({ ...t }); }}
              className={`w-full text-left px-3 py-2.5 hover:bg-[var(--bg-tertiary)]/20 transition-colors ${editingTemplate?.email_type === t.email_type ? 'bg-blue-500/10' : ''}`}
            >
              <div className="flex items-center gap-2">
                <FileText size={12} className="text-[var(--text-muted)] flex-shrink-0" />
                <span className="text-xs text-[var(--text-primary)] font-medium truncate flex-1">{t.email_type}</span>
                {!t.is_active && <Badge className="text-gray-400 bg-gray-500/10">Inactive</Badge>}
              </div>
              <p className="text-[10px] text-[var(--text-muted)] truncate mt-0.5">{t.subject || '(no subject)'}</p>
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderTemplateEditor = () => {
    if (!editingTemplate || !templateDraft) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)] text-center px-6 text-xs">
          <BookMarked size={28} className="mb-2 opacity-30" />
          <p>Select a template to view or edit it. Templates are also available in the reply composer (Template ▼) and the Auto Reply panel.</p>
        </div>
      );
    }
    const t = templateDraft;
    return (
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3">
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 p-3">
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-blue-400" />
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t.email_type}</h3>
            {detail && (
              <button onClick={() => insertTemplateIntoComposer(t.email_type)}
                className="ml-auto flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-medium transition-colors">
                <PenLine size={11} /> Insert into Reply
              </button>
            )}
          </div>
          <div className="mt-3 space-y-2">
            <Field label="Subject">
              <input type="text" value={t.subject || ''} onChange={e => setTemplateDraft({ ...t, subject: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Plain text body (used by the composer)">
              <textarea rows={6} value={t.plain_text || ''} onChange={e => setTemplateDraft({ ...t, plain_text: e.target.value })} className={`${inputCls} resize-y`} />
            </Field>
            <Field label="HTML body">
              <textarea rows={5} value={t.body || ''} onChange={e => setTemplateDraft({ ...t, body: e.target.value })} className={`${inputCls} resize-y font-mono text-[10px]`} />
            </Field>
            <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              <input type="checkbox" checked={t.is_active !== false} onChange={e => setTemplateDraft({ ...t, is_active: e.target.checked })} className="accent-blue-500" />
              Active
            </label>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={() => updateTemplate(t)} disabled={busy === 'save-template'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-medium transition-colors disabled:opacity-50">
              {busy === 'save-template' ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />} Save Template
            </button>
            <button onClick={() => { setEditingTemplate(null); setTemplateDraft(null); }}
              className="px-3 py-1.5 rounded-lg border border-[var(--border-color)] text-[11px] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 transition-colors">Close</button>
          </div>
        </div>
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">Preview</p>
          <div className="rounded-lg border border-dashed border-[var(--border-color)] bg-[var(--bg-primary)]/50 p-3">
            <p className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap break-words">{templateTextOf(t) || '(empty template)'}</p>
          </div>
        </div>
      </div>
    );
  };

  // ---- Signatures panel ----
  const renderSignaturesList = () => {
    return (
      <div className="flex flex-col min-h-0 h-full">
        <div className="px-3 py-2 border-b border-[var(--border-color)] shrink-0">
          <p className="text-xs text-[var(--text-muted)]">{signatures.length} signature(s) — select a signature to edit, or create a new one.</p>
          <button onClick={() => setSignatureForm({ open: true, id: null, name: '', content: '', enabled: true })}
            className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors">
            <Plus size={13} /> Add Signature
          </button>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin divide-y divide-[var(--border-color)]">
          {signatures.length === 0 && (
            <div className="flex flex-col items-center justify-center text-[var(--text-muted)] py-10">
              <Signature size={28} className="mb-2 opacity-30" />
              <p className="text-xs">No signatures yet — create one to attach to replies and auto-replies.</p>
            </div>
          )}
          {signatures.map(s => {
            const assignedMailboxes = mailboxes.filter(mb => mb.signature === s.content);
            return (
              <div key={s.id} className="px-3 py-2.5 hover:bg-[var(--bg-tertiary)]/20 transition-colors">
                <div className="flex items-center gap-2">
                  <Signature size={12} className="text-[var(--text-muted)] flex-shrink-0" />
                  <span className="text-xs text-[var(--text-primary)] font-medium truncate flex-1">{s.name}</span>
                  {s.is_default && <Badge className="text-blue-400 bg-blue-500/10">Default</Badge>}
                  <Badge className={s.enabled !== false ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'}>
                    {s.enabled !== false ? 'Enabled' : 'Disabled'}
                  </Badge>
                  <Toggle
                    checked={s.enabled !== false}
                    onChange={() => updateSignature(s.id, s.name, s.content, !(s.enabled !== false))}
                    disabled={busy === 'save-comm-settings'}
                  />
                  {assignedMailboxes.length > 0 && (
                    <span className="text-[9px] text-[var(--text-muted)] truncate flex-1 ml-2" title={assignedMailboxes.map(m => m.email_address).join(', ')}>
                      → {assignedMailboxes.map(m => m.display_name || m.email_address).join(', ')}
                    </span>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); if (confirm(`Delete signature "${s.name}"? This cannot be undone.`)) deleteSignature(s.id); }}
                    disabled={busy === 'save-comm-settings' || busy?.toString().startsWith('assign-sig:')}
                    className="p-1 text-[var(--text-muted)] hover:text-red-400 transition-colors disabled:opacity-50"
                    title="Delete signature"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
                <p className="text-[10px] text-[var(--text-muted)] whitespace-pre-wrap break-words mt-1 line-clamp-2">{s.content || '(empty)'}</p>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderSignatureEditor = () => {
    if (!signatureForm.open) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)] text-center px-6 text-xs">
          <Signature size={28} className="mb-2 opacity-30" />
          <p>Create, edit and delete reusable signatures. Signatures are inserted into the reply composer (Signature ▼), assigned to mailboxes, and used by Auto Reply.</p>
        </div>
      );
    }
    const isNew = !signatureForm.id;
    const existing = isNew ? null : signatures.find(s => s.id === signatureForm.id);
    return (
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3">
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 p-3">
          <div className="flex items-center gap-2">
            <Signature size={14} className="text-blue-400" />
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">{isNew ? 'Add Signature' : 'Edit Signature'}</h3>
          </div>
          <div className="mt-3 space-y-2">
            <Field label="Name">
              <input type="text" value={signatureForm.name} onChange={e => setSignatureForm({ ...signatureForm, name: e.target.value })} className={inputCls} placeholder="e.g. Websmith Support" />
            </Field>
            <Field label="Content">
              <textarea rows={5} value={signatureForm.content} onChange={e => setSignatureForm({ ...signatureForm, content: e.target.value })}
                className={`${inputCls} resize-y`} placeholder={"Best regards,\nThe Support Team\nsupport@websmithdigital.com"} />
            </Field>
            <Field label="Status">
              <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                <Toggle checked={signatureForm.enabled !== false} onChange={() => setSignatureForm(prev => ({ ...prev, enabled: !(prev.enabled !== false) }))} />
                <span>{signatureForm.enabled !== false ? 'Enabled' : 'Disabled'}</span>
              </label>
            </Field>
          </div>
          <div className="flex items-center gap-1.5 mt-3">
            {isNew ? (
              <button onClick={() => { if (!signatureForm.name.trim() && !signatureForm.content.trim()) { showToast('err', 'Signature name or content is required'); return; } addSignature(signatureForm.name, signatureForm.content, signatureForm.enabled); setSignatureForm({ open: false, id: null, name: '', content: '', enabled: true }); }}
                disabled={busy === 'save-comm-settings'}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-medium transition-colors disabled:opacity-50">
                <Plus size={11} /> Create Signature
              </button>
            ) : (
              <>
                <button onClick={() => { updateSignature(signatureForm.id!, signatureForm.name, signatureForm.content, signatureForm.enabled); setSignatureForm({ open: false, id: null, name: '', content: '', enabled: true }); }}
                  disabled={busy === 'save-comm-settings'}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-medium transition-colors disabled:opacity-50">
                  <Save size={11} /> Save Signature
                </button>
                <button onClick={() => { setDefaultSignature(signatureForm.id!); }}
                  disabled={busy === 'save-comm-settings' || existing?.is_default}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-color)] text-[11px] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 transition-colors disabled:opacity-50">
                  <CheckCheck size={11} /> Set Default
                </button>
                <button onClick={() => { if (confirm(`Delete signature "${signatureForm.name}"? This cannot be undone.`)) { deleteSignature(signatureForm.id!); setSignatureForm({ open: false, id: null, name: '', content: '', enabled: true }); } }}
                  disabled={busy === 'save-comm-settings'}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 text-[11px] font-medium transition-colors disabled:opacity-50">
                  <Trash2 size={11} /> Delete
                </button>
              </>
            )}
            <button onClick={() => setSignatureForm({ open: false, id: null, name: '', content: '', enabled: true })}
              className="px-3 py-1.5 rounded-lg border border-[var(--border-color)] text-[11px] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 transition-colors">Close</button>
          </div>
        </div>
        {!isNew && mailboxes.length > 0 && (
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">Assign to Mailbox</p>
            <p className="text-[10px] text-[var(--text-muted)] mb-2">Copy this signature into a mailbox so every email sent through it includes the signature.</p>
            <div className="space-y-1">
              {mailboxes.map(mb => (
                <button key={mb.id} onClick={() => assignSignatureToMailbox(mb.id, existing || { id: signatureForm.id!, name: signatureForm.name, content: signatureForm.content, is_default: false, enabled: signatureForm.enabled })}
                  disabled={busy === `assign-sig:${mb.id}`}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-[var(--border-color)] text-[11px] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 transition-colors disabled:opacity-50">
                  {busy === `assign-sig:${mb.id}` ? <Loader2 size={11} className="animate-spin" /> : <AtSign size={11} />}
                  <span className="flex-1 text-left truncate">{mb.display_name || mb.email_address}</span>
                  <span className="text-[9px] text-[var(--text-muted)] truncate">{mb.email_address}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">Preview</p>
          <div className="rounded-lg border border-dashed border-[var(--border-color)] bg-[var(--bg-primary)]/50 p-3">
            <p className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap break-words">{signatureForm.content || '(empty signature)'}</p>
          </div>
        </div>
      </div>
    );
  };

  // ---- Auto Reply panel ----
  const renderAutoReplyList = () => {
    if (loading) return <div className="flex-1 flex items-center justify-center"><Loader2 className="h-6 w-6 text-blue-400 animate-spin" /></div>;
    if (mailboxes.length === 0) return (
      <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)] gap-3 px-6 text-center">
        <Zap size={28} className="opacity-30" />
        <p className="text-xs">No external mailboxes configured yet. Add a mailbox first, then configure its auto-reply.</p>
      </div>
    );
    return (
      <div className="flex flex-col min-h-0 h-full">
        <div className="px-3 py-2 border-b border-[var(--border-color)] shrink-0">
          <p className="text-xs text-[var(--text-muted)]">{mailboxes.length} mailbox(es) — auto-replies use the selected Template + Signature for NEW incoming conversations. Edit a card and press Save.</p>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-3">
          {mailboxes.map(mb => {
            const base = {
              auto_reply_enabled: !!mb.auto_reply_enabled,
              auto_reply_template_key: mb.auto_reply_template_key || '',
              auto_reply_signature: mb.auto_reply_signature || '',
              auto_reply_message: mb.auto_reply_message || '',
            };
            const draft = autoReplyDrafts[mb.id] || base;
            const setDraft = (patch: any) => setAutoReplyDrafts(prev => ({ ...prev, [mb.id]: { ...(prev[mb.id] || base), ...patch } }));
            const unsaved = JSON.stringify(draft) !== JSON.stringify(base);
            const tpl = templates.find(t => t.email_type === draft.auto_reply_template_key);
            const sig = signatures.find(s => s.id === draft.auto_reply_signature);
            const preview = (draft.auto_reply_enabled ? (templateTextOf(tpl) || draft.auto_reply_message || '(no template selected)') + (sig?.content ? `\n\n${sig.content}` : (mb.signature ? `\n\n${mb.signature}` : '')) : 'Auto-reply is disabled for this mailbox.');
            const h = mailboxHealth(mb);
            const saving = busy === `auto-reply:${mb.id}`;
            return (
              <div key={mb.id} className={`rounded-xl border p-3 transition-colors ${draft.auto_reply_enabled ? 'border-blue-500/30 bg-blue-500/5' : 'border-[var(--border-color)] bg-[var(--bg-tertiary)]/5'}`}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-[var(--text-primary)] truncate">{mb.display_name || mb.email_address}</span>
                  <HealthBadge h={h} />
                  <div className="ml-auto flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
                    Auto Reply <Toggle checked={draft.auto_reply_enabled} onChange={() => setDraft({ auto_reply_enabled: !draft.auto_reply_enabled })} />
                  </div>
                </div>
                <p className="text-[10px] text-[var(--text-secondary)] truncate mt-1">{mb.email_address}</p>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <Field label="Reply Template">
                    <select value={draft.auto_reply_template_key} onChange={e => setDraft({ auto_reply_template_key: e.target.value })}
                      className={inputCls} disabled={saving}>
                      <option value="">— Legacy message —</option>
                      {templates.map(t => <option key={t.email_type} value={t.email_type}>{t.email_type}</option>)}
                    </select>
                  </Field>
                  <Field label="Signature">
                    <select value={draft.auto_reply_signature} onChange={e => setDraft({ auto_reply_signature: e.target.value })}
                      className={inputCls} disabled={saving}>
                      <option value="">— None —</option>
                      {signatures.filter(s => s.enabled !== false).map(s => <option key={s.id} value={s.id}>{s.name}{s.is_default ? ' (default)' : ''}</option>)}
                    </select>
                  </Field>
                </div>
                {draft.auto_reply_template_key === '' && (
                  <Field label="Legacy auto-reply message">
                    <textarea rows={2} value={draft.auto_reply_message} onChange={e => setDraft({ auto_reply_message: e.target.value })}
                      className={`${inputCls} resize-none mt-2`} placeholder="Thanks for your message — we will get back to you within 24 hours." />
                  </Field>
                )}
                <div className="mt-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">Preview</p>
                  <div className="rounded-lg border border-dashed border-[var(--border-color)] bg-[var(--bg-primary)]/50 p-3">
                    <p className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap break-words">{preview}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <button onClick={() => saveAutoReply({ ...mb, ...draft })}
                    disabled={saving || !unsaved}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/15 text-blue-400 text-[11px] font-medium hover:bg-blue-500/25 transition-colors disabled:opacity-40">
                    {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save Auto Reply
                  </button>
                  {unsaved && !saving && <span className="text-[10px] text-amber-400">Unsaved changes</span>}
                </div>
              </div>
            );
          })}
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
    if (activeFolderDef.kind === 'list') {
      if (detail) return renderEmailReader();
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)] px-6 text-center">
          <Inbox size={32} className="mb-2 opacity-30" />
          <p className="text-xs">Select a conversation from the list to read and reply to it here.</p>
        </div>
      );
    }
    switch (activeFolderDef.kind) {
      case 'queue': return renderQueueDetail();
      case 'logs': return renderLogDetail();
      case 'history': return renderHistoryDetail();
      case 'mailboxes': return renderMailboxDetail();
      case 'settings': return renderSettingsWorkspace();
      case 'templates': return renderTemplateEditor();
      case 'signatures': return renderSignatureEditor();
      case 'auto-reply': return renderAutoReplyList();
      case 'empty': return renderEmptyFolder();
      default: return <div className="flex-1" />;
    }
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
            <span className="flex items-center gap-1"><HealthBadge h={mailboxHealth(mb)} /></span>
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
            auto_reply_template_key: mb.auto_reply_template_key, auto_reply_signature: mb.auto_reply_signature,
          }); setMailboxFormError(null); setMailboxTest({ running: false, results: null }); setShowMailboxForm(true); }}
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

  // ---- Email reader (right pane; conversation + reply composer) ----
  const renderEmailReader = () => {
    if (detailLoading) return <div className="flex-1 flex items-center justify-center"><Loader2 className="h-6 w-6 text-blue-400 animate-spin" /></div>;
    if (!detail) return (
      <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)] px-6 text-center">
        <Inbox size={28} className="mb-2 opacity-30" />
        <p className="text-xs">Select a conversation to read it here.</p>
      </div>
    );
    const conv = detail.conversation;
    const unread = (conv.unread_replies || 0) > 0;
    const prio = priorityOf(conv.status);
    const receiving = accountForConversation(conv, commSettings, mailboxes);
    const receivingLabel = receiving
      ? (receiving.display_name ? `${receiving.display_name} <${receiving.email}>` : receiving.email)
      : (conv.category === 'sales' ? 'sales@websmithdigital.com' : 'support@websmithdigital.com');
    return (
      <div className="flex-1 min-h-0 flex flex-col">
        {/* Reader toolbar */}
        <div className="flex items-center gap-1 px-3 py-2 border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 shrink-0">
          <button onClick={() => openReply()} title="Reply"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-medium transition-colors">
            <Reply size={12} /> Reply
          </button>
          <button onClick={() => openReply()} title="Reply All"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--bg-tertiary)]/50 hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] text-[11px] font-medium transition-colors">
            <ReplyAll size={12} /> Reply All
          </button>
          <button onClick={openForward} title="Forward"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--bg-tertiary)]/50 hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] text-[11px] font-medium transition-colors">
            <Forward size={12} /> Forward
          </button>
          <div className="w-px h-5 bg-[var(--border-color)] mx-1" />
          <button onClick={() => readerAction('mark_unread', 'Marked as unread')} disabled={busy === 'reader:mark_unread'}
            title="Mark as unread" className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)]/50 text-[var(--text-secondary)] transition-colors">
            {busy === 'reader:mark_unread' ? <Loader2 size={13} className="animate-spin" /> : <MailOpen size={13} />}
          </button>
          <button onClick={() => readerAction('archive', 'Conversation archived')} disabled={busy === 'reader:archive'}
            title="Archive" className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)]/50 text-[var(--text-secondary)] transition-colors">
            {busy === 'reader:archive' ? <Loader2 size={13} className="animate-spin" /> : <Archive size={13} />}
          </button>
          <button onClick={trashConversation} disabled={busy === 'reader:trash'}
            title="Move to Trash" className="p-1.5 rounded-lg hover:bg-red-500/10 text-[var(--text-secondary)] hover:text-red-400 transition-colors">
            {busy === 'reader:trash' ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
          </button>
          {allowEmailDeletion && (
            <button onClick={() => setShowDeleteConfirm({ ids: [conv.id], count: 1, subject: conv.subject || undefined })}
              disabled={busy === 'permanent-delete'}
              title="Delete Forever"
              className="p-1.5 rounded-lg hover:bg-red-500/15 text-[var(--text-muted)] hover:text-red-400 transition-colors">
              {busy === 'permanent-delete' ? <Loader2 size={13} className="animate-spin" /> : <Delete size={13} />}
            </button>
          )}
          <button onClick={retryConversation} disabled={busy === 'reader:retry'}
            title="Retry failed messages" className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)]/50 text-[var(--text-secondary)] transition-colors">
            {busy === 'reader:retry' ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
          </button>
          <div className="w-px h-5 bg-[var(--border-color)] mx-1" />
          <button onClick={() => { const id = detail?.conversation.id; if (id) openDetail(id); }} title="Refresh"
            className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)]/50 text-[var(--text-secondary)] transition-colors">
            <RefreshCw size={13} />
          </button>
        </div>

        {/* Reader body */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="max-w-5xl mx-auto p-4 space-y-4">
            {/* Header card — consistent display bar: sender / email / category / priority / date */}
            <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 p-4">
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${unread ? 'bg-blue-500/20 text-blue-400' : 'bg-[var(--bg-tertiary)]/40 text-[var(--text-secondary)]'}`}>
                  {(conv.customer_name || conv.customer_email || '?').trim()[0]?.toUpperCase() || '?'}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold text-[var(--text-primary)] leading-snug truncate">{conv.subject || '(No subject)'}</h2>
                  <p className="text-xs text-[var(--text-primary)] mt-1 truncate font-medium">
                    {conv.customer_name || 'Unknown'} <span className="text-[var(--text-muted)] font-normal">&lt;{conv.customer_email}&gt;</span>
                    {unread && <span className="ml-2 text-[9px] font-medium text-blue-400">{conv.unread_replies} unread</span>}
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)] truncate">To: {receivingLabel}</p>
                </div>
                <span className="text-[10px] text-[var(--text-muted)] whitespace-nowrap shrink-0">{new Date(conv.updated_at).toLocaleDateString()}</span>
              </div>
              {/* Meta row — every label keeps its own reserved space */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 pt-3 border-t border-[var(--border-color)]">
                <span className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] whitespace-nowrap">
                  Category <CategoryBadge category={conv.category} />
                </span>
                <span className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] whitespace-nowrap">
                  Priority
                  <span className={`text-[10px] font-medium flex items-center gap-1 ${prio.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${prio.dot}`} /> {prio.label}
                  </span>
                </span>
                <span className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] whitespace-nowrap">
                  Status <StatusBadge status={conv.status} />
                </span>
                <span className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] whitespace-nowrap">
                  From <span className="text-[var(--text-secondary)]">{conv.customer_name || 'Unknown'} &lt;{conv.customer_email}&gt;</span>
                </span>
                <span className="ml-auto flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] whitespace-nowrap">
                  Received <span className="text-[var(--text-secondary)]">{new Date(conv.created_at).toLocaleDateString()}</span>
                </span>
              </div>
              <div className="text-[11px] text-[var(--text-muted)] mt-2 pt-2 border-t border-[var(--border-color)] space-y-0.5">
                <p>To: <span className="text-[var(--text-secondary)]">{receivingLabel}</span> · CC: <span className="text-[var(--text-secondary)]">—</span> · BCC: <span className="text-[var(--text-secondary)]">—</span></p>
                <p>Date &amp; Time: <span className="text-[var(--text-secondary)]">{new Date(conv.created_at).toLocaleString()}</span> · Updated: {new Date(conv.updated_at).toLocaleString()}</p>
              </div>
            </div>

            {/* Thread */}
            <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5">
              <p className="px-4 py-2 border-b border-[var(--border-color)] text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Conversation · {detail.messages.length} message(s)</p>
              <div className="divide-y divide-[var(--border-color)]">
                {detail.messages.length === 0 && <p className="text-xs text-[var(--text-muted)] text-center py-6">No messages yet in this conversation.</p>}
                {detail.messages.map((m: any) => {
                  const msgAttachments = detail.attachments.filter(a => String(a.message_id) === String(m.id));
                  const isCustomer = m.sender_type === 'customer';
                  return (
                    <div key={m.id} className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 ${isCustomer ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                          {(m.sender_name || (isCustomer ? 'C' : 'S')).trim()[0]?.toUpperCase() || '?'}
                        </div>
                        <span className="text-[11px] font-medium text-[var(--text-primary)]">{m.sender_name || (isCustomer ? 'Customer' : 'Support')}</span>
                        {m.sender_email && <span className="text-[10px] text-[var(--text-muted)] truncate">{m.sender_email}</span>}
                        <span className="text-[10px] text-[var(--text-muted)] shrink-0">{new Date(m.created_at).toLocaleString()}</span>
                        {m.email_sent && <span className="text-[9px] text-green-400 ml-auto">sent via email</span>}
                        {!m.email_sent && m.email_error && <span className="text-[9px] text-red-400 ml-auto" title={m.email_error}>email failed</span>}
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap break-words">{m.message}</p>
                      {msgAttachments.length > 0 && (
                        <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                          {msgAttachments.map(a => <AttachmentCard key={a.id} a={a} />)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Customer + Device & Product */}
            <div className="grid gap-4 md:grid-cols-2">
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
              {(conv.hardware_id || conv.sdk_version || conv.runtime_type || conv.product_id || conv.license_key) && (
                <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5">
                  <p className="px-3 py-2 border-b border-[var(--border-color)] text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Device & Product</p>
                  <div className="p-3 text-xs text-[var(--text-secondary)] space-y-1">
                    {conv.product_id && <p><span className="text-[var(--text-muted)]">Product:</span> {conv.product_id}</p>}
                    {conv.license_key && <p><span className="text-[var(--text-muted)]">License:</span> <code className="text-[10px]">{conv.license_key}</code></p>}
                    {conv.hardware_id && <p><span className="text-[var(--text-muted)]">Hardware:</span> <code className="text-[10px]">{conv.hardware_id}</code></p>}
                    {conv.sdk_version && <p><span className="text-[var(--text-muted)]">SDK version:</span> {conv.sdk_version}</p>}
                    {conv.runtime_type && <p><span className="text-[var(--text-muted)]">Runtime:</span> {conv.runtime_type}</p>}
                  </div>
                </div>
              )}
            </div>

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

            {/* Reply — the SAME universal composer used for New Email /
                Reply All / Forward. The inline box is reserved for Internal
                Notes only (notes are not email). */}
            <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 p-3">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <button onClick={() => openReply()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-medium transition-colors">
                  <Reply size={11} /> Reply
                </button>
                <button onClick={openForward}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--bg-tertiary)]/50 hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] text-[11px] font-medium transition-colors">
                  <Forward size={11} /> Forward
                </button>
                <span className="ml-auto text-[10px] text-[var(--text-muted)] truncate">
                  Reply to <span className="text-[var(--text-secondary)]">{conv.customer_email}</span>
                </span>
              </div>
              {composerOpen && composerInternal ? (
                <>
                  <textarea
                    value={composerText}
                    onChange={e => setComposerText(e.target.value)}
                    placeholder="Add an internal note (not visible to customer)..."
                    rows={3}
                    className="w-full px-3 py-2.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)]/60 text-[var(--text-primary)] text-xs placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-y scrollbar-thin"
                  />
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {composerError && <span className="text-[10px] text-red-400 flex-1 min-w-[120px]">{composerError}</span>}
                    <button onClick={sendReply} disabled={!composerText.trim() || busy === 'composer-send'}
                      className="ml-auto flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-medium transition-colors disabled:opacity-50">
                      {busy === 'composer-send' ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />} Add Note
                    </button>
                    <button onClick={() => { setComposerOpen(false); setComposerText(''); setComposerError(null); }}
                      className="px-3 py-1.5 rounded-lg border border-[var(--border-color)] text-[var(--text-secondary)] text-[11px] hover:bg-[var(--bg-tertiary)]/30 transition-colors">
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <AtSign size={13} className="text-[var(--text-muted)] flex-shrink-0" />
                  <span className="flex-1 min-w-0 text-[11px] text-[var(--text-muted)] truncate">
                    {composerOpen ? 'Type your reply in the compose window — use the universal composer below.' : 'Reply opens the universal email composer (From / To / CC / BCC / Subject / Attachments).'}
                  </span>
                  <button onClick={() => { setComposerOpen(true); setComposerInternal(true); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-500/20 text-amber-400 hover:bg-amber-500/10 text-[11px] font-medium transition-colors">
                    <StickyNote size={11} /> Internal Note
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full gap-2 p-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 flex-shrink-0">
            <Mail className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-[var(--text-primary)] leading-tight truncate">Communication Center</h1>
            <p className="text-xs text-[var(--text-secondary)] truncate">
              {scopeLabel ? `${activeFolderDef.label} · ${scopeLabel}` : activeFolderDef.label}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={syncAllMailboxes} disabled={busy === 'sync-all'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-color)] text-[11px] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 transition-colors disabled:opacity-50">
            {busy === 'sync-all' ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Sync All
          </button>
          {isTrash && conversations.length > 0 && allowEmailDeletion && (
            <button onClick={() => setShowTrashConfirm(true)}
              title="Empty Trash requires the Allow Email Deletion setting"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/20 text-[11px] text-red-400 hover:bg-red-500/10 transition-colors">
              <Trash2 size={12} /> Empty Trash
            </button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="relative shrink-0">{renderToolbar()}</div>

      {/* Pinned status cards — always visible (section-scoped: Mail shows
          mailbox stats, Websmith Communications shows system stats) */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2 shrink-0">
        {(() => {
          const activeStats = activeFolderDef.section === 'external' ? mailboxStats : systemStats;
          return statusCards.map(card => {
            const Icon = card.icon;
            const cardFolderMap: Record<string, string> = { inbox: 'ext-inbox', waiting: 'ext-waiting', sent: activeFolderDef.section === 'external' ? 'ext-sent' : 'sent', failed: 'ext-failed', queued: 'ext-queued', unread: 'all' };
            return (
              <button key={card.key} onClick={() => handleFolderChange(cardFolderMap[card.key])}
                className="flex items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 px-3 py-2 hover:bg-[var(--bg-tertiary)]/20 transition-colors">
                <span className={`p-1.5 rounded-lg ${card.color}`}><Icon size={13} /></span>
                <span className="flex-1 text-left min-w-0">
                  <span className="block text-[10px] text-[var(--text-muted)] truncate">{card.label}</span>
                  <span className="block text-sm font-bold text-[var(--text-primary)] leading-tight">{activeStats[card.key]}</span>
                </span>
              </button>
            );
          });
        })()}
      </div>

      {/* 3-pane body: Mailboxes | Folders + Email List | Conversation */}
      <div className="flex-1 min-h-0 flex rounded-xl border border-[var(--border-color)] overflow-hidden">
        {renderSidebar()}
        {activeFolderDef.kind !== 'auto-reply' && activeFolderDef.kind !== 'settings' && (
          <div className="w-[400px] min-w-[320px] flex-shrink-0 flex flex-col border-l border-[var(--border-color)]">
            {renderMiddle()}
          </div>
        )}
        <div className="flex-1 min-w-0 flex flex-col border-l border-[var(--border-color)]">
          {renderCenter()}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-[100] flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm shadow-2xl shadow-black/40 ${
          toast.type === 'ok' ? 'border-green-500/30 bg-[var(--bg-secondary)] text-green-400' : toast.type === 'warn' ? 'border-amber-500/30 bg-[var(--bg-secondary)] text-amber-400' : 'border-red-500/30 bg-[var(--bg-secondary)] text-red-400'
        }`}>
          {toast.type === 'ok' ? <CheckCircle2 size={15} /> : toast.type === 'warn' ? <AlertTriangle size={15} /> : <AlertCircle size={15} />}
          <span className="text-xs">{toast.text}</span>
        </div>
      )}

      {/* Universal Email Dialog */}
      <UniversalEmailDialog
        isOpen={emailDialog.isOpen}
        onClose={() => setEmailDialog({ isOpen: false })}
        defaultEmail={emailDialog.defaultEmail}
        defaultRecipientName={emailDialog.defaultRecipientName}
        defaultLicenseKey={emailDialog.defaultLicenseKey}
        defaultProductId={emailDialog.defaultProductId}
        defaultProductName={emailDialog.defaultProductName}
        defaultAction={emailDialog.defaultAction}
        fromAccounts={emailDialog.fromAccounts}
        defaultFromId={emailDialog.defaultFromId}
        conversationId={emailDialog.conversationId}
        defaultSubject={emailDialog.defaultSubject}
        defaultMessage={emailDialog.defaultMessage}
        defaultCc={emailDialog.defaultCc}
        defaultBcc={emailDialog.defaultBcc}
        templates={templates}
        signatures={signatures}
        onSent={() => { setEmailDialog({ isOpen: false }); refreshCurrent(true); fetchStats(); }}
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

      {/* Mailbox form modal (card-based configuration UI) */}
      {showMailboxForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] w-[860px] max-w-[94vw] mx-4 max-h-[92vh] overflow-y-auto scrollbar-thin">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)] sticky top-0 bg-[var(--bg-secondary)] z-10">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-[var(--text-primary)]">Mailbox Settings</h2>
                  <p className="text-[10px] text-[var(--text-muted)]">Configure incoming and outgoing email</p>
                </div>
                {editingMailbox && (
                  <Badge className={mailboxHealth(editingMailbox).status === 'connected' ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'}>
                    <span className={`w-1.5 h-1.5 rounded-full ${mailboxHealth(editingMailbox).status === 'connected' ? 'bg-green-400' : 'bg-red-400'}`} />
                    {mailboxHealth(editingMailbox).status === 'connected' ? 'Connected' : mailboxHealth(editingMailbox).label}
                  </Badge>
                )}
              </div>
              <button onClick={() => { setShowMailboxForm(false); setEditingMailbox(null); setMailboxFormError(null); setMailboxTest({ running: false, results: null }); }} className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)]/50 text-[var(--text-muted)] transition-colors"><X size={15} /></button>
            </div>
            <div className="p-5 space-y-4">
              {/* Provider card */}
              <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Provider</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Provider">
                    <select value={mailboxForm.provider || ''} onChange={e => {
                      const p = presetForKey(e.target.value);
                      setMailboxForm((prev: any) => ({
                        ...prev,
                        provider: p.key,
                        imap_host: p.imap.host,
                        imap_port: p.imap.port,
                        imap_secure: p.imap.secure,
                        smtp_host: p.smtp.host,
                        smtp_port: p.smtp.port,
                        smtp_secure: p.smtp.secure,
                      }));
                    }} className={inputCls} name="mailbox-provider" autoComplete="off" data-lpignore="true">
                      <option value="">Auto-detect from email</option>
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
                        // Outgoing mail uses the same address by default
                        // (editable afterwards for providers that need a
                        // different sender / username). The username mirrors
                        // the incoming email while typing; a username that
                        // was manually changed to something else is kept.
                        if (!next.imap_username || next.imap_username === prev.email_address) next.imap_username = email;
                        if (!next.smtp_username || next.smtp_username === prev.email_address) next.smtp_username = email;
                        if (detected.key !== 'custom') {
                          if (prev.provider === '' || prev.provider === 'custom') {
                            next.provider = detected.key;
                            next.imap_host = detected.imap.host;
                            next.imap_port = detected.imap.port;
                            next.imap_secure = detected.imap.secure;
                            next.smtp_host = detected.smtp.host;
                            next.smtp_port = detected.smtp.port;
                            next.smtp_secure = detected.smtp.secure;
                          }
                        } else if (prev.provider === '') {
                          // Unknown domain: stay in manual mode rather than
                          // inventing server values.
                          next.provider = 'custom';
                        }
                        return next;
                      });
                    }} className={inputCls} placeholder="support@yourcompany.com" name="mailbox-email" autoComplete="off" data-lpignore="true" />
                  </Field>
                  <Field label="Display Name">
                    <input type="text" value={mailboxForm.display_name || ''} onChange={e => setMailboxForm({ ...mailboxForm, display_name: e.target.value })}
                      className={inputCls} placeholder="Support Team" name="mailbox-display-name" autoComplete="off" />
                  </Field>
                  <div className="flex items-end">
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
                      showToast('ok', `Auto-detected ${detected.label} server settings.`);
                    }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-blue-500/30 text-[11px] text-blue-400 hover:bg-blue-500/10 transition-colors">
                      <Sparkles size={12} /> Detect Server Settings
                    </button>
                  </div>
                </div>
              </div>

              {/* IMAP / SMTP cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400 mb-2">Incoming — IMAP</p>
                  <div className="space-y-2.5">
                    <Field label="Server *"><input type="text" value={mailboxForm.imap_host || ''} onChange={e => setMailboxForm({ ...mailboxForm, imap_host: e.target.value })} className={inputCls} placeholder="imap.example.com" name="mailbox-imap-host" autoComplete="off" /></Field>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Port">
                        <input type="number" value={mailboxForm.imap_port ?? 993} onChange={e => setMailboxForm({ ...mailboxForm, imap_port: parseInt(e.target.value) || 993 })} className={inputCls} name="mailbox-imap-port" autoComplete="off" />
                      </Field>
                      <Field label="Encryption">
                        <select value={mailboxForm.imap_secure !== false ? 'true' : 'false'} onChange={e => setMailboxForm({ ...mailboxForm, imap_secure: e.target.value === 'true' })} className={inputCls} name="mailbox-imap-encryption" autoComplete="off">
                          <option value="true">SSL / TLS</option>
                          <option value="false">None</option>
                        </select>
                      </Field>
                    </div>
                    <Field label="Username *"><input type="text" value={mailboxForm.imap_username || ''} onChange={e => setMailboxForm({ ...mailboxForm, imap_username: e.target.value })} className={inputCls} placeholder="user@example.com" name="mailbox-imap-username" autoComplete="off" /></Field>
                    <Field label="Password / App Password *">
                      <div className="relative">
                        <input type={showImapPass ? 'text' : 'password'} value={mailboxForm.imap_password || ''} onChange={e => {
                          const pw = e.target.value;
                          setMailboxForm((prev: any) => {
                            const next: any = { ...prev, imap_password: pw };
                            // Providers using the same credentials for IMAP and
                            // SMTP: mirror the incoming password into outgoing.
                            // If outgoing still equals the previous incoming
                            // password (kept in sync) or is empty it follows the
                            // new value; a manually overridden outgoing password
                            // that differs is preserved.
                            if (!prev.smtp_password || prev.smtp_password === prev.imap_password) next.smtp_password = pw;
                            return next;
                          });
                        }} className={`${inputCls} pr-8`} placeholder={editingMailbox ? '•••••••• (unchanged — leave blank to keep)' : ''} name="mailbox-imap-password" autoComplete="new-password" data-lpignore="true" />
                        <button type="button" onClick={() => setShowImapPass(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                          {showImapPass ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      </div>
                    </Field>
                  </div>
                </div>
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-2">Outgoing — SMTP</p>
                  <div className="space-y-2.5">
                    <Field label="Server *"><input type="text" value={mailboxForm.smtp_host || ''} onChange={e => setMailboxForm({ ...mailboxForm, smtp_host: e.target.value })} className={inputCls} placeholder="smtp.example.com" name="mailbox-smtp-host" autoComplete="off" /></Field>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Port">
                        <input type="number" value={mailboxForm.smtp_port ?? 465} onChange={e => setMailboxForm({ ...mailboxForm, smtp_port: parseInt(e.target.value) || 465 })} className={inputCls} name="mailbox-smtp-port" autoComplete="off" />
                      </Field>
                      <Field label="Encryption">
                        <select value={mailboxForm.smtp_secure !== false ? 'true' : 'false'} onChange={e => setMailboxForm({ ...mailboxForm, smtp_secure: e.target.value === 'true' })} className={inputCls} name="mailbox-smtp-encryption" autoComplete="off">
                          <option value="true">SSL / TLS</option>
                          <option value="false">None</option>
                        </select>
                      </Field>
                    </div>
                    <Field label="Username *"><input type="text" value={mailboxForm.smtp_username || ''} onChange={e => setMailboxForm({ ...mailboxForm, smtp_username: e.target.value })} className={inputCls} placeholder="user@example.com" name="mailbox-smtp-username" autoComplete="off" /></Field>
                    <Field label="Password / App Password *">
                      <div className="relative">
                        <input type={showSmtpPass ? 'text' : 'password'} value={mailboxForm.smtp_password || ''} onChange={e => setMailboxForm({ ...mailboxForm, smtp_password: e.target.value })} className={`${inputCls} pr-8`} placeholder={editingMailbox ? '•••••••• (unchanged — leave blank to keep)' : ''} name="mailbox-smtp-password" autoComplete="new-password" data-lpignore="true" />
                        <button type="button" onClick={() => setShowSmtpPass(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                          {showSmtpPass ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      </div>
                    </Field>
                  </div>
                </div>
              </div>

              {/* Provider authentication help */}
              {(() => {
                const preset = presetForKey(mailboxForm.provider || '');
                const h = preset.help;
                if (!h) return null;
                return (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400 mb-1.5">{preset.label} Authentication</p>
                    <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">{h.note}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {h.appPassword && (
                        <a href={h.appPassword.url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-blue-500/30 text-[11px] text-blue-400 hover:bg-blue-500/10 transition-colors">
                          <KeyRound size={11} /> {h.appPassword.label} <ExternalLink size={10} />
                        </a>
                      )}
                      {h.instructions && (
                        <a href={h.instructions.url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--border-color)] text-[11px] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 transition-colors">
                          <HelpCircle size={11} /> {h.instructions.label} <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Sender & Reply settings */}
              <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Sender &amp; Reply Settings</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                    <input type="checkbox" checked={mailboxForm.is_default_sender === true} onChange={e => setMailboxForm({ ...mailboxForm, is_default_sender: e.target.checked })} className="accent-blue-500" />
                    Default sender
                  </label>
                  <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                    <input type="checkbox" checked={mailboxForm.is_enabled !== false} onChange={e => setMailboxForm({ ...mailboxForm, is_enabled: e.target.checked })} className="accent-blue-500" />
                    Enabled
                  </label>
                  <Field label="Email Signature">
                    <div className="flex gap-1.5">
                      <select value={signatures.find(s => s.enabled !== false && s.content === (mailboxForm.signature || ''))?.id || ''} onChange={e => {
                        const sig = signatures.find(s => s.id === e.target.value);
                        if (sig) setMailboxForm((prev: any) => ({ ...prev, signature: sig.content }));
                      }} className={inputCls} name="mailbox-signature" autoComplete="off">
                        <option value="">No signature selected</option>
                        {signatures.filter(s => s.enabled !== false).map(s => <option key={s.id} value={s.id}>{s.name}{s.is_default ? ' (default)' : ''}</option>)}
                      </select>
                      <button type="button" onClick={() => setSignatureForm({ open: true, id: null, name: '', content: '', enabled: true })} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-blue-500/30 text-[11px] text-blue-400 hover:bg-blue-500/10 transition-colors shrink-0">
                        <Plus size={11} /> Add Signature
                      </button>
                    </div>
                  </Field>
                  <Field label="Auto Reply">
                    <div className="flex items-center gap-2">
                      <Toggle checked={mailboxForm.auto_reply_enabled === true} onChange={() => setMailboxForm((prev: any) => ({ ...prev, auto_reply_enabled: !(prev.auto_reply_enabled === true) }))} />
                      <span className="text-[10px] text-[var(--text-muted)]">{mailboxForm.auto_reply_enabled ? 'ON' : 'OFF'}</span>
                    </div>
                  </Field>
                  {mailboxForm.auto_reply_enabled && (
                    <>
                      <Field label="Auto Reply Template">
                        <select value={mailboxForm.auto_reply_template_key || ''} onChange={e => setMailboxForm({ ...mailboxForm, auto_reply_template_key: e.target.value })} className={inputCls}>
                          <option value="">— Legacy message —</option>
                          {templates.map(t => <option key={t.email_type} value={t.email_type}>{t.email_type}</option>)}
                        </select>
                      </Field>
                      <Field label="Auto Reply Signature">
                        <select value={mailboxForm.auto_reply_signature || ''} onChange={e => setMailboxForm({ ...mailboxForm, auto_reply_signature: e.target.value })} className={inputCls} name="mailbox-auto-reply-signature" autoComplete="off">
                          <option value="">— None —</option>
                          {signatures.filter(s => s.enabled !== false).map(s => <option key={s.id} value={s.id}>{s.name}{s.is_default ? ' (default)' : ''}</option>)}
                        </select>
                      </Field>
                      {!mailboxForm.auto_reply_template_key && (
                        <div className="col-span-2">
                          <Field label="Legacy auto-reply message">
                            <textarea rows={2} value={mailboxForm.auto_reply_message || ''} onChange={e => setMailboxForm({ ...mailboxForm, auto_reply_message: e.target.value })}
                              className={`${inputCls} resize-none`} placeholder="Thanks for your message — we will get back to you within 24 hours." />
                          </Field>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Connection test */}
              <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Test Connection</p>
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => testMailboxForm('imap')} disabled={mailboxTest.running}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-blue-500/30 text-[11px] text-blue-400 hover:bg-blue-500/10 transition-colors disabled:opacity-50">
                    {mailboxTest.running ? <Loader2 size={11} className="animate-spin" /> : <Database size={11} />} Test Incoming
                  </button>
                  <button type="button" onClick={() => testMailboxForm('smtp')} disabled={mailboxTest.running}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-emerald-500/30 text-[11px] text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-50">
                    {mailboxTest.running ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />} Test Outgoing
                  </button>
                  <button type="button" onClick={() => testMailboxForm('both')} disabled={mailboxTest.running}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-medium transition-colors disabled:opacity-50">
                    {mailboxTest.running ? <Loader2 size={11} className="animate-spin" /> : <ShieldCheck size={11} />} Test Connection
                  </button>
                </div>
                {mailboxTest.results && (
                  <div className="mt-2 space-y-1">
                    {mailboxTest.results.imap && (
                      <p className={`text-[11px] flex items-center gap-1.5 ${mailboxTest.results.imap.connected ? 'text-green-400' : 'text-red-400'}`}>
                        {mailboxTest.results.imap.connected ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                        Incoming IMAP connection {mailboxTest.results.imap.connected ? 'successful' : 'failed'}
                        {mailboxTest.results.imap.error && !mailboxTest.results.imap.connected && <span className="text-[var(--text-muted)] truncate">— {mailboxTest.results.imap.error}</span>}
                      </p>
                    )}
                    {mailboxTest.results.smtp && (
                      <p className={`text-[11px] flex items-center gap-1.5 ${mailboxTest.results.smtp.connected ? 'text-green-400' : 'text-red-400'}`}>
                        {mailboxTest.results.smtp.connected ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                        Outgoing SMTP connection {mailboxTest.results.smtp.connected ? 'successful' : 'failed'}
                        {mailboxTest.results.smtp.error && !mailboxTest.results.smtp.connected && <span className="text-[var(--text-muted)] truncate">— {mailboxTest.results.smtp.error}</span>}
                      </p>
                    )}
                    {mailboxTest.results.imap?.connected && mailboxTest.results.smtp?.connected && (
                      <p className="text-[11px] text-green-400 flex items-center gap-1.5"><CheckCircle2 size={12} /> Mailbox is ready.</p>
                    )}
                  </div>
                )}
                {mailboxFormError && (
                  <p className="mt-2 text-xs text-red-400 break-words rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2">{mailboxFormError}</p>
                )}
              </div>
            </div>
            <div className="flex gap-2 px-5 py-4 border-t border-[var(--border-color)] sticky bottom-0 bg-[var(--bg-secondary)]">
              <button onClick={saveMailbox} disabled={busy === 'save-mailbox'}
                className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {busy === 'save-mailbox' ? <><Loader2 size={13} className="animate-spin" /> {editingMailbox ? 'Saving changes...' : 'Creating mailbox...'}</> : <><Save size={13} /> {editingMailbox ? 'Save Mailbox' : 'Create Mailbox'}</>}
              </button>
              <button onClick={() => { setShowMailboxForm(false); setEditingMailbox(null); setMailboxFormError(null); setMailboxTest({ running: false, results: null }); }}
                className="px-4 py-2 rounded-lg border border-[var(--border-color)] text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Signature creation modal (opened from the mailbox form's Add Signature) */}
      {showMailboxForm && signatureForm.open && (
        <Modal title={signatureForm.id ? 'Edit Signature' : 'Add Signature'} onClose={() => setSignatureForm({ open: false, id: null, name: '', content: '', enabled: true })}>
          <div className="space-y-3">
            <Field label="Signature Name">
              <input type="text" value={signatureForm.name} onChange={e => setSignatureForm({ ...signatureForm, name: e.target.value })} className={inputCls} placeholder="e.g. Senior Engineer Signature" name="mailbox-signature-name" autoComplete="off" />
            </Field>
            <Field label="Signature Content">
              <textarea rows={5} value={signatureForm.content} onChange={e => setSignatureForm({ ...signatureForm, content: e.target.value })}
                className={`${inputCls} resize-y`} placeholder={"Best regards,\nThe Support Team\nsupport@websmithdigital.com"} />
            </Field>
            <Field label="Status">
              <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                <Toggle checked={signatureForm.enabled !== false} onChange={() => setSignatureForm(prev => ({ ...prev, enabled: !(prev.enabled !== false) }))} />
                <span>{signatureForm.enabled !== false ? 'Enabled' : 'Disabled'}</span>
              </label>
            </Field>
            <div className="rounded-lg border border-dashed border-[var(--border-color)] bg-[var(--bg-primary)]/50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">Preview</p>
              <p className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap break-words">{signatureForm.content || '(empty signature)'}</p>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => {
                  if (!signatureForm.name.trim() && !signatureForm.content.trim()) { showToast('err', 'Signature name or content is required'); return; }
                  if (signatureForm.id) {
                    updateSignature(signatureForm.id, signatureForm.name, signatureForm.content, signatureForm.enabled);
                  } else {
                    addSignature(signatureForm.name, signatureForm.content, signatureForm.enabled);
                  }
                  setSignatureForm({ open: false, id: null, name: '', content: '', enabled: true });
                }}
                disabled={busy === 'save-comm-settings'}
                className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {busy === 'save-comm-settings' ? <><Loader2 size={13} className="animate-spin" /> Saving...</> : <><Save size={13} /> Save Signature</>}
              </button>
              <button onClick={() => setSignatureForm({ open: false, id: null, name: '', content: '', enabled: true })}
                className="px-4 py-2 rounded-lg border border-[var(--border-color)] text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 transition-colors">Cancel</button>
            </div>
          </div>
        </Modal>
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

      {/* Permanent delete confirm (Mail Delete feature) */}
      {showDeleteConfirm && (
        <Modal title={showDeleteConfirm.count === 1 ? 'Delete Conversation?' : `Delete ${showDeleteConfirm.count} Conversations?`} onClose={() => setShowDeleteConfirm(null)}>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            {showDeleteConfirm.count === 1
              ? <>This will permanently delete <span className="text-[var(--text-primary)] font-medium">&ldquo;{showDeleteConfirm.subject || 'this conversation'}&rdquo;</span> and all related email data — messages, metadata, drafts/replies and unused attachments. This action cannot be undone.</>
              : <>This will permanently delete <span className="text-[var(--text-primary)] font-medium">{showDeleteConfirm.count} conversations</span> and all related email data — messages, metadata, drafts/replies and unused attachments. This action cannot be undone.</>}
          </p>
          <div className="flex gap-2 pt-4">
            <button onClick={() => permanentlyDeleteConversations(showDeleteConfirm.ids)} disabled={busy === 'permanent-delete'}
              className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {busy === 'permanent-delete' ? <><Loader2 size={13} className="animate-spin" /> Deleting...</> : <><Delete size={13} /> Delete Forever</>}
            </button>
            <button onClick={() => setShowDeleteConfirm(null)} disabled={busy === 'permanent-delete'}
              className="px-4 py-2 rounded-lg border border-[var(--border-color)] text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 transition-colors">Cancel</button>
          </div>
        </Modal>
      )}

      {/* Delete mailbox confirm */}
      {showDeleteMailboxConfirm && (
        <Modal title="Delete Mailbox" onClose={() => setShowDeleteMailboxConfirm(null)}>
          <p className="text-sm text-[var(--text-secondary)]">This permanently removes the mailbox integration, all conversations synced from it (messages, attachments, drafts, sync history) and its IMAP/SMTP credentials. This action cannot be undone.</p>
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
