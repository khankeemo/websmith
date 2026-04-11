// PATH: C:\websmith\app\invoices\services\invoiceService.ts
// Invoice Service - API calls for invoice management

import apiService from '../../../core/services/apiService';

export interface InvoiceItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface Invoice {
  _id: string;
  clientId?: string | null;
  projectId?: string | null;
  billingType?: 'project_completion' | 'advance_payment' | 'milestone';
  milestoneLabel?: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  clientAddress?: string;
  amount: number;
  status: 'paid' | 'pending' | 'overdue' | 'draft';
  issueDate: string;
  dueDate: string;
  items: InvoiceItem[];
  notes?: string;
  tax?: number;
  discount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInvoiceData {
  clientId?: string | null;
  projectId?: string | null;
  billingType?: 'project_completion' | 'advance_payment' | 'milestone';
  milestoneLabel?: string;
  clientName: string;
  clientEmail: string;
  clientAddress?: string;
  issueDate: string;
  dueDate: string;
  items: InvoiceItem[];
  notes?: string;
  tax?: number;
  discount?: number;
}

class InvoiceService {
  // Get all invoices
  async getAllInvoices(): Promise<Invoice[]> {
    const response = await apiService.get('/invoices');
    return response.data.data;
  }

  // Get single invoice by ID
  async getInvoiceById(id: string): Promise<Invoice> {
    const response = await apiService.get(`/invoices/${id}`);
    return response.data.data;
  }

  // Create new invoice
  async createInvoice(data: CreateInvoiceData): Promise<Invoice> {
    const response = await apiService.post('/invoices', data);
    return response.data.data;
  }

  // Update invoice
  async updateInvoice(id: string, data: Partial<CreateInvoiceData>): Promise<Invoice> {
    const response = await apiService.put(`/invoices/${id}`, data);
    return response.data.data;
  }

  // Delete invoice
  async deleteInvoice(id: string): Promise<void> {
    await apiService.delete(`/invoices/${id}`);
  }

  // Mark invoice as paid
  async markAsPaid(id: string): Promise<Invoice> {
    const response = await apiService.patch(`/invoices/${id}/paid`);
    return response.data.data;
  }

  // Download invoice as PDF
  async downloadInvoice(id: string): Promise<Blob> {
    const response = await apiService.get(`/invoices/${id}/download`, {
      responseType: 'blob'
    });
    return response.data;
  }

  // Get invoice statistics
  async getInvoiceStats(): Promise<{
    total: number;
    paid: number;
    pending: number;
    overdue: number;
    totalAmount: number;
  }> {
    const response = await apiService.get('/invoices/stats');
    return response.data.data;
  }
}

export default new InvoiceService();
