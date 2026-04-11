'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Shield, Trash2, X } from 'lucide-react';
import { getStoredUser } from '@/lib/auth';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import { createManagedUser, deleteManagedUser, getUsersByRole, ManagedUserPayload, RoleUser } from '@/core/services/userService';

function ManagedUserModal({
  isOpen,
  role,
  title,
  isSaving,
  submitError,
  onClose,
  onSave,
}: {
  isOpen: boolean;
  role: 'admin' | 'developer';
  title: string;
  isSaving: boolean;
  submitError?: string | null;
  onClose: () => void;
  onSave: (payload: ManagedUserPayload) => Promise<void>;
}) {
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', company: '' });

  useEffect(() => {
    if (isOpen) {
      setFormData({ name: '', email: '', phone: '', company: '' });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      ...formData,
      name: formData.name.trim(),
      email: formData.email.trim().toLowerCase(),
      phone: formData.phone.trim(),
      company: formData.company.trim(),
      role,
    });
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>{title}</h2>
          <button onClick={onClose} style={styles.closeBtn}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={styles.row}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Name *</label>
              <input
                value={formData.name}
                onChange={(e) => setFormData((current) => ({ ...current, name: e.target.value }))}
                style={styles.input}
                required
                disabled={isSaving}
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Email *</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((current) => ({ ...current, email: e.target.value }))}
                style={styles.input}
                required
                disabled={isSaving}
              />
            </div>
          </div>

          <div style={styles.row}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Phone</label>
              <input
                value={formData.phone}
                onChange={(e) => setFormData((current) => ({ ...current, phone: e.target.value }))}
                style={styles.input}
                disabled={isSaving}
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Company</label>
              <input
                value={formData.company}
                onChange={(e) => setFormData((current) => ({ ...current, company: e.target.value }))}
                style={styles.input}
                disabled={isSaving}
              />
            </div>
          </div>

          <div style={styles.infoBox}>
            <p style={styles.infoText}>
              <strong>Note:</strong> Saving this {role} will email their login credentials automatically.
            </p>
          </div>

          {submitError && <p style={styles.submitError}>{submitError}</p>}

          <div style={styles.modalFooter}>
            <button type="button" onClick={onClose} style={styles.cancelBtn} disabled={isSaving}>Cancel</button>
            <button type="submit" style={styles.saveBtn} disabled={isSaving}>
              {isSaving ? 'Saving...' : `Save Admin`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ManagedUserCard({
  user,
  onDelete,
}: {
  user: RoleUser;
  onDelete: (user: RoleUser) => void;
}) {
  return (
    <div style={styles.userCard} className="managed-user-card">
      <div style={styles.userCardHeader}>
        <div style={styles.userIcon}>
          <Shield size={20} color="#007AFF" />
        </div>
        <button onClick={() => onDelete(user)} style={styles.iconDeleteBtn} title={`Delete ${user.name}`} className="delete-btn-hover">
          <Trash2 size={16} />
        </button>
      </div>
      <h3 style={styles.userName}>{user.name}</h3>
      <p style={styles.userMeta}>{user.email}</p>
      <p style={styles.userMeta}>{user.company || '-'}</p>
      <div style={{ marginTop: '16px' }}>
        <span style={{ 
          ...styles.roleBadge,
          backgroundColor: 'rgba(0, 122, 255, 0.1)',
          color: '#007AFF'
        }}>
          {((user.adminLevel || 'super') === 'super' ? 'Super Admin' : 'Sub Admin')}
        </span>
      </div>
    </div>
  );
}

export default function AdminsPage() {
  const [admins, setAdmins] = useState<RoleUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleSaving, setRoleSaving] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<RoleUser | null>(null);

  const fetchUsers = useCallback(async () => {
    const user = getStoredUser();
    const isSuperAdmin = user?.role === 'admin' && (user?.adminLevel || 'super') === 'super';
    
    setLoading(true);
    setRoleError(null);
    try {
      if (isSuperAdmin) {
        const adminUsers = await getUsersByRole('admin');
        setAdmins(adminUsers.filter((u) => (u.adminLevel || 'super') !== 'super'));
      }
    } catch (err) {
      console.error('Failed to fetch admins:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSaveManagedUser = async (payload: ManagedUserPayload) => {
    setRoleSaving(true);
    setRoleError(null);
    try {
      await createManagedUser(payload);
      setIsAdminModalOpen(false);
      await fetchUsers();
    } catch (err: any) {
      setRoleError(err.response?.data?.message || 'Failed to create admin account');
    } finally {
      setRoleSaving(false);
    }
  };

  const handleDeleteManagedUser = async () => {
    if (!deleteTarget) return;
    try {
      await deleteManagedUser(deleteTarget._id);
      setDeleteTarget(null);
      await fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete admin');
    }
  };

  const filteredAdmins = admins.filter(
    (u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.company && u.company.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Admins</h1>
          <p style={styles.subtitle}>Manage sub-admins and internal system access</p>
        </div>
        <button onClick={() => setIsAdminModalOpen(true)} style={styles.primaryBtn}>
          <Plus size={18} />
          <span>Add Admin</span>
        </button>
      </header>

      <section style={styles.searchSection}>
        <div style={styles.searchBox}>
          <Search size={20} color="var(--text-secondary)" />
          <input
            placeholder="Search admins by name, email or company..."
            style={styles.searchInput}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </section>

      <div style={styles.sectionBlock}>
        {loading ? (
          <div style={styles.loadingContainer}>
            <div style={styles.spinner}></div>
            <p style={{ color: "var(--text-secondary)" }}>Loading admins...</p>
          </div>
        ) : filteredAdmins.length === 0 ? (
          <div style={styles.emptyContainer}>
            <Shield size={48} color="var(--border-color)" />
            <h3 style={styles.emptyTitle}>No sub-admins found</h3>
            <p style={styles.emptyText}>Add an admin account to help manage the platform.</p>
          </div>
        ) : (
          <div style={styles.userGrid}>
            {filteredAdmins.map((user) => (
              <ManagedUserCard
                key={user._id}
                user={user}
                onDelete={(target) => setDeleteTarget(target)}
              />
            ))}
          </div>
        )}
      </div>

      <ManagedUserModal
        isOpen={isAdminModalOpen}
        role="admin"
        title="New Admin"
        isSaving={roleSaving}
        submitError={roleError}
        onClose={() => setIsAdminModalOpen(false)}
        onSave={handleSaveManagedUser}
      />

      <ConfirmationModal
        isOpen={!!deleteTarget}
        title="Delete Admin"
        message={`Are you sure you want to delete ${deleteTarget?.name}? This will permanently remove their access to the system.`}
        confirmLabel="Delete"
        isDanger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDeleteManagedUser}
      />

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes modalFadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .managed-user-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 12px 30px rgba(0,0,0,0.08);
          border-color: #007AFF20;
        }
        .delete-btn-hover:hover {
          background: #FF3B30 !important;
          color: white !important;
          transform: scale(1.1);
        }
      `}</style>
    </div>
  );
}

const styles: any = {
  container: {
    padding: '40px',
    maxWidth: '1400px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '40px',
  },
  title: {
    fontSize: '34px',
    fontWeight: 800,
    color: 'var(--text-primary)',
    margin: 0,
    marginBottom: '8px',
    letterSpacing: '-1px',
  },
  subtitle: {
    fontSize: '16px',
    color: 'var(--text-secondary)',
    margin: 0,
  },
  primaryBtn: {
    padding: '12px 24px',
    backgroundColor: '#007AFF',
    color: '#ffffff',
    border: 'none',
    borderRadius: '14px',
    fontSize: '15px',
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    boxShadow: '0 8px 16px rgba(0,122,255,0.2)',
  },
  searchSection: {
    marginBottom: '40px',
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '14px 20px',
    backgroundColor: 'var(--bg-secondary)',
    border: '1.5px solid var(--border-color)',
    borderRadius: '16px',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: '16px',
    fontFamily: 'inherit',
    backgroundColor: 'transparent',
    color: 'var(--text-primary)',
  },
  sectionBlock: {
    marginBottom: '56px',
  },
  userGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '24px',
  },
  userCard: {
    backgroundColor: 'var(--bg-primary)',
    border: '1.5px solid var(--border-color)',
    borderRadius: '24px',
    padding: '28px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
    transition: 'all 0.3s ease',
    display: 'flex',
    flexDirection: 'column',
  },
  userCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  },
  userIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '14px',
    backgroundColor: 'var(--bg-secondary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid var(--border-color)',
  },
  iconDeleteBtn: {
    background: 'rgba(255, 59, 48, 0.05)',
    border: '1px solid rgba(255, 59, 48, 0.1)',
    cursor: 'pointer',
    color: '#FF3B30',
    padding: '10px',
    borderRadius: '12px',
    transition: 'all 0.25s ease',
  },
  userName: {
    fontSize: '20px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: 0,
    marginBottom: '8px',
    letterSpacing: '-0.5px',
  },
  userMeta: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    margin: 0,
    marginBottom: '6px',
    fontWeight: 500,
  },
  roleBadge: {
    display: 'inline-flex',
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '100px',
    gap: '20px',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid var(--border-color)',
    borderTopColor: '#007AFF',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  emptyContainer: {
    textAlign: 'center',
    padding: '100px 20px',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: '32px',
    border: '1.5px dashed var(--border-color)',
  },
  emptyTitle: {
    fontSize: '22px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginTop: '20px',
    marginBottom: '8px',
  },
  emptyText: {
    fontSize: '15px',
    color: 'var(--text-secondary)',
    marginBottom: '24px',
  },
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(10px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
  },
  modal: {
    backgroundColor: 'var(--bg-primary)',
    borderRadius: '32px',
    padding: '32px',
    width: '95%',
    maxWidth: '640px',
    boxShadow: '0 24px 60px rgba(0,0,0,0.2)',
    border: '1.5px solid var(--border-color)',
    animation: 'modalFadeIn 0.3s ease',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '28px',
  },
  modalTitle: {
    fontSize: '28px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: 0,
    letterSpacing: '-1px',
  },
  closeBtn: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    cursor: 'pointer',
    padding: '8px',
    display: 'flex',
    alignItems: 'center',
    color: 'var(--text-secondary)',
  },
  row: {
    display: 'flex',
    gap: '20px',
    marginBottom: '20px',
    flexWrap: 'wrap',
  },
  formGroup: {
    flex: 1,
    minWidth: '240px',
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: 700,
    marginBottom: '8px',
    color: 'var(--text-primary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    backgroundColor: 'var(--bg-secondary)',
    border: '1.5px solid var(--border-color)',
    borderRadius: '14px',
    fontSize: '15px',
    color: 'var(--text-primary)',
    outline: 'none',
    transition: 'all 0.2s ease',
  },
  infoBox: {
    backgroundColor: 'rgba(0, 122, 255, 0.05)',
    border: '1px solid rgba(0, 122, 255, 0.1)',
    borderRadius: '14px',
    padding: '16px',
    marginBottom: '24px',
  },
  infoText: {
    fontSize: '13px',
    color: '#007AFF',
    margin: 0,
    lineHeight: 1.5,
  },
  submitError: {
    color: '#FF3B30',
    fontSize: '14px',
    fontWeight: 600,
    marginBottom: '20px',
    textAlign: 'center',
  },
  modalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '12px',
  },
  cancelBtn: {
    padding: '12px 24px',
    backgroundColor: 'transparent',
    border: '1.5px solid var(--border-color)',
    borderRadius: '14px',
    fontSize: '15px',
    fontWeight: 700,
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  },
  saveBtn: {
    padding: '12px 28px',
    backgroundColor: '#007AFF',
    border: 'none',
    borderRadius: '14px',
    fontSize: '15px',
    fontWeight: 700,
    color: '#ffffff',
    cursor: 'pointer',
    boxShadow: '0 8px 16px rgba(0,122,255,0.2)',
  },
};
