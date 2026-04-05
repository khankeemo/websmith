"use client";

import { createContext, useContext, useMemo, useState } from "react";

export interface SelectedLeadService {
  id: string;
  name: string;
}

interface LeadFunnelContextValue {
  selectedServices: SelectedLeadService[];
  setSelectedServices: (services: SelectedLeadService[]) => void;
  toggleService: (service: SelectedLeadService) => void;
  clearSelectedServices: () => void;
}

const LeadFunnelContext = createContext<LeadFunnelContextValue | undefined>(undefined);

const STORAGE_KEY = "wsd_lead_selected_services";

const getInitialServices = (): SelectedLeadService[] => {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
    return [];
  }
};

export function LeadFunnelProvider({ children }: { children: React.ReactNode }) {
  const [selectedServices, setSelectedServicesState] = useState<SelectedLeadService[]>(getInitialServices);

  const persist = (services: SelectedLeadService[]) => {
    setSelectedServicesState(services);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(services));
    }
  };

  const toggleService = (service: SelectedLeadService) => {
    const exists = selectedServices.some((item) => item.id === service.id);
    persist(
      exists
        ? selectedServices.filter((item) => item.id !== service.id)
        : [...selectedServices, service]
    );
  };

  const clearSelectedServices = () => {
    persist([]);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  };

  const value = useMemo(
    () => ({
      selectedServices,
      setSelectedServices: persist,
      toggleService,
      clearSelectedServices,
    }),
    [selectedServices]
  );

  return <LeadFunnelContext.Provider value={value}>{children}</LeadFunnelContext.Provider>;
}

export function useLeadFunnel() {
  const context = useContext(LeadFunnelContext);

  if (!context) {
    throw new Error("useLeadFunnel must be used within LeadFunnelProvider");
  }

  return context;
}
