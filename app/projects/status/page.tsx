// PATH: C:\websmith\app\projects\status\page.tsx
// PURPOSE: Project Status Dashboard - 8-card view for project progress
// CREATED: 2026-04-03
// CARDS: 1-Client Info, 2-Project Type, 3-Timeline, 4-Progress, 5-Q&A, 6-Feedback, 7-Customization, 8-Status Overview

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  User, 
  FolderKanban, 
  Calendar, 
  TrendingUp, 
  MessageCircle, 
  Star, 
  Settings, 
  Info,
  ArrowLeft,
  Send,
  Edit2,
  Save,
  RefreshCw
} from 'lucide-react';
import API from '../../../core/services/apiService';

// Types
interface ProjectStatus {
  clientInfo: {
    name: string;
    email: string;
    phone: string;
    company: string;
  };
  projectType: {
    type: string;
    displayName: string;
    description: string;
  };
  timeline: {
    startDate: string;
    endDate: string | null;
    daysRemaining: number | null;
    totalDays: number | null;
  };
  progress: {
    percentage: number;
    status: { text: string; color: string };
    budgetUsed: number;
    budgetTotal: number;
  };
  messages: Array<{
    sender: string;
    senderName: string;
    message: string;
    timestamp: string;
    isRead: boolean;
  }>;
  feedback: Array<{
    rating: number;
    comment: string;
    date: string;
    clientName: string;
  }>;
  customization: {
    buttonColor: string;
    theme: string;
    headerImage: string;
    logoImage: string;
  };
  statusOverview: {
    currentStatus: string;
    priority: string;
    createdAt: string;
    updatedAt: string;
  };
}

export default function ProjectStatusPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  
  const [status, setStatus] = useState<ProjectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [editingProgress, setEditingProgress] = useState(false);
  const [tempProgress, setTempProgress] = useState(0);
  const [updatingProgress, setUpdatingProgress] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'messages' | 'feedback' | 'settings'>('overview');

  useEffect(() => {
    fetchStatus();
  }, [projectId]);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const response = await API.get(`/projects/${projectId}/status`);
      setStatus(response.data.data);
      setTempProgress(response.data.data.progress.percentage);
    } catch (err: any) {
      console.error('Fetch status error:', err);
      setError(err.response?.data?.message || 'Failed to load project status');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    
    setSendingMessage(true);
    try {
      await API.post(`/projects/${projectId}/messages`, {
        sender: 'team',
        senderName: 'Websmith Team',
        message: newMessage
      });
      setNewMessage('');
      fetchStatus(); // Refresh to get new message
    } catch (err) {
      console.error('Send message error:', err);
    } finally {
      setSendingMessage(false);
    }
  };

  const updateProgress = async () => {
    setUpdatingProgress(true);
    try {
      await API.put(`/projects/${projectId}/progress`, { progress: tempProgress });
      setEditingProgress(false);
      fetchStatus();
    } catch (err) {
      console.error('Update progress error:', err);
    } finally {
      setUpdatingProgress(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      low: '#34C759',
      medium: '#FF9500',
      high: '#FF3B30'
    };
    return colors[priority] || '#8E8E93';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours} hours ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p>Loading project status...</p>
      </div>
    );
  }

  if (error || !status) {
    return (
      <div style={styles.errorContainer}>
        <p style={styles.errorText}>{error || 'Project not found'}</p>
        <button onClick={() => router.back()} style={styles.backButton}>Go Back</button>
      </div>
    );
  }

  const budgetPercentage = status.progress.budgetTotal > 0 
    ? (status.progress.budgetUsed / status.progress.budgetTotal) * 100 
    : 0;

  const averageRating = status.feedback.length > 0
    ? status.feedback.reduce((sum, f) => sum + f.rating, 0) / status.feedback.length
    : null;

  return (
    <div style={styles.container} className="wsd-page">
      {/* Header */}
      <div style={styles.header}>
        <button onClick={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={20} />
          Back
        </button>
        <h1 style={styles.title}>Project Status Dashboard</h1>
        <button onClick={fetchStatus} style={styles.refreshBtn}>
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Tab Navigation */}
      <div style={styles.tabs}>
        <button 
          onClick={() => setActiveTab('overview')} 
          style={{ ...styles.tab, ...(activeTab === 'overview' ? styles.tabActive : {}) }}
        >
          <Info size={16} /> Overview
        </button>
        <button 
          onClick={() => setActiveTab('messages')} 
          style={{ ...styles.tab, ...(activeTab === 'messages' ? styles.tabActive : {}) }}
        >
          <MessageCircle size={16} /> Messages ({status.messages.length})
        </button>
        <button 
          onClick={() => setActiveTab('feedback')} 
          style={{ ...styles.tab, ...(activeTab === 'feedback' ? styles.tabActive : {}) }}
        >
          <Star size={16} /> Feedback ({status.feedback.length})
        </button>
        <button 
          onClick={() => setActiveTab('settings')} 
          style={{ ...styles.tab, ...(activeTab === 'settings' ? styles.tabActive : {}) }}
        >
          <Settings size={16} /> Settings
        </button>
      </div>

      {/* Card 1-4 Grid (Overview Tab) */}
      {activeTab === 'overview' && (
        <div style={styles.grid}>
          {/* Card 1: Client Info */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <User size={20} color="#007AFF" />
              <h3 style={styles.cardTitle}>Client Information</h3>
            </div>
            <div style={styles.cardContent}>
              <p style={styles.clientName}>{status.clientInfo.name}</p>
              {status.clientInfo.email && <p style={styles.clientDetail}>📧 {status.clientInfo.email}</p>}
              {status.clientInfo.phone && <p style={styles.clientDetail}>📞 {status.clientInfo.phone}</p>}
              {status.clientInfo.company && <p style={styles.clientDetail}>🏢 {status.clientInfo.company}</p>}
            </div>
          </div>

          {/* Card 2: Project Type */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <FolderKanban size={20} color="#AF52DE" />
              <h3 style={styles.cardTitle}>Project Type</h3>
            </div>
            <div style={styles.cardContent}>
              <p style={styles.projectType}>{status.projectType.displayName}</p>
              <p style={styles.projectDesc}>{status.projectType.description.substring(0, 100)}...</p>
            </div>
          </div>

          {/* Card 3: Timeline */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <Calendar size={20} color="#FF9500" />
              <h3 style={styles.cardTitle}>Timeline</h3>
            </div>
            <div style={styles.cardContent}>
              <p>📅 Start: {formatDate(status.timeline.startDate)}</p>
              {status.timeline.endDate && <p>🎯 End: {formatDate(status.timeline.endDate)}</p>}
              {status.timeline.daysRemaining !== null && (
                <p style={status.timeline.daysRemaining < 0 ? styles.urgent : styles.onTrack}>
                  ⏰ {status.timeline.daysRemaining < 0 ? 'Overdue by' : 'Remaining'}: {Math.abs(status.timeline.daysRemaining)} days
                </p>
              )}
            </div>
          </div>

          {/* Card 4: Progress */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <TrendingUp size={20} color="#34C759" />
              <h3 style={styles.cardTitle}>Progress</h3>
            </div>
            <div style={styles.cardContent}>
              {editingProgress ? (
                <div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={tempProgress}
                    onChange={(e) => setTempProgress(parseInt(e.target.value))}
                    style={styles.slider}
                  />
                  <div style={styles.progressValue}>{tempProgress}%</div>
                  <div style={styles.progressActions}>
                    <button onClick={() => setEditingProgress(false)} style={styles.cancelSmallBtn}>Cancel</button>
                    <button onClick={updateProgress} disabled={updatingProgress} style={styles.saveSmallBtn}>
                      {updatingProgress ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={styles.progressBarContainer}>
                    <div style={{ ...styles.progressBar, width: `${status.progress.percentage}%` }} />
                  </div>
                  <div style={styles.progressStats}>
                    <span style={styles.progressPercent}>{status.progress.percentage}% Complete</span>
                    <button onClick={() => setEditingProgress(true)} style={styles.editProgressBtn}>
                      <Edit2 size={14} /> Update
                    </button>
                  </div>
                  <p style={styles.progressStatus}>Status: <span style={{ color: status.progress.status.color }}>{status.progress.status.text}</span></p>
                  {status.progress.budgetTotal > 0 && (
                    <div>
                      <div style={styles.budgetBarContainer}>
                        <div style={{ ...styles.budgetBar, width: `${Math.min(budgetPercentage, 100)}%` }} />
                      </div>
                      <p style={styles.budgetText}>Budget: ${status.progress.budgetUsed.toLocaleString()} / ${status.progress.budgetTotal.toLocaleString()}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Card 5: Messages Tab */}
      {activeTab === 'messages' && (
        <div style={styles.messagesCard}>
          <div style={styles.cardHeader}>
            <MessageCircle size={20} color="#007AFF" />
            <h3 style={styles.cardTitle}>Q&A Conversation</h3>
          </div>
          <div style={styles.messagesList}>
            {status.messages.length === 0 ? (
              <p style={styles.emptyText}>No messages yet. Start a conversation!</p>
            ) : (
              status.messages.map((msg, idx) => (
                <div key={idx} style={{ ...styles.messageItem, ...(msg.sender === 'team' ? styles.messageOwn : styles.messageOther) }}>
                  <div style={styles.messageHeader}>
                    <strong>{msg.senderName}</strong>
                    <span style={styles.messageTime}>{formatTime(msg.timestamp)}</span>
                  </div>
                  <p style={styles.messageText}>{msg.message}</p>
                </div>
              ))
            )}
          </div>
          <div style={styles.messageInputContainer}>
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              style={styles.messageInput}
              rows={2}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
            />
            <button onClick={sendMessage} disabled={sendingMessage} style={styles.sendBtn}>
              <Send size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Card 6: Feedback Tab */}
      {activeTab === 'feedback' && (
        <div style={styles.feedbackCard}>
          <div style={styles.cardHeader}>
            <Star size={20} color="#FFB800" />
            <h3 style={styles.cardTitle}>Client Feedback</h3>
          </div>
          {averageRating && (
            <div style={styles.avgRating}>
              <span style={styles.avgRatingLabel}>Average Rating:</span>
              <div style={styles.stars}>
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={18} fill={i < Math.floor(averageRating) ? '#FFB800' : 'none'} color="#FFB800" />
                ))}
                <span style={styles.avgRatingValue}>{averageRating.toFixed(1)} / 5.0</span>
              </div>
            </div>
          )}
          {status.feedback.length === 0 ? (
            <p style={styles.emptyText}>No feedback received yet.</p>
          ) : (
            status.feedback.map((fb, idx) => (
              <div key={idx} style={styles.feedbackItem}>
                <div style={styles.feedbackHeader}>
                  <strong>{fb.clientName}</strong>
                  <div style={styles.feedbackStars}>
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={14} fill={i < fb.rating ? '#FFB800' : 'none'} color="#FFB800" />
                    ))}
                  </div>
                  <span style={styles.feedbackDate}>{formatDate(fb.date)}</span>
                </div>
                {fb.comment && <p style={styles.feedbackComment}>"{fb.comment}"</p>}
              </div>
            ))
          )}
        </div>
      )}

      {/* Card 7 & 8: Settings Tab */}
      {activeTab === 'settings' && (
        <div style={styles.settingsGrid}>
          {/* Card 7: Customization */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <Settings size={20} color="#5856D6" />
              <h3 style={styles.cardTitle}>Customization</h3>
            </div>
            <div style={styles.cardContent}>
              <div style={styles.colorPreview}>
                <span>Button Color:</span>
                <div style={{ ...styles.colorDot, backgroundColor: status.customization.buttonColor }} />
                <span>{status.customization.buttonColor}</span>
              </div>
              <p>Theme: {status.customization.theme}</p>
              {status.customization.logoImage && <p>Logo uploaded ✓</p>}
              {status.customization.headerImage && <p>Header image uploaded ✓</p>}
              <button style={styles.editSettingsBtn}>Customize</button>
            </div>
          </div>

          {/* Card 8: Status Overview */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <Info size={20} color="#8E8E93" />
              <h3 style={styles.cardTitle}>Status Overview</h3>
            </div>
            <div style={styles.cardContent}>
              <p>Current Status: <span style={{ color: status.progress.status.color }}>{status.progress.status.text}</span></p>
              <p>Priority: <span style={{ color: getPriorityColor(status.statusOverview.priority) }}>{status.statusOverview.priority.toUpperCase()}</span></p>
              <p>Created: {formatDate(status.statusOverview.createdAt)}</p>
              <p>Last Updated: {formatDate(status.statusOverview.updatedAt)}</p>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

const styles: any = {
  container: {
    padding: 0,
    width: '100%',
    maxWidth: '100%',
    margin: 0,
    fontFamily: 'var(--font-sans)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '24px',
  },
  backBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    background: '#F2F2F7',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
    fontFamily: 'inherit',
  },
  title: {
    flex: 1,
    fontSize: '28px',
    fontWeight: 600,
    color: '#1C1C1E',
    margin: 0,
  },
  refreshBtn: {
    padding: '8px',
    background: '#F2F2F7',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '400px',
    gap: '16px',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid #E5E5EA',
    borderTopColor: '#007AFF',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  errorContainer: {
    textAlign: 'center',
    padding: '60px',
  },
  errorText: {
    color: '#FF3B30',
    marginBottom: '16px',
  },
  backButton: {
    padding: '10px 20px',
    background: '#007AFF',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
  },
  tabs: {
    display: 'flex',
    gap: '8px',
    marginBottom: '24px',
    borderBottom: '1px solid #E5E5EA',
    paddingBottom: '12px',
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    background: 'none',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
    color: '#8E8E93',
    fontFamily: 'inherit',
  },
  tabActive: {
    background: '#007AFF',
    color: '#FFFFFF',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '20px',
  },
  settingsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '20px',
  },
  card: {
    background: '#FFFFFF',
    borderRadius: '20px',
    padding: '20px',
    border: '1px solid #E5E5EA',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '16px',
    paddingBottom: '12px',
    borderBottom: '1px solid #E5E5EA',
  },
  cardTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#1C1C1E',
    margin: 0,
  },
  cardContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  clientName: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#1C1C1E',
    margin: 0,
  },
  clientDetail: {
    fontSize: '14px',
    color: '#6C6C70',
    margin: 0,
  },
  projectType: {
    fontSize: '20px',
    fontWeight: 600,
    color: '#AF52DE',
    margin: 0,
  },
  projectDesc: {
    fontSize: '14px',
    color: '#6C6C70',
    margin: 0,
    lineHeight: 1.4,
  },
  urgent: {
    color: '#FF3B30',
    fontWeight: 500,
    marginTop: '8px',
  },
  onTrack: {
    color: '#34C759',
    fontWeight: 500,
    marginTop: '8px',
  },
  progressBarContainer: {
    height: '8px',
    background: '#E5E5EA',
    borderRadius: '4px',
    overflow: 'hidden',
    marginBottom: '8px',
  },
  progressBar: {
    height: '100%',
    background: '#34C759',
    borderRadius: '4px',
    transition: 'width 0.3s ease',
  },
  progressStats: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  progressPercent: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#1C1C1E',
  },
  editProgressBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    background: '#F2F2F7',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
    fontFamily: 'inherit',
  },
  progressStatus: {
    fontSize: '13px',
    margin: 0,
  },
  slider: {
    width: '100%',
    marginBottom: '8px',
  },
  progressValue: {
    fontSize: '24px',
    fontWeight: 600,
    textAlign: 'center',
    marginBottom: '8px',
  },
  progressActions: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'center',
  },
  cancelSmallBtn: {
    padding: '6px 12px',
    background: '#F2F2F7',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  saveSmallBtn: {
    padding: '6px 12px',
    background: '#34C759',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  budgetBarContainer: {
    height: '4px',
    background: '#E5E5EA',
    borderRadius: '2px',
    overflow: 'hidden',
    marginTop: '8px',
  },
  budgetBar: {
    height: '100%',
    background: '#FF9500',
    borderRadius: '2px',
  },
  budgetText: {
    fontSize: '12px',
    color: '#8E8E93',
    marginTop: '4px',
  },
  messagesCard: {
    background: '#FFFFFF',
    borderRadius: '20px',
    padding: '20px',
    border: '1px solid #E5E5EA',
  },
  messagesList: {
    maxHeight: '400px',
    overflowY: 'auto',
    marginBottom: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  messageItem: {
    padding: '12px',
    borderRadius: '12px',
    maxWidth: '80%',
  },
  messageOwn: {
    alignSelf: 'flex-end',
    background: '#007AFF',
    color: 'white',
  },
  messageOther: {
    alignSelf: 'flex-start',
    background: '#F2F2F7',
    color: '#1C1C1E',
  },
  messageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    marginBottom: '4px',
  },
  messageTime: {
    fontSize: '10px',
    opacity: 0.7,
  },
  messageText: {
    fontSize: '14px',
    margin: 0,
  },
  messageInputContainer: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-end',
  },
  messageInput: {
    flex: 1,
    padding: '10px',
    border: '1px solid #E5E5EA',
    borderRadius: '12px',
    fontSize: '14px',
    fontFamily: 'inherit',
    resize: 'vertical',
  },
  sendBtn: {
    padding: '10px',
    background: '#007AFF',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackCard: {
    background: '#FFFFFF',
    borderRadius: '20px',
    padding: '20px',
    border: '1px solid #E5E5EA',
  },
  avgRating: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '16px',
    background: '#F9F9FB',
    borderRadius: '12px',
    marginBottom: '20px',
  },
  avgRatingLabel: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#1C1C1E',
  },
  stars: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  avgRatingValue: {
    fontSize: '14px',
    fontWeight: 600,
    marginLeft: '8px',
  },
  feedbackItem: {
    padding: '16px',
    borderBottom: '1px solid #E5E5EA',
  },
  feedbackHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '8px',
  },
  feedbackStars: {
    display: 'flex',
    gap: '2px',
  },
  feedbackDate: {
    fontSize: '12px',
    color: '#8E8E93',
    marginLeft: 'auto',
  },
  feedbackComment: {
    fontSize: '14px',
    color: '#6C6C70',
    margin: 0,
    fontStyle: 'italic',
  },
  emptyText: {
    textAlign: 'center',
    color: '#8E8E93',
    padding: '40px',
  },
  colorPreview: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  colorDot: {
    width: '24px',
    height: '24px',
    borderRadius: '12px',
    border: '1px solid #E5E5EA',
  },
  editSettingsBtn: {
    marginTop: '12px',
    padding: '8px',
    background: '#F2F2F7',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px',
    fontFamily: 'inherit',
  },
};