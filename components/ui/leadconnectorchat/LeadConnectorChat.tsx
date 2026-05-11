"use client";

import { useEffect } from "react";

const LEAD_CONNECTOR_SCRIPT_ID = "leadconnector-chat-widget";

export default function LeadConnectorChat() {
  useEffect(() => {
    if (document.getElementById(LEAD_CONNECTOR_SCRIPT_ID)) return;

    const script = document.createElement("script");
    script.id = LEAD_CONNECTOR_SCRIPT_ID;
    script.src = "https://widgets.leadconnectorhq.com/loader.js";
    script.async = true;
    script.dataset.resourcesUrl =
      "https://widgets.leadconnectorhq.com/chat-widget/loader.js";
    script.dataset.widgetId = "6a01b0940c2994035d498791";
    script.dataset.source = "WEB_USER";

    document.body.appendChild(script);

    return () => {
      script.remove();
    };
  }, []);

  return null;
}
