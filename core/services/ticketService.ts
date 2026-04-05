import API from "./apiService";

export interface Ticket {
  _id: string;
  clientId: {
    _id: string;
    name: string;
    email: string;
  } | string;
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
}) => {
  const response = await API.post("/tickets", payload);
  return response.data.data as Ticket;
};

export const updateTicketStatus = async (id: string, status: Ticket["status"]) => {
  const response = await API.put(`/tickets/${id}/status`, { status });
  return response.data.data as Ticket;
};
