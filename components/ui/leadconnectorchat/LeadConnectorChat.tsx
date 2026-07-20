"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { isPublicRoute } from "@/core/constants/routes";

const LEAD_CONNECTOR_SCRIPT_ID = "leadconnector-chat-widget";
const LEAD_CONNECTOR_WIDGET_ID = "6a01b0940c2994035d498791";

const removeLeadConnector = () => {
  document.querySelectorAll('head script[src*="leadconnector"]').forEach((el) => el.remove());
  document.querySelectorAll(`[data-widget-id="${LEAD_CONNECTOR_WIDGET_ID}"]`).forEach((el) => el.remove());
  document.getElementById(LEAD_CONNECTOR_SCRIPT_ID)?.remove();
};

export default function LeadConnectorChat() {
  const pathname = usePathname();
  const canLoadLeadConnector = Boolean(pathname && isPublicRoute(pathname) && !pathname.startsWith("/internal"));

  useEffect(() => {
    if (!canLoadLeadConnector) {
      removeLeadConnector();
      return;
    }

    if (document.getElementById(LEAD_CONNECTOR_SCRIPT_ID)) return;

    const script = document.createElement("script");
    script.id = LEAD_CONNECTOR_SCRIPT_ID;
    script.src = "https://widgets.leadconnectorhq.com/loader.js";
    script.async = true;
    script.dataset.resourcesUrl = "https://widgets.leadconnectorhq.com/chat-widget/loader.js";
    script.dataset.widgetId = LEAD_CONNECTOR_WIDGET_ID;
    script.dataset.source = "WEB_USER";

    document.body.appendChild(script);

    return removeLeadConnector;
  }, [canLoadLeadConnector]);

  return null;
}
