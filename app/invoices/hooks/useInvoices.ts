// PATH: C:\websmith\app\invoices\hooks\useInvoices.ts
// useInvoices Hook - State management for invoices

import { useState, useEffect, useCallback } from 'react';
import invoiceService, { Invoice, CreateInvoiceData } from '../services/invoiceService';

export const useInvoices = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    paid: 0,
    pending: 0,
    overdue: 0,
    totalAmount: 0
  });

  // Fetch all invoices
  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await invoiceService.getAllInvoices();
      setInvoices(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch invoices');
      console.error('Fetch invoices error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch invoice statistics
  const fetchStats = useCallback(async () => {
    try {
      const data = await invoiceService.getInvoiceStats();
      setStats(data);
    } catch (err: any) {
      console.error('Fetch stats error:', err);
    }
  }, []);

  // Create invoice
  const createInvoice = useCallback(async (data: CreateInvoiceData) => {
    try {
      setError(null);
      const newInvoice = await invoiceService.createInvoice(data);
      setInvoices(prev => [newInvoice, ...prev]);
      await fetchStats();
      return { success: true, data: newInvoice };
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Failed to create invoice';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, [fetchStats]);

  // Update invoice
  const updateInvoice = useCallback(async (id: string, data: Partial<CreateInvoiceData>) => {
    try {
      setError(null);
      const updatedInvoice = await invoiceService.updateInvoice(id, data);
      setInvoices(prev => prev.map(inv => inv._id === id ? updatedInvoice : inv));
      await fetchStats();
      return { success: true, data: updatedInvoice };
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Failed to update invoice';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, [fetchStats]);

  // Delete invoice
  const deleteInvoice = useCallback(async (id: string) => {
    try {
      setError(null);
      await invoiceService.deleteInvoice(id);
      setInvoices(prev => prev.filter(inv => inv._id !== id));
      await fetchStats();
      return { success: true };
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Failed to delete invoice';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, [fetchStats]);

  // Mark invoice as paid
  const markAsPaid = useCallback(async (id: string) => {
    try {
      setError(null);
      const updatedInvoice = await invoiceService.markAsPaid(id);
      setInvoices(prev => prev.map(inv => inv._id === id ? updatedInvoice : inv));
      await fetchStats();
      return { success: true, data: updatedInvoice };
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Failed to mark invoice as paid';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, [fetchStats]);

  // Download invoice
  const downloadInvoice = useCallback(async (id: string, invoiceNumber: string) => {
    try {
      const blob = await invoiceService.downloadInvoice(id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Invoice_${invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      return { success: true };
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Failed to download invoice';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, []);

  // Filter invoices by status
  const filterByStatus = useCallback((status: string) => {
    return invoices.filter(invoice => invoice.status === status);
  }, [invoices]);

  // Get total amount for a specific status
  const getTotalByStatus = useCallback((status: string) => {
    return invoices
      .filter(invoice => invoice.status === status)
      .reduce((sum, inv) => sum + inv.amount, 0);
  }, [invoices]);

  useEffect(() => {
    fetchInvoices();
    fetchStats();
  }, [fetchInvoices, fetchStats]);

  return {
    invoices,
    loading,
    error,
    stats,
    createInvoice,
    updateInvoice,
    deleteInvoice,
    markAsPaid,
    downloadInvoice,
    filterByStatus,
    getTotalByStatus,
    refreshInvoices: fetchInvoices,
  };
};