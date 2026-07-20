// PATH: C:\websmith\app\messages\page.tsx
// Messages Page - Internal chat and messaging system

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
  Clock,
  ArrowLeft
} from "lucide-react";
import API from "@/core/services/apiService";
import { getStoredUser } from "@/lib/auth";
import { ViewModeToggle, GridListView } from "@/components/ui/ViewModeToggle";

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
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [convViewMode, setConvViewMode] = useState<GridListView>("grid");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const u = getStoredUser();
    setCurrentUserId(u?.id ?? null);
  }, []);

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    if (selectedConversation) {
      const peerId = selectedConversation.participantId || selectedConversation._id;
      fetchMessages(peerId);
      setShowMobileChat(true);
      API.patch(`/messages/conversations/${peerId}/read`).catch(() => {});
      fetchConversations();
    }
  }, [selectedConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchConversations = async () => {
    try {
      setLoadError(null);
      const response = await API.get("/messages/conversations");
      const list = Array.isArray(response.data.data) ? response.data.data : [];
      setConversations(list);
    } catch (error: any) {
      console.error("Fetch conversations error:", error);
      setLoadError(error?.response?.data?.message || "Could not load conversations.");
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (peerId: string) => {
    try {
      const response = await API.get(`/messages/${peerId}`);
      const list = Array.isArray(response.data.data) ? response.data.data : [];
      setMessages(list);
    } catch (error: any) {
      console.error("Fetch messages error:", error);
      setMessages([]);
    }
  };

  const sendMessage = async (payload?: { content: string; type: "text" | "image" | "file" }) => {
    if (!selectedConversation) return;

    const content = payload?.content ?? newMessage.trim();
    const type = payload?.type ?? "text";
    if (!content) return;

    const receiverId = selectedConversation.participantId || selectedConversation._id;
    const optimistic: Message = {
      _id: `temp-${Date.now()}`,
      senderId: currentUserId || "me",
      receiverId,
      content,
      type,
      status: "sent",
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimistic]);
    if (type === "text") {
      setNewMessage("");
    }

    try {
      const response = await API.post("/messages/send", {
        receiverId,
        content,
        type,
      });
      const saved = response.data?.data;
      if (saved?._id) {
        setMessages((prev) =>
          prev.map((m) => (m._id === optimistic._id ? { ...saved, timestamp: saved.timestamp || optimistic.timestamp } : m))
        );
      } else {
        await fetchMessages(receiverId);
      }
      await fetchConversations();
    } catch (error: any) {
      console.error("Send message error:", error);
      setMessages((prev) => prev.filter((m) => m._id !== optimistic._id));
      if (type === "text") {
        setNewMessage(content);
      }
      alert(error?.response?.data?.message || "Failed to send message.");
    }
  };

  const handleAttachmentSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";

    if (!file || !selectedConversation) {
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadResponse = await API.post("/messages/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const uploadData = uploadResponse.data?.data;
      if (!uploadData?.url || !uploadData?.type) {
        throw new Error("Attachment upload did not return a usable file.");
      }

      await sendMessage({ content: uploadData.url, type: uploadData.type });
    } catch (error: any) {
      console.error("Attachment upload error:", error);
      alert(error?.response?.data?.message || "Failed to upload attachment.");
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
      case "sent": return <Clock size={12} color="var(--text-secondary)" />;
      case "delivered": return <Check size={12} color="var(--text-secondary)" />;
      case "read": return <CheckCheck size={12} color="#34C759" />;
      default: return <Clock size={12} color="var(--text-secondary)" />;
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

  const renderMessageContent = (message: Message) => {
    if (message.type === "image") {
      return (
        <img
          src={message.content}
          alt="Attachment"
          style={styles.messageImage}
        />
      );
    }

    if (message.type === "file") {
      return (
        <a
          href={message.content}
          target="_blank"
          rel="noreferrer"
          style={styles.fileLink}
        >
          Open attachment
        </a>
      );
    }

    return message.content;
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p style={{ color: 'var(--text-secondary)' }}>Loading messages...</p>
      </div>
    );
  }

  if (!currentUserId) {
    return (
      <div style={styles.loadingContainer}>
        <p style={{ color: "var(--text-secondary)" }}>Please log in to use messages.</p>
      </div>
    );
  }

  return (
    <div style={styles.container} className="messages-page-shell">
      {/* Chat Sidebar */}
      <div
        style={{
          ...styles.sidebar,
          ...(showMobileChat ? styles.mobileSidebarHidden : {}),
        }}
        className="messages-sidebar"
      >
        <div style={styles.sidebarHeader}>
          <h2 style={styles.sidebarTitle}>Messages</h2>
          {loadError && (
            <p style={{ color: "#FF3B30", fontSize: "13px", marginBottom: "12px" }}>{loadError}</p>
          )}
          <div style={styles.searchRow}>
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
            <ViewModeToggle value={convViewMode} onChange={setConvViewMode} />
          </div>
        </div>
        <div
          style={{
            ...styles.conversationsList,
            ...(convViewMode === "grid" ? styles.conversationsGrid : {}),
          }}
        >
          {filteredConversations.length === 0 && !loadError && (
            <p style={{ padding: "24px", color: "var(--text-secondary)", fontSize: "14px", textAlign: "center" }}>
              No conversations yet. Messages appear here after someone sends you a message or you reply from another screen.
            </p>
          )}
          {filteredConversations.map((conv) => (
            <div
              key={conv._id}
              onClick={() => {
                setSelectedConversation(conv);
                setShowMobileChat(true);
              }}
              style={{
                ...styles.conversationItem,
                ...(convViewMode === "grid" ? styles.conversationItemGrid : {}),
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
                <div style={styles.lastMessageText}>{conv.lastMessage}</div>
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
        <div
          style={{
            ...styles.chatArea,
            ...(!showMobileChat ? styles.mobileChatHidden : {}),
          }}
          className="messages-chat-area"
        >
          {/* Chat Header */}
          <div style={styles.chatHeader}>
            <div style={styles.chatHeaderInfo}>
              <button
                onClick={() => setShowMobileChat(false)}
                style={styles.mobileBackButton}
                className="messages-mobile-back"
              >
                <ArrowLeft size={18} />
              </button>
              <div style={styles.chatAvatar}>
                {selectedConversation.participantName.charAt(0)}
              </div>
              <div>
                <div style={styles.chatName}>{selectedConversation.participantName}</div>
                <div style={styles.chatRole}>{selectedConversation.participantRole}</div>
              </div>
            </div>
          <div style={styles.chatActions} className="messages-chat-actions">
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
              const isOwn = currentUserId ? message.senderId === currentUserId : false;
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
                  <div style={{ maxWidth: "75%" }} className="messages-bubble-wrap">
                    <div
                      style={{
                        ...styles.messageBubble,
                        ...(isOwn ? styles.messageBubbleOwn : styles.messageBubbleOther)
                      }}
                      className="message-bubble"
                    >
                      {renderMessageContent(message)}
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
          <div style={styles.messageInputContainer} className="messages-input-row">
            <input
              ref={attachmentInputRef}
              type="file"
              onChange={handleAttachmentSelect}
              style={{ display: "none" }}
              accept="image/*,.pdf,.txt,.doc,.docx,.xls,.xlsx"
            />
            <button
              style={styles.attachBtn}
              className="chat-input-btn"
              onClick={() => attachmentInputRef.current?.click()}
            >
              <Paperclip size={20} />
            </button>
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              style={styles.messageInput}
              rows={1}
            />
            <button style={styles.emojiBtn} className="chat-input-btn">
              <Smile size={20} />
            </button>
            <button onClick={() => { void sendMessage(); }} style={styles.sendBtn} className="send-btn">
              <Send size={18} />
            </button>
          </div>
        </div>
      ) : (
        <div style={styles.noChatSelected}>
          <div style={styles.noChatIcon}>💬</div>
          <h3 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>Select a conversation</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Choose a teammate from the list to start messaging</p>
        </div>
      )}

      <style>{`
        .input-focus:focus {
          border-color: #007AFF !important;
          box-shadow: 0 0 0 3px rgba(0,122,255,0.1) !important;
          outline: none;
        }
        .conv-item { transition: all 0.2s ease; border-left: 3px solid transparent; }
        .conv-item:hover { background-color: var(--bg-secondary); }
        .message-bubble { transition: all 0.2s ease; position: relative; }
        .chat-action, .chat-input-btn { transition: all 0.2s ease; border-radius: 10px; }
        .chat-action:hover, .chat-input-btn:hover { background-color: var(--bg-secondary); color: #007AFF !important; }
        .send-btn { transition: all 0.25s ease; border: none; }
        .send-btn:hover { background-color: #0055CC !important; transform: scale(1.05); }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 900px) {
          .messages-page-shell { margin: 8px !important; height: calc(100vh - 96px) !important; }
          .messages-mobile-back { display: flex !important; margin-right: 8px; }
          .messages-sidebar,
          .messages-chat-area {
            width: 100% !important;
            min-width: 0 !important;
          }
          .messages-chat-actions {
            gap: 6px !important;
          }
          .messages-input-row {
            gap: 10px !important;
            padding: 16px !important;
          }
          .messages-bubble-wrap {
            max-width: 88% !important;
          }
        }
        @media (max-width: 640px) {
          .messages-page-shell {
            margin: 0 !important;
            border-radius: 18px !important;
            height: calc(100vh - 88px) !important;
          }
          .messages-chat-actions button:nth-child(2),
          .messages-chat-actions button:nth-child(3) {
            display: none !important;
          }
          .messages-input-row {
            display: grid !important;
            grid-template-columns: auto 1fr auto auto;
            align-items: end !important;
          }
        }
      `}</style>
    </div>
  );
}

const styles: any = {
  container: {
    display: "flex",
    height: "calc(100dvh - 2 * var(--space-page-y) - 8px)",
    maxHeight: "calc(100dvh - 2 * var(--space-page-y) - 8px)",
    backgroundColor: "var(--bg-primary)",
    borderRadius: "24px",
    overflow: "hidden",
    margin: "var(--space-page-y) var(--space-page-x)",
    border: "1.5px solid var(--border-color)",
    boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
    boxSizing: "border-box",
  },
  loadingContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "calc(100vh - 40px)",
    gap: "16px",
  },
  spinner: {
    width: "40px",
    height: "40px",
    border: "3px solid var(--border-color)",
    borderTopColor: "#007AFF",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  sidebar: {
    width: "360px",
    minWidth: "320px",
    borderRight: "1.5px solid var(--border-color)",
    display: "flex",
    flexDirection: "column",
    backgroundColor: "var(--bg-primary)",
  },
  mobileSidebarHidden: { display: "none" },
  sidebarHeader: {
    padding: "32px 24px 24px",
    borderBottom: "1.5px solid var(--border-color)",
  },
  sidebarTitle: {
    fontSize: "24px",
    fontWeight: 700,
    marginBottom: "20px",
    color: "var(--text-primary)",
    letterSpacing: '-0.5px'
  },
  searchRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap" as const,
  },
  searchWrapper: { position: "relative", flex: 1, minWidth: "160px" },
  searchIconSmall: { position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)" },
  searchInputSmall: {
    width: "100%",
    padding: "12px 16px 12px 42px",
    fontSize: "14px",
    border: "1.5px solid var(--border-color)",
    borderRadius: "14px",
    backgroundColor: "var(--bg-secondary)",
    color: 'var(--text-primary)',
    outline: "none",
  },
  conversationsList: { flex: 1, overflowY: "auto" },
  conversationsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "10px",
    padding: "12px",
    alignContent: "start",
  },
  conversationItem: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    padding: "18px 24px",
    cursor: "pointer",
    borderBottom: "1px solid var(--border-color)",
  },
  conversationItemGrid: {
    flexDirection: "column" as const,
    alignItems: "stretch",
    padding: "14px",
    border: "1px solid var(--border-color)",
    borderRadius: "14px",
    borderBottom: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-secondary)",
  },
  conversationItemActive: {
    backgroundColor: "rgba(0, 122, 255, 0.08)",
    borderLeftColor: "#007AFF",
  },
  avatarContainer: { position: "relative", flexShrink: 0 },
  avatar: {
    width: "54px",
    height: "54px",
    borderRadius: "18px",
    backgroundColor: "#007AFF",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#FFFFFF",
    fontWeight: 700,
    fontSize: "20px",
  },
  onlineDot: {
    position: "absolute",
    bottom: "-2px",
    right: "-2px",
    width: "14px",
    height: "14px",
    backgroundColor: "#34C759",
    borderRadius: "50%",
    border: "2.5px solid var(--bg-primary)",
  },
  conversationInfo: { flex: 1, minWidth: 0 },
  conversationName: { fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" },
  conversationRole: { fontSize: "12px", color: "var(--text-secondary)", marginBottom: "6px", fontWeight: 500 },
  lastMessageText: { fontSize: "13px", color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  conversationMeta: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" },
  lastTime: { fontSize: "11px", color: "var(--text-secondary)", fontWeight: 500 },
  unreadBadge: { padding: "3px 8px", backgroundColor: "#007AFF", color: "#FFFFFF", borderRadius: "10px", fontSize: "10px", fontWeight: 800 },
  chatArea: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    backgroundColor: "var(--bg-primary)",
  },
  mobileChatHidden: { display: "none" },
  chatHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px 32px",
    borderBottom: "1.5px solid var(--border-color)",
    backgroundColor: 'var(--bg-primary)',
  },
  chatHeaderInfo: { display: "flex", alignItems: "center", gap: "16px" },
  mobileBackButton: {
    display: "none",
    width: "40px",
    height: "40px",
    borderRadius: "12px",
    border: "1.5px solid var(--border-color)",
    background: "var(--bg-secondary)",
    color: "var(--text-primary)",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  chatAvatar: {
    width: "48px",
    height: "48px",
    borderRadius: "16px",
    backgroundColor: "#007AFF",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#FFFFFF",
    fontWeight: 700,
  },
  chatName: { fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" },
  chatRole: { fontSize: "12px", color: "var(--text-secondary)", fontWeight: 500 },
  chatActions: { display: "flex", gap: "10px" },
  chatActionBtn: { padding: "10px", background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)" },
  messagesArea: { flex: 1, overflowY: "auto", padding: "32px", display: "flex", flexDirection: "column", gap: "24px", backgroundColor: 'var(--bg-secondary)' },
  messageWrapper: { display: "flex", gap: "12px" },
  messageAvatar: { width: "36px", height: "36px", borderRadius: "12px", backgroundColor: "#007AFF", display: "flex", alignItems: "center", justifyContent: "center", color: "#FFFFFF", fontSize: "15px", fontWeight: 700 },
  messageBubble: { padding: "14px 20px", borderRadius: "20px", fontSize: "15px", lineHeight: 1.5 },
  messageBubbleOwn: { backgroundColor: "#007AFF", color: "#FFFFFF", borderBottomRightRadius: "4px", boxShadow: '0 4px 12px rgba(0,122,255,0.2)' },
  messageBubbleOther: { backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", borderBottomLeftRadius: "4px", border: '1px solid var(--border-color)' },
  messageImage: {
    maxWidth: "240px",
    maxHeight: "240px",
    display: "block",
    borderRadius: "12px",
  },
  fileLink: {
    color: "inherit",
    fontWeight: 600,
    textDecoration: "underline",
    textUnderlineOffset: "3px",
  },
  messageMeta: { display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "6px", marginTop: "6px" },
  messageTime: { fontSize: "11px", color: "var(--text-secondary)", fontWeight: 500 },
  messageInputContainer: { display: "flex", alignItems: "center", gap: "16px", padding: "20px 32px", borderTop: "1.5px solid var(--border-color)", backgroundColor: "var(--bg-primary)" },
  attachBtn: { padding: "10px", background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)" },
  emojiBtn: { padding: "10px", background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)" },
  messageInput: { flex: 1, padding: "14px 20px", fontSize: "15px", border: "1.5px solid var(--border-color)", borderRadius: "16px", outline: "none", resize: "none", fontFamily: "inherit", backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' },
  sendBtn: { padding: "12px", backgroundColor: "#007AFF", borderRadius: "14px", cursor: "pointer", color: "#FFFFFF" },
  noChatSelected: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "40px", backgroundColor: 'var(--bg-secondary)' },
  noChatIcon: { fontSize: "64px", marginBottom: "24px", backgroundColor: 'var(--bg-primary)', width: '120px', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '40px', border: '1.5px solid var(--border-color)' },
};
