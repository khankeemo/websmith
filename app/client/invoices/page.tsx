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

interface Invoice {
  _id: string;
  invoiceNumber: string;
  clientName: string;
  amount: number;
  status: "paid" | "pending" | "overdue";
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

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      const response = await API.get("/invoices");
      if (response.data.success) {
        setInvoices(response.data.data || []);
      }
    } catch (error) {
      console.error("Fetch invoices error:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid": return "#34C759";
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

  const filteredInvoices = invoices.filter(invoice => 
    invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: invoices.length,
    pending: invoices.filter(i => i.status !== "paid").length,
    totalDue: invoices.filter(i => i.status !== "paid").reduce((sum, i) => sum + i.amount, 0),
    totalPaid: invoices.filter(i => i.status === "paid").reduce((sum, i) => sum + i.amount, 0),
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
                  <div style={styles.amountValue}>{formatCurrency(invoice.amount)}</div>
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
                  <button style={styles.actionBtn} className="action-btn-hover">
                    <Eye size={16} /> <span className="hide-mobile">Details</span>
                  </button>
                  <button style={styles.actionBtn} className="action-btn-hover">
                    <Download size={16} /> <span className="hide-mobile">Receipt</span>
                  </button>
                </div>
                {invoice.status !== "paid" && (
                  <button 
                    style={styles.payButton} 
                    className="pay-btn-hover"
                    onClick={() => alert("Redirecting to secure payment page...")}
                  >
                    <CreditCard size={18} /> Pay Now
                  </button>
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
  emptyState: { 
    textAlign: "center", 
    padding: "100px 20px", 
    backgroundColor: 'var(--bg-secondary)', 
    borderRadius: '32px',
    border: '1.5px dashed var(--border-color)',
  },
};
