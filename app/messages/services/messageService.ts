// PATH: C:\websmith\app\messages\services\messageService.ts
// Message Service - API calls for chat/messaging system

import apiService from '../../../core/services/apiService';

export interface Message {
  _id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  receiverId: string;
  receiverName: string;
  content: string;
  type: 'text' | 'image' | 'file';
  status: 'sent' | 'delivered' | 'read';
  timestamp: string;
  readAt?: string;
}

export interface Conversation {
  _id: string;
  participantId: string;
  participantName: string;
  participantAvatar: string;
  participantRole: string;
  participantEmail: string;
  lastMessage: string;
  lastMessageTime: string;
  lastMessageSender: string;
  unreadCount: number;
  online: boolean;
  lastSeen?: string;
}

export interface SendMessageData {
  receiverId: string;
  content: string;
  type?: 'text' | 'image' | 'file';
}

export interface ConversationStats {
  total: number;
  unread: number;
  activeToday: number;
  messagesToday: number;
}

class MessageService {
  // Get all conversations
  async getConversations(): Promise<Conversation[]> {
    const response = await apiService.get('/messages/conversations');
    return response.data.data;
  }

  // Get messages for a specific conversation
  async getMessages(conversationId: string, page?: number, limit?: number): Promise<Message[]> {
    const params: any = {};
    if (page) params.page = page;
    if (limit) params.limit = limit;
    const response = await apiService.get(`/messages/${conversationId}`, { params });
    return response.data.data;
  }

  // Send a new message
  async sendMessage(data: SendMessageData): Promise<Message> {
    const response = await apiService.post('/messages/send', data);
    return response.data.data;
  }

  // Mark message as read
  async markAsRead(messageId: string): Promise<void> {
    await apiService.patch(`/messages/${messageId}/read`);
  }

  // Mark entire conversation as read
  async markConversationAsRead(conversationId: string): Promise<void> {
    await apiService.patch(`/messages/conversations/${conversationId}/read`);
  }

  // Delete message (for sender only)
  async deleteMessage(messageId: string): Promise<void> {
    await apiService.delete(`/messages/${messageId}`);
  }

  // Get unread count
  async getUnreadCount(): Promise<number> {
    const response = await apiService.get('/messages/unread/count');
    return response.data.data.count;
  }

  // Get conversation statistics
  async getConversationStats(): Promise<ConversationStats> {
    const response = await apiService.get('/messages/stats');
    return response.data.data;
  }

  // Search messages
  async searchMessages(query: string, conversationId?: string): Promise<Message[]> {
    const params: any = { q: query };
    if (conversationId) params.conversationId = conversationId;
    const response = await apiService.get('/messages/search', { params });
    return response.data.data;
  }

  // Typing indicator
  async sendTypingIndicator(receiverId: string, isTyping: boolean): Promise<void> {
    await apiService.post('/messages/typing', { receiverId, isTyping });
  }

  // Upload file attachment
  async uploadAttachment(file: File): Promise<{ url: string; type: string }> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiService.post('/messages/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data.data;
  }
}

export default new MessageService();