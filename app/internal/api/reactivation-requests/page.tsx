"use client";

import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw, CheckCircle, XCircle, Clock, Search,
  Eye, ChevronLeft, ChevronRight, Loader2, ExternalLink,
} from "lucide-react";

const API_BASE = "/internal/backend";

interface ReactivationRequest {
  id: number;
  license_key: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  hardware_id: string;
  product_id: string;
  product_name: string;
  plan: string;
  new_customer_name: string;
  new_customer_email: string;
  new_customer_phone: string;
  new_hardware_id: string;
  reason: string;
  status: string;
  admin_notes: string;
  admin_actioned_at: string | null;
  actioned_by: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  pending: { bg: "rgba(250,204,21,0.1)", text: "#fbbf24", dot: "#fbbf24" },
  approved: { bg: "rgba(34,197,94,0.1)", text: "#22c55e", dot: "#22c55e" },
  rejected: { bg: "rgba(239,68,68,0.1)", text: "#ef4444", dot: "#ef4444" },
};

export default function ReactivationRequestsPage() {
  const [requests, setRequests] = useState<ReactivationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<ReactivationRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  const limit = 20;
  const authToken = typeof window !== "undefined" ? localStorage.getItem("api_center_token") : null;

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("search", search);
      params.set("limit", String(limit));
      params.set("offset", String(page * limit));

      const res = await fetch(`${API_BASE}/reactivation-requests?${params}`, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      });
      const data = await res.json();
      if (data.success) {
        setRequests(data.data);
        setTotal(data.pagination.total);
      }
    } catch (e) {
      console.error("Failed to fetch requests:", e);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, page, authToken]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleAction = async (id: number, action: "approve" | "reject") => {
    setActionLoading(`${action}-${id}`);
    setActionError("");
    try {
      const res = await fetch(`${API_BASE}/reactivation-requests/${id}/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ adminNotes: adminNotes || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        setSelected(null);
        setAdminNotes("");
        fetchRequests();
      } else {
        setActionError(data.error || "Action failed");
      }
    } catch (e) {
      setActionError("Network error");
    } finally {
      setActionLoading(null);
    }
  };

  const totalPages = Math.ceil(total / limit);

  const getChangeSummary = (r: ReactivationRequest) => {
    const changes: string[] = [];
    if (r.new_customer_name && r.new_customer_name !== r.customer_name) changes.push(`Name: ${r.customer_name} → ${r.new_customer_name}`);
    if (r.new_customer_email && r.new_customer_email !== r.customer_email) changes.push(`Email: ${r.customer_email} → ${r.new_customer_email}`);
    if (r.new_customer_phone && r.new_customer_phone !== r.customer_phone) changes.push(`Phone: ${r.customer_phone} → ${r.new_customer_phone}`);
    if (r.new_hardware_id && r.new_hardware_id !== r.hardware_id) changes.push(`Hardware: ${r.hardware_id?.slice(0, 16)}... → ${r.new_hardware_id?.slice(0, 16)}...`);
    return changes;
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "24px", fontWeight: "700", color: "var(--text-primary)" }}>
            Reactivation Requests
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: "14px", color: "var(--text-secondary)" }}>
            {total} request{total !== 1 ? "s" : ""}
          </p>
        </div>
        <button onClick={fetchRequests}
          style={{
            padding: "10px 16px", borderRadius: "10px",
            background: "var(--bg-tertiary)", border: "1px solid var(--border-color)",
            color: "var(--text-primary)", fontSize: "13px", fontWeight: "500",
            cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
          }}>
          <RefreshCw size="14" /> Refresh
        </button>
      </div>

      <div style={{
        display: "flex", gap: "12px", marginBottom: "20px",
        alignItems: "center",
      }}>
        <div style={{ flex: 1, position: "relative" }}>
          <Search size="16" style={{
            position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)",
            color: "var(--text-secondary)",
          }} />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search by license key or customer..."
            style={{
              width: "100%", padding: "10px 12px 10px 36px", borderRadius: "10px",
              background: "var(--bg-tertiary)", border: "1px solid var(--border-color)",
              color: "var(--text-primary)", fontSize: "14px", outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
          style={{
            padding: "10px 14px", borderRadius: "10px",
            background: "var(--bg-tertiary)", border: "1px solid var(--border-color)",
            color: "var(--text-primary)", fontSize: "14px", outline: "none",
          }}>
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <Loader2 size="32" className="animate-spin" style={{ margin: "0 auto 12px", color: "var(--text-secondary)" }} />
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>Loading requests...</p>
        </div>
      ) : requests.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "60px 0",
          background: "var(--bg-secondary)", borderRadius: "16px",
          border: "1px solid var(--border-color)",
        }}>
          <Clock size="40" style={{ color: "var(--text-secondary)", margin: "0 auto 12px", opacity: 0.5 }} />
          <p style={{ color: "var(--text-secondary)", fontSize: "15px", margin: 0 }}>
            {statusFilter || search ? "No requests match your filters" : "No reactivation requests yet"}
          </p>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {requests.map(req => {
              const statusColor = STATUS_COLORS[req.status] || STATUS_COLORS.pending;
              const changes = getChangeSummary(req);
              return (
                <div key={req.id}
                  style={{
                    background: "var(--bg-secondary)", borderRadius: "12px",
                    border: "1px solid var(--border-color)", overflow: "hidden",
                    transition: "all 0.15s",
                  }}>
                  <div style={{ padding: "16px 20px", cursor: "pointer" }}
                    onClick={() => setSelected(selected?.id === req.id ? null : req)}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                          <span style={{
                            display: "inline-block", width: "8px", height: "8px", borderRadius: "50%",
                            background: statusColor.dot,
                          }} />
                          <span style={{
                            fontSize: "12px", fontWeight: "600", padding: "2px 8px", borderRadius: "6px",
                            background: statusColor.bg, color: statusColor.text,
                            textTransform: "capitalize",
                          }}>
                            {req.status}
                          </span>
                          <span style={{
                            fontSize: "13px", fontWeight: "600", color: "var(--text-primary)",
                            fontFamily: "'SF Mono', monospace",
                          }}>
                            #{String(req.id).padStart(5, "0")}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: "12px", fontSize: "14px", color: "var(--text-primary)" }}>
                          <span style={{ fontWeight: 500 }}>{req.new_customer_name || req.customer_name || "—"}</span>
                          <span style={{ color: "var(--text-secondary)" }}>{req.license_key}</span>
                          {req.product_name && (
                            <span style={{ color: "var(--text-secondary)" }}>{req.product_name}</span>
                          )}
                        </div>
                        {changes.length > 0 && (
                          <div style={{ marginTop: "6px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
                            {changes.map((c, i) => (
                              <span key={i} style={{
                                fontSize: "11px", padding: "2px 8px", borderRadius: "6px",
                                background: "rgba(99,102,241,0.1)", color: "#818cf8",
                              }}>
                                {c}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)", whiteSpace: "nowrap", marginLeft: "16px" }}>
                        {new Date(req.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  {selected?.id === req.id && (
                    <div style={{
                      borderTop: "1px solid var(--border-color)",
                      padding: "20px", background: "var(--bg-tertiary)",
                    }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                        <DetailCard title="Current Customer">
                          <DetailRow label="Name" value={req.customer_name || "—"} />
                          <DetailRow label="Email" value={req.customer_email || "—"} />
                          <DetailRow label="Phone" value={req.customer_phone || "—"} />
                          <DetailRow label="Hardware ID" value={req.hardware_id ? req.hardware_id.slice(0, 24) + "..." : "—"} />
                        </DetailCard>
                        {(req.new_customer_name || req.new_customer_email || req.new_customer_phone || req.new_hardware_id) && (
                          <DetailCard title="Requested Changes">
                            {req.new_customer_name && <DetailRow label="Name" value={req.new_customer_name} changed />}
                            {req.new_customer_email && <DetailRow label="Email" value={req.new_customer_email} changed />}
                            {req.new_customer_phone && <DetailRow label="Phone" value={req.new_customer_phone} changed />}
                            {req.new_hardware_id && <DetailRow label="Hardware ID" value={req.new_hardware_id.slice(0, 24) + "..."} changed />}
                          </DetailCard>
                        )}
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                        <DetailCard title="License">
                          <DetailRow label="Key" value={req.license_key} />
                          <DetailRow label="Product" value={req.product_name || "—"} />
                          <DetailRow label="Plan" value={req.plan || "—"} />
                        </DetailCard>
                        <DetailCard title="Request">
                          <DetailRow label="Reason" value={req.reason || "—"} />
                          <DetailRow label="Created" value={new Date(req.created_at).toLocaleString()} />
                          {req.admin_actioned_at && (
                            <DetailRow label="Actioned" value={new Date(req.admin_actioned_at).toLocaleString()} />
                          )}
                        </DetailCard>
                      </div>

                      {actionError && (
                        <div style={{
                          background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
                          borderRadius: "8px", padding: "10px 14px", marginBottom: "12px",
                          fontSize: "13px", color: "#ef4444",
                        }}>
                          {actionError}
                        </div>
                      )}

                      {req.status === "pending" && (
                        <div>
                          <textarea
                            value={adminNotes}
                            onChange={e => setAdminNotes(e.target.value)}
                            placeholder="Admin notes (optional — shown to customer on rejection)"
                            rows={2}
                            style={{
                              width: "100%", padding: "10px 14px", borderRadius: "8px",
                              background: "var(--bg-secondary)", border: "1px solid var(--border-color)",
                              color: "var(--text-primary)", fontSize: "13px", outline: "none",
                              resize: "none", fontFamily: "inherit", marginBottom: "12px",
                              boxSizing: "border-box",
                            }}
                          />
                          <div style={{ display: "flex", gap: "10px" }}>
                            <button onClick={() => handleAction(req.id, "approve")}
                              disabled={actionLoading !== null}
                              style={{
                                padding: "10px 24px", borderRadius: "8px",
                                background: "linear-gradient(135deg, #22c55e, #16a34a)",
                                border: "none", color: "white", fontSize: "13px", fontWeight: "600",
                                cursor: actionLoading ? "wait" : "pointer", flex: 1,
                                display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                                opacity: actionLoading ? 0.7 : 1,
                              }}>
                              {actionLoading === `approve-${req.id}` ? <Loader2 size="14" className="animate-spin" /> : <CheckCircle size="14" />}
                              Approve
                            </button>
                            <button onClick={() => handleAction(req.id, "reject")}
                              disabled={actionLoading !== null}
                              style={{
                                padding: "10px 24px", borderRadius: "8px",
                                background: "rgba(239,68,68,0.15)",
                                border: "1px solid rgba(239,68,68,0.3)",
                                color: "#ef4444", fontSize: "13px", fontWeight: "600",
                                cursor: actionLoading ? "wait" : "pointer", flex: 1,
                                display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                                opacity: actionLoading ? 0.7 : 1,
                              }}>
                              {actionLoading === `reject-${req.id}` ? <Loader2 size="14" className="animate-spin" /> : <XCircle size="14" />}
                              Reject
                            </button>
                          </div>
                        </div>
                      )}

                      {req.status === "approved" && (
                        <div style={{
                          background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)",
                          borderRadius: "8px", padding: "12px 16px",
                          display: "flex", alignItems: "center", gap: "8px",
                          fontSize: "13px", color: "#22c55e",
                        }}>
                          <CheckCircle size="16" /> Approved on {new Date(req.admin_actioned_at || req.updated_at).toLocaleString()}
                        </div>
                      )}

                      {req.status === "rejected" && (
                        <div style={{
                          background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                          borderRadius: "8px", padding: "12px 16px",
                          display: "flex", alignItems: "center", gap: "8px",
                          fontSize: "13px", color: "#ef4444",
                        }}>
                          <XCircle size="16" /> Rejected on {new Date(req.admin_actioned_at || req.updated_at).toLocaleString()}
                          {req.admin_notes && <span style={{ color: "var(--text-secondary)" }}>— {req.admin_notes}</span>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", marginTop: "20px" }}>
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                style={{
                  padding: "8px 12px", borderRadius: "8px",
                  background: "var(--bg-tertiary)", border: "1px solid var(--border-color)",
                  color: page === 0 ? "var(--text-secondary)" : "var(--text-primary)",
                  cursor: page === 0 ? "default" : "pointer", opacity: page === 0 ? 0.5 : 1,
                }}>
                <ChevronLeft size="16" />
              </button>
              <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                Page {page + 1} of {totalPages}
              </span>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                style={{
                  padding: "8px 12px", borderRadius: "8px",
                  background: "var(--bg-tertiary)", border: "1px solid var(--border-color)",
                  color: page >= totalPages - 1 ? "var(--text-secondary)" : "var(--text-primary)",
                  cursor: page >= totalPages - 1 ? "default" : "pointer", opacity: page >= totalPages - 1 ? 0.5 : 1,
                }}>
                <ChevronRight size="16" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "var(--bg-secondary)", borderRadius: "10px",
      border: "1px solid var(--border-color)", padding: "14px",
    }}>
      <p style={{ margin: "0 0 10px", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
        {title}
      </p>
      {children}
    </div>
  );
}

function DetailRow({ label, value, changed }: { label: string; value: string; changed?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: "13px" }}>
      <span style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span style={{
        color: changed ? "#818cf8" : "var(--text-primary)",
        fontWeight: changed ? 600 : 400,
        textAlign: "right", maxWidth: "60%", wordBreak: "break-word",
      }}>
        {value}
      </span>
    </div>
  );
}
