// C:\websmith\app\clients\page.tsx
// Clients Page - Main clients management page
// Features: List clients, add/edit/delete, search

'use client';

import { useState } from 'react';
import { Plus, Search, Users as UsersIcon } from 'lucide-react';
import { useClients } from './hooks/useClients';
import ClientCard from './components/ClientCard';
import ClientModal from './components/ClientModal';
import { Client } from './services/clientService';

export default function ClientsPage() {
  const { clients, loading, error, addClient, editClient, removeClient, fetchClients } = useClients();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const handleAddClient = () => {
    setEditingClient(null);
    setIsModalOpen(true);
  };

  const handleEditClient = (client: Client) => {
    setEditingClient(client);
    setIsModalOpen(true);
  };

  const handleSaveClient = async (clientData: any) => {
    if (editingClient) {
      await editClient(editingClient._id!, clientData);
    } else {
      await addClient(clientData);
    }
    setIsModalOpen(false);
    setEditingClient(null);
    fetchClients();
  };

  const handleDeleteClient = async (id: string) => {
    if (confirm('Are you sure you want to delete this client?')) {
      await removeClient(id);
    }
  };

  // Filter clients
  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.company?.toLowerCase().includes(searchTerm.toLowerCase())
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
        }}
        onSave={handleSaveClient}
        client={editingClient}
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