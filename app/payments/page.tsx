// PATH: C:\websmith\app\payments\page.tsx
// Payments Page - Track all payments and transactions
// Features: View payment history, payment status, transaction details

"use client";

import { useState, useEffect } from "react";
import { 
  Search, 
  CreditCard, 
  DollarSign, 
  Calendar, 
  CheckCircle, 
  Clock, 
  XCircle,
  Download,
  Eye
} from "lucide-react";
import API from "@/core/services/apiService";
import Modal from "@/components/ui/Modal";
import { ViewModeToggle } from "@/components/ui/ViewModeToggle";

interface Payment {
  _id: string;
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  amount: number;
  method: "card" | "bank" | "cash" | "crypto";
  status: "completed" | "pending" | "failed" | "refunded";
  transactionId: string;
  date: string;
  notes?: string;
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [isDownloadingReceipt, setIsDownloadingReceipt] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      const response = await API.get("/payments");
      if (response.data.success || response.data.data) {
        setPayments(response.data.data || []);
      }
    } catch (error) {
      console.error("Fetch payments error:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "#34C759";
      case "pending": return "#FF9500";
      case "failed": return "#FF3B30";
      case "refunded": return "#8E8E93";
      default: return "#8E8E93";
    }
  };

  const getMethodIcon = (method: string) => {
    switch (method) {
      case "card": return "💳";
      case "bank": return "🏦";
      case "cash": return "💰";
      case "crypto": return "₿";
      default: return "💳";
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

  const filteredPayments = payments.filter(payment => {
    const matchesSearch = payment.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         payment.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         payment.transactionId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === "all" || payment.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const handleViewDetails = (payment: Payment) => {
    setSelectedPayment(payment);
  };

  const handleCloseDetails = () => {
    setSelectedPayment(null);
  };

  const handleDownloadReceipt = async (payment: Payment) => {
    try {
      setIsDownloadingReceipt(true);
      setDownloadError("");

      const response = await API.get(`/payments/${payment._id}/receipt`, { responseType: "blob" });
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `receipt-${payment.invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error("Receipt download error:", error);
      setDownloadError(error?.response?.data?.message || "Failed to download receipt");
    } finally {
      setIsDownloadingReceipt(false);
    }
  };

  const stats = {
    total: payments.length,
    completed: payments.filter(p => p.status === "completed").length,
    pending: payments.filter(p => p.status === "pending").length,
    totalAmount: payments.reduce((sum, p) => sum + (p.status === "completed" ? p.amount : 0), 0)
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p>Loading payments...</p>
      </div>
    );
  }

  return (
    <div style={styles.container} className="wsd-page">
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Payments</h1>
          <p style={styles.subtitle}>Track all your transactions and payments</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={styles.statsGrid} className="wsd-grid-tiles">
        <div style={styles.statCard}>
          <div style={{ ...styles.statIcon, backgroundColor: "rgba(0, 122, 255, 0.1)" }}>
            <CreditCard size={20} color="#007AFF" />
          </div>
          <div>
            <div style={styles.statValue}>{stats.total}</div>
            <div style={styles.statLabel}>Total Transactions</div>
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statIcon, backgroundColor: "rgba(52, 199, 89, 0.1)" }}>
            <DollarSign size={20} color="#34C759" />
          </div>
          <div>
            <div style={styles.statValue}>{formatCurrency(stats.totalAmount)}</div>
            <div style={styles.statLabel}>Total Received</div>
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statIcon, backgroundColor: "rgba(255, 149, 0, 0.1)" }}>
            <Clock size={20} color="#FF9500" />
          </div>
          <div>
            <div style={styles.statValue}>{stats.pending}</div>
            <div style={styles.statLabel}>Pending</div>
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statIcon, backgroundColor: "rgba(52, 199, 89, 0.1)" }}>
            <CheckCircle size={20} color="#34C759" />
          </div>
          <div>
            <div style={styles.statValue}>{stats.completed}</div>
            <div style={styles.statLabel}>Completed</div>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div style={styles.searchSection} className="payments-search-section wsd-toolbar">
        <div style={styles.searchWrapper} className="wsd-search-box">
          <Search size={18} style={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search by invoice #, client, or transaction ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
            className="input-focus"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={styles.filterSelect}
        >
          <option value="all">All Status</option>
          <option value="completed">Completed</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </select>
        <ViewModeToggle value={viewMode} onChange={setViewMode} />
      </div>

      {downloadError && (
        <div style={styles.errorBanner} role="alert">
          {downloadError}
        </div>
      )}

      {/* Payments List */}
      {filteredPayments.length === 0 ? (
        <div style={styles.emptyState}>
          <CreditCard size={64} color="var(--text-secondary)" />
          <h3 style={{color: 'var(--text-primary)'}}>No payments found</h3>
          <p style={{color: 'var(--text-secondary)'}}>When you receive payments, they will appear here</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div style={styles.paymentsGrid}>
          {filteredPayments.map((payment) => (
            <div key={payment._id} style={styles.paymentCard} className="payment-card">
              <div style={styles.paymentHeader}>
                <div style={styles.paymentLeft}>
                  <div style={styles.methodIcon}>{getMethodIcon(payment.method)}</div>
                  <div>
                    <div style={styles.invoiceNumber}>Invoice #{payment.invoiceNumber}</div>
                    <div style={styles.clientName}>{payment.clientName}</div>
                  </div>
                </div>
                <div style={styles.paymentRight}>
                  <div style={styles.amount}>{formatCurrency(payment.amount)}</div>
                  <span style={{
                    ...styles.statusBadge,
                    backgroundColor: `${getStatusColor(payment.status)}15`,
                    color: getStatusColor(payment.status)
                  }}>
                    {payment.status}
                  </span>
                </div>
              </div>
              <div style={styles.paymentDetails}>
                <div style={styles.detailItem}>
                  <Calendar size={14} color="var(--text-secondary)" />
                  <span>{formatDate(payment.date)}</span>
                </div>
                <div style={styles.detailItem}>
                  <CreditCard size={14} color="var(--text-secondary)" />
                  <span>Transaction: {payment.transactionId}</span>
                </div>
              </div>
              <div style={styles.paymentActions} className="payment-actions-stack">
                <button style={styles.viewButton} className="action-btn" onClick={() => handleViewDetails(payment)}>
                  <Eye size={14} /> View Details
                </button>
                <button
                  style={styles.downloadButton}
                  className="action-btn"
                  onClick={() => handleDownloadReceipt(payment)}
                  disabled={isDownloadingReceipt}
                >
                  <Download size={14} /> {isDownloadingReceipt ? 'Downloading...' : 'Receipt'}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={styles.tableContainer}>
          <table style={styles.paymentsTable}>
            <thead>
              <tr>
                <th style={styles.th}>Invoice #</th>
                <th style={styles.th}>Client</th>
                <th style={styles.th}>Amount</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Date</th>
                <th style={styles.th}>Transaction</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map((payment) => (
                <tr key={payment._id} style={styles.tableRow} className="table-row">
                  <td style={styles.td}>{payment.invoiceNumber}</td>
                  <td style={styles.td}>{payment.clientName}</td>
                  <td style={styles.td}>{formatCurrency(payment.amount)}</td>
                  <td style={styles.td}>
                    <span style={{
                      ...styles.statusBadge,
                      backgroundColor: `${getStatusColor(payment.status)}15`,
                      color: getStatusColor(payment.status)
                    }}>
                      {payment.status}
                    </span>
                  </td>
                  <td style={styles.td}>{formatDate(payment.date)}</td>
                  <td style={styles.td}>{payment.transactionId}</td>
                  <td style={styles.td}>
                    <div style={styles.paymentActions} className="payment-actions-stack">
                      <button style={styles.viewButton} className="action-btn" onClick={() => handleViewDetails(payment)}>
                        <Eye size={14} /> View
                      </button>
                      <button
                        style={styles.downloadButton}
                        className="action-btn"
                        onClick={() => handleDownloadReceipt(payment)}
                        disabled={isDownloadingReceipt}
                      >
                        <Download size={14} /> Receipt
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        isOpen={Boolean(selectedPayment)}
        onClose={handleCloseDetails}
        title="Payment Details"
        maxWidth="560px"
      >
        {selectedPayment ? (
          <div style={styles.modalContent}>
            <div style={styles.modalGrid}>
              <div>
                <div style={styles.modalLabel}>Invoice</div>
                <div style={styles.modalValue}>#{selectedPayment.invoiceNumber}</div>
              </div>
              <div>
                <div style={styles.modalLabel}>Status</div>
                <div style={styles.modalValue}>{selectedPayment.status}</div>
              </div>
              <div>
                <div style={styles.modalLabel}>Amount</div>
                <div style={styles.modalValue}>{formatCurrency(selectedPayment.amount)}</div>
              </div>
              <div>
                <div style={styles.modalLabel}>Payment Date</div>
                <div style={styles.modalValue}>{formatDate(selectedPayment.date)}</div>
              </div>
              <div>
                <div style={styles.modalLabel}>Payment Method</div>
                <div style={styles.modalValue}>{selectedPayment.method}</div>
              </div>
              <div>
                <div style={styles.modalLabel}>Transaction ID</div>
                <div style={styles.modalValue}>{selectedPayment.transactionId}</div>
              </div>
            </div>
            <div style={styles.modalSection}>
              <div style={styles.modalLabel}>Client</div>
              <div style={styles.modalValue}>{selectedPayment.clientName}</div>
              <div style={styles.modalValue}>{selectedPayment.clientEmail}</div>
            </div>
            {selectedPayment.notes && (
              <div style={styles.modalSection}>
                <div style={styles.modalLabel}>Notes</div>
                <div style={styles.modalValue}>{selectedPayment.notes}</div>
              </div>
            )}
          </div>
        ) : null}
      </Modal>

      <style>{`
        .input-focus:focus {
          border-color: #007AFF !important;
          box-shadow: 0 0 0 4px rgba(0,122,255,0.1) !important;
        }
        .payment-card {
          transition: all 0.2s ease;
        }
        .payment-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0,0,0,0.12);
          border-color: #007AFF !important;
        }
        .action-btn {
          transition: all 0.2s ease;
        }
        .action-btn:hover {
          transform: translateY(-1px);
          opacity: 0.8;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @media (max-width: 768px) {
          .payments-search-section {
            flex-direction: column !important;
          }
          .payments-search-section select {
            width: 100%;
          }
          .payment-actions-stack {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}

const styles: any = {
  container: {
    width: "100%",
    maxWidth: "100%",
    margin: 0,
    padding: 0,
    backgroundColor: "var(--bg-primary)",
    color: "var(--text-primary)",
    minHeight: "100vh",
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
  header: {
    marginBottom: "32px",
  },
  title: {
    fontSize: "34px",
    fontWeight: 700,
    color: "var(--text-primary)",
    marginBottom: "8px",
    letterSpacing: "-1px",
  },
  subtitle: {
    fontSize: "16px",
    color: "var(--text-secondary)",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "16px",
    marginBottom: "32px",
  },
  statCard: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    padding: "20px",
    backgroundColor: "var(--bg-primary)",
    borderRadius: "16px",
    border: "1px solid var(--border-color)",
  },
  statIcon: {
    width: "48px",
    height: "48px",
    borderRadius: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    fontSize: "24px",
    fontWeight: 700,
    color: "var(--text-primary)",
  },
  statLabel: {
    fontSize: "13px",
    color: "var(--text-secondary)",
  },
  searchSection: {
    display: "flex",
    gap: "16px",
    marginBottom: "24px",
    flexWrap: "wrap",
  },
  searchWrapper: {
    flex: 1,
    position: "relative",
  },
  searchIcon: {
    position: "absolute",
    left: "14px",
    top: "50%",
    transform: "translateY(-50%)",
    color: "var(--text-secondary)",
  },
  searchInput: {
    width: "100%",
    padding: "12px 16px 12px 40px",
    fontSize: "16px",
    border: "1.5px solid var(--border-color)",
    borderRadius: "12px",
    outline: "none",
    transition: "all 0.2s ease",
    backgroundColor: "var(--bg-primary)",
    color: "var(--text-primary)",
  },
  filterSelect: {
    padding: "12px 16px",
    fontSize: "14px",
    border: "1.5px solid var(--border-color)",
    borderRadius: "12px",
    backgroundColor: "var(--bg-primary)",
    color: "var(--text-primary)",
    cursor: "pointer",
  },
  emptyState: {
    textAlign: "center",
    padding: "80px 20px",
    backgroundColor: "var(--bg-secondary)",
    borderRadius: "20px",
    border: "1px solid var(--border-color)",
  },
  paymentsList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "16px",
  },
  paymentsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: "16px",
  },
  tableContainer: {
    overflowX: "auto" as const,
    borderRadius: "20px",
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-primary)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.04)",
  },
  paymentsTable: {
    width: "100%",
    borderCollapse: "collapse" as const,
    minWidth: "780px",
  },
  th: {
    padding: "18px 16px",
    textAlign: "left" as const,
    fontSize: "12px",
    fontWeight: 700,
    color: "var(--text-secondary)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    borderBottom: "1px solid var(--border-color)",
  },
  td: {
    padding: "16px",
    borderBottom: "1px solid var(--border-color)",
    color: "var(--text-primary)",
    verticalAlign: "middle" as const,
    fontSize: "14px",
  },
  tableRow: {
    transition: "background-color 0.2s ease",
  },
  paymentCard: {
    backgroundColor: "var(--bg-primary)",
    borderRadius: "16px",
    border: "1px solid var(--border-color)",
    padding: "20px",
  },
  paymentHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "16px",
    flexWrap: "wrap",
    gap: "12px",
  },
  paymentLeft: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  methodIcon: {
    fontSize: "28px",
  },
  invoiceNumber: {
    fontSize: "16px",
    fontWeight: 700,
    color: "#007AFF",
  },
  clientName: {
    fontSize: "14px",
    color: "var(--text-secondary)",
  },
  paymentRight: {
    textAlign: "right" as const,
  },
  amount: {
    fontSize: "20px",
    fontWeight: 700,
    color: "var(--text-primary)",
    marginBottom: "4px",
  },
  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "4px 10px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: 600,
    textTransform: "capitalize" as const,
  },
  paymentDetails: {
    display: "flex",
    gap: "24px",
    paddingTop: "12px",
    borderTop: "1px solid var(--border-color)",
    marginBottom: "12px",
    flexWrap: "wrap",
  },
  detailItem: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "13px",
    color: "var(--text-secondary)",
  },
  paymentActions: {
    display: "flex",
    gap: "12px",
  },
  viewButton: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "8px 16px",
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border-color)",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "13px",
    color: "var(--text-primary)",
    fontWeight: 600,
  },
  downloadButton: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "8px 16px",
    backgroundColor: "#007AFF",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "13px",
    color: "#FFFFFF",
    fontWeight: 600,
  },
  errorBanner: {
    backgroundColor: "#FFE9E9",
    color: "#BF1E2E",
    border: "1px solid #F5C6CB",
    borderRadius: "12px",
    padding: "14px 16px",
    marginBottom: "20px",
  },
  modalContent: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  modalGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "16px",
    marginBottom: "16px",
  },
  modalLabel: {
    fontSize: "12px",
    color: "var(--text-secondary)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: "6px",
  },
  modalValue: {
    fontSize: "14px",
    color: "var(--text-primary)",
    fontWeight: 600,
    lineHeight: 1.6,
  },
  modalSection: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
};
