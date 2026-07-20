// PATH: C:\websmith\app\payments\hooks\usePayments.ts
// usePayments Hook - State management for payments

import { useState, useEffect, useCallback } from 'react';
import paymentService, { Payment, CreatePaymentData, PaymentStats } from '../services/paymentService';

export const usePayments = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<PaymentStats>({
    total: 0,
    completed: 0,
    pending: 0,
    failed: 0,
    refunded: 0,
    totalAmount: 0,
    monthlyData: []
  });

  // Fetch all payments
  const fetchPayments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await paymentService.getAllPayments();
      setPayments(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch payments');
      console.error('Fetch payments error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch payment statistics
  const fetchStats = useCallback(async () => {
    try {
      const data = await paymentService.getPaymentStats();
      setStats(data);
    } catch (err: any) {
      console.error('Fetch stats error:', err);
    }
  }, []);

  // Create payment
  const createPayment = useCallback(async (data: CreatePaymentData) => {
    try {
      setError(null);
      const newPayment = await paymentService.createPayment(data);
      setPayments(prev => [newPayment, ...prev]);
      await fetchStats();
      return { success: true, data: newPayment };
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Failed to create payment';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, [fetchStats]);

  // Update payment
  const updatePayment = useCallback(async (id: string, data: Partial<CreatePaymentData>) => {
    try {
      setError(null);
      const updatedPayment = await paymentService.updatePayment(id, data);
      setPayments(prev => prev.map(p => p._id === id ? updatedPayment : p));
      await fetchStats();
      return { success: true, data: updatedPayment };
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Failed to update payment';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, [fetchStats]);

  // Delete payment
  const deletePayment = useCallback(async (id: string) => {
    try {
      setError(null);
      await paymentService.deletePayment(id);
      setPayments(prev => prev.filter(p => p._id !== id));
      await fetchStats();
      return { success: true };
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Failed to delete payment';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, [fetchStats]);

  // Refund payment
  const refundPayment = useCallback(async (id: string, reason?: string) => {
    try {
      setError(null);
      const refundedPayment = await paymentService.refundPayment(id, reason);
      setPayments(prev => prev.map(p => p._id === id ? refundedPayment : p));
      await fetchStats();
      return { success: true, data: refundedPayment };
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Failed to refund payment';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, [fetchStats]);

  // Download receipt
  const downloadReceipt = useCallback(async (id: string, invoiceNumber: string) => {
    try {
      const blob = await paymentService.downloadReceipt(id, invoiceNumber);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Receipt_${invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      return { success: true };
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Failed to download receipt';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, []);

  // Verify payment
  const verifyPayment = useCallback(async (transactionId: string) => {
    try {
      const result = await paymentService.verifyPayment(transactionId);
      return result;
    } catch (err: any) {
      console.error('Verify payment error:', err);
      return { valid: false };
    }
  }, []);

  // Filter payments by status
  const filterByStatus = useCallback((status: string) => {
    return payments.filter(payment => payment.status === status);
  }, [payments]);

  // Filter payments by date range
  const filterByDateRange = useCallback((startDate: string, endDate: string) => {
    return payments.filter(payment => {
      const paymentDate = new Date(payment.date);
      return paymentDate >= new Date(startDate) && paymentDate <= new Date(endDate);
    });
  }, [payments]);

  // Get total amount for a specific status
  const getTotalByStatus = useCallback((status: string) => {
    return payments
      .filter(payment => payment.status === status)
      .reduce((sum, p) => sum + p.amount, 0);
  }, [payments]);

  // Get payments by method
  const getPaymentsByMethod = useCallback((method: string) => {
    return payments.filter(payment => payment.method === method);
  }, [payments]);

  useEffect(() => {
    fetchPayments();
    fetchStats();
  }, [fetchPayments, fetchStats]);

  return {
    payments,
    loading,
    error,
    stats,
    createPayment,
    updatePayment,
    deletePayment,
    refundPayment,
    downloadReceipt,
    verifyPayment,
    filterByStatus,
    filterByDateRange,
    getTotalByStatus,
    getPaymentsByMethod,
    refreshPayments: fetchPayments,
  };
};