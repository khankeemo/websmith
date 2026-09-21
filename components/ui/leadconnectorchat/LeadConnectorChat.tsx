"use client";

import { useEffect } from "react";

const LEAD_CONNECTOR_SCRIPT_ID = "leadconnector-chat-widget";
const LEAD_CONNECTOR_WIDGET_ID = "6a01b0940c2994035d498791";

const removeLeadConnector = () => {
  document.querySelectorAll('head script[src*="leadconnector"]').forEach((el) => el.remove());
  document.querySelectorAll(`[data-widget-id="${LEAD_CONNECTOR_WIDGET_ID}"]`).forEach((el) => el.remove());
  document.getElementById(LEAD_CONNECTOR_SCRIPT_ID)?.remove();
};

export default function LeadConnectorChat() {
  useEffect(() => {
    removeLeadConnector();
  }, []);

  return null;
}

