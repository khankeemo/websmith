// PATH: C:\websmith\app\payments\components\PaymentCard.tsx
// Payment Card Component - Display payment in card view

'use client';

import React from 'react';
import { Payment } from '../services/paymentService';
import { 
  CreditCard, 
  DollarSign, 
  Calendar, 
  Building2, 
  Download, 
  Eye,
  CheckCircle,
  Clock,
  XCircle,
  RefreshCw
} from 'lucide-react';

interface PaymentCardProps {
  payment: Payment;
  onView: (payment: Payment) => void;
  onDownloadReceipt: (id: string, invoiceNumber: string) => void;
  onRefund?: (id: string) => void;
}

const getStatusConfig = (status: string) => {
  switch (status) {
    case 'completed':
      return { color: '#34C759', bg: '#E8F5E9', icon: CheckCircle, label: 'Completed' };
    case 'pending':
      return { color: '#FF9500', bg: '#FFF3E0', icon: Clock, label: 'Pending' };
    case 'failed':
      return { color: '#FF3B30', bg: '#FFE5E5', icon: XCircle, label: 'Failed' };
    case 'refunded':
      return { color: '#8E8E93', bg: '#F2F2F7', icon: RefreshCw, label: 'Refunded' };
    default:
      return { color: '#8E8E93', bg: '#F2F2F7', icon: CreditCard, label: 'Unknown' };
  }
};

const getMethodIcon = (method: string) => {
  switch (method) {
    case 'card': return '💳';
    case 'bank': return '🏦';
    case 'cash': return '💰';
    case 'crypto': return '₿';
    default: return '💳';
  }
};

const getMethodLabel = (method: string) => {
  switch (method) {
    case 'card': return 'Credit Card';
    case 'bank': return 'Bank Transfer';
    case 'cash': return 'Cash';
    case 'crypto': return 'Cryptocurrency';
    default: return method;
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

const PaymentCard: React.FC<PaymentCardProps> = ({ 
  payment, 
  onView, 
  onDownloadReceipt,
  onRefund 
}) => {
  const statusConfig = getStatusConfig(payment.status);
  const StatusIcon = statusConfig.icon;
  const isCompleted = payment.status === 'completed';
  const isPending = payment.status === 'pending';

  return (
    <div 
      style={styles.card}
      className="payment-card"
    >
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.invoiceInfo}>
          <span style={styles.invoiceLabel}>Invoice</span>
          <span style={styles.invoiceNumber}>#{payment.invoiceNumber}</span>
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
        <h3 style={styles.clientName}>{payment.clientName}</h3>
        <div style={styles.clientEmail}>{payment.clientEmail}</div>
      </div>

      {/* Amount */}
      <div style={styles.amountSection}>
        <span style={styles.amountLabel}>Payment Amount</span>
        <span style={styles.amountValue}>{formatCurrency(payment.amount)}</span>
      </div>

      {/* Payment Details */}
      <div style={styles.detailsGrid}>
        <div style={styles.detailItem}>
          <div style={styles.detailIcon}>
            <span style={{ fontSize: '20px' }}>{getMethodIcon(payment.method)}</span>
          </div>
          <div>
            <span style={styles.detailLabel}>Method</span>
            <span>{getMethodLabel(payment.method)}</span>
          </div>
        </div>
        <div style={styles.detailItem}>
          <div style={styles.detailIcon}>
            <Calendar size={14} color="#8E8E93" />
          </div>
          <div>
            <span style={styles.detailLabel}>Date</span>
            <span>{formatDate(payment.date)}</span>
          </div>
        </div>
        <div style={styles.detailItem}>
          <div style={styles.detailIcon}>
            <Building2 size={14} color="#8E8E93" />
          </div>
          <div>
            <span style={styles.detailLabel}>Transaction ID</span>
            <span style={styles.transactionId}>
              {payment.transactionId.slice(0, 12)}...
            </span>
          </div>
        </div>
      </div>

      {/* Notes */}
      {payment.notes && (
        <div style={styles.notes}>
          <span style={styles.notesLabel}>Notes:</span>
          <span>{payment.notes}</span>
        </div>
      )}

      {/* Actions */}
      <div style={styles.actions}>
        <button 
          onClick={() => onView(payment)} 
          style={styles.actionBtn}
          className="action-btn"
        >
          <Eye size={14} /> Details
        </button>
        <button 
          onClick={() => onDownloadReceipt(payment._id, payment.invoiceNumber)} 
          style={styles.actionBtn}
          className="action-btn"
        >
          <Download size={14} /> Receipt
        </button>
        {isCompleted && onRefund && (
          <button 
            onClick={() => onRefund(payment._id)} 
            style={{ ...styles.actionBtn, ...styles.refundBtn }}
            className="action-btn"
          >
            <RefreshCw size={14} /> Refund
          </button>
        )}
        {isPending && (
          <button style={{ ...styles.actionBtn, ...styles.verifyBtn }} className="action-btn">
            <CheckCircle size={14} /> Verify
          </button>
        )}
      </div>

      <style>{`
        .payment-card {
          transition: all 0.3s ease;
        }
        .payment-card:hover {
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
  invoiceInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  invoiceLabel: {
    fontSize: '12px',
    color: '#8E8E93',
  },
  invoiceNumber: {
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
    marginBottom: '4px',
  },
  clientEmail: {
    fontSize: '12px',
    color: '#8E8E93',
  },
  amountSection: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: '16px',
    paddingBottom: '12px',
    borderBottom: '1px solid #E5E5EA',
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
  detailsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
    marginBottom: '16px',
  },
  detailItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    color: '#6C6C70',
  },
  detailIcon: {
    width: '28px',
    height: '28px',
    backgroundColor: '#F2F2F7',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailLabel: {
    display: 'block',
    fontSize: '10px',
    color: '#8E8E93',
  },
  transactionId: {
    fontFamily: 'monospace',
    fontSize: '11px',
  },
  notes: {
    display: 'flex',
    gap: '8px',
    fontSize: '12px',
    color: '#6C6C70',
    padding: '8px 12px',
    backgroundColor: '#F9F9FB',
    borderRadius: '10px',
    marginBottom: '16px',
  },
  notesLabel: {
    fontWeight: 500,
    color: '#1C1C1E',
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
  refundBtn: {
    backgroundColor: '#FF3B30',
    color: '#FFFFFF',
  },
  verifyBtn: {
    backgroundColor: '#FF9500',
    color: '#FFFFFF',
  },
};

export default PaymentCard;