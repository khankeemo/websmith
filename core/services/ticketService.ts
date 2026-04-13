import API from "./apiService";

export interface Ticket {
  _id: string;
  source?: "client_portal" | "public_contact";
  clientId: {
    _id: string;
    name: string;
    email: string;
  } | string | null;
  contactName?: string;
  contactEmail?: string;
  contactCompany?: string;
  developerId?: {
    _id: string;
    name: string;
    email: string;
  } | string | null;
  projectId?: {
    _id: string;
    name: string;
    status: string;
  } | string | null;
  subject: string;
  description: string;
  priority: "low" | "medium" | "high";
  status: "open" | "in_progress" | "resolved";
  resolution?: string;
  attachments?: Array<{
    _id?: string;
    name: string;
    url: string;
  }>;
  history?: Array<{
    action: string;
    actorRole: "admin" | "client" | "developer" | "system";
    message?: string;
    createdAt: string;
  }>;
  createdAt: string;
}

export const getTickets = async () => {
  const response = await API.get("/tickets");
  return response.data.data as Ticket[];
};

export const createTicket = async (payload: {
  projectId?: string;
  subject: string;
  description: string;
  priority: "low" | "medium" | "high";
  attachments?: Array<{ name: string; url: string }>;
}) => {
  const response = await API.post("/tickets", payload);
  return response.data.data as Ticket;
};

export const createPublicTicket = async (payload: {
  name: string;
  email: string;
  company?: string;
  subject: string;
  message: string;
}) => {
  const response = await API.post("/tickets/public", payload);
  return response.data.data as Ticket;
};

export const updateTicketStatus = async (
  id: string,
  payload: { status: Ticket["status"]; resolution?: string; reopenMessage?: string }
) => {
  const response = await API.put(`/tickets/${id}/status`, payload);
  return response.data.data as Ticket;
};

export const addTicketReply = async (id: string, message: string) => {
  const response = await API.post(`/tickets/${id}/replies`, { message });
  return response.data.data as Ticket;
};

export const deleteTicket = async (id: string) => {
  await API.delete(`/tickets/${id}`);
};
