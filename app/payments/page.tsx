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

interface Payment {
  _id: string;
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
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
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Payments</h1>
          <p style={styles.subtitle}>Track all your transactions and payments</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={styles.statsGrid}>
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
      <div style={styles.searchSection} className="payments-search-section">
        <div style={styles.searchWrapper}>
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
      </div>

      {/* Payments List */}
      {filteredPayments.length === 0 ? (
        <div style={styles.emptyState}>
          <CreditCard size={64} color="var(--text-secondary)" />
          <h3 style={{color: 'var(--text-primary)'}}>No payments found</h3>
          <p style={{color: 'var(--text-secondary)'}}>When you receive payments, they will appear here</p>
        </div>
      ) : (
        <div style={styles.paymentsList}>
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
              <div style={styles.paymentActions}>
                <button style={styles.viewButton} className="action-btn">
                  <Eye size={14} /> View Details
                </button>
                <button style={styles.downloadButton} className="action-btn">
                  <Download size={14} /> Receipt
                </button>
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
        }
      `}</style>
    </div>
  );
}

const styles: any = {
  container: {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "32px 24px",
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
};
