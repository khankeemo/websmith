// PATH: C:\websmith\app\client\invoices\page.tsx
// Client Invoices Page - View and manage personal invoices

"use client";

import { useState, useEffect } from "react";
import { 
  Search, 
  Download, 
  Eye, 
  FileText,
  DollarSign,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  CreditCard,
  ChevronRight
} from "lucide-react";
import API from "@/core/services/apiService";
import Modal from "../../../components/ui/Modal";
import paymentService from "../../payments/services/paymentService";
import type { Payment } from "../../payments/services/paymentService";

interface Invoice {
  _id: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail?: string;
  amount: number;
  paidAmount?: number;
  dueAmount?: number;
  status: "paid" | "pending" | "partially_paid" | "overdue";
  issueDate: string;
  dueDate: string;
  items: Array<{
    description: string;
    amount: number;
  }>;
}

export default function ClientInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [gatewayLoading, setGatewayLoading] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [gatewayMessage, setGatewayMessage] = useState("");

  useEffect(() => {
    refreshBillingData();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const searchParams = new URLSearchParams(window.location.search);
    const paymentStatus = searchParams.get("paymentStatus");
    const provider = searchParams.get("provider");
    const paymentId = searchParams.get("paymentId");
    const sessionId = searchParams.get("session_id");

    if (paymentStatus === "success" && provider === "stripe" && paymentId && sessionId) {
      confirmStripePayment(paymentId, sessionId);
      return;
    }

    if (paymentStatus === "success") {
      setGatewayMessage("Payment submitted successfully. Verification is in progress.");
      refreshBillingData();
    } else if (paymentStatus === "cancelled") {
      setPaymentError("Payment was cancelled before completion.");
    }
  }, []);

  const fetchInvoices = async () => {
    try {
      const response = await API.get("/invoices");
      if (response.data.success) {
        setInvoices(response.data.data || []);
      }
    } catch (error) {
      console.error("Fetch invoices error:", error);
    }
  };

  const fetchPayments = async () => {
    try {
      const data = await paymentService.getAllPayments();
      setPayments(data || []);
    } catch (error) {
      console.error("Fetch payments error:", error);
    }
  };

  const refreshBillingData = async () => {
    try {
      setLoading(true);
      await Promise.all([fetchInvoices(), fetchPayments()]);
    } finally {
      setLoading(false);
    }
  };

  const confirmStripePayment = async (paymentId: string, sessionId: string) => {
    try {
      setGatewayLoading(true);
      setPaymentError("");
      setGatewayMessage("Confirming your Stripe payment...");

      await paymentService.confirmGatewayPayment({
        provider: "stripe",
        paymentId,
        sessionId,
      });

      setGatewayMessage("Payment confirmed successfully.");
      await refreshBillingData();
    } catch (error: any) {
      setPaymentError(
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        "Failed to confirm Stripe payment"
      );
    } finally {
      setGatewayLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid": return "#34C759";
      case "partially_paid": return "#007AFF";
      case "pending": return "#FF9500";
      case "overdue": return "#FF3B30";
      default: return "#8E8E93";
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const loadRazorpayScript = () => {
    return new Promise<void>((resolve, reject) => {
      if (typeof window === "undefined") {
        reject(new Error("Razorpay checkout requires a browser."));
        return;
      }

      if ((window as any).Razorpay) {
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Razorpay SDK."));
      document.body.appendChild(script);
    });
  };

  const handleGatewayPayment = async (provider: "stripe" | "razorpay") => {
    if (!selectedInvoice) return;

    setGatewayLoading(true);
    setPaymentError("");
    setGatewayMessage("");

    try {
      const response = await paymentService.createGatewayPayment({
        invoiceId: selectedInvoice._id,
        provider,
        amount: selectedInvoice.amount,
        currency: provider === "razorpay" ? "INR" : "USD",
        notes: `Client initiated payment for ${selectedInvoice.invoiceNumber}`,
      });

      if (response.provider === "stripe" && response.checkoutUrl) {
        window.location.href = response.checkoutUrl;
        return;
      }

      if (response.provider !== "razorpay") {
        throw new Error("Unexpected payment gateway response.");
      }

      const { order, keyId, paymentId } = response;
      await loadRazorpayScript();

      const options = {
        key: keyId,
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        name: "Websmith",
        description: `Invoice ${selectedInvoice.invoiceNumber}`,
        handler: async (gatewayResponse: any) => {
          try {
            await paymentService.confirmGatewayPayment({
              provider: "razorpay",
              paymentId,
              razorpayPaymentId: gatewayResponse.razorpay_payment_id,
              razorpayOrderId: gatewayResponse.razorpay_order_id,
              razorpaySignature: gatewayResponse.razorpay_signature,
            });

            setGatewayMessage("Payment confirmed successfully.");
            setSelectedInvoice(null);
            await refreshBillingData();
          } catch (error: any) {
            setPaymentError(
              error?.response?.data?.error ||
              error?.response?.data?.message ||
              error?.message ||
              "Failed to confirm Razorpay payment"
            );
          }
        },
        prefill: {
          name: selectedInvoice.clientName,
          email: selectedInvoice.clientEmail,
        },
        notes: {
          invoiceId: selectedInvoice._id,
          paymentId,
        },
      };

      const razorpay = new (window as any).Razorpay(options);
      razorpay.open();
    } catch (error: any) {
      setPaymentError(
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        "Failed to process payment"
      );
    } finally {
      setGatewayLoading(false);
    }
  };

  const filteredInvoices = invoices.filter(invoice => 
    invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const hasPendingPayment = (invoiceId: string) =>
    payments.some((payment) => payment.invoiceId === invoiceId && payment.status === "pending");

  const handleDownloadInvoice = async (invoice: Invoice) => {
    try {
      const response = await API.get(`/invoices/${invoice._id}/download`, { responseType: "blob" });
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `invoice-${invoice.invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Invoice download error:", error);
    }
  };

  const stats = {
    total: invoices.length,
    pending: invoices.filter(i => i.status !== "paid").length,
    totalDue: invoices.filter(i => i.status !== "paid").reduce((sum, i) => sum + (i.dueAmount ?? i.amount), 0),
    totalPaid: invoices.reduce((sum, i) => sum + (i.paidAmount ?? (i.status === "paid" ? i.amount : 0)), 0),
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p style={{ color: 'var(--text-secondary)' }}>Loading your billing dashboard...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>My Invoices</h1>
          <p style={styles.subtitle}>Review your billing history and manage payments</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={{ ...styles.statIcon, backgroundColor: "rgba(0, 122, 255, 0.1)" }}>
            <FileText size={22} color="#007AFF" />
          </div>
          <div>
            <div style={styles.statValue}>{stats.total}</div>
            <div style={styles.statLabel}>Total Invoices</div>
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statIcon, backgroundColor: "rgba(255, 59, 48, 0.1)" }}>
            <AlertCircle size={22} color="#FF3B30" />
          </div>
          <div>
            <div style={styles.statValue}>{formatCurrency(stats.totalDue)}</div>
            <div style={styles.statLabel}>Total Outstanding</div>
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statIcon, backgroundColor: "rgba(52, 199, 89, 0.1)" }}>
            <CheckCircle size={22} color="#34C759" />
          </div>
          <div>
            <div style={styles.statValue}>{formatCurrency(stats.totalPaid)}</div>
            <div style={styles.statLabel}>Total Paid</div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div style={styles.searchSection}>
        <div style={styles.searchWrapper}>
          <Search size={18} style={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search by invoice number (#)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
            className="input-focus"
          />
        </div>
      </div>

      {/* Invoice List */}
      {filteredInvoices.length === 0 ? (
        <div style={styles.emptyState}>
          <FileText size={64} color="var(--border-color)" />
          <h3 style={{ color: 'var(--text-primary)' }}>No invoices found</h3>
          <p style={{ color: 'var(--text-secondary)' }}>When you receive new invoices, they will appear here for payment.</p>
        </div>
      ) : (
        <div style={styles.listContainer}>
          {filteredInvoices.map((invoice) => (
            <div key={invoice._id} style={styles.invoiceCard} className="invoice-card">
              <div style={styles.cardHeader}>
                <div style={styles.cardInfo}>
                  <div style={styles.invNum}>{invoice.invoiceNumber}</div>
                  <div style={styles.invDate}>Generated on {formatDate(invoice.issueDate)}</div>
                </div>
                <div style={{
                  ...styles.statusBadge,
                  backgroundColor: `${getStatusColor(invoice.status)}15`,
                  color: getStatusColor(invoice.status),
                  border: `1px solid ${getStatusColor(invoice.status)}25`
                }}>
                  {invoice.status.toUpperCase()}
                </div>
              </div>
              
              <div style={styles.cardContent}>
                <div style={styles.amountSection}>
                  <div style={styles.amountLabel}>Total Due</div>
                  <div style={styles.amountValue}>{formatCurrency(invoice.dueAmount ?? invoice.amount)}</div>
                </div>
                <div style={styles.dateSection}>
                  <div style={styles.amountLabel}>Due Date</div>
                  <div style={{
                    ...styles.dateValue, 
                    color: invoice.status === 'overdue' ? '#FF3B30' : 'var(--text-primary)'
                  }}>
                    {formatDate(invoice.dueDate)}
                  </div>
                </div>
              </div>

              <div style={styles.cardFooter}>
                <div style={styles.footerActions}>
                  <button style={styles.actionBtn} className="action-btn-hover" onClick={() => setViewInvoice(invoice)}>
                    <Eye size={16} /> <span className="hide-mobile">Details</span>
                  </button>
                  <button style={styles.actionBtn} className="action-btn-hover" onClick={() => handleDownloadInvoice(invoice)}>
                    <Download size={16} /> <span className="hide-mobile">Receipt</span>
                  </button>
                </div>
                {invoice.status !== "paid" && !hasPendingPayment(invoice._id) && (
                  <button 
                    style={styles.payButton} 
                    className="pay-btn-hover"
                    onClick={() => {
                      setPaymentError("");
                      setGatewayMessage("");
                      setSelectedInvoice(invoice);
                    }}
                  >
                    <CreditCard size={18} /> Pay Now
                  </button>
                )}
                {hasPendingPayment(invoice._id) && (
                  <div style={styles.pendingVerification}>
                    Payment verification in progress
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .input-focus:focus {
          border-color: #007AFF !important;
          box-shadow: 0 0 0 4px rgba(0,122,255,0.1) !important;
        }
        .invoice-card {
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .invoice-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 32px rgba(0,0,0,0.12);
          border-color: #007AFF55 !important;
        }
        .action-btn-hover {
          transition: all 0.2s ease;
        }
        .action-btn-hover:hover {
          background-color: var(--bg-secondary) !important;
          color: #007AFF !important;
          border-color: #007AFF33 !important;
        }
        .pay-btn-hover {
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .pay-btn-hover:hover {
          background-color: #0055CC !important;
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0,122,255,0.25);
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 480px) {
          .hide-mobile { display: none; }
        }
      `}</style>

      <Modal
        isOpen={Boolean(selectedInvoice)}
        onClose={() => {
          setSelectedInvoice(null);
          setPaymentError("");
        }}
        title="Complete Payment"
        footer={
          <button
            type="button"
            onClick={() => setSelectedInvoice(null)}
            style={styles.modalSecondaryBtn}
          >
            Close
          </button>
        }
      >
        {selectedInvoice && (
          <div style={styles.paymentModalBody}>
            <p style={styles.modalText}>
              Invoice <strong>{selectedInvoice.invoiceNumber}</strong> for {formatCurrency(selectedInvoice.amount)}
            </p>
            {typeof selectedInvoice.paidAmount === "number" && selectedInvoice.paidAmount > 0 && (
              <p style={styles.modalText}>
                Paid so far: <strong>{formatCurrency(selectedInvoice.paidAmount)}</strong> | Remaining:{" "}
                <strong>{formatCurrency(selectedInvoice.dueAmount ?? selectedInvoice.amount)}</strong>
              </p>
            )}
            <label style={styles.modalLabel}>Choose Payment Gateway</label>
            <div style={styles.gatewayButtons}>
              <button
                type="button"
                style={styles.gatewayButton}
                onClick={() => handleGatewayPayment('razorpay')}
                disabled={gatewayLoading}
              >
                {gatewayLoading ? "Processing..." : "Pay with Razorpay"}
              </button>
              <button
                type="button"
                style={styles.gatewayButton}
                onClick={() => handleGatewayPayment('stripe')}
                disabled={gatewayLoading}
              >
                {gatewayLoading ? "Processing..." : "Pay with Stripe"}
              </button>
            </div>

            {gatewayMessage && <p style={styles.gatewayMessage}>{gatewayMessage}</p>}
            {paymentError && <p style={styles.modalError}>{paymentError}</p>}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(viewInvoice)}
        onClose={() => setViewInvoice(null)}
        title={viewInvoice ? `Invoice ${viewInvoice.invoiceNumber}` : "Invoice Details"}
      >
        {viewInvoice && (
          <div style={styles.paymentModalBody}>
            <p style={styles.modalText}><strong>Client:</strong> {viewInvoice.clientName}</p>
            <p style={styles.modalText}><strong>Status:</strong> {viewInvoice.status}</p>
            <p style={styles.modalText}><strong>Issue Date:</strong> {formatDate(viewInvoice.issueDate)}</p>
            <p style={styles.modalText}><strong>Due Date:</strong> {formatDate(viewInvoice.dueDate)}</p>
            {viewInvoice.items.map((item, index) => (
              <div key={`${item.description}-${index}`} style={styles.invoiceItemRow}>
                <span>{item.description}</span>
                <strong>{formatCurrency(item.amount)}</strong>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

const styles: any = {
  container: {
    maxWidth: "1000px",
    margin: "0 auto",
    padding: "40px 24px",
    backgroundColor: "var(--bg-primary)",
    color: "var(--text-primary)",
    minHeight: '100vh',
  },
  loadingContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "400px",
    gap: "16px",
  },
  spinner: {
    width: "40px",
    height: "40px",
    border: "3px solid var(--border-color)",
    borderTopColor: "#007AFF",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  header: { marginBottom: "40px" },
  title: { 
    fontSize: "36px", 
    fontWeight: 800, 
    marginBottom: "8px", 
    letterSpacing: "-1.5px",
    color: 'var(--text-primary)'
  },
  subtitle: { 
    fontSize: "17px", 
    color: "var(--text-secondary)",
    fontWeight: 500
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "24px",
    marginBottom: "40px",
  },
  statCard: {
    display: "flex",
    alignItems: "center",
    gap: "20px",
    padding: "28px",
    backgroundColor: "var(--bg-primary)",
    borderRadius: "24px",
    border: "1.5px solid var(--border-color)",
    boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
  },
  statIcon: {
    width: "56px",
    height: "56px",
    borderRadius: "16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: { 
    fontSize: "28px", 
    fontWeight: 800, 
    color: "var(--text-primary)",
    letterSpacing: '-1px'
  },
  statLabel: { 
    fontSize: "14px", 
    color: "var(--text-secondary)", 
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  searchSection: { marginBottom: "32px" },
  searchWrapper: { position: "relative" },
  searchIcon: { position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)" },
  searchInput: {
    width: "100%",
    padding: "14px 16px 14px 48px",
    fontSize: "16px",
    border: "1.5px solid var(--border-color)",
    borderRadius: "16px",
    outline: "none",
    backgroundColor: "var(--bg-secondary)",
    color: "var(--text-primary)",
    transition: 'all 0.2s ease',
  },
  listContainer: { display: "flex", flexDirection: "column", gap: "20px" },
  invoiceCard: {
    backgroundColor: "var(--bg-primary)",
    borderRadius: "24px",
    border: "1.5px solid var(--border-color)",
    padding: "28px",
    boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
  },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" },
  cardInfo: { display: "flex", flexDirection: "column", gap: "6px" },
  invNum: { fontSize: "20px", fontWeight: 800, color: "#007AFF", letterSpacing: '-0.5px' },
  invDate: { fontSize: "14px", color: "var(--text-secondary)", fontWeight: 500 },
  statusBadge: { padding: "6px 14px", borderRadius: "20px", fontSize: "11px", fontWeight: 800, letterSpacing: "1px" },
  cardContent: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    padding: "24px 0",
    borderTop: "1.5px solid var(--border-color)",
    borderBottom: "1.5px solid var(--border-color)",
    marginBottom: "24px",
  },
  amountSection: { display: "flex", flexDirection: "column", gap: "6px" },
  dateSection: { display: "flex", flexDirection: "column", gap: "6px", alignItems: "flex-end" },
  amountLabel: { fontSize: "12px", color: "var(--text-secondary)", fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' },
  amountValue: { fontSize: "26px", fontWeight: 800, color: 'var(--text-primary)' },
  dateValue: { fontSize: "16px", fontWeight: 700 },
  cardFooter: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" },
  footerActions: { display: "flex", gap: "10px" },
  actionBtn: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 20px",
    backgroundColor: "transparent",
    border: "1.5px solid var(--border-color)",
    borderRadius: "12px",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
    color: "var(--text-primary)",
  },
  payButton: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "12px 28px",
    backgroundColor: "#007AFF",
    color: "#FFFFFF",
    border: "none",
    borderRadius: "14px",
    fontSize: "15px",
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: '0 8px 20px rgba(0,122,255,0.2)',
  },
  pendingVerification: {
    padding: "12px 18px",
    borderRadius: "14px",
    backgroundColor: "rgba(255, 149, 0, 0.12)",
    color: "#B26A00",
    fontSize: "13px",
    fontWeight: 700,
  },
  emptyState: { 
    textAlign: "center", 
    padding: "100px 20px", 
    backgroundColor: 'var(--bg-secondary)', 
    borderRadius: '32px',
    border: '1.5px dashed var(--border-color)',
  },
  paymentModalBody: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  modalText: {
    margin: 0,
    color: "var(--text-primary)",
    lineHeight: 1.5,
  },
  modalLabel: {
    fontSize: "14px",
    fontWeight: 600,
    color: "var(--text-primary)",
  },
  gatewayButtons: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "12px",
    marginTop: "10px",
  },
  gatewayButton: {
    padding: "12px 16px",
    borderRadius: "12px",
    border: "1px solid var(--border-color)",
    backgroundColor: "#007AFF",
    color: "#FFFFFF",
    fontWeight: 700,
    cursor: "pointer",
  },
  gatewayMessage: {
    margin: 0,
    color: "#0B6F44",
    fontSize: "13px",
    fontWeight: 500,
  },
  modalError: {
    margin: 0,
    color: "#FF3B30",
    fontSize: "13px",
    fontWeight: 500,
  },
  invoiceItemRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    padding: "10px 12px",
    borderRadius: "12px",
    backgroundColor: "var(--bg-secondary)",
    color: "var(--text-primary)",
  },
  modalSecondaryBtn: {
    padding: "10px 16px",
    borderRadius: "12px",
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-primary)",
    color: "var(--text-primary)",
    fontWeight: 600,
    cursor: "pointer",
  },
};
