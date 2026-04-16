// PATH: C:\websmith\app\invoices\page.tsx
// Invoices Page - Manage all invoices
// Features: Create, view, edit, delete invoices, download PDF

"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
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
import { ViewModeToggle } from "@/components/ui/ViewModeToggle";
import { getProjects, Project } from "../projects/services/projectService";
import { getUsersByRole, RoleUser } from "../../core/services/userService";
import { computeInvoiceDashboardStats } from "../../lib/invoiceStats";

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
  paidAmount?: number;
  dueAmount?: number;
  status: "paid" | "pending" | "partially_paid" | "overdue" | "draft";
  issueDate: string;
  dueDate: string;
  items: Array<{
    description: string;
    quantity: number;
    rate: number;
    amount: number;
  }>;
  notes?: string;
  tax?: number;
  discount?: number;
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
  const [clientProjects, setClientProjects] = useState<Project[]>([]);
  const [selectedProjectDetails, setSelectedProjectDetails] = useState<Project | null>(null);
  const [clientNotFound, setClientNotFound] = useState(false);
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
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  const fetchInvoices = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchInvoices();
    Promise.all([getProjects(), getUsersByRole("client")])
      .then(([projectData, clientData]) => {
        setProjects(projectData);
        setClients(clientData);
      })
      .catch((error) => console.error("Invoice dependencies error:", error));
  }, [fetchInvoices]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      fetchInvoices();
    }, 45000);
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchInvoices();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchInvoices]);

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

  const handleDownload = async (invoice: Invoice) => {
    try {
      const response = await API.get(`/invoices/${invoice._id}/download`, {
        responseType: 'blob'
      });
      
      // Create blob and download
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice-${invoice.invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download error:", error);
      alert("Failed to download invoice PDF");
    }
  };

  const handleEdit = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setFormState({
      projectId: invoice.projectId || "",
      clientId: invoice.clientId || "",
      billingType: invoice.billingType || "project_completion",
      milestoneLabel: invoice.milestoneLabel || "",
      clientName: invoice.clientName,
      clientEmail: invoice.clientEmail,
      issueDate: new Date(invoice.issueDate).toISOString().split("T")[0],
      dueDate: new Date(invoice.dueDate).toISOString().split("T")[0],
      description: invoice.items[0]?.description || "",
      quantity: String(invoice.items[0]?.quantity || 1),
      rate: String(invoice.items[0]?.rate || 0),
      tax: String(invoice.tax || 0),
      discount: String(invoice.discount || 0),
      notes: invoice.notes || "",
    });
    setIsModalOpen(true);
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "paid": return <CheckCircle size={14} />;
      case "partially_paid": return <DollarSign size={14} />;
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

  const stats = useMemo(() => computeInvoiceDashboardStats(invoices), [invoices]);

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

  const findClientByIdOrCustomId = (id: string) => {
    const trimmed = id.trim();
    if (!trimmed) return undefined;
    return clients.find((item) => item._id === trimmed || item.customId === trimmed);
  };

  const filterProjectsByClient = (client: RoleUser | undefined) => {
    if (!client) return [];
    return projects.filter(
      (project) =>
        String(project.clientId || "") === client._id ||
        (!!project.customClientId && project.customClientId === client.customId)
    );
  };

  const buildLineItemDescription = (
    billingType: "project_completion" | "advance_payment" | "milestone",
    project: Project | null,
    milestoneLabel: string
  ) => {
    const projectName = project?.name || "project";
    if (billingType === "advance_payment") {
      return `Advance payment for ${projectName}`;
    }
    if (billingType === "milestone") {
      return `Milestone: ${milestoneLabel || "Project milestone"} for ${projectName}`;
    }
    return `Project completion for ${projectName}`;
  };

  const handleProjectSelect = (projectId: string) => {
    const project =
      clientProjects.find((item) => item._id === projectId) ||
      projects.find((item) => item._id === projectId) ||
      null;
    const client = findClientByIdOrCustomId(formState.clientId);

    setSelectedProjectDetails(project);
    setFormState((prev) => ({
      ...prev,
      projectId,
      clientId: project?.clientId || prev.clientId,
      clientName: project?.client || prev.clientName,
      clientEmail: client?.email || prev.clientEmail,
      rate: project?.budget ? String(project.budget) : prev.rate,
      description: buildLineItemDescription(prev.billingType, project, prev.milestoneLabel),
    }));
  };

  const handleClientIdChange = (clientId: string) => {
    const resolvedClient = findClientByIdOrCustomId(clientId);
    const projectsForClient = filterProjectsByClient(resolvedClient);

    setClientProjects(projectsForClient);
    setSelectedProjectDetails((current) =>
      current && projectsForClient.some((project) => project._id === current._id)
        ? current
        : null
    );
    setFormState((prev) => ({
      ...prev,
      clientId: clientId.trim(),
      clientName: resolvedClient?.name || "",
      clientEmail: resolvedClient?.email || "",
      projectId: projectsForClient.some((project) => project._id === prev.projectId)
        ? prev.projectId
        : "",
    }));
    setClientNotFound(Boolean(clientId.trim() && !resolvedClient));
  };

  const invoiceTotal = useMemo(() => {
    const quantity = Number(formState.quantity) || 0;
    const rate = Number(formState.rate) || 0;
    const tax = Number(formState.tax) || 0;
    const discount = Number(formState.discount) || 0;
    const subtotal = quantity * rate;
    return Math.max(0, subtotal + tax - discount);
  }, [formState.quantity, formState.rate, formState.tax, formState.discount]);

  const handleCreateInvoice = async () => {
    if (!formState.clientName || !formState.clientEmail || !formState.description || !formState.rate) {
      setFormError("Client, description, and amount are required.");
      return;
    }

    setFormLoading(true);
    setFormError("");
    try {
      if (editingInvoice) {
        // Update existing invoice
        await API.put(`/invoices/${editingInvoice._id}`, {
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
      } else {
        // Create new invoice
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
      }
      setIsModalOpen(false);
      setEditingInvoice(null);
      resetForm();
      await fetchInvoices();
    } catch (error: any) {
      setFormError(error?.response?.data?.message || "Failed to save invoice");
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
          <option value="partially_paid">Partially Paid</option>
          <option value="pending">Pending</option>
          <option value="overdue">Overdue</option>
          <option value="draft">Draft</option>
        </select>
        <ViewModeToggle value={viewMode} onChange={setViewMode} />
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
      ) : viewMode === 'grid' ? (
        <div style={styles.invoiceGrid} className="wsd-card-grid">
          {filteredInvoices.map((invoice) => (
            <div key={invoice._id} style={styles.invoiceCard} className="invoice-card">
              <div style={styles.invoiceCardHeader}>
                <div>
                  <div style={styles.invoiceNumber}>{invoice.invoiceNumber}</div>
                  <div style={styles.clientName}>{invoice.clientName}</div>
                </div>
                <span style={{
                  ...styles.statusBadge,
                  backgroundColor: `${getStatusColor(invoice.status)}15`,
                  color: getStatusColor(invoice.status)
                }}>
                  {getStatusIcon(invoice.status)} {invoice.status}
                </span>
              </div>
              <div style={styles.invoiceCardBody}>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Amount:</span>
                  <span style={styles.detailValue}>{formatCurrency(invoice.amount)}</span>
                </div>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Issue:</span>
                  <span style={styles.detailValue}>{formatDate(invoice.issueDate)}</span>
                </div>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Due:</span>
                  <span style={styles.detailValue}>{formatDate(invoice.dueDate)}</span>
                </div>
              </div>
              <div style={styles.invoiceCardActions}>
                <button onClick={() => handleDownload(invoice)} style={styles.cardActionBtn} title="Download">
                  <Download size={14} />
                </button>
                <button onClick={() => handleEdit(invoice)} style={styles.cardActionBtn} title="Edit">
                  <Edit2 size={14} />
                </button>
                <button onClick={() => handleDelete(invoice._id)} style={{ ...styles.cardActionBtn, ...styles.deleteBtn }} title="Delete">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
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
                    <div style={styles.amountSubtext}>
                      Due: {formatCurrency(invoice.dueAmount ?? invoice.amount)}
                    </div>
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
                      <button onClick={() => handleDownload(invoice)} style={styles.actionBtn} className="action-btn" title="Download">
                        <Download size={16} />
                      </button>
                      <button onClick={() => handleEdit(invoice)} style={styles.actionBtn} className="action-btn" title="Edit">
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
          setEditingInvoice(null);
          resetForm();
        }}
        title={editingInvoice ? "Edit Invoice" : "Create Invoice"}
        footer={
          <>
            <button type="button" onClick={() => { setIsModalOpen(false); setEditingInvoice(null); resetForm(); }} style={styles.modalSecondaryBtn}>Cancel</button>
            <button type="button" onClick={handleCreateInvoice} style={styles.modalPrimaryBtn} disabled={formLoading}>
              {formLoading ? (editingInvoice ? "Updating..." : "Creating...") : (editingInvoice ? "Update Invoice" : "Create Invoice")}
            </button>
          </>
        }
      >
        <div style={styles.modalGrid}>
          <div style={styles.modalField}>
            <label style={styles.modalLabel}>Client ID</label>
            <input
              type="text"
              list="clientIds"
              value={String(formState.clientId)}
              onChange={(e) => handleClientIdChange(e.target.value)}
              placeholder="Enter client ID or custom client ID"
              style={styles.modalInput}
            />
            <datalist id="clientIds">
              {clients.map((client) => (
                <option key={client._id} value={String(client.customId || client._id)} />
              ))}
            </datalist>
            {clientNotFound && (
              <span style={styles.helpText}>No client found for this Client ID.</span>
            )}
          </div>
          <div style={styles.modalField}>
            <label style={styles.modalLabel}>Client Name</label>
            <input
              value={formState.clientName}
              readOnly
              placeholder="Client name will populate automatically"
              style={styles.modalInput}
            />
          </div>
          <div style={styles.modalField}>
            <label style={styles.modalLabel}>Client Email</label>
            <input
              value={formState.clientEmail}
              readOnly
              placeholder="Client email will populate automatically"
              style={styles.modalInput}
            />
          </div>
          <div style={styles.modalField}>
            <label style={styles.modalLabel}>Project</label>
            <select
              value={String(formState.projectId)}
              onChange={(e) => handleProjectSelect(e.target.value)}
              style={styles.modalInput}
              disabled={!formState.clientId || clientNotFound}
            >
              <option value="">
                {formState.clientId && !clientNotFound
                  ? clientProjects.length > 0
                    ? "Select project"
                    : "No projects found for this client"
                  : "Enter Client ID first"}
              </option>
              {clientProjects.map((project) => (
                <option key={project._id} value={String(project._id)}>{project.name}</option>
              ))}
            </select>
          </div>
          {selectedProjectDetails && (
            <div style={{ ...styles.detailCard, gridColumn: "1 / -1" }}>
              <div style={styles.detailTitle}>Project details</div>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Name:</span>
                <span style={styles.detailValue}>{selectedProjectDetails.name}</span>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Total Amount:</span>
                <span style={styles.detailValue}>{selectedProjectDetails.budget ? formatCurrency(selectedProjectDetails.budget) : "N/A"}</span>
              </div>
              {selectedProjectDetails.description && (
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Description:</span>
                  <span style={styles.detailValue}>{selectedProjectDetails.description}</span>
                </div>
              )}
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Status:</span>
                <span style={styles.detailValue}>{selectedProjectDetails.status}</span>
              </div>
            </div>
          )}
          <div style={styles.modalField}>
            <label style={styles.modalLabel}>Billing Type</label>
            <select
              value={formState.billingType}
              onChange={(e) => {
                const billingType = e.target.value as "project_completion" | "advance_payment" | "milestone";
                setFormState((prev) => ({
                  ...prev,
                  billingType,
                  description: buildLineItemDescription(billingType, selectedProjectDetails, prev.milestoneLabel),
                }));
              }}
              style={styles.modalInput}
            >
              <option value="project_completion">Project Completion</option>
              <option value="advance_payment">Advance Payment</option>
              <option value="milestone">Milestone</option>
            </select>
          </div>
          {formState.billingType === "milestone" && (
            <div style={styles.modalField}>
              <label style={styles.modalLabel}>Milestone Label</label>
              <input
                value={formState.milestoneLabel}
                onChange={(e) => {
                  const milestoneLabel = e.target.value;
                  setFormState((prev) => ({
                    ...prev,
                    milestoneLabel,
                    description: buildLineItemDescription(prev.billingType, selectedProjectDetails, milestoneLabel),
                  }));
                }}
                style={styles.modalInput}
              />
            </div>
          )}
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
          <div style={styles.modalField}>
            <label style={styles.modalLabel}>Total</label>
            <input value={formatCurrency(invoiceTotal)} readOnly style={styles.modalInput} />
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
  invoiceGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "20px",
  },
  invoiceCard: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "16px",
    padding: "20px",
    borderRadius: "24px",
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border-color)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.04)",
  },
  invoiceCardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "14px",
  },
  invoiceCardBody: {
    display: "grid",
    gap: "10px",
  },
  invoiceCardActions: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap" as const,
  },
  cardActionBtn: {
    padding: "10px 12px",
    borderRadius: "12px",
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-primary)",
    color: "var(--text-primary)",
    cursor: "pointer",
    fontSize: "13px",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
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
  amountSubtext: {
    marginTop: "4px",
    fontSize: "12px",
    color: "var(--text-secondary)",
    fontWeight: 600,
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
  helpText: {
    marginTop: "6px",
    fontSize: "12px",
    color: "#FF3B30",
    fontWeight: 500,
  },
  detailCard: {
    gridColumn: "1 / -1",
    padding: "18px",
    borderRadius: "18px",
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border-color)",
    display: "grid",
    gap: "12px",
  },
  detailTitle: {
    fontSize: "15px",
    fontWeight: 700,
    color: "var(--text-primary)",
  },
  detailRow: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap" as const,
    alignItems: "baseline",
    fontSize: "14px",
    color: "var(--text-primary)",
  },
  detailLabel: {
    fontWeight: 700,
    color: "var(--text-secondary)",
  },
  detailValue: {
    fontWeight: 600,
    color: "var(--text-primary)",
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
