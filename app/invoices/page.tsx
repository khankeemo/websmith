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
  XCircle,
  AlertCircle
} from "lucide-react";

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
    const token = localStorage.getItem("token");
    try {
      const response = await fetch("http://localhost:5000/api/invoices", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setInvoices(data.data || []);
      }
    } catch (error) {
      console.error("Fetch invoices error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this invoice?")) return;
    
    const token = localStorage.getItem("token");
    try {
      const response = await fetch(`http://localhost:5000/api/invoices/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
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
        <p>Loading invoices...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Invoices</h1>
          <p style={styles.subtitle}>Manage and track all your invoices</p>
        </div>
        <button onClick={() => { setEditingInvoice(null); setIsModalOpen(true); }} style={styles.createButton} className="create-btn">
          <Plus size={18} /> Create Invoice
        </button>
      </div>

      {/* Stats Cards */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={{ ...styles.statIcon, backgroundColor: "#E3F2FF" }}>
            <FileText size={20} color="#007AFF" />
          </div>
          <div>
            <div style={styles.statValue}>{stats.total}</div>
            <div style={styles.statLabel}>Total Invoices</div>
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statIcon, backgroundColor: "#E8F5E9" }}>
            <DollarSign size={20} color="#34C759" />
          </div>
          <div>
            <div style={styles.statValue}>{formatCurrency(stats.totalAmount)}</div>
            <div style={styles.statLabel}>Total Amount</div>
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statIcon, backgroundColor: "#FFF3E0" }}>
            <Clock size={20} color="#FF9500" />
          </div>
          <div>
            <div style={styles.statValue}>{stats.pending}</div>
            <div style={styles.statLabel}>Pending</div>
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statIcon, backgroundColor: "#FFE5E5" }}>
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
            placeholder="Search by invoice number or client..."
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
          <FileText size={64} color="#C6C6C8" />
          <h3>No invoices found</h3>
          <p>Create your first invoice to get started</p>
          <button onClick={() => setIsModalOpen(true)} style={styles.emptyButton}>
            Create Invoice
          </button>
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
                      <button onClick={() => handleDelete(invoice._id)} style={{ ...styles.actionBtn, ...styles.deleteBtn }} className="action-btn" title="Delete">
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
        .create-btn {
          transition: all 0.25s ease;
        }
        .create-btn:hover {
          background-color: #0055CC !important;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,122,255,0.3);
        }
        .input-focus:focus {
          border-color: #007AFF !important;
          box-shadow: 0 0 0 4px rgba(0,122,255,0.1) !important;
        }
        .table-row {
          transition: all 0.2s ease;
        }
        .table-row:hover {
          background-color: #F9F9FB;
        }
        .action-btn {
          transition: all 0.2s ease;
        }
        .action-btn:hover {
          background-color: #E3F2FF !important;
          color: #007AFF !important;
          transform: scale(1.05);
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

const styles: any = {
  container: {
    maxWidth: "1400px",
    margin: "0 auto",
    padding: "32px 24px",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
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
    border: "3px solid #E5E5EA",
    borderTopColor: "#007AFF",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "32px",
    flexWrap: "wrap",
    gap: "16px",
  },
  title: {
    fontSize: "34px",
    fontWeight: 600,
    color: "#1C1C1E",
    marginBottom: "8px",
    letterSpacing: "-0.5px",
  },
  subtitle: {
    fontSize: "16px",
    color: "#8E8E93",
  },
  createButton: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "12px 24px",
    backgroundColor: "#007AFF",
    color: "#FFFFFF",
    border: "none",
    borderRadius: "12px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: 500,
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
    backgroundColor: "#FFFFFF",
    borderRadius: "16px",
    border: "1px solid #E5E5EA",
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
    color: "#1C1C1E",
  },
  statLabel: {
    fontSize: "13px",
    color: "#8E8E93",
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
    color: "#8E8E93",
  },
  searchInput: {
    width: "100%",
    padding: "12px 16px 12px 40px",
    fontSize: "16px",
    border: "1.5px solid #E5E5EA",
    borderRadius: "12px",
    outline: "none",
    transition: "all 0.2s ease",
  },
  filterSelect: {
    padding: "12px 16px",
    fontSize: "14px",
    border: "1.5px solid #E5E5EA",
    borderRadius: "12px",
    backgroundColor: "#FFFFFF",
    cursor: "pointer",
  },
  emptyState: {
    textAlign: "center",
    padding: "80px 20px",
    backgroundColor: "#F9F9FB",
    borderRadius: "20px",
  },
  emptyButton: {
    marginTop: "16px",
    padding: "10px 20px",
    backgroundColor: "#007AFF",
    color: "#FFFFFF",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
  },
  tableContainer: {
    overflowX: "auto" as const,
    backgroundColor: "#FFFFFF",
    borderRadius: "16px",
    border: "1px solid #E5E5EA",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
  },
  tableHeader: {
    borderBottom: "1px solid #E5E5EA",
    backgroundColor: "#F9F9FB",
  },
  th: {
    padding: "16px",
    textAlign: "left" as const,
    fontSize: "13px",
    fontWeight: 600,
    color: "#8E8E93",
  },
  td: {
    padding: "16px",
    borderBottom: "1px solid #E5E5EA",
    fontSize: "14px",
    color: "#1C1C1E",
  },
  invoiceNumber: {
    fontWeight: 600,
    color: "#007AFF",
  },
  clientName: {
    fontWeight: 500,
  },
  clientEmail: {
    fontSize: "12px",
    color: "#8E8E93",
  },
  amount: {
    fontWeight: 600,
  },
  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "4px 10px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: 500,
    textTransform: "capitalize" as const,
  },
  actions: {
    display: "flex",
    gap: "8px",
  },
  actionBtn: {
    padding: "6px",
    background: "none",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    color: "#8E8E93",
  },
  deleteBtn: {
    color: "#FF3B30",
  },
};