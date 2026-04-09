'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDanger?: boolean;
  isLoading?: boolean;
}

export default function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  isDanger = true,
  isLoading = false,
}: ConfirmationModalProps) {
  const [isRendered, setIsRendered] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      document.body.style.overflow = 'hidden';
    } else {
      const timer = setTimeout(() => setIsRendered(false), 300);
      document.body.style.overflow = 'unset';
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isRendered && !isOpen) return null;

  return (
    <div 
      style={{
        ...styles.overlay,
        opacity: isOpen ? 1 : 0,
        pointerEvents: isOpen ? 'auto' : 'none',
      }}
      onClick={onCancel}
    >
      <div 
        style={{
          ...styles.modal,
          transform: isOpen ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(10px)',
          opacity: isOpen ? 1 : 0,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button style={styles.closeBtn} onClick={onCancel}>
          <X size={20} color="#8E8E93" />
        </button>

        <div style={styles.content}>
          <div style={{
            ...styles.iconWrapper,
            backgroundColor: isDanger ? '#FEF2F0' : '#E3F2FF',
          }}>
            <AlertTriangle size={24} color={isDanger ? '#FF3B30' : '#007AFF'} />
          </div>

          <h3 style={styles.title}>{title}</h3>
          <p style={styles.message}>{message}</p>
        </div>

        <div style={styles.actions}>
          <button 
            style={styles.cancelBtn} 
            onClick={onCancel}
            disabled={isLoading}
          >
            {cancelLabel}
          </button>
          <button 
            style={{
              ...styles.confirmBtn,
              backgroundColor: isDanger ? '#FF3B30' : '#007AFF',
            }} 
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

const styles: any = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderRadius: '20px',
    padding: '32px',
    width: '100%',
    maxWidth: '400px',
    boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
    position: 'relative',
    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
    textAlign: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: '16px',
    right: '16px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '50%',
    transition: 'background-color 0.2s ease',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: '24px',
  },
  iconWrapper: {
    width: '56px',
    height: '56px',
    borderRadius: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '20px',
  },
  title: {
    fontSize: '20px',
    fontWeight: 600,
    color: '#1C1C1E',
    margin: '0 0 12px 0',
  },
  message: {
    fontSize: '15px',
    color: '#636366',
    lineHeight: 1.5,
    margin: 0,
  },
  actions: {
    display: 'flex',
    gap: '12px',
  },
  cancelBtn: {
    flex: 1,
    padding: '12px',
    borderRadius: '12px',
    border: '1px solid #E5E5EA',
    backgroundColor: '#FFFFFF',
    color: '#1C1C1E',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    fontFamily: 'inherit',
  },
  confirmBtn: {
    flex: 1,
    padding: '12px',
    borderRadius: '12px',
    border: 'none',
    color: '#FFFFFF',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    fontFamily: 'inherit',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  },
};
