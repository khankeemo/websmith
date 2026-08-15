import API from "./apiService";

/** Resolve stored ticket file paths for <img src> (same-origin `/api` in dev). */
export const resolveTicketFileUrl = (url: string) => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (typeof window === "undefined") return url;
  const path = url.startsWith("/") ? url : `/${url}`;
  return `${window.location.origin}${path}`;
};

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
  status: "open" | "in_progress" | "resolved" | "closed";
  chatStatus?: "open" | "closed";
  resolution?: string;
  closedAt?: string | null;
  archiveAfter?: string | null;
  attachments?: Array<{
    _id?: string;
    name: string;
    url: string;
  }>;
  history?: Array<{
    action: string;
    actorRole: "admin" | "client" | "developer" | "system";
    message?: string;
    attachments?: Array<{ name: string; url: string }>;
    emailDelivered?: boolean;
    emailError?: string;
    createdAt: string;
  }>;
  createdAt: string;
  emailDelivered?: boolean;
  emailError?: string;
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

export const uploadTicketImage = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await API.post("/tickets/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data.data as { url: string; name: string; type: string };
};

export const addTicketReply = async (
  id: string,
  message: string,
  attachments?: Array<{ name: string; url: string }>
) => {
  const response = await API.post(`/tickets/${id}/replies`, {
    message,
    attachments: attachments && attachments.length ? attachments : [],
  });
  return response.data.data as Ticket;
};

export const deleteTicket = async (id: string) => {
  await API.delete(`/tickets/${id}`);
};

export interface ResolutionTemplate {
  key: string;
  name: string;
  category: string;
  subject: string;
  isActive: boolean;
  isDefault: boolean;
}

export type ClientAccountState = "not_created" | "ready" | "existing";

export interface TicketClientAccount {
  state: ClientAccountState;
  email: string;
  name: string;
  clientId?: string;
}

export const getResolutionTemplates = async (): Promise<{ data: ResolutionTemplate[]; defaultKey: string }> => {
  const response = await API.get("/tickets/resolution-templates");
  return response.data as { data: ResolutionTemplate[]; defaultKey: string };
};

export const getTicketClientAccount = async (id: string): Promise<TicketClientAccount> => {
  const response = await API.get(`/tickets/${id}/client-account`);
  return response.data.data as TicketClientAccount;
};

export const sendResolutionEmail = async (
  id: string,
  payload: {
    resolution: string;
    templateKey?: string;
    createAccount?: boolean;
    portalUrl?: string;
  }
) => {
  const response = await API.post(`/tickets/${id}/send-resolution-email`, payload);
  return response.data;
};
