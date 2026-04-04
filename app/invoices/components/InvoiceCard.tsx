// PATH: C:\websmith\app\invoices\components\InvoiceCard.tsx
// Invoice Card Component - Display invoice in card view

'use client';

import React from 'react';
import { Invoice } from '../services/invoiceService';
import { 
  FileText, 
  Calendar, 
  DollarSign, 
  Mail, 
  Download, 
  Eye, 
  CheckCircle,
  Clock,
  AlertCircle
} from 'lucide-react';

interface InvoiceCardProps {
  invoice: Invoice;
  onView: (invoice: Invoice) => void;
  onDownload: (id: string, number: string) => void;
  onMarkAsPaid?: (id: string) => void;
}

const getStatusConfig = (status: string) => {
  switch (status) {
    case 'paid':
      return { color: '#34C759', bg: '#E8F5E9', icon: CheckCircle, label: 'Paid' };
    case 'pending':
      return { color: '#FF9500', bg: '#FFF3E0', icon: Clock, label: 'Pending' };
    case 'overdue':
      return { color: '#FF3B30', bg: '#FFE5E5', icon: AlertCircle, label: 'Overdue' };
    default:
      return { color: '#8E8E93', bg: '#F2F2F7', icon: FileText, label: 'Draft' };
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

const InvoiceCard: React.FC<InvoiceCardProps> = ({ 
  invoice, 
  onView, 
  onDownload,
  onMarkAsPaid 
}) => {
  const statusConfig = getStatusConfig(invoice.status);
  const StatusIcon = statusConfig.icon;
  const isOverdue = invoice.status === 'overdue';
  const isPending = invoice.status === 'pending';

  return (
    <div 
      style={styles.card}
      className="invoice-card"
    >
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.invoiceNumber}>
          <FileText size={16} color="#007AFF" />
          <span>{invoice.invoiceNumber}</span>
        </div>
        <div style={{
          ...styles.statusBadge,
          backgroundColor: statusConfig.bg,
          color: statusConfig.color
        }}>
          <StatusIcon size={12} />
          <span>{statusConfig.label}</span>
        </div>
      </div>

      {/* Client Info */}
      <div style={styles.clientInfo}>
        <h3 style={styles.clientName}>{invoice.clientName}</h3>
        <div style={styles.clientEmail}>
          <Mail size={12} color="#8E8E93" />
          <span>{invoice.clientEmail}</span>
        </div>
      </div>

      {/* Amount */}
      <div style={styles.amountSection}>
        <span style={styles.amountLabel}>Total Amount</span>
        <span style={styles.amountValue}>{formatCurrency(invoice.amount)}</span>
      </div>

      {/* Dates */}
      <div style={styles.dates}>
        <div style={styles.dateItem}>
          <Calendar size={12} color="#8E8E93" />
          <div>
            <span style={styles.dateLabel}>Issued</span>
            <span>{formatDate(invoice.issueDate)}</span>
          </div>
        </div>
        <div style={styles.dateItem}>
          <Calendar size={12} color={isOverdue ? '#FF3B30' : '#8E8E93'} />
          <div>
            <span style={{
              ...styles.dateLabel,
              ...(isOverdue && { color: '#FF3B30' })
            }}>Due Date</span>
            <span style={isOverdue ? { color: '#FF3B30' } : {}}>
              {formatDate(invoice.dueDate)}
            </span>
          </div>
        </div>
      </div>

      {/* Items Preview */}
      {invoice.items && invoice.items.length > 0 && (
        <div style={styles.itemsPreview}>
          <span style={styles.itemsLabel}>
            {invoice.items.length} item{invoice.items.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Actions */}
      <div style={styles.actions}>
        <button 
          onClick={() => onView(invoice)} 
          style={styles.actionBtn}
          className="action-btn"
        >
          <Eye size={14} /> View
        </button>
        <button 
          onClick={() => onDownload(invoice._id, invoice.invoiceNumber)} 
          style={styles.actionBtn}
          className="action-btn"
        >
          <Download size={14} /> PDF
        </button>
        {isPending && onMarkAsPaid && (
          <button 
            onClick={() => onMarkAsPaid(invoice._id)} 
            style={{ ...styles.actionBtn, ...styles.markPaidBtn }}
            className="action-btn"
          >
            <CheckCircle size={14} /> Mark Paid
          </button>
        )}
      </div>

      <style>{`
        .invoice-card {
          transition: all 0.3s ease;
        }
        .invoice-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
        }
        .action-btn {
          transition: all 0.2s ease;
        }
        .action-btn:hover {
          transform: translateY(-2px);
          opacity: 0.85;
        }
      `}</style>
    </div>
  );
};

const styles: any = {
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: '20px',
    padding: '20px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
    border: '1px solid #E5E5EA',
    transition: 'all 0.3s ease',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  invoiceNumber: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#007AFF',
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 500,
    textTransform: 'capitalize' as const,
  },
  clientInfo: {
    marginBottom: '16px',
    paddingBottom: '12px',
    borderBottom: '1px solid #E5E5EA',
  },
  clientName: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#1C1C1E',
    marginBottom: '6px',
  },
  clientEmail: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    color: '#8E8E93',
  },
  amountSection: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: '16px',
  },
  amountLabel: {
    fontSize: '12px',
    color: '#8E8E93',
  },
  amountValue: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#1C1C1E',
  },
  dates: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '16px',
    paddingBottom: '12px',
    borderBottom: '1px solid #E5E5EA',
  },
  dateItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    color: '#6C6C70',
  },
  dateLabel: {
    fontSize: '10px',
    color: '#8E8E93',
    display: 'block',
  },
  itemsPreview: {
    marginBottom: '16px',
  },
  itemsLabel: {
    fontSize: '11px',
    color: '#8E8E93',
    backgroundColor: '#F2F2F7',
    padding: '4px 8px',
    borderRadius: '12px',
  },
  actions: {
    display: 'flex',
    gap: '8px',
  },
  actionBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '8px',
    backgroundColor: '#F2F2F7',
    border: 'none',
    borderRadius: '10px',
    fontSize: '12px',
    fontWeight: 500,
    color: '#1C1C1E',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  markPaidBtn: {
    backgroundColor: '#34C759',
    color: '#FFFFFF',
  },
};

export default InvoiceCard;