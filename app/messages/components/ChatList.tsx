// PATH: C:\websmith\app\messages\components\ChatList.tsx
// Chat List Component - Display list of conversations

'use client';

import React, { useState } from 'react';
import { Conversation } from '../services/messageService';
import { Search, MoreVertical, CheckCheck, Clock } from 'lucide-react';

interface ChatListProps {
  conversations: Conversation[];
  selectedConversation: Conversation | null;
  onSelectConversation: (conversation: Conversation) => void;
  loading?: boolean;
}

const formatTime = (timestamp: string) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getDate() - date.getDate();
  
  if (diff === 0) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } else if (diff === 1) {
    return 'Yesterday';
  } else if (diff < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
};

const truncateText = (text: string, maxLength: number = 50) => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

const ChatList: React.FC<ChatListProps> = ({ 
  conversations, 
  selectedConversation, 
  onSelectConversation,
  loading 
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredConversations = conversations.filter(conv =>
    conv.participantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conv.participantRole.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conv.participantEmail.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p>Loading conversations...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Search Header */}
      <div style={styles.header}>
        <h2 style={styles.title}>Messages</h2>
        <div style={styles.searchWrapper}>
          <Search size={16} style={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
            className="search-input"
          />
        </div>
      </div>

      {/* Conversations List */}
      <div style={styles.conversationsList}>
        {filteredConversations.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>💬</div>
            <p>No conversations found</p>
          </div>
        ) : (
          filteredConversations.map((conv) => (
            <div
              key={conv._id}
              onClick={() => onSelectConversation(conv)}
              style={{
                ...styles.conversationItem,
                ...(selectedConversation?._id === conv._id ? styles.conversationItemActive : {})
              }}
              className="conv-item"
            >
              {/* Avatar */}
              <div style={styles.avatarContainer}>
                <div style={styles.avatar}>
                  {conv.participantName.charAt(0).toUpperCase()}
                </div>
                {conv.online && <div style={styles.onlineDot}></div>}
              </div>

              {/* Content */}
              <div style={styles.conversationContent}>
                <div style={styles.conversationHeader}>
                  <span style={styles.conversationName}>{conv.participantName}</span>
                  <span style={styles.conversationTime}>
                    {formatTime(conv.lastMessageTime)}
                  </span>
                </div>
                <div style={styles.conversationSubheader}>
                  <span style={styles.conversationRole}>{conv.participantRole}</span>
                </div>
                <div style={styles.lastMessageContainer}>
                  {conv.lastMessageSender === 'me' && (
                    <CheckCheck size={12} style={styles.deliveryIcon} />
                  )}
                  <span style={styles.lastMessage}>
                    {truncateText(conv.lastMessage, 35)}
                  </span>
                </div>
              </div>

              {/* Unread Badge */}
              {conv.unreadCount > 0 && (
                <div style={styles.unreadBadge}>
                  {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <style>{`
        .search-input:focus {
          border-color: #007AFF !important;
          box-shadow: 0 0 0 3px rgba(0,122,255,0.1) !important;
        }
        .conv-item {
          transition: all 0.2s ease;
        }
        .conv-item:hover {
          background-color: #F2F2F7;
        }
      `}</style>
    </div>
  );
};

const styles: any = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRight: '1px solid #E5E5EA',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: '16px',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid #E5E5EA',
    borderTopColor: '#007AFF',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  header: {
    padding: '20px',
    borderBottom: '1px solid #E5E5EA',
  },
  title: {
    fontSize: '20px',
    fontWeight: 600,
    color: '#1C1C1E',
    marginBottom: '16px',
  },
  searchWrapper: {
    position: 'relative',
  },
  searchIcon: {
    position: 'absolute',
    left: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#8E8E93',
  },
  searchInput: {
    width: '100%',
    padding: '10px 12px 10px 36px',
    fontSize: '14px',
    border: '1px solid #E5E5EA',
    borderRadius: '10px',
    outline: 'none',
    backgroundColor: '#F9F9FB',
    transition: 'all 0.2s ease',
  },
  conversationsList: {
    flex: 1,
    overflowY: 'auto',
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    color: '#8E8E93',
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '16px',
  },
  conversationItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '16px 20px',
    cursor: 'pointer',
    borderBottom: '1px solid #F5F5F7',
    transition: 'all 0.2s ease',
    position: 'relative',
  },
  conversationItemActive: {
    backgroundColor: '#E3F2FF',
  },
  avatarContainer: {
    position: 'relative',
    flexShrink: 0,
  },
  avatar: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    backgroundColor: '#007AFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#FFFFFF',
    fontWeight: 600,
    fontSize: '18px',
  },
  onlineDot: {
    position: 'absolute',
    bottom: '2px',
    right: '2px',
    width: '12px',
    height: '12px',
    backgroundColor: '#34C759',
    borderRadius: '50%',
    border: '2px solid #FFFFFF',
  },
  conversationContent: {
    flex: 1,
    minWidth: 0,
  },
  conversationHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: '4px',
  },
  conversationName: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#1C1C1E',
  },
  conversationTime: {
    fontSize: '11px',
    color: '#8E8E93',
  },
  conversationSubheader: {
    marginBottom: '6px',
  },
  conversationRole: {
    fontSize: '12px',
    color: '#007AFF',
  },
  lastMessageContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  deliveryIcon: {
    flexShrink: 0,
    color: '#34C759',
  },
  lastMessage: {
    fontSize: '13px',
    color: '#6C6C70',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  unreadBadge: {
    flexShrink: 0,
    padding: '2px 8px',
    backgroundColor: '#007AFF',
    color: '#FFFFFF',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: 600,
    minWidth: '20px',
    textAlign: 'center',
  },
};

export default ChatList;