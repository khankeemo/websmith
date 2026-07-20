"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import NavbarVisibilityToggle from "@/components/admin/NavbarVisibilityToggle";
import {
  createAdminSoftwareListing,
  deleteAdminSoftwareListing,
  getAdminSoftwareInquiries,
  getAdminSoftwareListings,
  SoftwareInquiry,
  SoftwareInquiryStatus,
  SoftwareListing,
  SoftwareListingPayload,
  updateAdminSoftwareInquiryStatus,
  updateAdminSoftwareListing,
} from "@/app/admin/software-store/services/softwareStoreAdminService";

const emptyListing: SoftwareListingPayload = {
  title: "",
  description: "",
  category: "General",
  price: 0,
  currency: "USD",
  licenseType: "one_time",
  listingMode: "buy",
  sellerName: "",
  sellerEmail: "",
  website: "",
  isActive: true,
  isFeatured: false,
};

export default function AdminSoftwareStorePage() {
  const [listings, setListings] = useState<SoftwareListing[]>([]);
  const [inquiries, setInquiries] = useState<SoftwareInquiry[]>([]);
  const [form, setForm] = useState<SoftwareListingPayload>(emptyListing);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const activeCount = useMemo(() => listings.filter((listing) => listing.isActive).length, [listings]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [listingData, inquiryData] = await Promise.all([
        getAdminSoftwareListings(),
        getAdminSoftwareInquiries(),
      ]);
      setListings(listingData);
      setInquiries(inquiryData);
    } catch (error: any) {
      setMessage(error || "Failed to load Software Store data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleEdit = (listing: SoftwareListing) => {
    setEditingId(listing._id || null);
    setForm({
      title: listing.title,
      description: listing.description,
      category: listing.category,
      price: listing.price,
      currency: listing.currency,
      licenseType: listing.licenseType,
      listingMode: listing.listingMode,
      sellerName: listing.sellerName,
      sellerEmail: listing.sellerEmail,
      website: listing.website || "",
      isActive: listing.isActive,
      isFeatured: listing.isFeatured,
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyListing);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      if (editingId) {
        await updateAdminSoftwareListing(editingId, form);
        setMessage("Software listing updated.");
      } else {
        await createAdminSoftwareListing(form);
        setMessage("Software listing created.");
      }
      resetForm();
      await loadData();
    } catch (error: any) {
      setMessage(error || "Failed to save software listing.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (listing: SoftwareListing) => {
    if (!listing._id || !confirm(`Delete "${listing.title}"?`)) return;

    try {
      await deleteAdminSoftwareListing(listing._id);
      await loadData();
    } catch (error: any) {
      setMessage(error || "Failed to delete software listing.");
    }
  };

  const handleInquiryStatus = async (id: string | undefined, status: SoftwareInquiryStatus) => {
    if (!id) return;

    try {
      await updateAdminSoftwareInquiryStatus(id, status);
      await loadData();
    } catch (error: any) {
      setMessage(error || "Failed to update inquiry.");
    }
  };

  return (
    <div className="wsd-page" style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Software Store</h1>
          <p style={styles.subtitle}>Manage buy/sell software listings and incoming requests.</p>
        </div>
      </header>

      <section style={styles.summary}>
        <div style={styles.summaryCard}>
          <span style={styles.summaryLabel}>Listings</span>
          <strong style={styles.summaryValue}>{listings.length}</strong>
        </div>
        <div style={styles.summaryCard}>
          <span style={styles.summaryLabel}>Active</span>
          <strong style={styles.summaryValue}>{activeCount}</strong>
        </div>
        <div style={styles.summaryCard}>
          <span style={styles.summaryLabel}>Requests</span>
          <strong style={styles.summaryValue}>{inquiries.length}</strong>
        </div>
      </section>

      <NavbarVisibilityToggle
        sectionKey="softwareStore"
        label="Software Store"
        description="Show or hide the Software Store across the public website."
      />

      {message && <div style={styles.message}>{message}</div>}

      <section style={styles.twoColumn}>
        <form onSubmit={handleSubmit} style={styles.panel}>
          <div style={styles.panelHeader}>
            <h2 style={styles.panelTitle}>{editingId ? "Edit Listing" : "New Listing"}</h2>
            {editingId ? <button type="button" onClick={resetForm} style={styles.secondaryButton}>Cancel</button> : null}
          </div>
          <input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Software title" style={styles.input} />
          <textarea required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Description" style={styles.textarea} />
          <div style={styles.formRow}>
            <input required value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} placeholder="Category" style={styles.input} />
            <input required type="number" min="0" value={form.price} onChange={(event) => setForm({ ...form, price: Number(event.target.value) })} placeholder="Price" style={styles.input} />
          </div>
          <div style={styles.formRow}>
            <select value={form.licenseType} onChange={(event) => setForm({ ...form, licenseType: event.target.value as any })} style={styles.input}>
              <option value="one_time">One-time</option>
              <option value="subscription">Subscription</option>
              <option value="free">Free</option>
              <option value="open_source">Open source</option>
            </select>
            <select value={form.listingMode} onChange={(event) => setForm({ ...form, listingMode: event.target.value as any })} style={styles.input}>
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
              <option value="both">Buy/Sell</option>
            </select>
          </div>
          <div style={styles.formRow}>
            <input required value={form.sellerName} onChange={(event) => setForm({ ...form, sellerName: event.target.value })} placeholder="Seller name" style={styles.input} />
            <input required type="email" value={form.sellerEmail} onChange={(event) => setForm({ ...form, sellerEmail: event.target.value })} placeholder="Seller email" style={styles.input} />
          </div>
          <input value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} placeholder="Website" style={styles.input} />
          <div style={styles.checkRow}>
            <label style={styles.checkLabel}>
              <input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />
              Active
            </label>
            <label style={styles.checkLabel}>
              <input type="checkbox" checked={form.isFeatured} onChange={(event) => setForm({ ...form, isFeatured: event.target.checked })} />
              Featured
            </label>
          </div>
          <button type="submit" disabled={saving} style={styles.primaryButton}>
            <Plus size={16} />
            {saving ? "Saving..." : editingId ? "Save Listing" : "Create Listing"}
          </button>
        </form>

        <section style={styles.panel}>
          <h2 style={styles.panelTitle}>Listings</h2>
          {loading ? (
            <p style={styles.muted}>Loading...</p>
          ) : (
            <div style={styles.list}>
              {listings.map((listing) => (
                <div key={listing._id || listing.title} style={styles.listRow}>
                  <div>
                    <strong style={styles.rowTitle}>{listing.title}</strong>
                    <p style={styles.muted}>{listing.category} · {listing.isActive ? "Active" : "Hidden"}</p>
                  </div>
                  <div style={styles.actions}>
                    <button type="button" onClick={() => handleEdit(listing)} style={styles.iconButton}><Pencil size={15} /></button>
                    <button type="button" onClick={() => handleDelete(listing)} style={styles.iconButtonDanger}><Trash2 size={15} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </section>

      <section style={styles.panel}>
        <h2 style={styles.panelTitle}>Buy/Sell Requests</h2>
        <div style={styles.list}>
          {inquiries.map((inquiry) => {
            const listingTitle = typeof inquiry.listingId === "object" && inquiry.listingId ? inquiry.listingId.title : "General request";
            return (
              <div key={inquiry._id || inquiry.email} style={styles.inquiryRow}>
                <div>
                  <strong style={styles.rowTitle}>{inquiry.name} · {inquiry.intent}</strong>
                  <p style={styles.muted}>{inquiry.email} · {listingTitle}</p>
                  <p style={styles.requestText}>{inquiry.message}</p>
                </div>
                <select
                  value={inquiry.status || "new"}
                  onChange={(event) => handleInquiryStatus(inquiry._id, event.target.value as SoftwareInquiryStatus)}
                  style={styles.statusSelect}
                >
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            );
          })}
          {!inquiries.length && !loading ? <p style={styles.muted}>No requests yet.</p> : null}
        </div>
      </section>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { display: "grid", gap: "24px", color: "var(--text-primary)" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" },
  title: { margin: 0, fontSize: "34px", fontWeight: 800 },
  subtitle: { margin: "8px 0 0", color: "var(--text-secondary)" },
  summary: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "16px" },
  summaryCard: { display: "grid", gap: "6px", padding: "18px", border: "1px solid var(--border-color)", borderRadius: "8px", background: "var(--bg-secondary)" },
  summaryLabel: { color: "var(--text-secondary)", fontSize: "12px", fontWeight: 800, textTransform: "uppercase" },
  summaryValue: { fontSize: "28px" },
  twoColumn: { display: "grid", gridTemplateColumns: "minmax(300px, 0.8fr) minmax(300px, 1fr)", gap: "18px" },
  panel: { display: "grid", gap: "14px", padding: "20px", border: "1px solid var(--border-color)", borderRadius: "8px", background: "var(--bg-secondary)", alignSelf: "start" },
  panelHeader: { display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" },
  panelTitle: { margin: 0, fontSize: "20px", fontWeight: 800 },
  formRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" },
  input: { width: "100%", border: "1px solid var(--border-color)", borderRadius: "8px", background: "var(--bg-primary)", color: "var(--text-primary)", padding: "11px 12px", outline: "none" },
  textarea: { width: "100%", minHeight: "110px", border: "1px solid var(--border-color)", borderRadius: "8px", background: "var(--bg-primary)", color: "var(--text-primary)", padding: "11px 12px", resize: "vertical", outline: "none" },
  checkRow: { display: "flex", gap: "16px", flexWrap: "wrap" },
  checkLabel: { display: "inline-flex", alignItems: "center", gap: "8px", color: "var(--text-primary)", fontWeight: 700 },
  primaryButton: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px", border: "none", borderRadius: "8px", background: "#007AFF", color: "#FFFFFF", padding: "12px 16px", cursor: "pointer", fontWeight: 800 },
  secondaryButton: { border: "1px solid var(--border-color)", borderRadius: "8px", background: "var(--bg-primary)", color: "var(--text-primary)", padding: "8px 12px", cursor: "pointer", fontWeight: 700 },
  list: { display: "grid", gap: "10px" },
  listRow: { display: "flex", justifyContent: "space-between", gap: "14px", alignItems: "center", padding: "14px", border: "1px solid var(--border-color)", borderRadius: "8px", background: "var(--bg-primary)" },
  inquiryRow: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) 150px", gap: "14px", alignItems: "start", padding: "14px", border: "1px solid var(--border-color)", borderRadius: "8px", background: "var(--bg-primary)" },
  rowTitle: { color: "var(--text-primary)", textTransform: "capitalize" },
  muted: { margin: "4px 0 0", color: "var(--text-secondary)", fontSize: "13px" },
  requestText: { margin: "8px 0 0", color: "var(--text-primary)", lineHeight: 1.5 },
  actions: { display: "flex", gap: "8px" },
  iconButton: { border: "1px solid var(--border-color)", borderRadius: "8px", background: "var(--bg-secondary)", color: "var(--text-primary)", padding: "8px", cursor: "pointer", display: "flex" },
  iconButtonDanger: { border: "1px solid rgba(255,59,48,0.3)", borderRadius: "8px", background: "var(--bg-secondary)", color: "#FF3B30", padding: "8px", cursor: "pointer", display: "flex" },
  statusSelect: { border: "1px solid var(--border-color)", borderRadius: "8px", background: "var(--bg-secondary)", color: "var(--text-primary)", padding: "10px", outline: "none" },
  message: { padding: "12px 14px", border: "1px solid var(--border-color)", borderRadius: "8px", background: "var(--bg-secondary)", color: "var(--text-primary)", fontWeight: 700 },
};
