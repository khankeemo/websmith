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
  customId?: string;
  published?: boolean;
  createdAt?: string;
}

export type ClientPayload = Omit<Client, "_id" | "createdAt">;

const getApiErrorMessage = (error: any, fallback: string) => {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallback
  );
};

// Get all clients
export const getClients = async (): Promise<Client[]> => {
  try {
    const response = await API.get('/clients');
    return response.data.data || response.data;
  } catch (error: any) {
    console.error('Get clients error:', error);
    throw getApiErrorMessage(error, 'Failed to fetch clients');
  }
};

// Get single client
export const getClient = async (id: string): Promise<Client> => {
  try {
    const response = await API.get(`/clients/${id}`);
    return response.data.data || response.data;
  } catch (error: any) {
    console.error('Get client error:', error);
    throw getApiErrorMessage(error, 'Failed to fetch client');
  }
};

// Create client
export const createClient = async (client: ClientPayload): Promise<Client> => {
  try {
    const response = await API.post('/clients', client);
    return response.data.data || response.data;
  } catch (error: any) {
    const message = error.response?.data?.message || error.message || 'Unknown error';
    console.error('Create client error details:', { 
      message, 
      status: error.response?.status,
      data: error.response?.data 
    });
    throw getApiErrorMessage(error, 'Failed to create client');
  }
};

// Update client
export const updateClient = async (id: string, client: Partial<Client>): Promise<Client> => {
  try {
    const response = await API.put(`/clients/${id}`, client);
    return response.data.data || response.data;
  } catch (error: any) {
    console.error('Update client error:', error);
    throw getApiErrorMessage(error, 'Failed to update client');
  }
};

// Delete client
export const deleteClient = async (id: string): Promise<void> => {
  try {
    await API.delete(`/clients/${id}`);
  } catch (error: any) {
    console.error('Delete client error:', error);
    throw getApiErrorMessage(error, 'Failed to delete client');
  }
};

export const getPublishedClients = async (): Promise<Client[]> => {
  try {
    const response = await API.get('/clients/public');
    return response.data.data || [];
  } catch (error: any) {
    console.error('Get public clients error:', error);
    throw getApiErrorMessage(error, 'Failed to fetch public clients');
  }
};

// Publish/unpublish client
export const toggleClientPublish = async (id: string, published: boolean): Promise<Client> => {
  try {
    const response = await API.patch(`/clients/${id}/publish`, { published });
    return response.data.data || response.data;
  } catch (error: any) {
    console.error('Toggle client publish error:', error);
    throw getApiErrorMessage(error, 'Failed to update client publish status');
  }
};
