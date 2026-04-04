// C:\websmith\app\clients\services\clientService.ts
// Client Service - Handles all API calls for clients
// Features: Create, Read, Update, Delete operations

import API from "../../../core/services/apiService";

export interface Client {
  _id?: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  address: string;
  status: 'active' | 'inactive';
  createdAt?: string;
}

// Get all clients
export const getClients = async (): Promise<Client[]> => {
  try {
    const response = await API.get('/clients');
    return response.data.data || response.data;
  } catch (error: any) {
    console.error('Get clients error:', error);
    throw error.response?.data?.message || 'Failed to fetch clients';
  }
};

// Get single client
export const getClient = async (id: string): Promise<Client> => {
  try {
    const response = await API.get(`/clients/${id}`);
    return response.data.data || response.data;
  } catch (error: any) {
    console.error('Get client error:', error);
    throw error.response?.data?.message || 'Failed to fetch client';
  }
};

// Create client
export const createClient = async (client: Omit<Client, '_id' | 'createdAt'>): Promise<Client> => {
  try {
    const response = await API.post('/clients', client);
    return response.data.data || response.data;
  } catch (error: any) {
    console.error('Create client error:', error);
    throw error.response?.data?.message || 'Failed to create client';
  }
};

// Update client
export const updateClient = async (id: string, client: Partial<Client>): Promise<Client> => {
  try {
    const response = await API.put(`/clients/${id}`, client);
    return response.data.data || response.data;
  } catch (error: any) {
    console.error('Update client error:', error);
    throw error.response?.data?.message || 'Failed to update client';
  }
};

// Delete client
export const deleteClient = async (id: string): Promise<void> => {
  try {
    await API.delete(`/clients/${id}`);
  } catch (error: any) {
    console.error('Delete client error:', error);
    throw error.response?.data?.message || 'Failed to delete client';
  }
};