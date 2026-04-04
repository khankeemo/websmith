// PATH: C:\websmith\app\messages\components\ChatMessage.tsx
// Chat Message Component - Individual message bubble

'use client';

import React, { useState } from 'react';
import { Message } from '../services/messageService';
import { Check, CheckCheck, Clock } from 'lucide-react';

interface ChatMessageProps {
  message: Message;
  showAvatar?: boolean;
  onDelete?: (messageId: string) => void;
}

const formatTime = (timestamp: string) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'sent':
      return <Clock size={12} color="#8E8E93" />;
    case 'delivered':
      return <Check size={12} color="#8E8E93" />;
    case 'read':
      return <CheckCheck size={12} color="#34C759" />;
    default:
      return <Clock size={12} color="#8E8E93" />;
  }
};

const ChatMessage: React.FC<ChatMessageProps> = ({ 
  message, 
  showAvatar = true,
  onDelete 
}) => {
  const [showActions, setShowActions] = useState(false);
  const isOwn = message.senderId === 'current-user' || message.senderName === 'You';

  return (
    <div 
      style={{
        ...styles.container,
        justifyContent: isOwn ? 'flex-end' : 'flex-start',
      }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      className="message-container"
    >
      {/* Avatar (only for other user messages) */}
      {!isOwn && showAvatar && (
        <div style={styles.avatar}>
          {message.senderName?.charAt(0).toUpperCase() || 'U'}
        </div>
      )}
      
      {/* Spacer for alignment when no avatar */}
      {!isOwn && !showAvatar && <div style={styles.avatarSpacer} />}

      {/* Message Bubble */}
      <div style={{ maxWidth: '70%' }}>
        {/* Sender name (only for other user, first message in group) */}
        {!isOwn && showAvatar && (
          <div style={styles.senderName}>{message.senderName}</div>
        )}
        
        <div
          style={{
            ...styles.bubble,
            ...(isOwn ? styles.bubbleOwn : styles.bubbleOther),
          }}
          className="message-bubble"
        >
          <span>{message.content}</span>
        </div>
        
        {/* Message Meta */}
        <div style={styles.meta}>
          <span style={styles.time}>{formatTime(message.timestamp)}</span>
          {isOwn && (
            <span style={styles.statusIcon}>
              {getStatusIcon(message.status)}
            </span>
          )}
        </div>
      </div>

      {/* Actions Menu (on hover) */}
      {showActions && isOwn && onDelete && (
        <div style={styles.actionsMenu}>
          <button 
            onClick={() => onDelete(message._id)}
            style={styles.deleteBtn}
            className="delete-btn"
          >
            Delete
          </button>
        </div>
      )}

      <style>{`
        .message-container {
          animation: fadeIn 0.2s ease;
        }
        .message-bubble {
          transition: all 0.2s ease;
        }
        .message-bubble:hover {
          transform: scale(1.02);
        }
        .delete-btn {
          transition: all 0.2s ease;
        }
        .delete-btn:hover {
          background-color: #FF3B30 !important;
          color: white !important;
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

const styles: any = {
  container: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '8px',
    position: 'relative',
  },
  avatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: '#007AFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#FFFFFF',
    fontSize: '14px',
    fontWeight: 600,
    flexShrink: 0,
  },
  avatarSpacer: {
    width: '32px',
    flexShrink: 0,
  },
  senderName: {
    fontSize: '12px',
    fontWeight: 500,
    color: '#8E8E93',
    marginBottom: '4px',
    marginLeft: '4px',
  },
  bubble: {
    padding: '10px 14px',
    borderRadius: '18px',
    fontSize: '14px',
    lineHeight: 1.4,
    wordBreak: 'break-word' as const,
  },
  bubbleOwn: {
    backgroundColor: '#007AFF',
    color: '#FFFFFF',
    borderBottomRightRadius: '4px',
  },
  bubbleOther: {
    backgroundColor: '#F2F2F7',
    color: '#1C1C1E',
    borderBottomLeftRadius: '4px',
  },
  meta: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '4px',
    marginTop: '4px',
    marginRight: '4px',
  },
  time: {
    fontSize: '10px',
    color: '#8E8E93',
  },
  statusIcon: {
    display: 'inline-flex',
    alignItems: 'center',
  },
  actionsMenu: {
    position: 'absolute',
    right: '0',
    top: '-30px',
    backgroundColor: '#FFFFFF',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    border: '1px solid #E5E5EA',
    zIndex: 10,
  },
  deleteBtn: {
    padding: '6px 12px',
    fontSize: '12px',
    backgroundColor: '#FFFFFF',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    color: '#FF3B30',
    transition: 'all 0.2s ease',
  },
};

export default ChatMessage;