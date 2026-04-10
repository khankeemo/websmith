// C:\websmith\app\clients\page.tsx
// Clients Page - Main clients management page
// Features: List clients, add/edit/delete, search

'use client';

import { useState } from 'react';
import { Plus, Search, Users as UsersIcon } from 'lucide-react';
import { useClients } from './hooks/useClients';
import ClientCard from './components/ClientCard';
import ClientModal from './components/ClientModal';
import ConfirmationModal from '../../components/ui/ConfirmationModal';
import { Client, ClientPayload } from './services/clientService';

export default function ClientsPage() {
  const { clients, loading, saving, error, addClient, editClient, removeClient, fetchClients, clearError } = useClients();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Deletion State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<string | null>(null);

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

  const handleDeleteClient = (id: string) => {
    setClientToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const handleTogglePublish = async (client: Client) => {
    await editClient(client._id!, { published: !client.published });
  };

  const confirmDelete = async () => {
    if (!clientToDelete) return;
    
    setSuccessMessage(null);
    const removed = await removeClient(clientToDelete);
    if (removed) {
      setSuccessMessage('Client and associated user account deleted successfully.');
    }
    setIsDeleteModalOpen(false);
    setClientToDelete(null);
  };

  // Filter clients
  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.customId?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Clients</h1>
          <p style={styles.subtitle}>Manage all your client relationships</p>
        </div>
        <button onClick={handleAddClient} style={styles.addBtn} className="add-btn">
          <Plus size={18} />
          <span>New Client</span>
        </button>
      </div>

      {/* Search */}
      <div style={styles.searchSection}>
        <div style={styles.searchBox}>
          <Search size={18} color="#8E8E93" />
          <input
            type="text"
            placeholder="Search clients..."
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

      {/* Loading State */}
      {loading && (
        <div style={styles.loadingContainer}>
          <div style={styles.spinner}></div>
          <p>Loading clients...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div style={styles.errorContainer}>
          <p style={styles.errorText}>{error}</p>
          <button onClick={fetchClients} style={styles.retryBtn}>Try Again</button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredClients.length === 0 && (
        <div style={styles.emptyContainer}>
          <UsersIcon size={48} color="#C6C6C8" />
          <h3 style={styles.emptyTitle}>No clients found</h3>
          <p style={styles.emptyText}>
            {searchTerm ? 'Try adjusting your search' : 'Create your first client to get started'}
          </p>
          {!searchTerm && (
            <button onClick={handleAddClient} style={styles.emptyBtn}>Add Client</button>
          )}
        </div>
      )}

      {/* Clients Grid */}
      {!loading && !error && filteredClients.length > 0 && (
        <div style={styles.grid}>
          {filteredClients.map((client) => (
            <ClientCard
              key={client._id}
              client={client}
              onEdit={handleEditClient}
              onDelete={handleDeleteClient}
              onTogglePublish={handleTogglePublish}
            />
          ))}
        </div>
      )}

      {/* Modal */}
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

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        title="Delete Client"
        message="Are you sure you want to delete this client? This will also permanently remove their account access and all associated data."
        confirmLabel="Delete Client"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => {
          setIsDeleteModalOpen(false);
          setClientToDelete(null);
        }}
        isDanger={true}
        isLoading={saving}
      />

      <style>{`
        .add-btn {
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .add-btn:hover {
          background-color: #34C759 !important;
          transform: translateX(4px) translateY(-2px);
          box-shadow: 0 4px 12px rgba(52,199,89,0.3);
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
    padding: '8px 4px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '32px',
  },
  title: {
    fontSize: '34px',
    fontWeight: 600,
    letterSpacing: '-0.5px',
    color: '#1C1C1E',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '15px',
    color: '#8E8E93',
  },
  addBtn: {
    padding: '10px 20px',
    backgroundColor: '#007AFF',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontFamily: 'inherit',
  },
  searchSection: {
    marginBottom: '24px',
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    backgroundColor: '#FFFFFF',
    border: '1px solid #E5E5EA',
    borderRadius: '12px',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: '15px',
    fontFamily: 'inherit',
    backgroundColor: 'transparent',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
    gap: '20px',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px',
    gap: '16px',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid #E5E5EA',
    borderTopColor: '#007AFF',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  errorContainer: {
    textAlign: 'center',
    padding: '60px',
    backgroundColor: '#FEF2F0',
    borderRadius: '16px',
  },
  successContainer: {
    marginBottom: '20px',
    padding: '14px 16px',
    backgroundColor: '#E8F5E9',
    border: '1px solid #34C759',
    borderRadius: '12px',
  },
  successText: {
    color: '#1C1C1E',
    margin: 0,
    fontSize: '14px',
    fontWeight: 500,
  },
  errorText: {
    color: '#FF3B30',
    marginBottom: '16px',
  },
  retryBtn: {
    padding: '8px 20px',
    backgroundColor: '#007AFF',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  emptyContainer: {
    textAlign: 'center',
    padding: '60px',
  },
  emptyTitle: {
    fontSize: '20px',
    fontWeight: 600,
    color: '#1C1C1E',
    marginTop: '16px',
    marginBottom: '8px',
  },
  emptyText: {
    fontSize: '14px',
    color: '#8E8E93',
    marginBottom: '20px',
  },
  emptyBtn: {
    padding: '10px 24px',
    backgroundColor: '#007AFF',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};
