// PATH: C:\websmith\app\messages\hooks\useMessages.ts
// useMessages Hook - State management for chat/messaging

import { useState, useEffect, useCallback, useRef } from 'react';
import messageService, { 
  Message, 
  Conversation, 
  SendMessageData,
  ConversationStats 
} from '../services/messageService';

export const useMessages = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ConversationStats>({
    total: 0,
    unread: 0,
    activeToday: 0,
    messagesToday: 0
  });
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);

  // Fetch all conversations
  const fetchConversations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await messageService.getConversations();
      setConversations(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch conversations');
      console.error('Fetch conversations error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch messages for selected conversation
  const fetchMessages = useCallback(async (conversationId: string) => {
    try {
      const data = await messageService.getMessages(conversationId);
      setMessages(data);
      // Mark as read when opening conversation
      await messageService.markConversationAsRead(conversationId);
      // Update unread count in conversation list
      setConversations(prev => prev.map(conv => 
        conv._id === conversationId 
          ? { ...conv, unreadCount: 0 }
          : conv
      ));
    } catch (err: any) {
      console.error('Fetch messages error:', err);
    }
  }, []);

  // Fetch statistics
  const fetchStats = useCallback(async () => {
    try {
      const data = await messageService.getConversationStats();
      setStats(data);
    } catch (err: any) {
      console.error('Fetch stats error:', err);
    }
  }, []);

  // Send a new message
  const sendMessage = useCallback(async (data: SendMessageData) => {
    if (!data.content.trim()) return { success: false, error: 'Message cannot be empty' };
    
    setSending(true);
    try {
      const newMessage = await messageService.sendMessage(data);
      setMessages(prev => [...prev, newMessage]);
      
      // Update conversation list with last message
      setConversations(prev => prev.map(conv => 
        conv.participantId === data.receiverId
          ? {
              ...conv,
              lastMessage: data.content,
              lastMessageTime: new Date().toISOString(),
              lastMessageSender: 'me'
            }
          : conv
      ));
      
      await fetchStats();
      return { success: true, data: newMessage };
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Failed to send message';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setSending(false);
    }
  }, [fetchStats]);

  // Delete a message
  const deleteMessage = useCallback(async (messageId: string) => {
    try {
      await messageService.deleteMessage(messageId);
      setMessages(prev => prev.filter(msg => msg._id !== messageId));
      return { success: true };
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Failed to delete message';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, []);

  // Select a conversation
  const selectConversation = useCallback(async (conversation: Conversation) => {
    setSelectedConversation(conversation);
    await fetchMessages(conversation._id);
  }, [fetchMessages]);

  // Send typing indicator
  const sendTyping = useCallback(async (receiverId: string, typing: boolean) => {
    try {
      await messageService.sendTypingIndicator(receiverId, typing);
    } catch (err) {
      console.error('Typing indicator error:', err);
    }
  }, []);

  // Search messages
  const searchMessages = useCallback(async (query: string, conversationId?: string) => {
    try {
      const results = await messageService.searchMessages(query, conversationId);
      return results;
    } catch (err: any) {
      console.error('Search error:', err);
      return [];
    }
  }, []);

  // Get unread count
  const getUnreadCount = useCallback(async () => {
    try {
      const count = await messageService.getUnreadCount();
      return count;
    } catch (err) {
      console.error('Get unread count error:', err);
      return 0;
    }
  }, []);

  // Setup polling for new messages
  const startPolling = useCallback(() => {
    if (pollingInterval.current) clearInterval(pollingInterval.current);
    
    pollingInterval.current = setInterval(async () => {
      if (selectedConversation) {
        const newMessages = await messageService.getMessages(selectedConversation._id);
        if (newMessages.length > messages.length) {
          setMessages(newMessages);
        }
      }
      await fetchConversations();
      await fetchStats();
    }, 5000); // Poll every 5 seconds
  }, [selectedConversation, messages.length, fetchConversations, fetchStats]);

  const stopPolling = useCallback(() => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
      pollingInterval.current = null;
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchConversations();
    fetchStats();
    startPolling();
    
    return () => {
      stopPolling();
    };
  }, [fetchConversations, fetchStats, startPolling, stopPolling]);

  return {
    conversations,
    messages,
    selectedConversation,
    loading,
    sending,
    error,
    stats,
    isTyping,
    typingUsers,
    sendMessage,
    deleteMessage,
    selectConversation,
    sendTyping,
    searchMessages,
    getUnreadCount,
    refreshConversations: fetchConversations,
    refreshStats: fetchStats,
  };
};