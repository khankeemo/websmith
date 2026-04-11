// PATH: C:\websmith\app\payments\services\paymentService.ts
// Payment Service - API calls for payment management

import apiService from '../../../core/services/apiService';

export interface Payment {
  _id: string;
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  amount: number;
  method: 'card' | 'bank' | 'cash' | 'crypto';
  status: 'completed' | 'pending' | 'failed' | 'refunded';
  transactionId: string;
  date: string;
  notes?: string;
  receipt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentData {
  invoiceId: string;
  amount?: number;
  method: Payment['method'];
  transactionId?: string;
  date?: string;
  notes?: string;
}

export interface PaymentStats {
  total: number;
  completed: number;
  pending: number;
  failed: number;
  refunded: number;
  totalAmount: number;
  monthlyData: {
    month: string;
    amount: number;
    count: number;
  }[];
}

class PaymentService {
  // Get all payments
  async getAllPayments(): Promise<Payment[]> {
    const response = await apiService.get('/payments');
    return response.data.data;
  }

  // Get single payment by ID
  async getPaymentById(id: string): Promise<Payment> {
    const response = await apiService.get(`/payments/${id}`);
    return response.data.data;
  }

  // Create new payment
  async createPayment(data: CreatePaymentData): Promise<Payment> {
    const response = await apiService.post('/payments', data);
    return response.data.data;
  }

  // Update payment
  async updatePayment(id: string, data: Partial<CreatePaymentData>): Promise<Payment> {
    const response = await apiService.put(`/payments/${id}`, data);
    return response.data.data;
  }

  // Delete payment
  async deletePayment(id: string): Promise<void> {
    await apiService.delete(`/payments/${id}`);
  }

  // Refund payment
  async refundPayment(id: string, reason?: string): Promise<Payment> {
    const response = await apiService.post(`/payments/${id}/refund`, { reason });
    return response.data.data;
  }

  // Download payment receipt
  async downloadReceipt(id: string, invoiceNumber: string): Promise<Blob> {
    const response = await apiService.get(`/payments/${id}/receipt`, {
      responseType: 'blob'
    });
    return response.data;
  }

  // Get payment statistics
  async getPaymentStats(): Promise<PaymentStats> {
    const response = await apiService.get('/payments/stats');
    return response.data.data;
  }

  // Get payments by status
  async getPaymentsByStatus(status: string): Promise<Payment[]> {
    const response = await apiService.get(`/payments/status/${status}`);
    return response.data.data;
  }

  // Verify payment
  async verifyPayment(transactionId: string): Promise<{ valid: boolean; payment?: Payment }> {
    const response = await apiService.post('/payments/verify', { transactionId });
    return response.data.data;
  }
}

export default new PaymentService();
