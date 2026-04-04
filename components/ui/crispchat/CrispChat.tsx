// C:\websmith\components\ui\crispchat\CrispChat.tsx
"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    $crisp: any;
    CRISP_WEBSITE_ID: string;
  }
}

export default function CrispChat() {
  useEffect(() => {
    // Initialize Crisp with your Website ID
    window.$crisp = [];
    window.CRISP_WEBSITE_ID = "3d6830f4-8b95-4447-a778-7ef2b502341c";

    // Load Crisp script
    const script = document.createElement("script");
    script.src = "https://client.crisp.chat/l.js";
    script.async = true;
    document.head.appendChild(script);
  }, []);

  return null;
}