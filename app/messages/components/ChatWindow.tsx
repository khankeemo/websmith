// PATH: C:\websmith\app\messages\components\ChatWindow.tsx
// Chat Window Component - Main chat interface

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Conversation, Message, SendMessageData } from '../services/messageService';
import ChatMessage from './ChatMessage';
import { Phone, Video, MoreVertical, Send, Paperclip, Smile } from 'lucide-react';

interface ChatWindowProps {
  conversation: Conversation | null;
  messages: Message[];
  onSendMessage: (data: SendMessageData) => Promise<void>;
  onDeleteMessage?: (messageId: string) => void;
  onTyping?: (isTyping: boolean) => void;
  sending?: boolean;
}

const ChatWindow: React.FC<ChatWindowProps> = ({
  conversation,
  messages,
  onSendMessage,
  onDeleteMessage,
  onTyping,
  sending = false,
}) => {
  const [newMessage, setNewMessage] = useState('');
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !conversation || sending) return;

    await onSendMessage({
      receiverId: conversation.participantId,
      content: newMessage,
      type: 'text',
    });

    setNewMessage('');
    
    // Reset height of textarea
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTyping = () => {
    if (onTyping) {
      onTyping(true);
      
      if (typingTimeout) clearTimeout(typingTimeout);
      
      const timeout = setTimeout(() => {
        if (onTyping) onTyping(false);
      }, 1000);
      
      setTypingTimeout(timeout);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    handleTyping();
    
    // Auto-resize textarea
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  if (!conversation) {
    return (
      <div style={styles.emptyState}>
        <div style={styles.emptyIcon}>💬</div>
        <h3>Select a conversation</h3>
        <p>Choose a conversation from the list to start messaging</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Chat Header */}
      <div style={styles.header}>
        <div style={styles.headerInfo}>
          <div style={styles.avatar}>
            {conversation.participantName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={styles.chatName}>{conversation.participantName}</div>
            <div style={styles.chatStatus}>
              {conversation.online ? (
                <span style={styles.onlineText}>● Online</span>
              ) : (
                <span style={styles.offlineText}>○ Offline</span>
              )}
            </div>
          </div>
        </div>
        <div style={styles.actions}>
          <button style={styles.actionBtn} className="chat-action">
            <Phone size={18} />
          </button>
          <button style={styles.actionBtn} className="chat-action">
            <Video size={18} />
          </button>
          <button style={styles.actionBtn} className="chat-action">
            <MoreVertical size={18} />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div style={styles.messagesArea}>
        {messages.length === 0 ? (
          <div style={styles.noMessages}>
            <div style={styles.noMessagesIcon}>💬</div>
            <p>No messages yet</p>
            <p style={styles.noMessagesSub}>Send a message to start the conversation</p>
          </div>
        ) : (
          messages.map((message, index) => {
            const showAvatar = index === 0 || messages[index - 1]?.senderId !== message.senderId;
            return (
              <ChatMessage
                key={message._id}
                message={message}
                showAvatar={showAvatar}
                onDelete={onDeleteMessage}
              />
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div style={styles.inputContainer}>
        <button style={styles.inputBtn} className="input-action">
          <Paperclip size={18} />
        </button>
        <textarea
          ref={inputRef}
          value={newMessage}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          placeholder="Type a message..."
          style={styles.messageInput}
          className="message-input"
          rows={1}
          disabled={sending}
        />
        <button style={styles.inputBtn} className="input-action">
          <Smile size={18} />
        </button>
        <button 
          onClick={handleSend} 
          style={{
            ...styles.sendBtn,
            ...(!newMessage.trim() && styles.sendBtnDisabled)
          }}
          className="send-btn"
          disabled={!newMessage.trim() || sending}
        >
          <Send size={18} />
        </button>
      </div>

      <style>{`
        .chat-action {
          transition: all 0.2s ease;
        }
        .chat-action:hover {
          background-color: #F2F2F7;
          transform: scale(1.05);
        }
        .input-action {
          transition: all 0.2s ease;
        }
        .input-action:hover {
          background-color: #F2F2F7;
          transform: scale(1.05);
        }
        .send-btn {
          transition: all 0.2s ease;
        }
        .send-btn:hover:not(:disabled) {
          background-color: #0055CC !important;
          transform: scale(1.05);
        }
        .message-input {
          transition: all 0.2s ease;
        }
        .message-input:focus {
          border-color: #007AFF !important;
          box-shadow: 0 0 0 3px rgba(0,122,255,0.1) !important;
        }
      `}</style>
    </div>
  );
};

const styles: any = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    height: '100%',
  },
  emptyState: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    backgroundColor: '#F9F9FB',
    textAlign: 'center',
  },
  emptyIcon: {
    fontSize: '64px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 24px',
    borderBottom: '1px solid #E5E5EA',
    backgroundColor: '#FFFFFF',
  },
  headerInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  avatar: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    backgroundColor: '#007AFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#FFFFFF',
    fontWeight: 600,
    fontSize: '18px',
  },
  chatName: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#1C1C1E',
  },
  chatStatus: {
    fontSize: '12px',
  },
  onlineText: {
    color: '#34C759',
  },
  offlineText: {
    color: '#8E8E93',
  },
  actions: {
    display: 'flex',
    gap: '8px',
  },
  actionBtn: {
    padding: '8px',
    background: 'none',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    color: '#8E8E93',
    transition: 'all 0.2s ease',
  },
  messagesArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    backgroundColor: '#FAFAFA',
  },
  noMessages: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    textAlign: 'center',
  },
  noMessagesIcon: {
    fontSize: '48px',
  },
  noMessagesSub: {
    fontSize: '13px',
    color: '#8E8E93',
  },
  inputContainer: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '12px',
    padding: '16px 24px',
    borderTop: '1px solid #E5E5EA',
    backgroundColor: '#FFFFFF',
  },
  inputBtn: {
    padding: '8px',
    background: 'none',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    color: '#8E8E93',
    transition: 'all 0.2s ease',
  },
  messageInput: {
    flex: 1,
    padding: '10px 16px',
    fontSize: '14px',
    border: '1px solid #E5E5EA',
    borderRadius: '20px',
    outline: 'none',
    resize: 'none',
    fontFamily: 'inherit',
    maxHeight: '100px',
    transition: 'all 0.2s ease',
  },
  sendBtn: {
    padding: '8px 12px',
    backgroundColor: '#007AFF',
    border: 'none',
    borderRadius: '20px',
    cursor: 'pointer',
    color: '#FFFFFF',
    transition: 'all 0.2s ease',
  },
  sendBtnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
};

export default ChatWindow;