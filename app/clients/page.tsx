// C:\websmith\app\clients\page.tsx
// Clients Page - Main clients management page
// Features: List clients, add/edit/delete, search

'use client';

import { useEffect, useState } from 'react';
import { Plus, Search, Shield, Users as UsersIcon, Code2, Trash2, X } from 'lucide-react';
import { getStoredUser } from '../../lib/auth';
import { useClients } from './hooks/useClients';
import ClientCard from './components/ClientCard';
import ClientModal from './components/ClientModal';
import ConfirmationModal from '../../components/ui/ConfirmationModal';
import { Client, ClientPayload } from './services/clientService';
import { createManagedUser, deleteManagedUser, getUsersByRole, ManagedUserPayload, RoleUser } from '../../core/services/userService';

type DeleteTarget =
  | { type: 'client'; id: string }
  | { type: 'developer' | 'admin'; id: string; name: string };

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
                className="modal-input-focus"
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
                className="modal-input-focus"
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
                className="modal-input-focus"
                disabled={isSaving}
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Company</label>
              <input
                value={formData.company}
                onChange={(e) => setFormData((current) => ({ ...current, company: e.target.value }))}
                style={styles.input}
                className="modal-input-focus"
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
              {isSaving ? 'Saving...' : `Save ${role === 'admin' ? 'Admin' : 'Developer'}`}
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
          {user.role === 'admin' ? <Shield size={20} color="#007AFF" /> : <Code2 size={20} color="#007AFF" />}
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
          backgroundColor: user.role === 'admin' ? 'rgba(0, 122, 255, 0.1)' : 'rgba(175, 82, 222, 0.1)',
          color: user.role === 'admin' ? '#007AFF' : '#AF52DE'
        }}>
          {user.role === 'admin' ? ((user.adminLevel || 'super') === 'super' ? 'Super Admin' : 'Sub Admin') : 'Developer'}
        </span>
      </div>
    </div>
  );
}

export default function ClientsPage() {
  const currentUser = getStoredUser();
  const isSuperAdmin = currentUser?.role === 'admin' && (currentUser.adminLevel || 'super') === 'super';
  const { clients, loading, saving, error, addClient, editClient, removeClient, fetchClients, clearError } = useClients();
  const [developers, setDevelopers] = useState<RoleUser[]>([]);
  const [admins, setAdmins] = useState<RoleUser[]>([]);
  const [roleLoading, setRoleLoading] = useState(false);
  const [roleSaving, setRoleSaving] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeveloperModalOpen, setIsDeveloperModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const loadRoleUsers = async () => {
    setRoleLoading(true);
    setRoleError(null);
    try {
      const developerUsers = await getUsersByRole('developer');
      setDevelopers(developerUsers);
      if (isSuperAdmin) {
        const adminUsers = await getUsersByRole('admin');
        setAdmins(adminUsers.filter((user) => (user.adminLevel || 'super') !== 'super'));
      } else {
        setAdmins([]);
      }
    } catch (err: any) {
      setRoleError(typeof err === 'string' ? err : err?.message || 'Failed to fetch role accounts');
    } finally {
      setRoleLoading(false);
    }
  };

  useEffect(() => {
    loadRoleUsers();
  }, [isSuperAdmin]);

  const handleAddClient = () => {
    clearError();
    setFormError(null);
    setEditingClient(null);
    setIsModalOpen(true);
  };

  const handleEditClient = (client: Client) => {
    clearError();
    setFormError(null);
    setEditingClient(client);
    setIsModalOpen(true);
  };

  const handleSaveClient = async (clientData: ClientPayload) => {
    setFormError(null);
    setSuccessMessage(null);

    if (editingClient) {
      const updatedClient = await editClient(editingClient._id!, clientData);
      if (!updatedClient) {
        setFormError('Unable to update client. Please check the details and try again.');
        return;
      }
      setSuccessMessage('Client updated successfully.');
    } else {
      const createdClient = await addClient(clientData);
      if (!createdClient) {
        setFormError('Unable to create client. Please check the details and try again.');
        return;
      }
      setSuccessMessage('Client created successfully.');
    }

    setIsModalOpen(false);
    setEditingClient(null);
  };

  const handleSaveManagedUser = async (payload: ManagedUserPayload) => {
    setRoleSaving(true);
    setRoleError(null);
    setSuccessMessage(null);
    try {
      await createManagedUser(payload);
      await loadRoleUsers();
      setSuccessMessage(`${payload.role === 'admin' ? 'Admin' : 'Developer'} created successfully.`);
      setIsDeveloperModalOpen(false);
      setIsAdminModalOpen(false);
    } catch (err: any) {
      setRoleError(typeof err === 'string' ? err : err?.message || 'Failed to create account');
    } finally {
      setRoleSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    setSuccessMessage(null);

    if (deleteTarget.type === 'client') {
      const removed = await removeClient(deleteTarget.id);
      if (removed) {
        setSuccessMessage('Client and associated user account deleted successfully.');
      }
    } else {
      setRoleSaving(true);
      try {
        await deleteManagedUser(deleteTarget.id);
        await loadRoleUsers();
        setSuccessMessage(`${deleteTarget.type === 'admin' ? 'Admin' : 'Developer'} deleted successfully.`);
      } catch (err: any) {
        setRoleError(typeof err === 'string' ? err : err?.message || 'Failed to delete account');
      } finally {
        setRoleSaving(false);
      }
    }

    setDeleteTarget(null);
  };

  const filteredClients = clients.filter((client) =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.customId?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredDevelopers = developers.filter((user) =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.company?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredAdmins = admins.filter((user) =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.company?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={styles.container}>
      <div style={styles.header} className="clients-header">
        <div>
          <h1 style={styles.title}>Clients</h1>
          <p style={styles.subtitle}>Manage clients, developers, and admin access from one place</p>
        </div>
        <div style={styles.headerButtons}>
          <button onClick={() => setIsDeveloperModalOpen(true)} style={styles.secondaryBtn} className="secondary-action-btn">
            <Plus size={18} />
            <span>Add Developer</span>
          </button>
          {isSuperAdmin && (
            <button onClick={() => setIsAdminModalOpen(true)} style={styles.secondaryBtn} className="secondary-action-btn">
              <Plus size={18} />
              <span>Add Admin</span>
            </button>
          )}
          <button onClick={handleAddClient} style={styles.addBtn} className="add-btn">
            <Plus size={18} />
            <span>New Client</span>
          </button>
        </div>
      </div>

      <div style={styles.searchSection}>
        <div style={styles.searchBox}>
          <Search size={18} color="var(--text-secondary)" />
          <input
            type="text"
            placeholder="Search accounts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
        </div>
      </div>

      {successMessage && (
        <div style={styles.successContainer}>
          <p style={styles.successText}>{successMessage}</p>
        </div>
      )}

      {(error || roleError) && (
        <div style={styles.errorContainer}>
          <p style={styles.errorText}>{roleError || error}</p>
          <button
            onClick={() => {
              fetchClients();
              loadRoleUsers();
            }}
            style={styles.retryBtn}
          >
            Try Again
          </button>
        </div>
      )}

      <div style={styles.sectionBlock}>
        <div style={styles.sectionHeader}>
          <div>
            <h2 style={styles.sectionTitle}>Clients</h2>
            <p style={styles.sectionDescription}>Manage your active client base and their account credentials.</p>
          </div>
        </div>

        {loading ? (
          <div style={styles.loadingContainer}>
            <div style={styles.spinner}></div>
            <p style={{ color: "var(--text-secondary)" }}>Loading client details...</p>
          </div>
        ) : filteredClients.length === 0 ? (
          <div style={styles.emptyContainer}>
            <UsersIcon size={48} color="var(--border-color)" />
            <h3 style={styles.emptyTitle}>No clients found</h3>
            <p style={styles.emptyText}>{searchTerm ? 'Try adjusting your search' : 'Create your first client to get started'}</p>
          </div>
        ) : (
          <div style={styles.grid}>
            {filteredClients.map((client) => (
              <ClientCard
                key={client._id}
                client={client}
                onEdit={handleEditClient}
                onDelete={(id) => setDeleteTarget({ type: 'client', id })}
              />
            ))}
          </div>
        )}
      </div>

      <div style={styles.sectionBlock}>
        <div style={styles.sectionHeader}>
          <div>
            <h2 style={styles.sectionTitle}>Developers</h2>
            <p style={styles.sectionDescription}>Assign and manage technical access for your team.</p>
          </div>
        </div>

        {roleLoading ? (
          <div style={styles.loadingContainer}>
            <div style={styles.spinner}></div>
            <p style={{ color: "var(--text-secondary)" }}>Loading developers...</p>
          </div>
        ) : filteredDevelopers.length === 0 ? (
          <div style={styles.emptyContainer}>
            <Code2 size={48} color="var(--border-color)" />
            <h3 style={styles.emptyTitle}>No developers found</h3>
            <p style={styles.emptyText}>Add a developer account to get started.</p>
          </div>
        ) : (
          <div style={styles.userGrid}>
            {filteredDevelopers.map((user) => (
              <ManagedUserCard
                key={user._id}
                user={user}
                onDelete={(target) => setDeleteTarget({ type: 'developer', id: target._id, name: target.name })}
              />
            ))}
          </div>
        )}
      </div>

      {isSuperAdmin && (
        <div style={styles.sectionBlock}>
          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>Admins</h2>
              <p style={styles.sectionDescription}>Manage sub-admin permissions and administrative access.</p>
            </div>
          </div>

          {roleLoading ? (
            <div style={styles.loadingContainer}>
              <div style={styles.spinner}></div>
              <p style={{ color: "var(--text-secondary)" }}>Loading admin accounts...</p>
            </div>
          ) : filteredAdmins.length === 0 ? (
            <div style={styles.emptyContainer}>
              <Shield size={48} color="var(--border-color)" />
              <h3 style={styles.emptyTitle}>No sub-admins found</h3>
              <p style={styles.emptyText}>Sharing access helps you manage the workload.</p>
            </div>
          ) : (
            <div style={styles.userGrid}>
              {filteredAdmins.map((user) => (
                <ManagedUserCard
                  key={user._id}
                  user={user}
                  onDelete={(target) => setDeleteTarget({ type: 'admin', id: target._id, name: target.name })}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <ClientModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingClient(null);
          setFormError(null);
        }}
        onSave={handleSaveClient}
        client={editingClient}
        isSaving={saving}
        submitError={formError || error}
      />

      <ManagedUserModal
        isOpen={isDeveloperModalOpen}
        role="developer"
        title="New Developer"
        isSaving={roleSaving}
        submitError={roleError}
        onClose={() => setIsDeveloperModalOpen(false)}
        onSave={handleSaveManagedUser}
      />

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
        isOpen={Boolean(deleteTarget)}
        title={deleteTarget?.type === 'client' ? 'Delete Client' : deleteTarget?.type === 'admin' ? 'Delete Admin' : 'Delete Developer'}
        message={
          deleteTarget?.type === 'client'
            ? 'Are you sure you want to delete this client? This will also permanently remove their account access and all associated data.'
            : `Are you sure you want to delete this ${deleteTarget?.type} account?`
        }
        confirmLabel={deleteTarget?.type === 'client' ? 'Delete Client' : 'Delete Account'}
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        isDanger={true}
        isLoading={saving || roleSaving}
      />

      <style>{`
        .add-btn, .secondary-action-btn { transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); }
        .add-btn:hover { background-color: #34C759 !important; transform: translateY(-2px); box-shadow: 0 8px 20px rgba(52,199,89,0.3); }
        .secondary-action-btn:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); background-color: var(--bg-secondary) !important; }
        .modal-input-focus:focus { border-color: #007AFF !important; box-shadow: 0 0 0 3px rgba(0,122,255,0.1) !important; }
        .managed-user-card:hover { transform: translateY(-4px); box-shadow: 0 12px 24px rgba(0,0,0,0.1); border-color: #007AFF55 !important; }
        .delete-btn-hover:hover { background-color: rgba(255, 59, 48, 0.15) !important; transform: scale(1.1); }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

const styles: any = {
  container: {
    padding: '8px 4px',
    backgroundColor: 'var(--bg-primary)',
    minHeight: '100vh',
    color: 'var(--text-primary)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '40px',
  },
  headerButtons: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  title: {
    fontSize: '34px',
    fontWeight: 700,
    letterSpacing: '-1px',
    color: 'var(--text-primary)',
    margin: '0 0 8px 0',
  },
  subtitle: {
    fontSize: '15px',
    color: 'var(--text-secondary)',
    margin: 0,
  },
  addBtn: {
    padding: '12px 24px',
    backgroundColor: '#007AFF',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '14px',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontFamily: 'inherit',
    boxShadow: '0 4px 12px rgba(0,122,255,0.2)',
  },
  secondaryBtn: {
    padding: '12px 20px',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    border: '1.5px solid var(--border-color)',
    borderRadius: '14px',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontFamily: 'inherit',
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
    boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
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
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '24px',
  },
  userGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '24px',
  },
  sectionBlock: {
    marginBottom: '56px',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    borderBottom: '1.5px solid var(--border-color)',
    paddingBottom: '16px',
  },
  sectionTitle: {
    fontSize: '26px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: 0,
    marginBottom: '4px',
    letterSpacing: '-0.5px',
  },
  sectionDescription: {
    fontSize: '15px',
    color: 'var(--text-secondary)',
    margin: 0,
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
  errorContainer: {
    textAlign: 'center',
    padding: '48px',
    backgroundColor: 'rgba(255, 59, 48, 0.05)',
    borderRadius: '24px',
    border: '1.5px solid rgba(255, 59, 48, 0.1)',
    marginBottom: '40px',
  },
  successContainer: {
    marginBottom: '40px',
    padding: '16px 24px',
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    border: '1.5px solid #34C759',
    borderRadius: '16px',
  },
  successText: {
    color: '#34C759',
    margin: 0,
    fontSize: '14px',
    fontWeight: 700,
  },
  errorText: {
    color: '#FF3B30',
    marginBottom: '20px',
    fontWeight: 700,
    fontSize: '16px',
  },
  retryBtn: {
    padding: '12px 32px',
    backgroundColor: '#007AFF',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    fontWeight: 700,
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
