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
      return { color: '#34C759', bg: 'rgba(52, 199, 89, 0.1)', icon: CheckCircle, label: 'Paid' };
    case 'pending':
      return { color: '#FF9500', bg: 'rgba(255, 149, 0, 0.1)', icon: Clock, label: 'Pending' };
    case 'overdue':
      return { color: '#FF3B30', bg: 'rgba(255, 59, 48, 0.1)', icon: AlertCircle, label: 'Overdue' };
    default:
      return { color: 'var(--text-secondary)', bg: 'var(--bg-secondary)', icon: FileText, label: 'Draft' };
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
          color: statusConfig.color,
          border: `1px solid ${statusConfig.color}20`
        }}>
          <StatusIcon size={12} />
          <span>{statusConfig.label}</span>
        </div>
      </div>

      {/* Client Info */}
      <div style={styles.clientInfo}>
        <h3 style={styles.clientName}>{invoice.clientName}</h3>
        <div style={styles.clientEmail}>
          <Mail size={12} color="var(--text-secondary)" />
          <span>{invoice.clientEmail}</span>
        </div>
      </div>

      {/* Amount */}
      <div style={styles.amountSection}>
        <span style={styles.amountLabel}>Grand Total</span>
        <span style={styles.amountValue}>{formatCurrency(invoice.amount)}</span>
      </div>

      {/* Dates */}
      <div style={styles.dates}>
        <div style={styles.dateItem}>
          <Calendar size={12} color="var(--text-secondary)" />
          <div>
            <span style={styles.dateLabel}>DATE ISSUED</span>
            <span style={styles.dateValue}>{formatDate(invoice.issueDate)}</span>
          </div>
        </div>
        <div style={styles.dateItem}>
          <Calendar size={12} color={isOverdue ? '#FF3B30' : 'var(--text-secondary)'} />
          <div>
            <span style={{
              ...styles.dateLabel,
              ...(isOverdue && { color: '#FF3B30' })
            }}>DUE DATE</span>
            <span style={{
              ...styles.dateValue,
              ...(isOverdue && { color: '#FF3B30', fontWeight: 800 })
            }}>
              {formatDate(invoice.dueDate)}
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={styles.actions}>
        <button 
          onClick={() => onView(invoice)} 
          style={styles.actionBtn}
          className="action-btn-hover"
        >
          <Eye size={14} /> View
        </button>
        <button 
          onClick={() => onDownload(invoice._id, invoice.invoiceNumber)} 
          style={styles.actionBtn}
          className="action-btn-hover"
        >
          <Download size={14} /> PDF
        </button>
        {isPending && onMarkAsPaid && (
          <button 
            onClick={() => onMarkAsPaid(invoice._id)} 
            style={{ ...styles.actionBtn, ...styles.markPaidBtn }}
            className="mark-paid-hover"
          >
            <CheckCircle size={14} /> Mark Paid
          </button>
        )}
      </div>

      <style>{`
        .invoice-card { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .invoice-card:hover { transform: translateY(-4px); box-shadow: 0 12px 32px rgba(0,0,0,0.12); border-color: #007AFF55 !important; }
        .action-btn-hover { transition: all 0.2s ease; }
        .action-btn-hover:hover { background-color: var(--bg-primary) !important; color: #007AFF !important; border-color: #007AFF33 !important; }
        .mark-paid-hover { transition: all 0.2s ease; }
        .mark-paid-hover:hover { background-color: #34C759 !important; transform: scale(1.02); }
      `}</style>
    </div>
  );
};

const styles: any = {
  card: {
    backgroundColor: 'var(--bg-primary)',
    borderRadius: '24px',
    padding: '24px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)',
    border: '1.5px solid var(--border-color)',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  invoiceNumber: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '15px',
    fontWeight: 700,
    color: '#007AFF',
    letterSpacing: '-0.3px',
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '5px 12px',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  clientInfo: {
    marginBottom: '20px',
    paddingBottom: '16px',
    borderBottom: '1.5px solid var(--border-color)',
  },
  clientName: {
    fontSize: '18px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: '4px',
    letterSpacing: '-0.5px',
  },
  clientEmail: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: 'var(--text-secondary)',
    fontWeight: 500,
  },
  amountSection: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: '20px',
  },
  amountLabel: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  amountValue: {
    fontSize: '22px',
    fontWeight: 800,
    color: 'var(--text-primary)',
  },
  dates: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '20px',
    paddingBottom: '16px',
    borderBottom: '1.5px solid var(--border-color)',
  },
  dateItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
  },
  dateLabel: {
    fontSize: '10px',
    color: 'var(--text-secondary)',
    display: 'block',
    fontWeight: 700,
    letterSpacing: '0.5px',
    marginBottom: '2px',
  },
  dateValue: {
    fontSize: '13px',
    color: 'var(--text-primary)',
    fontWeight: 600,
  },
  actions: {
    display: 'flex',
    gap: '10px',
    marginTop: 'auto',
  },
  actionBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '10px',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    fontSize: '13px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  markPaidBtn: {
    backgroundColor: '#34C75922',
    color: '#34C759',
    borderColor: '#34C75944',
  },
};

export default InvoiceCard;