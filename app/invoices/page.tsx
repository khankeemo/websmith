// PATH: C:\websmith\app\invoices\page.tsx
// Invoices Page - Manage all invoices
// Features: Create, view, edit, delete invoices, download PDF

"use client";

import { useState, useEffect } from "react";
import { 
  Plus, 
  Search, 
  Download, 
  Eye, 
  Edit2, 
  Trash2,
  FileText,
  DollarSign,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import API from "@/core/services/apiService";

interface Invoice {
  _id: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  amount: number;
  status: "paid" | "pending" | "overdue" | "draft";
  issueDate: string;
  dueDate: string;
  items: Array<{
    description: string;
    quantity: number;
    rate: number;
    amount: number;
  }>;
  notes?: string;
  createdAt: string;
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      const response = await API.get("/invoices");
      if (response.data.success || response.data.data) {
        setInvoices(response.data.data || []);
      }
    } catch (error) {
      console.error("Fetch invoices error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this invoice?")) return;
    
    try {
      const response = await API.delete(`/invoices/${id}`);
      if (response.status === 200) {
        await fetchInvoices();
      }
    } catch (error) {
      console.error("Delete error:", error);
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "paid": return <CheckCircle size={14} />;
      case "pending": return <Clock size={14} />;
      case "overdue": return <AlertCircle size={14} />;
      default: return <FileText size={14} />;
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

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         invoice.clientName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === "all" || invoice.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const stats = {
    total: invoices.length,
    paid: invoices.filter(i => i.status === "paid").length,
    pending: invoices.filter(i => i.status === "pending").length,
    overdue: invoices.filter(i => i.status === "overdue").length,
    totalAmount: invoices.reduce((sum, i) => sum + i.amount, 0)
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p style={{ color: 'var(--text-secondary)' }}>Loading invoices...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Invoices</h1>
          <p style={styles.subtitle}>Manage and track all customer billing</p>
        </div>
        <button onClick={() => { setEditingInvoice(null); setIsModalOpen(true); }} style={styles.createButton} className="create-btn">
          <Plus size={18} /> Create Invoice
        </button>
      </div>

      {/* Stats Cards */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={{ ...styles.statIcon, backgroundColor: "rgba(0, 122, 255, 0.1)" }}>
            <FileText size={20} color="#007AFF" />
          </div>
          <div>
            <div style={styles.statValue}>{stats.total}</div>
            <div style={styles.statLabel}>Total Invoices</div>
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statIcon, backgroundColor: "rgba(52, 199, 89, 0.1)" }}>
            <DollarSign size={20} color="#34C759" />
          </div>
          <div>
            <div style={styles.statValue}>{formatCurrency(stats.totalAmount)}</div>
            <div style={styles.statLabel}>Total Value</div>
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
          <div style={{ ...styles.statIcon, backgroundColor: "rgba(255, 59, 48, 0.1)" }}>
            <AlertCircle size={20} color="#FF3B30" />
          </div>
          <div>
            <div style={styles.statValue}>{stats.overdue}</div>
            <div style={styles.statLabel}>Overdue</div>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div style={styles.searchSection}>
        <div style={styles.searchWrapper}>
          <Search size={18} style={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search by invoice # or client..."
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
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="overdue">Overdue</option>
          <option value="draft">Draft</option>
        </select>
      </div>

      {/* Invoices Table */}
      {filteredInvoices.length === 0 ? (
        <div style={styles.emptyState}>
          <FileText size={64} color="var(--border-color)" />
          <h3 style={{ color: 'var(--text-primary)' }}>No invoices found</h3>
          <p style={{ color: 'var(--text-secondary)' }}>{searchTerm ? 'Try adjusting your search terms' : 'Create your first invoice to get started'}</p>
          {!searchTerm && (
            <button onClick={() => setIsModalOpen(true)} style={styles.emptyButton}>
              Create Invoice
            </button>
          )}
        </div>
      ) : (
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeader}>
                <th style={styles.th}>Invoice #</th>
                <th style={styles.th}>Client</th>
                <th style={styles.th}>Issue Date</th>
                <th style={styles.th}>Due Date</th>
                <th style={styles.th}>Amount</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map((invoice) => (
                <tr key={invoice._id} style={styles.tableRow} className="table-row">
                  <td style={styles.td}>
                    <span style={styles.invoiceNumber}>{invoice.invoiceNumber}</span>
                  </td>
                  <td style={styles.td}>
                    <div>
                      <div style={styles.clientName}>{invoice.clientName}</div>
                      <div style={styles.clientEmail}>{invoice.clientEmail}</div>
                    </div>
                  </td>
                  <td style={styles.td}>{formatDate(invoice.issueDate)}</td>
                  <td style={styles.td}>{formatDate(invoice.dueDate)}</td>
                  <td style={styles.td}>
                    <span style={styles.amount}>{formatCurrency(invoice.amount)}</span>
                  </td>
                  <td style={styles.td}>
                    <span style={{
                      ...styles.statusBadge,
                      backgroundColor: `${getStatusColor(invoice.status)}15`,
                      color: getStatusColor(invoice.status)
                    }}>
                      {getStatusIcon(invoice.status)} {invoice.status}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <div style={styles.actions}>
                      <button style={styles.actionBtn} className="action-btn" title="View">
                        <Eye size={16} />
                      </button>
                      <button style={styles.actionBtn} className="action-btn" title="Download">
                        <Download size={16} />
                      </button>
                      <button style={styles.actionBtn} className="action-btn" title="Edit">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDelete(invoice._id)} style={{ ...styles.actionBtn, ...styles.deleteBtn }} className="action-btn delete-hover" title="Delete">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <style>{`
        .create-btn { transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); }
        .create-btn:hover { background-color: #0055CC !important; transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,122,255,0.3); }
        .input-focus:focus { border-color: #007AFF !important; box-shadow: 0 0 0 4px rgba(0,122,255,0.1) !important; }
        .table-row { transition: all 0.2s ease; }
        .table-row:hover { background-color: var(--bg-secondary); }
        .action-btn { transition: all 0.2s ease; display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 8px; }
        .action-btn:hover { background-color: var(--bg-secondary) !important; color: #007AFF !important; transform: scale(1.1); }
        .delete-hover:hover { color: #FF3B30 !important; background-color: rgba(255, 59, 48, 0.1) !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

const styles: any = {
  container: {
    maxWidth: "1400px",
    margin: "0 auto",
    padding: "32px 24px",
    backgroundColor: 'var(--bg-primary)',
    minHeight: '100vh',
    color: 'var(--text-primary)',
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
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "40px",
    flexWrap: "wrap",
    gap: "16px",
  },
  title: {
    fontSize: "34px",
    fontWeight: 700,
    color: "var(--text-primary)",
    margin: "0 0 8px 0",
    letterSpacing: "-1px",
  },
  subtitle: {
    fontSize: "16px",
    color: "var(--text-secondary)",
    margin: 0,
  },
  createButton: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "12px 24px",
    backgroundColor: "#007AFF",
    color: "#FFFFFF",
    border: "none",
    borderRadius: "14px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: 700,
    boxShadow: '0 4px 12px rgba(0,122,255,0.2)',
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "20px",
    marginBottom: "40px",
  },
  statCard: {
    display: "flex",
    alignItems: "center",
    gap: "20px",
    padding: "24px",
    backgroundColor: "var(--bg-primary)",
    borderRadius: "20px",
    border: "1.5px solid var(--border-color)",
    boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
  },
  statIcon: {
    width: "52px",
    height: "52px",
    borderRadius: "14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    fontSize: "26px",
    fontWeight: 700,
    color: "var(--text-primary)",
    letterSpacing: '-0.5px',
  },
  statLabel: {
    fontSize: "13px",
    color: "var(--text-secondary)",
    fontWeight: 600,
  },
  searchSection: {
    display: "flex",
    gap: "16px",
    marginBottom: "32px",
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
    padding: "12px 16px 12px 42px",
    fontSize: "16px",
    border: "1.5px solid var(--border-color)",
    borderRadius: "14px",
    outline: "none",
    backgroundColor: "var(--bg-secondary)",
    color: "var(--text-primary)",
    transition: "all 0.2s ease",
  },
  filterSelect: {
    padding: "12px 16px",
    fontSize: "14px",
    border: "1.5px solid var(--border-color)",
    borderRadius: "14px",
    backgroundColor: "var(--bg-secondary)",
    color: "var(--text-primary)",
    cursor: "pointer",
    outline: 'none',
  },
  emptyState: {
    textAlign: "center",
    padding: "100px 20px",
    backgroundColor: "var(--bg-secondary)",
    borderRadius: "32px",
    border: '1.5px dashed var(--border-color)',
  },
  emptyButton: {
    marginTop: "20px",
    padding: "12px 28px",
    backgroundColor: "#007AFF",
    color: "#FFFFFF",
    border: "none",
    borderRadius: "14px",
    cursor: "pointer",
    fontWeight: 700,
    boxShadow: '0 8px 20px rgba(0,122,255,0.2)',
  },
  tableContainer: {
    overflowX: "auto" as const,
    backgroundColor: "var(--bg-primary)",
    borderRadius: "24px",
    border: "1.5px solid var(--border-color)",
    boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
  },
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
  },
  tableHeader: {
    borderBottom: "1.5px solid var(--border-color)",
    backgroundColor: "var(--bg-secondary)",
  },
  th: {
    padding: "20px 16px",
    textAlign: "left" as const,
    fontSize: "12px",
    fontWeight: 700,
    color: "var(--text-secondary)",
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  td: {
    padding: "20px 16px",
    borderBottom: "1px solid var(--border-color)",
    fontSize: "14px",
    color: "var(--text-primary)",
    verticalAlign: 'middle',
  },
  invoiceNumber: {
    fontWeight: 700,
    color: "#007AFF",
  },
  clientName: {
    fontWeight: 700,
    fontSize: '15px',
    marginBottom: '2px',
  },
  clientEmail: {
    fontSize: "12px",
    color: "var(--text-secondary)",
    fontWeight: 500,
  },
  amount: {
    fontWeight: 800,
    fontSize: '15px',
  },
  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "6px 12px",
    borderRadius: "20px",
    fontSize: "11px",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: '0.5px',
  },
  actions: {
    display: "flex",
    gap: "8px",
  },
  actionBtn: {
    padding: "8px",
    background: "var(--bg-secondary)",
    border: "1px solid var(--border-color)",
    borderRadius: "8px",
    cursor: "pointer",
    color: "var(--text-secondary)",
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    color: "#FF3B30",
    backgroundColor: 'rgba(255, 59, 48, 0.05)',
  },
};