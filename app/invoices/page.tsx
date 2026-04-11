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
import Modal from "../../components/ui/Modal";
import { getProjects, Project } from "../projects/services/projectService";
import { getUsersByRole, RoleUser } from "../../core/services/userService";

interface Invoice {
  _id: string;
  clientId?: string | null;
  projectId?: string | null;
  billingType?: "project_completion" | "advance_payment" | "milestone";
  milestoneLabel?: string;
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
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<RoleUser[]>([]);
  const [formState, setFormState] = useState({
    projectId: "",
    clientId: "",
    billingType: "project_completion" as "project_completion" | "advance_payment" | "milestone",
    milestoneLabel: "",
    clientName: "",
    clientEmail: "",
    issueDate: new Date().toISOString().split("T")[0],
    dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
    description: "",
    quantity: "1",
    rate: "",
    tax: "0",
    discount: "0",
    notes: "",
  });
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    fetchInvoices();
    Promise.all([getProjects(), getUsersByRole("client")])
      .then(([projectData, clientData]) => {
        setProjects(projectData);
        setClients(clientData);
      })
      .catch((error) => console.error("Invoice dependencies error:", error));
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

  const resetForm = () => {
    setFormState({
      projectId: "",
      clientId: "",
      billingType: "project_completion",
      milestoneLabel: "",
      clientName: "",
      clientEmail: "",
      issueDate: new Date().toISOString().split("T")[0],
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
      description: "",
      quantity: "1",
      rate: "",
      tax: "0",
      discount: "0",
      notes: "",
    });
    setFormError("");
  };

  const handleProjectSelect = (projectId: string) => {
    const project = projects.find((item) => item._id === projectId);
    const client = clients.find((item) => item._id === project?.clientId);
    setFormState((prev) => ({
      ...prev,
      projectId,
      clientId: project?.clientId || prev.clientId,
      clientName: project?.client || prev.clientName,
      clientEmail: client?.email || prev.clientEmail,
      description:
        prev.description || (project ? `${prev.billingType === "advance_payment" ? "Advance payment" : prev.billingType === "milestone" ? `Milestone: ${prev.milestoneLabel || "Project milestone"}` : "Project completion"} for ${project.name}` : ""),
    }));
  };

  const handleClientSelect = (clientId: string) => {
    const client = clients.find((item) => item._id === clientId);
    setFormState((prev) => ({
      ...prev,
      clientId,
      clientName: client?.name || prev.clientName,
      clientEmail: client?.email || prev.clientEmail,
    }));
  };

  const handleCreateInvoice = async () => {
    if (!formState.clientName || !formState.clientEmail || !formState.description || !formState.rate) {
      setFormError("Client, description, and amount are required.");
      return;
    }

    setFormLoading(true);
    setFormError("");
    try {
      await API.post("/invoices", {
        projectId: formState.projectId || undefined,
        clientId: formState.clientId || undefined,
        billingType: formState.billingType,
        milestoneLabel: formState.billingType === "milestone" ? formState.milestoneLabel : "",
        clientName: formState.clientName,
        clientEmail: formState.clientEmail,
        issueDate: formState.issueDate,
        dueDate: formState.dueDate,
        notes: formState.notes,
        tax: Number(formState.tax || 0),
        discount: Number(formState.discount || 0),
        items: [
          {
            description: formState.description,
            quantity: Number(formState.quantity || 1),
            rate: Number(formState.rate || 0),
            amount: Number(formState.quantity || 1) * Number(formState.rate || 0),
          },
        ],
      });
      setIsModalOpen(false);
      resetForm();
      await fetchInvoices();
    } catch (error: any) {
      setFormError(error?.response?.data?.message || "Failed to create invoice");
    } finally {
      setFormLoading(false);
    }
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
    <div style={styles.container} className="wsd-page">
      {/* Header */}
      <div style={styles.header} className="wsd-page-header">
        <div>
          <h1 style={styles.title}>Invoices</h1>
          <p style={styles.subtitle}>Manage and track all customer billing</p>
        </div>
        <button onClick={() => { setEditingInvoice(null); setIsModalOpen(true); }} style={styles.createButton} className="create-btn">
          <Plus size={18} /> Create Invoice
        </button>
      </div>

      {/* Stats Cards */}
      <div style={styles.statsGrid} className="wsd-grid-tiles">
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
      <div style={styles.searchSection} className="wsd-toolbar">
        <div style={styles.searchWrapper} className="wsd-search-box">
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
        <div style={styles.tableContainer} className="wsd-table-scroll">
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
        @media (max-width: 640px) {
          .action-btn {
            width: 36px;
            height: 36px;
          }
        }
      `}</style>

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          resetForm();
        }}
        title="Create Invoice"
        footer={
          <>
            <button type="button" onClick={() => setIsModalOpen(false)} style={styles.modalSecondaryBtn}>Cancel</button>
            <button type="button" onClick={handleCreateInvoice} style={styles.modalPrimaryBtn} disabled={formLoading}>
              {formLoading ? "Creating..." : "Create Invoice"}
            </button>
          </>
        }
      >
        <div style={styles.modalGrid}>
          <div style={styles.modalField}>
            <label style={styles.modalLabel}>Project</label>
            <select value={formState.projectId} onChange={(e) => handleProjectSelect(e.target.value)} style={styles.modalInput}>
              <option value="">Select project (optional)</option>
              {projects.map((project) => (
                <option key={project._id} value={project._id}>{project.name}</option>
              ))}
            </select>
          </div>
          <div style={styles.modalField}>
            <label style={styles.modalLabel}>Client</label>
            <select value={formState.clientId} onChange={(e) => handleClientSelect(e.target.value)} style={styles.modalInput}>
              <option value="">Select client</option>
              {clients.map((client) => (
                <option key={client._id} value={client._id}>{client.name}</option>
              ))}
            </select>
          </div>
          <div style={styles.modalField}>
            <label style={styles.modalLabel}>Billing Type</label>
            <select value={formState.billingType} onChange={(e) => setFormState((prev) => ({ ...prev, billingType: e.target.value as any }))} style={styles.modalInput}>
              <option value="project_completion">Project Completion</option>
              <option value="advance_payment">Advance Payment</option>
              <option value="milestone">Milestone</option>
            </select>
          </div>
          {formState.billingType === "milestone" && (
            <div style={styles.modalField}>
              <label style={styles.modalLabel}>Milestone Label</label>
              <input value={formState.milestoneLabel} onChange={(e) => setFormState((prev) => ({ ...prev, milestoneLabel: e.target.value }))} style={styles.modalInput} />
            </div>
          )}
          <div style={styles.modalField}>
            <label style={styles.modalLabel}>Client Name</label>
            <input value={formState.clientName} onChange={(e) => setFormState((prev) => ({ ...prev, clientName: e.target.value }))} style={styles.modalInput} />
          </div>
          <div style={styles.modalField}>
            <label style={styles.modalLabel}>Client Email</label>
            <input value={formState.clientEmail} onChange={(e) => setFormState((prev) => ({ ...prev, clientEmail: e.target.value }))} style={styles.modalInput} />
          </div>
          <div style={styles.modalField}>
            <label style={styles.modalLabel}>Issue Date</label>
            <input type="date" value={formState.issueDate} onChange={(e) => setFormState((prev) => ({ ...prev, issueDate: e.target.value }))} style={styles.modalInput} />
          </div>
          <div style={styles.modalField}>
            <label style={styles.modalLabel}>Due Date</label>
            <input type="date" value={formState.dueDate} onChange={(e) => setFormState((prev) => ({ ...prev, dueDate: e.target.value }))} style={styles.modalInput} />
          </div>
          <div style={{ ...styles.modalField, gridColumn: "1 / -1" }}>
            <label style={styles.modalLabel}>Line Item Description</label>
            <input value={formState.description} onChange={(e) => setFormState((prev) => ({ ...prev, description: e.target.value }))} style={styles.modalInput} />
          </div>
          <div style={styles.modalField}>
            <label style={styles.modalLabel}>Quantity</label>
            <input type="number" min="1" value={formState.quantity} onChange={(e) => setFormState((prev) => ({ ...prev, quantity: e.target.value }))} style={styles.modalInput} />
          </div>
          <div style={styles.modalField}>
            <label style={styles.modalLabel}>Rate</label>
            <input type="number" min="0" value={formState.rate} onChange={(e) => setFormState((prev) => ({ ...prev, rate: e.target.value }))} style={styles.modalInput} />
          </div>
          <div style={styles.modalField}>
            <label style={styles.modalLabel}>Tax</label>
            <input type="number" min="0" value={formState.tax} onChange={(e) => setFormState((prev) => ({ ...prev, tax: e.target.value }))} style={styles.modalInput} />
          </div>
          <div style={styles.modalField}>
            <label style={styles.modalLabel}>Discount</label>
            <input type="number" min="0" value={formState.discount} onChange={(e) => setFormState((prev) => ({ ...prev, discount: e.target.value }))} style={styles.modalInput} />
          </div>
          <div style={{ ...styles.modalField, gridColumn: "1 / -1" }}>
            <label style={styles.modalLabel}>Notes</label>
            <textarea value={formState.notes} onChange={(e) => setFormState((prev) => ({ ...prev, notes: e.target.value }))} style={styles.modalTextarea} />
          </div>
          {formError && <p style={styles.modalError}>{formError}</p>}
        </div>
      </Modal>
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
  modalGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "14px",
  },
  modalField: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    minWidth: 0,
  },
  modalLabel: {
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--text-primary)",
  },
  modalInput: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: "12px",
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-secondary)",
    color: "var(--text-primary)",
  },
  modalTextarea: {
    width: "100%",
    minHeight: "88px",
    padding: "12px 14px",
    borderRadius: "12px",
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-secondary)",
    color: "var(--text-primary)",
    resize: "vertical",
  },
  modalError: {
    gridColumn: "1 / -1",
    margin: 0,
    color: "#FF3B30",
    fontSize: "13px",
    fontWeight: 500,
  },
  modalPrimaryBtn: {
    padding: "10px 16px",
    borderRadius: "12px",
    border: "none",
    backgroundColor: "#007AFF",
    color: "#FFFFFF",
    fontWeight: 700,
    cursor: "pointer",
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
