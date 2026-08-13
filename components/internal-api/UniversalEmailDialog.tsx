"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  Mail,
  Send,
  History,
  ShoppingCart,
  KeyRound,
  Repeat,
  RefreshCw,
  Monitor,
  LifeBuoy,
  MessageSquare,
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
  Search,
  User,
  Phone,
  ArrowLeft,
  Paperclip,
  Package,
  FileArchive,
  Trash2,
} from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";

const API_BASE = "/internal/backend";
const SUPPORT_EMAIL = "support@websmithdigital.com";
const SALES_EMAIL = "sales@websmithdigital.com";

// A unified mail account used by the compose From dropdown. It is always
// derived from the real configured accounts (system mail_accounts + external
// mailboxes) — never hardcoded. `id` is the actual account identifier
// (system account id like 'support', or a mailbox id like 'MBX-…').
export interface SenderOption {
  id: string;
  kind: 'system' | 'mailbox';
  display_name: string;
  email: string;
  is_active: boolean;
  is_default: boolean;
  type?: string;
  provider?: string;
}

type EmailAction =
  | "send"
  | "history"
  | "buy-license"
  | "activate"
  | "renew"
  | "reactivation"
  | "device-replacement"
  | "support"
  | "general";

interface EmailRecord {
  id: string;
  email_type: string;
  recipient: string;
  subject: string;
  status: string;
  sent_at: string;
  attachments: { id: number; file_name: string; file_size: number }[];
}

interface SelectedFile {
  file: File;
  size: number;
}

interface SdkJobInfo {
  job_id: string;
  filename: string;
  product_name: string;
  file_size: number;
  has_sdk: boolean;
}

interface EmailTemplate {
  email_type: string;
  subject?: string;
  plain_text?: string;
  body?: string;
  is_active?: boolean;
}

interface EmailSignature {
  id: string;
  name: string;
  content: string;
  is_default?: boolean;
  enabled?: boolean;
}

interface EmailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSent?: () => void;
  defaultEmail?: string;
  defaultLicenseKey?: string;
  defaultProductName?: string;
  defaultProductId?: string;
  defaultAction?: EmailAction;
  allowedActions?: EmailAction[];
  // Dynamic From dropdown (account ID based). When omitted the dialog keeps
  // its previous behaviour (server-derived sender).
  fromAccounts?: SenderOption[];
  defaultFromId?: string;
  // Reply mode: when set, Send posts to the communication reply endpoint
  // (same universal composer used by the Communication Center).
  conversationId?: string;
  defaultSubject?: string;
  defaultMessage?: string;
  defaultCc?: string;
  defaultBcc?: string;
  // Customer-facing mode: posts to the public /api/portal/support-message
  // route (no admin session). The recipient is resolved SERVER-SIDE from the
  // action — the browser never supplies an address. Used by the Universal
  // Buy & Renew Portal contact-sales entries.
  customerMode?: boolean;
  // Prefilled customer identity for user→admin forms (Name REQUIRED, Email
  // REQUIRED, Mobile optional).
  defaultCustomerName?: string;
  defaultCustomerMobile?: string;
  // Content libraries for Template ▼ / Signature ▼ insertion (optional).
  templates?: EmailTemplate[];
  signatures?: EmailSignature[];
}

const actionConfig: Record<EmailAction, { label: string; icon: typeof Mail; description: string }> = {
  send: { label: "Send Email", icon: Send, description: "Send a custom email message" },
  history: { label: "Email History", icon: History, description: "View sent email history" },
  "buy-license": { label: "Buy License", icon: ShoppingCart, description: "Contact our sales team to purchase a license" },
  activate: { label: "Activate License", icon: KeyRound, description: "Request assistance activating a license key" },
  renew: { label: "Renew License", icon: Repeat, description: "Contact our sales team to renew your license" },
  reactivation: { label: "Reactivation", icon: RefreshCw, description: "Request reactivation of a previously active license" },
  "device-replacement": { label: "Device Replacement", icon: Monitor, description: "Request a replacement for a bound device" },
  support: { label: "Support Request", icon: LifeBuoy, description: "Get help from our support team" },
  general: { label: "General Support", icon: MessageSquare, description: "Submit a general inquiry to our team" },
};

// Per-action help text shown above user→admin forms so customers know where
// their request goes and what happens next.
const SUPPORT_ACTIONS: EmailAction[] = ["buy-license", "renew", "activate", "reactivation", "device-replacement", "support", "general"];

const SUPPORT_INFO_TEXT: Partial<Record<EmailAction, string>> = {
  "buy-license": "Your inquiry will be sent to our sales team, who will respond to the email address you provide.",
  renew: "Your renewal inquiry will be sent to our sales team, who will respond to the email address you provide.",
  activate: "Your activation request will be sent to our support team, who will respond to the email address you provide.",
  reactivation: "Your reactivation request will be sent to our support team, who will respond to the email address you provide.",
  "device-replacement": "Your device replacement request will be sent to our support team, who will respond to the email address you provide.",
  support: "Your support request will be sent to our support team, who will respond to the email address you provide.",
  general: "Your inquiry will be sent to our team, who will respond to the email address you provide.",
};

function formatSize(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export default function UniversalEmailDialog({ isOpen, onClose, onSent, defaultEmail, defaultLicenseKey, defaultProductName, defaultProductId, defaultAction, allowedActions, fromAccounts, defaultFromId, conversationId, defaultSubject, defaultMessage, defaultCc, defaultBcc, templates, signatures, customerMode, defaultCustomerName, defaultCustomerMobile }: EmailDialogProps) {
  const [view, setView] = useState<"actions" | "form" | "history">("actions");
  const [action, setAction] = useState<EmailAction>(defaultAction || "send");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [warning, setWarning] = useState("");

  const [fromId, setFromId] = useState("");
  const [recipientEmail, setRecipientEmail] = useState(defaultEmail || "");
  const [recipientName, setRecipientName] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");

  const [licenseKey, setLicenseKey] = useState(defaultLicenseKey || "");
  const [productName, setProductName] = useState(defaultProductName || "");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [reason, setReason] = useState("");

  const [emailHistory, setEmailHistory] = useState<EmailRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [searchEmail, setSearchEmail] = useState("");

  // Attachments
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sdkJob, setSdkJob] = useState<SdkJobInfo | null>(null);
  const [attachSdk, setAttachSdk] = useState(false);
  const [sdkLoading, setSdkLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setView("actions");
      setError("");
      setSuccess("");
      setWarning("");
      setFiles([]);
      setAttachSdk(false);
      setSdkJob(null);
      // Reset the From account: prefer the provided default (receiving account
      // for Reply/Forward, or the system default sender for New Mail), falling
      // back to the first available account.
      const enabled = (fromAccounts || []).filter(a => a.is_active);
      if (fromAccounts && fromAccounts.length > 0) {
        const requested = defaultFromId && fromAccounts.find(a => a.id === defaultFromId);
        const def = (requested && requested.is_active)
          ? requested
          : enabled[0] || fromAccounts[0];
        setFromId(def?.id || "");
      } else {
        setFromId("");
      }
      if (defaultAction) {
        openAction(defaultAction);
      }
      if (customerMode) {
        // Customer-facing forms start from the visitor's identity so they
        // don't have to re-type the details they already entered on the
        // Buy / Renew portal.
        setCustomerName(defaultCustomerName || "");
        setCustomerEmail(defaultEmail || "");
        setCustomerPhone(defaultCustomerMobile || "");
        setProductName(defaultProductName || "");
        setLicenseKey(defaultLicenseKey || "");
      }
    }
  }, [isOpen, defaultAction, defaultFromId, fromAccounts, customerMode, defaultCustomerName, defaultCustomerMobile]);

  const selectedSender = useMemo(
    () => (fromAccounts || []).find(a => a.id === fromId) || null,
    [fromAccounts, fromId]
  );

  // Load SDK job info for the product when the dialog opens
  useEffect(() => {
    if (isOpen && (defaultProductId || defaultProductName)) {
      let cancelled = false;
      const productId = defaultProductId || "";
      if (productId) {
        setSdkLoading(true);
        fetch(`${API_BASE}/admin/sdk/latest-job?product_id=${encodeURIComponent(productId)}`)
          .then(res => res.json())
          .then(data => {
            if (!cancelled && data.success && data.job) setSdkJob(data.job);
          })
          .catch(() => {})
          .finally(() => { if (!cancelled) setSdkLoading(false); });
      }
      return () => { cancelled = true; };
    }
  }, [isOpen, defaultProductId, defaultProductName]);

  const openAction = useCallback((a: EmailAction) => {
    setAction(a);
    setError("");
    setSuccess("");
    setWarning("");

    switch (a) {
      case "send":
        // Reply mode (conversationId set): keep the pre-filled subject /
        // message / cc / bcc from the conversation context.
        if (conversationId) {
          setSubject(defaultSubject || "");
          setMessage(defaultMessage || "");
          setCc(defaultCc || "");
          setBcc(defaultBcc || "");
        } else {
          setSubject("");
          setMessage("");
          setCc("");
          setBcc("");
        }
        if (!recipientEmail) setRecipientEmail(defaultEmail || "");
        setView("form");
        break;
      case "history":
        setSearchEmail(defaultEmail || "");
        loadHistory(defaultEmail || "");
        setView("history");
        break;
      case "buy-license":
        setSubject(`License Purchase Inquiry - ${productName || defaultProductName || "Product"}`);
        setMessage(`I am interested in purchasing a license for ${productName || defaultProductName || "your product"}.\n\nPlease provide pricing and availability.`);
        setRecipientEmail(SALES_EMAIL);
        setView("form");
        break;
      case "activate":
        setSubject(`License Activation Request - ${licenseKey || defaultLicenseKey || ""}`);
        setRecipientEmail(SUPPORT_EMAIL);
        setView("form");
        break;
      case "renew":
        setSubject(`License Renewal Request - ${licenseKey || defaultLicenseKey || ""}`);
        setRecipientEmail(SALES_EMAIL);
        setView("form");
        break;
      case "reactivation":
        setSubject(`License Reactivation Request - ${licenseKey || defaultLicenseKey || ""}`);
        setRecipientEmail(SUPPORT_EMAIL);
        setView("form");
        break;
      case "device-replacement":
        setSubject(`Device Replacement Request - ${licenseKey || defaultLicenseKey || ""}`);
        setRecipientEmail(SUPPORT_EMAIL);
        setView("form");
        break;
      case "support":
        setSubject("Support Request");
        setRecipientEmail(SUPPORT_EMAIL);
        setView("form");
        break;
      case "general":
        setSubject("General Inquiry");
        setRecipientEmail(SUPPORT_EMAIL);
        setView("form");
        break;
    }
  }, [defaultEmail, defaultLicenseKey, defaultProductName, productName, licenseKey, recipientEmail, conversationId, defaultSubject, defaultMessage, defaultCc, defaultBcc]);

  const loadHistory = useCallback(async (email?: string) => {
    const search = email || searchEmail;
    if (!search) return;
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/communication/history?email=${encodeURIComponent(search)}`);
      const data = await res.json();
      if (data.success) {
        // Always show newest first, even if the backend ordering ever changes.
        const rows = (data.data || []).slice().sort((a: any, b: any) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setEmailHistory(rows.map((row: any) => ({
          id: String(row.id),
          email_type: row.event_type,
          recipient: row.recipient,
          subject: row.subject || "",
          status: row.status,
          sent_at: row.created_at,
          attachments: row.attachments || [],
        })));
      } else {
        setEmailHistory([]);
      }
    } catch {
      setError("Failed to load email history");
    } finally {
      setHistoryLoading(false);
    }
  }, [searchEmail]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    setFiles(prev => {
      const merged = [...prev, ...selected.map(f => ({ file: f, size: f.size }))];
      return merged.slice(0, 5);
    });
    e.target.value = "";
  };

  const emailTypeForAction = () => {
    switch (action) {
      case "buy-license": return "welcome_customer";
      case "renew": return "license_renewed";
      case "activate": return "activation_success";
      case "reactivation": return "reactivation_approved";
      default: return "admin_notification";
    }
  };

  const handleSendEmail = async () => {
    if (!recipientEmail) {
      setError("Recipient email is required");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail.trim())) {
      setError("A valid recipient email is required");
      return;
    }
    // User→admin forms always require the requester's identity.
    const isSupportAction = SUPPORT_ACTIONS.includes(action);
    if (isSupportAction) {
      if (!customerName.trim()) {
        setError("Your name is required");
        return;
      }
      if (!customerEmail.trim()) {
        setError("Your email is required");
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim())) {
        setError("Please enter a valid email address");
        return;
      }
    }
    setLoading(true);
    setError("");
    setSuccess("");
    setWarning("");

    const parseList = (raw: string): string[] =>
      raw.split(/[,;]/).map(s => s.trim()).filter(s => s.length > 0);

    try {
      const emailType = emailTypeForAction();
      // User→admin requests are sent as a structured message that always
      // carries the requester's identity plus the request details.
      let finalMessage = message;
      if (isSupportAction) {
        const identityLines = [
          `Request Type: ${actionConfig[action].label}`,
          `Name: ${customerName.trim()}`,
          `Email: ${customerEmail.trim()}`,
          `Mobile: ${customerPhone.trim() || "Not provided"}`,
        ];
        if (subject.trim()) identityLines.push(`Subject: ${subject.trim()}`);
        finalMessage = `${identityLines.join("\n")}\n\n${message.trim()}`;
      }
      const common: Record<string, string> = {
        to_email: recipientEmail.trim(),
        to_name: recipientName.trim() || customerName.trim(),
        subject,
        message: finalMessage,
        email_type: emailType,
        license_key: licenseKey,
        product_id: defaultProductId || "",
        attach_sdk: attachSdk ? "true" : "false",
        sdk_job_id: attachSdk && sdkJob ? sdkJob.job_id : "",
        cc: cc.trim(),
        bcc: bcc.trim(),
      };

      // When the user chose an explicit From account, tell the backend so the
      // email leaves FROM that account (mailbox SMTP or a specific sender).
      if (selectedSender) {
        common.from_account_id = selectedSender.id;
        common.from_email = selectedSender.email;
        common.from_name = selectedSender.display_name;
        if (selectedSender.kind === "mailbox") {
          common.from_mailbox_id = selectedSender.id;
        }
      }

      let res: Response;
      if (customerMode) {
        // Customer-facing send: no admin session. Post to the public portal
        // route — the recipient is resolved SERVER-SIDE from the action (Buy /
        // Renew → sales@), so the browser can never target an arbitrary address.
        const payload: Record<string, string> = {
          action,
          customer_name: customerName.trim(),
          customer_email: customerEmail.trim(),
          mobile: customerPhone.trim(),
          subject,
          message: finalMessage,
          license_key: licenseKey,
        };
        res = await fetch("/api/portal/support-message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else if (conversationId) {
        // Reply mode: same universal composer, posted to the conversation
        // reply endpoint so the message lands in the conversation thread.
        const payload: Record<string, string> = {
          conversation_id: conversationId,
          message,
          subject,
          cc: cc.trim(),
          bcc: bcc.trim(),
          is_internal: "false",
          sender_name: selectedSender?.display_name || "Admin",
          email_type: emailType,
        };
        if (selectedSender) {
          payload.from_account_id = selectedSender.id;
          payload.from_email = selectedSender.email;
          payload.from_name = selectedSender.display_name;
          if (selectedSender.kind === "mailbox") {
            payload.from_mailbox_id = selectedSender.id;
          }
        }
        res = await fetch(`${API_BASE}/admin/communication/reply`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else if (files.length > 0) {
        const formData = new FormData();
        for (const [k, v] of Object.entries(common)) formData.append(k, String(v));
        for (const f of files) formData.append("files", f.file);
        res = await fetch(`${API_BASE}/admin/communication/send`, { method: "POST", body: formData });
      } else {
        res = await fetch(`${API_BASE}/admin/communication/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(common),
        });
      }

      const data = await res.json();
      if (data.success) {
        // Honest delivery feedback: a success with emailDelivered:false or
        // queued:true means the message was recorded but SMTP failed — show a
        // warning, never a bare success.
        if (data.emailDelivered === false || data.queued) {
          setWarning(data.warning || data.message || "Email saved, but SMTP delivery failed — queued for automatic retry.");
        } else {
          setSuccess(conversationId ? `Reply sent to ${recipientEmail}` : `Email sent to ${recipientEmail}`);
        }
        setFiles([]);
        setAttachSdk(false);
        if (onSent) onSent();
        setTimeout(() => {
          setView("actions");
          setSuccess("");
          setWarning("");
        }, 2500);
      } else {
        setError(data.error?.message || data.error || "Failed to send email");
      }
    } catch {
      setError("Failed to send email. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const renderActions = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {(Object.entries(actionConfig) as [EmailAction, typeof actionConfig[EmailAction]][])
        .filter(([key]) => !allowedActions || allowedActions.includes(key))
        .map(([key, cfg]) => {
        const Icon = cfg.icon;
        return (
          <button
            key={key}
            onClick={() => openAction(key)}
            className="flex items-start gap-3 p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 hover:bg-[var(--bg-tertiary)]/20 hover:border-blue-500/30 transition-all text-left"
          >
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 shrink-0">
              <Icon size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--text-primary)]">{cfg.label}</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">{cfg.description}</p>
            </div>
          </button>
        );
      })}
    </div>
  );

  const renderAttachmentSection = () => {
    const canAttachSdk = Boolean(sdkJob?.has_sdk) && Boolean(licenseKey || defaultProductId);
    return (
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 p-3 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs font-medium text-[var(--text-secondary)]">Attachments</p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            <Paperclip size={13} /> Add files (max 5)
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>

        {files.length > 0 && (
          <div className="space-y-1.5">
            {files.map((f, idx) => (
              <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-[var(--bg-primary)]/60 border border-[var(--border-color)]">
                <Paperclip size={13} className="text-[var(--text-muted)] shrink-0" />
                <span className="text-xs text-[var(--text-primary)] truncate flex-1">{f.file.name}</span>
                <span className="text-[10px] text-[var(--text-muted)] shrink-0">{formatSize(f.size)}</span>
                <button
                  type="button"
                  onClick={() => setFiles(prev => prev.filter((_, i) => i !== idx))}
                  className="text-[var(--text-muted)] hover:text-red-400 transition-colors shrink-0"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        {canAttachSdk && (
          <label className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/20 cursor-pointer hover:bg-blue-500/10 transition-colors">
            <input
              type="checkbox"
              checked={attachSdk}
              onChange={e => setAttachSdk(e.target.checked)}
              className="accent-blue-500"
            />
            <FileArchive size={14} className="text-blue-400 shrink-0" />
            <span className="text-xs text-[var(--text-primary)] flex-1">
              Attach product SDK package
            </span>
            <span className="text-[10px] text-[var(--text-muted)] shrink-0">
              {sdkJob ? sdkJob.filename : "…"}
            </span>
          </label>
        )}
        {sdkLoading && (
          <p className="text-[11px] text-[var(--text-muted)] flex items-center gap-1.5">
            <Loader2 size={11} className="animate-spin" /> Checking for product SDK…
          </p>
        )}
      </div>
    );
  };

  const renderEmailForm = () => {
    const isSupportAction = SUPPORT_ACTIONS.includes(action);

    return (
      <div className="space-y-4">
        {isSupportAction && (
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
            <p className="text-sm text-[var(--text-secondary)]">
              {SUPPORT_INFO_TEXT[action] || "This request will be sent to our team for processing."}
            </p>
          </div>
        )}

        {!customerMode && fromAccounts && fromAccounts.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">From</label>
            <div className="relative">
              <Send size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <select
                value={fromId}
                onChange={(e) => setFromId(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500/50 transition-all"
              >
                {(fromAccounts || []).filter(a => a.is_active).map(a => (
                  <option key={a.id} value={a.id} className="bg-[var(--bg-primary)]">
                    {a.display_name ? `${a.display_name} <${a.email}>` : a.email}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">To</label>
          <div className="relative">
            <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="recipient@example.com"
              readOnly={isSupportAction}
              className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all read-only:opacity-70"
            />
          </div>
        </div>

        {!isSupportAction && (
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Recipient Name</label>
            <input
              type="text"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="Full name"
              className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all"
            />
          </div>
        )}

        {isSupportAction && (
          <>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Your Name <span className="text-red-400">*</span></label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Your Email <span className="text-red-400">*</span></label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Mobile <span className="text-[var(--text-muted)]">(optional)</span></label>
              <div className="relative">
                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Mobile number"
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all"
                />
              </div>
            </div>
          </>
        )}

        {action === "send" && (
          <>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">CC <span className="text-[var(--text-muted)]">(comma or semicolon separated)</span></label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  placeholder="cc@example.com"
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">BCC <span className="text-[var(--text-muted)]">(comma or semicolon separated)</span></label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={bcc}
                  onChange={(e) => setBcc(e.target.value)}
                  placeholder="bcc@example.com"
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all"
                />
              </div>
            </div>
            {(templates || signatures) && (
              <div className="flex items-center gap-2 flex-wrap">
                {templates && templates.length > 0 && (
                  <select
                    value=""
                    onChange={(e) => {
                      if (!e.target.value) return;
                      const t = templates.find(x => x.email_type === e.target.value);
                      const text = t?.plain_text || (t?.body ? t.body.replace(/<[^>]+>/g, "") : "");
                      if (!text) { setError("Template is empty — edit it first."); return; }
                      setError("");
                      setMessage(prev => prev.trim() ? `${prev.trim()}\n\n${text}` : text);
                      if (!subject && t?.subject) setSubject(t.subject);
                    }}
                    className="px-2.5 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)]/20 text-[var(--text-primary)] text-xs focus:outline-none focus:border-blue-500/50"
                  >
                    <option value="">Template ▼</option>
                    {templates.filter(t => t.is_active !== false).map(t => (
                      <option key={t.email_type} value={t.email_type}>{t.email_type}</option>
                    ))}
                  </select>
                )}
                {signatures && signatures.length > 0 && (
                  <select
                    value=""
                    onChange={(e) => {
                      if (!e.target.value) return;
                      const s = signatures.find(x => x.id === e.target.value);
                      if (!s || !s.content) { setError("Signature is empty — edit it first."); return; }
                      if (s.enabled === false) { setError("Cannot insert a disabled signature — enable it first."); return; }
                      setError("");
                      setMessage(prev => prev.trim() ? `${prev.trim()}\n\n${s.content}` : s.content);
                    }}
                    className="px-2.5 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)]/20 text-[var(--text-primary)] text-xs focus:outline-none focus:border-blue-500/50"
                  >
                    <option value="">Signature ▼</option>
                    {signatures.filter(s => s.enabled !== false).map(s => (
                      <option key={s.id} value={s.id}>{s.name}{s.is_default ? " (default)" : ""}</option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </>
        )}

        {(action === "activate" || action === "renew" || action === "reactivation" || action === "device-replacement") && (
          <>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">License Key</label>
              <div className="relative">
                <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                  placeholder="Enter license key"
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all font-mono"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Product Name</label>
              <div className="relative">
                <Package size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="Product name"
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all"
                />
              </div>
            </div>
          </>
        )}

        {(action === "reactivation" || action === "device-replacement") && (
          <>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Device / Hardware ID</label>
              <div className="relative">
                <Monitor size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={deviceId}
                  onChange={(e) => setDeviceId(e.target.value)}
                  placeholder="Hardware ID"
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all font-mono"
                />
              </div>
            </div>
          </>
        )}

        {action !== "history" && (
          <>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject"
                className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all"
              />
            </div>

            {(isSupportAction || action === "send") && (
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Message <span className="text-red-400">*</span></label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type your message here..."
                  rows={5}
                  className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all resize-none"
                />
              </div>
            )}

            {(action === "reactivation" || action === "device-replacement") && (
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Reason <span className="text-[var(--text-muted)]">(optional)</span></label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason for request"
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all resize-none"
                />
              </div>
            )}
          </>
        )}

        {!conversationId && !customerMode && renderAttachmentSection()}

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl border border-red-500/20 bg-red-500/5">
            <AlertCircle size={16} className="text-red-400 shrink-0" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {warning && (
          <div className="flex items-center gap-2 p-3 rounded-xl border border-amber-500/20 bg-amber-500/5">
            <AlertCircle size={16} className="text-amber-400 shrink-0" />
            <p className="text-sm text-amber-400">{warning}</p>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 p-3 rounded-xl border border-green-500/20 bg-green-500/5">
            <CheckCircle size={16} className="text-green-400 shrink-0" />
            <p className="text-sm text-green-400">{success}</p>
          </div>
        )}
      </div>
    );
  };

  const renderHistory = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="email"
            value={searchEmail}
            onChange={(e) => setSearchEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") loadHistory(); }}
            placeholder="Search by email..."
            className="w-full pl-10 pr-3 py-2 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all"
          />
        </div>
        <Button size="sm" onClick={() => loadHistory()} isLoading={historyLoading}>
          Search
        </Button>
      </div>

      {historyLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-[var(--text-muted)]" />
        </div>
      ) : emailHistory.length === 0 ? (
        <div className="text-center py-12">
          <History size={32} className="mx-auto text-[var(--text-muted)] opacity-30 mb-3" />
          <p className="text-sm text-[var(--text-muted)]">No email history found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {emailHistory.map((record) => (
            <div key={record.id} className="flex items-center justify-between p-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Mail size={14} className="text-[var(--text-muted)] shrink-0" />
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">{record.subject || record.email_type}</p>
                  {record.attachments.length > 0 && (
                    <span className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] shrink-0">
                      <Paperclip size={10} /> {record.attachments.length}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-[var(--text-muted)]">{record.recipient}</span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {record.sent_at ? new Date(record.sent_at).toLocaleString() : ""}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)]">{record.email_type}</span>
                </div>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                record.status === "sent"
                  ? "bg-green-500/10 text-green-400"
                  : "bg-red-500/10 text-red-400"
              }`}>
                {record.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const getActionTitle = () => {
    if (view === "actions") return allowedActions ? "Email Options" : "Email Center";
    if (view === "history") return "Email History";
    return actionConfig[action]?.label || "Send Email";
  };

  const getActionDescription = () => {
    if (view === "actions") return allowedActions ? "Select an admin email action to get started" : "Select an email action to get started";
    if (view === "history") return "View sent emails and request history";
    return actionConfig[action]?.description || "";
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" maxWidth="760px">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">{getActionTitle()}</h3>
            <p className="text-sm text-[var(--text-muted)]">{getActionDescription()}</p>
          </div>
          {view !== "actions" && (
            <button
              onClick={() => { setView("actions"); setError(""); setSuccess(""); setWarning(""); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/20 transition-all"
            >
              <ArrowLeft size={14} />
              Back
            </button>
          )}
        </div>

        {view === "actions" && renderActions()}
        {view === "form" && (
          <div className="space-y-4">
            {renderEmailForm()}
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setView("actions")} disabled={loading}>
                Cancel
              </Button>
              <Button onClick={handleSendEmail} isLoading={loading} leftIcon={<Send size={16} />}>
                {loading ? "Sending..." : "Send"}
              </Button>
            </div>
          </div>
        )}
        {view === "history" && renderHistory()}
      </div>
    </Modal>
  );
}
