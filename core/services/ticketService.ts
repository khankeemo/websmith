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
  resolution?: string;
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
}) => {
  const response = await API.post("/tickets", payload);
  return response.data.data as Ticket;
};

export const updateTicketStatus = async (
  id: string,
  payload: { status: Ticket["status"]; resolution?: string; reopenMessage?: string }
) => {
  const response = await API.put(`/tickets/${id}/status`, payload);
  return response.data.data as Ticket;
};
