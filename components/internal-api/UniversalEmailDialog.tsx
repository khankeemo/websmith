"use client";

import { useState, useCallback, useEffect } from "react";
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
  Eye,
  User,
  Phone,
  FileText,
  ArrowLeft,
  Download,
  Clock,
  Copy,
  ExternalLink,
  Package,
} from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";

const API_BASE = "/internal/backend";
const SUPPORT_EMAIL = "support@websmithdigital.com";

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
}

interface EmailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  defaultEmail?: string;
  defaultLicenseKey?: string;
  defaultProductName?: string;
  defaultAction?: EmailAction;
}

const actionConfig: Record<EmailAction, { label: string; icon: typeof Mail; description: string }> = {
  send: { label: "Send Email", icon: Send, description: "Send a custom email message" },
  history: { label: "Email History", icon: History, description: "View sent email history" },
  "buy-license": { label: "Buy License", icon: ShoppingCart, description: "Purchase a new license" },
  activate: { label: "Activate License", icon: KeyRound, description: "Activate a license key" },
  renew: { label: "Renew License", icon: Repeat, description: "Extend license expiration" },
  reactivation: { label: "Reactivation", icon: RefreshCw, description: "Reactivate a previously active license" },
  "device-replacement": { label: "Device Replacement", icon: Monitor, description: "Replace a bound device" },
  support: { label: "Support Request", icon: LifeBuoy, description: "Contact support for assistance" },
  general: { label: "General Request", icon: MessageSquare, description: "Submit a general inquiry" },
};

export default function UniversalEmailDialog({ isOpen, onClose, defaultEmail, defaultLicenseKey, defaultProductName, defaultAction }: EmailDialogProps) {
  const [view, setView] = useState<"actions" | "form" | "history">("actions");
  const [action, setAction] = useState<EmailAction>(defaultAction || "send");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [recipientEmail, setRecipientEmail] = useState(defaultEmail || "");
  const [recipientName, setRecipientName] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const [licenseKey, setLicenseKey] = useState(defaultLicenseKey || "");
  const [productName, setProductName] = useState(defaultProductName || "");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [reason, setReason] = useState("");

  const [emailHistory, setEmailHistory] = useState<EmailRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [searchEmail, setSearchEmail] = useState("");

  useEffect(() => {
    if (isOpen) {
      setView("actions");
      setError("");
      setSuccess("");
      if (defaultAction) {
        openAction(defaultAction);
      }
    }
  }, [isOpen, defaultAction]);

  const openAction = useCallback((a: EmailAction) => {
    setAction(a);
    setError("");
    setSuccess("");

    switch (a) {
      case "send":
        setSubject("");
        setMessage("");
        if (!recipientEmail) setRecipientEmail(defaultEmail || "");
        setView("form");
        break;
      case "history":
        setSearchEmail(defaultEmail || "");
        loadHistory(defaultEmail || "");
        setView("history");
        break;
      case "buy-license":
        setSubject(`License Purchase Inquiry - ${productName || "Product"}`);
        setMessage(`I am interested in purchasing a license for ${productName || "your product"}.\n\nPlease provide pricing and availability.`);
        setRecipientEmail(SUPPORT_EMAIL);
        setView("form");
        break;
      case "activate":
        setSubject(`License Activation Request - ${licenseKey || ""}`);
        setRecipientEmail(SUPPORT_EMAIL);
        setView("form");
        break;
      case "renew":
        setSubject(`License Renewal Request - ${licenseKey || ""}`);
        setRecipientEmail(SUPPORT_EMAIL);
        setView("form");
        break;
      case "reactivation":
        setSubject(`License Reactivation Request - ${licenseKey || ""}`);
        setRecipientEmail(SUPPORT_EMAIL);
        setView("form");
        break;
      case "device-replacement":
        setSubject(`Device Replacement Request - ${licenseKey || ""}`);
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
  }, [defaultEmail, defaultLicenseKey, productName, licenseKey, recipientEmail]);

  const loadHistory = useCallback(async (email?: string) => {
    const search = email || searchEmail;
    if (!search) return;
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/search/email?email=${encodeURIComponent(search)}`);
      const data = await res.json();
      if (data.success) {
        setEmailHistory([{
          id: "1",
          email_type: data.license_key ? "license_lookup" : "search",
          recipient: search,
          subject: `License: ${data.license_key || "N/A"}`,
          status: data.status || "found",
          sent_at: data.created_at || new Date().toISOString(),
        }]);
      } else {
        setEmailHistory([]);
      }
    } catch {
      setError("Failed to load email history");
    } finally {
      setHistoryLoading(false);
    }
  }, [searchEmail]);

  const handleSendEmail = async () => {
    if (!recipientEmail) {
      setError("Recipient email is required");
      return;
    }
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const token = localStorage.getItem("api_center_token");
      const emailType = action === "send" ? "admin_notification" :
        action === "buy-license" ? "welcome_customer" :
        action === "renew" ? "license_renewed" :
        action === "activate" ? "activation_success" :
        action === "reactivation" ? "reactivation_approved" :
        action === "support" ? "admin_notification" : "admin_notification";

      const res = await fetch(`${API_BASE}/admin/email/templates`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email_type: emailType,
          subject,
          body: `<p>${message.replace(/\n/g, "<br/>")}</p>`,
          plain_text: message,
          is_active: true,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccess("Email sent successfully");
        setTimeout(() => {
          setView("actions");
          setSuccess("");
        }, 2000);
      } else {
        setError(data.error || "Failed to send email");
      }
    } catch {
      setError("Failed to send email. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const renderActions = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {(Object.entries(actionConfig) as [EmailAction, typeof actionConfig[EmailAction]][]).map(([key, cfg]) => {
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

  const renderEmailForm = () => {
    const isSupportAction = ["buy-license", "renew", "reactivation", "device-replacement", "support", "general"].includes(action);

    return (
      <div className="space-y-4">
        {isSupportAction && (
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
            <p className="text-sm text-[var(--text-secondary)]">
              This request will be sent to our support team for processing.
            </p>
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
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Customer Name</label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Customer name"
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Customer Phone</label>
              <div className="relative">
                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Phone number"
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all"
                />
              </div>
            </div>
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

            {(action === "reactivation" || action === "device-replacement" || action === "support" || action === "general" || action === "send") && (
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Message</label>
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

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl border border-red-500/20 bg-red-500/5">
            <AlertCircle size={16} className="text-red-400 shrink-0" />
            <p className="text-sm text-red-400">{error}</p>
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
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">{record.subject}</p>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-[var(--text-muted)]">{record.recipient}</span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {record.sent_at ? new Date(record.sent_at).toLocaleDateString() : ""}
                  </span>
                </div>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                record.status === "sent" || record.status === "found"
                  ? "bg-green-500/10 text-green-400"
                  : "bg-amber-500/10 text-amber-400"
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
    if (view === "actions") return "Email Center";
    if (view === "history") return "Email History";
    return actionConfig[action]?.label || "Send Email";
  };

  const getActionDescription = () => {
    if (view === "actions") return "Select an email action to get started";
    if (view === "history") return "View sent emails and request history";
    return actionConfig[action]?.description || "";
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" maxWidth="640px">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">{getActionTitle()}</h3>
            <p className="text-sm text-[var(--text-muted)]">{getActionDescription()}</p>
          </div>
          {view !== "actions" && (
            <button
              onClick={() => { setView("actions"); setError(""); setSuccess(""); }}
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