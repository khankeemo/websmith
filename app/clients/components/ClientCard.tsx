// C:\websmith\app\clients\components\ClientCard.tsx
// Client Card - Displays individual client with actions
// Features: Status badges, edit/delete buttons

'use client';

import { Client } from '../services/clientService';
import { Users, Mail, Phone, Building, Edit2, Trash2 } from 'lucide-react';

interface ClientCardProps {
  client: Client;
  onEdit: (client: Client) => void;
  onDelete: (id: string) => void;
  onTogglePublish?: (client: Client) => void;
}

export default function ClientCard({ client, onEdit, onDelete, onTogglePublish }: ClientCardProps) {
  return (
    <div style={styles.card} className="client-card">
      <div style={styles.cardHeader}>
        <div style={styles.iconContainer}>
          <Users size={24} color="#007AFF" />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {client.customId && (
            <span style={{ ...styles.statusBadge, backgroundColor: '#F2F2F7', color: '#1C1C1E' }}>
              {client.customId}
            </span>
          )}
          <span style={{ 
            ...styles.statusBadge, 
            backgroundColor: client.status === 'active' ? '#E8F5E9' : '#FEF2F0',
            color: client.status === 'active' ? '#34C759' : '#FF3B30'
          }}>
            {client.status === 'active' ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      <h3 style={styles.clientName}>{client.name}</h3>
      
      <div style={styles.clientDetails}>
        <div style={styles.detailItem}>
          <Mail size={14} color="#8E8E93" />
          <span style={styles.detailText}>{client.email}</span>
        </div>
        {client.phone && (
          <div style={styles.detailItem}>
            <Phone size={14} color="#8E8E93" />
            <span style={styles.detailText}>{client.phone}</span>
          </div>
        )}
        {client.company && (
          <div style={styles.detailItem}>
            <Building size={14} color="#8E8E93" />
            <span style={styles.detailText}>{client.company}</span>
          </div>
        )}
      </div>

      {client.address && (
        <p style={styles.clientAddress}>{client.address}</p>
      )}

      <div style={styles.cardActions}>
        {onTogglePublish && (
          <button onClick={() => onTogglePublish(client)} style={styles.publishBtn} className="card-action-btn">
            <span>{client.published ? 'Unpublish' : 'Publish'}</span>
          </button>
        )}
        <button onClick={() => onEdit(client)} style={styles.editBtn} className="card-action-btn">
          <Edit2 size={16} />
          <span>Edit</span>
        </button>
        <button onClick={() => onDelete(client._id!)} style={styles.deleteBtn} className="card-action-btn">
          <Trash2 size={16} />
          <span>Delete</span>
        </button>
      </div>

      <style>{`
        .client-card {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .client-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(0,0,0,0.1);
        }
        .card-action-btn {
          transition: all 0.2s ease;
        }
        .card-action-btn:hover {
          transform: translateY(-2px);
        }
      `}</style>
    </div>
  );
}

const styles: any = {
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: '16px',
    padding: '20px',
    border: '1px solid #E5E5EA',
    cursor: 'pointer',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '16px',
  },
  iconContainer: {
    width: '48px',
    height: '48px',
    backgroundColor: '#E3F2FF',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    padding: '4px 10px',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: 600,
  },
  clientName: {
    fontSize: '18px',
    fontWeight: 600,
    marginBottom: '12px',
    color: '#1C1C1E',
  },
  clientDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '12px',
    paddingBottom: '12px',
    borderBottom: '1px solid #E5E5EA',
  },
  detailItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  detailText: {
    fontSize: '13px',
    color: '#6C6C70',
  },
  clientAddress: {
    fontSize: '12px',
    color: '#8E8E93',
    marginBottom: '16px',
  },
  cardActions: {
    display: 'flex',
    gap: '12px',
  },
  editBtn: {
    flex: 1,
    padding: '8px',
    backgroundColor: '#F2F2F7',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 500,
    color: '#007AFF',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    fontFamily: 'inherit',
  },
  publishBtn: {
    flex: 1,
    padding: '8px',
    backgroundColor: '#E8FFF3',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 500,
    color: '#16A34A',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  deleteBtn: {
    flex: 1,
    padding: '8px',
    backgroundColor: '#FEF2F0',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 500,
    color: '#FF3B30',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    fontFamily: 'inherit',
  },
};
