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
}

export default function ClientCard({ client, onEdit, onDelete }: ClientCardProps) {
  return (
    <div style={styles.card} className="client-card">
      <div style={styles.cardHeader}>
        <div style={styles.iconContainer}>
          <Users size={24} color="#007AFF" />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {client.customId && (
            <span style={{ ...styles.statusBadge, backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
              {client.customId}
            </span>
          )}
          <span style={{ 
            ...styles.statusBadge, 
            backgroundColor: client.status === 'active' ? 'rgba(52, 199, 89, 0.1)' : 'rgba(255, 59, 48, 0.1)',
            color: client.status === 'active' ? '#34C759' : '#FF3B30',
            border: `1px solid ${client.status === 'active' ? 'rgba(52, 199, 89, 0.2)' : 'rgba(255, 59, 48, 0.2)'}`
          }}>
            {client.status === 'active' ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      <h3 style={styles.clientName}>{client.name}</h3>
      
      <div style={styles.clientDetails}>
        <div style={styles.detailItem}>
          <Mail size={14} color="var(--text-secondary)" />
          <span style={styles.detailText}>{client.email}</span>
        </div>
        {client.phone && (
          <div style={styles.detailItem}>
            <Phone size={14} color="var(--text-secondary)" />
            <span style={styles.detailText}>{client.phone}</span>
          </div>
        )}
        {client.company && (
          <div style={styles.detailItem}>
            <Building size={14} color="var(--text-secondary)" />
            <span style={styles.detailText}>{client.company}</span>
          </div>
        )}
      </div>

      {client.address && (
        <p style={styles.clientAddress}>{client.address}</p>
      )}

      <div style={styles.cardActions}>
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
          box-shadow: 0 12px 32px rgba(0,0,0,0.12);
          border-color: #007AFF55 !important;
        }
        .card-action-btn {
          transition: all 0.2s ease;
        }
        .card-action-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.05);
        }
      `}</style>
    </div>
  );
}

const styles: any = {
  card: {
    backgroundColor: 'var(--bg-primary)',
    borderRadius: '20px',
    padding: '24px',
    border: '1.5px solid var(--border-color)',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '20px',
  },
  iconContainer: {
    width: '48px',
    height: '48px',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid var(--border-color)',
  },
  statusBadge: {
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
  },
  clientName: {
    fontSize: '18px',
    fontWeight: 700,
    marginBottom: '12px',
    color: 'var(--text-primary)',
    letterSpacing: '-0.3px',
  },
  clientDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginBottom: '16px',
    paddingBottom: '16px',
    borderBottom: '1.5px solid var(--border-color)',
  },
  detailItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  detailText: {
    fontSize: '14px',
    color: 'var(--text-primary)',
    fontWeight: 500,
  },
  clientAddress: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    marginBottom: '20px',
    lineHeight: 1.5,
  },
  cardActions: {
    display: 'flex',
    gap: '12px',
    marginTop: 'auto',
  },
  editBtn: {
    flex: 1,
    padding: '10px',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: 700,
    color: '#007AFF',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    fontFamily: 'inherit',
  },
  deleteBtn: {
    flex: 1,
    padding: '10px',
    backgroundColor: 'rgba(255, 59, 48, 0.05)',
    border: '1px solid rgba(255, 59, 48, 0.1)',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: 700,
    color: '#FF3B30',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    fontFamily: 'inherit',
  },
};