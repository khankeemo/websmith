// PATH: C:\websmith\app\messages\page.tsx
// Messages Page - Internal chat and messaging system
// Features: Chat list, real-time messages, conversation management

"use client";

import { useState, useEffect, useRef } from "react";
import { 
  Search, 
  Send, 
  Paperclip, 
  MoreVertical,
  Phone,
  Video,
  Smile,
  Check,
  CheckCheck,
  Clock
} from "lucide-react";

interface Message {
  _id: string;
  senderId: string;
  receiverId: string;
  content: string;
  type: "text" | "image" | "file";
  status: "sent" | "delivered" | "read";
  timestamp: string;
}

interface Conversation {
  _id: string;
  participantId: string;
  participantName: string;
  participantAvatar: string;
  participantRole: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  online: boolean;
}

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation._id);
    }
  }, [selectedConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchConversations = async () => {
    const token = localStorage.getItem("token");
    try {
      const response = await fetch("http://localhost:5000/api/messages/conversations", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setConversations(data.data || sampleConversations);
      }
    } catch (error) {
      console.error("Fetch conversations error:", error);
      setConversations(sampleConversations);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    const token = localStorage.getItem("token");
    try {
      const response = await fetch(`http://localhost:5000/api/messages/${conversationId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setMessages(data.data || sampleMessages);
      }
    } catch (error) {
      console.error("Fetch messages error:", error);
      setMessages(sampleMessages);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    const token = localStorage.getItem("token");
    const tempMessage: Message = {
      _id: Date.now().toString(),
      senderId: "current-user",
      receiverId: selectedConversation.participantId,
      content: newMessage,
      type: "text",
      status: "sent",
      timestamp: new Date().toISOString()
    };

    setMessages([...messages, tempMessage]);
    setNewMessage("");

    try {
      const response = await fetch("http://localhost:5000/api/messages/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          receiverId: selectedConversation.participantId,
          content: newMessage
        })
      });
    } catch (error) {
      console.error("Send message error:", error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "sent": return <Clock size={12} color="#8E8E93" />;
      case "delivered": return <Check size={12} color="#8E8E93" />;
      case "read": return <CheckCheck size={12} color="#34C759" />;
      default: return <Clock size={12} color="#8E8E93" />;
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getDate() - date.getDate();
    
    if (diff === 0) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else if (diff === 1) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const filteredConversations = conversations.filter(conv =>
    conv.participantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conv.participantRole.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p>Loading messages...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Chat Sidebar - FIXED OVERFLOW */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <h2 style={styles.sidebarTitle}>Messages</h2>
          <div style={styles.searchWrapper}>
            <Search size={16} style={styles.searchIconSmall} />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={styles.searchInputSmall}
              className="input-focus"
            />
          </div>
        </div>
        <div style={styles.conversationsList}>
          {filteredConversations.map((conv) => (
            <div
              key={conv._id}
              onClick={() => setSelectedConversation(conv)}
              style={{
                ...styles.conversationItem,
                ...(selectedConversation?._id === conv._id ? styles.conversationItemActive : {})
              }}
              className="conv-item"
            >
              <div style={styles.avatarContainer}>
                <div style={styles.avatar}>
                  {conv.participantName.charAt(0)}
                </div>
                {conv.online && <div style={styles.onlineDot}></div>}
              </div>
              <div style={styles.conversationInfo}>
                <div style={styles.conversationName}>{conv.participantName}</div>
                <div style={styles.conversationRole}>{conv.participantRole}</div>
                <div style={styles.lastMessage}>{conv.lastMessage}</div>
              </div>
              <div style={styles.conversationMeta}>
                <div style={styles.lastTime}>{formatTime(conv.lastMessageTime)}</div>
                {conv.unreadCount > 0 && (
                  <div style={styles.unreadBadge}>{conv.unreadCount}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      {selectedConversation ? (
        <div style={styles.chatArea}>
          {/* Chat Header */}
          <div style={styles.chatHeader}>
            <div style={styles.chatHeaderInfo}>
              <div style={styles.chatAvatar}>
                {selectedConversation.participantName.charAt(0)}
              </div>
              <div>
                <div style={styles.chatName}>{selectedConversation.participantName}</div>
                <div style={styles.chatRole}>{selectedConversation.participantRole}</div>
              </div>
            </div>
            <div style={styles.chatActions}>
              <button style={styles.chatActionBtn} className="chat-action">
                <Phone size={18} />
              </button>
              <button style={styles.chatActionBtn} className="chat-action">
                <Video size={18} />
              </button>
              <button style={styles.chatActionBtn} className="chat-action">
                <MoreVertical size={18} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div style={styles.messagesArea}>
            {messages.map((message) => {
              const isOwn = message.senderId === "current-user";
              return (
                <div
                  key={message._id}
                  style={{
                    ...styles.messageWrapper,
                    justifyContent: isOwn ? "flex-end" : "flex-start"
                  }}
                >
                  {!isOwn && (
                    <div style={styles.messageAvatar}>
                      {selectedConversation.participantName.charAt(0)}
                    </div>
                  )}
                  <div style={{ maxWidth: "70%" }}>
                    <div
                      style={{
                        ...styles.messageBubble,
                        ...(isOwn ? styles.messageBubbleOwn : styles.messageBubbleOther)
                      }}
                      className="message-bubble"
                    >
                      {message.content}
                    </div>
                    <div style={styles.messageMeta}>
                      <span style={styles.messageTime}>{formatTime(message.timestamp)}</span>
                      {isOwn && getStatusIcon(message.status)}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div style={styles.messageInputContainer}>
            <button style={styles.attachBtn} className="input-action">
              <Paperclip size={18} />
            </button>
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              style={styles.messageInput}
              className="message-input"
              rows={1}
            />
            <button style={styles.emojiBtn} className="input-action">
              <Smile size={18} />
            </button>
            <button onClick={sendMessage} style={styles.sendBtn} className="send-btn">
              <Send size={18} />
            </button>
          </div>
        </div>
      ) : (
        <div style={styles.noChatSelected}>
          <div style={styles.noChatIcon}>💬</div>
          <h3>Select a conversation</h3>
          <p>Choose a conversation from the list to start messaging</p>
        </div>
      )}

      <style>{`
        .input-focus:focus {
          border-color: #007AFF !important;
          box-shadow: 0 0 0 3px rgba(0,122,255,0.1) !important;
          outline: none;
        }
        .conv-item {
          transition: all 0.2s ease;
        }
        .conv-item:hover {
          background-color: #F2F2F7;
        }
        .message-bubble {
          transition: all 0.2s ease;
        }
        .message-bubble:hover {
          transform: scale(1.02);
        }
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
        .send-btn:hover {
          background-color: #0055CC !important;
          transform: scale(1.05);
        }
        .message-input {
          transition: all 0.2s ease;
        }
        .message-input:focus {
          border-color: #007AFF !important;
          box-shadow: 0 0 0 3px rgba(0,122,255,0.1) !important;
          outline: none;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        * {
          box-sizing: border-box;
        }
      `}</style>
    </div>
  );
}

// Sample data for demo
const sampleConversations: Conversation[] = [
  {
    _id: "1",
    participantId: "2",
    participantName: "Sarah Johnson",
    participantAvatar: "S",
    participantRole: "Project Manager",
    lastMessage: "The project is on track for Friday",
    lastMessageTime: new Date().toISOString(),
    unreadCount: 2,
    online: true
  },
  {
    _id: "2",
    participantId: "3",
    participantName: "Michael Chen",
    participantAvatar: "M",
    participantRole: "Lead Developer",
    lastMessage: "I've pushed the latest updates",
    lastMessageTime: new Date(Date.now() - 3600000).toISOString(),
    unreadCount: 0,
    online: true
  },
  {
    _id: "3",
    participantId: "4",
    participantName: "Emily Rodriguez",
    participantAvatar: "E",
    participantRole: "UI/UX Designer",
    lastMessage: "Here are the new mockups",
    lastMessageTime: new Date(Date.now() - 86400000).toISOString(),
    unreadCount: 0,
    online: false
  }
];

const sampleMessages: Message[] = [
  {
    _id: "1",
    senderId: "other",
    receiverId: "current-user",
    content: "Hey! How's the project going?",
    type: "text",
    status: "read",
    timestamp: new Date(Date.now() - 3600000).toISOString()
  },
  {
    _id: "2",
    senderId: "current-user",
    receiverId: "other",
    content: "Going great! Almost done with the frontend.",
    type: "text",
    status: "read",
    timestamp: new Date(Date.now() - 3500000).toISOString()
  },
  {
    _id: "3",
    senderId: "other",
    receiverId: "current-user",
    content: "Awesome! Let me know if you need anything.",
    type: "text",
    status: "read",
    timestamp: new Date(Date.now() - 3400000).toISOString()
  }
];

const styles: any = {
  container: {
    display: "flex",
    height: "calc(100vh - 80px)",
    backgroundColor: "#FFFFFF",
    borderRadius: "20px",
    overflow: "hidden",
    margin: "20px",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  loadingContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "calc(100vh - 80px)",
    gap: "16px",
  },
  spinner: {
    width: "40px",
    height: "40px",
    border: "3px solid #E5E5EA",
    borderTopColor: "#007AFF",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  sidebar: {
    width: "320px",
    minWidth: "320px",
    maxWidth: "320px",
    borderRight: "1px solid #E5E5EA",
    display: "flex",
    flexDirection: "column" as const,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  sidebarHeader: {
    padding: "20px",
    borderBottom: "1px solid #E5E5EA",
  },
  sidebarTitle: {
    fontSize: "20px",
    fontWeight: 600,
    marginBottom: "16px",
    color: "#1C1C1E",
  },
  searchWrapper: {
    position: "relative",
    width: "100%",
    overflow: "hidden",
  },
  searchIconSmall: {
    position: "absolute",
    left: "12px",
    top: "50%",
    transform: "translateY(-50%)",
    color: "#8E8E93",
    zIndex: 1,
  },
  searchInputSmall: {
    width: "100%",
    padding: "10px 12px 10px 36px",
    fontSize: "14px",
    border: "1px solid #E5E5EA",
    borderRadius: "10px",
    outline: "none",
    backgroundColor: "#F9F9FB",
    boxSizing: "border-box" as const,
  },
  conversationsList: {
    flex: 1,
    overflowY: "auto" as const,
  },
  conversationItem: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "16px 20px",
    cursor: "pointer",
    borderBottom: "1px solid #F5F5F7",
    transition: "all 0.2s ease",
  },
  conversationItemActive: {
    backgroundColor: "#E3F2FF",
  },
  avatarContainer: {
    position: "relative" as const,
    flexShrink: 0,
  },
  avatar: {
    width: "48px",
    height: "48px",
    borderRadius: "50%",
    backgroundColor: "#007AFF",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#FFFFFF",
    fontWeight: 600,
    fontSize: "18px",
  },
  onlineDot: {
    position: "absolute",
    bottom: "2px",
    right: "2px",
    width: "12px",
    height: "12px",
    backgroundColor: "#34C759",
    borderRadius: "50%",
    border: "2px solid #FFFFFF",
  },
  conversationInfo: {
    flex: 1,
    minWidth: 0, // Allows text truncation
  },
  conversationName: {
    fontSize: "15px",
    fontWeight: 600,
    color: "#1C1C1E",
    marginBottom: "2px",
  },
  conversationRole: {
    fontSize: "12px",
    color: "#8E8E93",
    marginBottom: "4px",
  },
  lastMessage: {
    fontSize: "13px",
    color: "#6C6C70",
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  conversationMeta: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "flex-end",
    gap: "4px",
    flexShrink: 0,
  },
  lastTime: {
    fontSize: "11px",
    color: "#8E8E93",
  },
  unreadBadge: {
    padding: "2px 6px",
    backgroundColor: "#007AFF",
    color: "#FFFFFF",
    borderRadius: "10px",
    fontSize: "11px",
    fontWeight: 600,
  },
  chatArea: {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    backgroundColor: "#FFFFFF",
    minWidth: 0, // Prevents flex overflow
  },
  chatHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 24px",
    borderBottom: "1px solid #E5E5EA",
  },
  chatHeaderInfo: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  chatAvatar: {
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    backgroundColor: "#007AFF",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#FFFFFF",
    fontWeight: 600,
  },
  chatName: {
    fontSize: "16px",
    fontWeight: 600,
    color: "#1C1C1E",
  },
  chatRole: {
    fontSize: "12px",
    color: "#8E8E93",
  },
  chatActions: {
    display: "flex",
    gap: "8px",
  },
  chatActionBtn: {
    padding: "8px",
    background: "none",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    color: "#8E8E93",
  },
  messagesArea: {
    flex: 1,
    overflowY: "auto" as const,
    padding: "24px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "16px",
  },
  messageWrapper: {
    display: "flex",
    gap: "8px",
  },
  messageAvatar: {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    backgroundColor: "#007AFF",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#FFFFFF",
    fontSize: "14px",
    fontWeight: 600,
    flexShrink: 0,
  },
  messageBubble: {
    padding: "10px 14px",
    borderRadius: "18px",
    fontSize: "14px",
    lineHeight: 1.4,
    wordBreak: "break-word" as const,
  },
  messageBubbleOwn: {
    backgroundColor: "#007AFF",
    color: "#FFFFFF",
    borderBottomRightRadius: "4px",
  },
  messageBubbleOther: {
    backgroundColor: "#F2F2F7",
    color: "#1C1C1E",
    borderBottomLeftRadius: "4px",
  },
  messageMeta: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "4px",
    marginTop: "4px",
  },
  messageTime: {
    fontSize: "10px",
    color: "#8E8E93",
  },
  messageInputContainer: {
    display: "flex",
    alignItems: "flex-end",
    gap: "12px",
    padding: "16px 24px",
    borderTop: "1px solid #E5E5EA",
    backgroundColor: "#FFFFFF",
  },
  attachBtn: {
    padding: "8px",
    background: "none",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    color: "#8E8E93",
  },
  emojiBtn: {
    padding: "8px",
    background: "none",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    color: "#8E8E93",
  },
  messageInput: {
    flex: 1,
    padding: "10px 16px",
    fontSize: "14px",
    border: "1px solid #E5E5EA",
    borderRadius: "20px",
    outline: "none",
    resize: "none" as const,
    fontFamily: "inherit",
    maxHeight: "100px",
  },
  sendBtn: {
    padding: "8px 12px",
    backgroundColor: "#007AFF",
    border: "none",
    borderRadius: "20px",
    cursor: "pointer",
    color: "#FFFFFF",
  },
  noChatSelected: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "16px",
    backgroundColor: "#F9F9FB",
  },
  noChatIcon: {
    fontSize: "64px",
  },
};