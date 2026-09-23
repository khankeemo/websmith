// FILE: components/shared/LucideIcon.tsx
// PURPOSE: Dynamically renders a Lucide icon by name string, or an image if given a URL, with graceful fallback.

"use client";

import React from "react";
import * as LucideIcons from "lucide-react";
import type { LucideProps } from "lucide-react";

export interface DynamicIconProps extends Omit<LucideProps, "ref"> {
  name: string;
  fallback?: React.ComponentType<LucideProps>;
}

export default function LucideIcon({
  name,
  fallback = LucideIcons.Layers,
  ...props
}: DynamicIconProps) {
  if (!name) {
    const FallbackComponent = fallback;
    return <FallbackComponent {...props} />;
  }

  // If name is an image URL or path
  if (name.startsWith("/") || name.startsWith("http://") || name.startsWith("https://") || name.startsWith("data:")) {
    const size = typeof props.size === "number" ? `${props.size}px` : (props.size || "20px");
    return (
      <img
        src={name}
        alt=""
        style={{
          width: size,
          height: size,
          objectFit: "contain",
          display: "inline-block",
          verticalAlign: "middle",
        }}
        className={props.className}
      />
    );
  }

  // Normalize icon name (e.g., "code-2" -> "Code2", "shopping-cart" -> "ShoppingCart")
  const pascalName = name
    .split(/[-_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");

  const IconComponent =
    (LucideIcons as Record<string, any>)[name] ||
    (LucideIcons as Record<string, any>)[pascalName] ||
    fallback;

  if (typeof IconComponent === "function" || (typeof IconComponent === "object" && IconComponent !== null)) {
    return <IconComponent {...props} />;
  }

  const FallbackComponent = fallback;
  return <FallbackComponent {...props} />;
}

// Curated list of popular icon options with human-readable labels for admin icon pickers
export const COMMON_ICON_OPTIONS: Array<{ name: string; label: string }> = [
  { name: "Landmark", label: "Landmark (Bank/FinTech)" },
  { name: "ShoppingCart", label: "Shopping Cart (Retail/Ecommerce)" },
  { name: "HeartPulse", label: "Heart Pulse (Healthcare/MedTech)" },
  { name: "Cloud", label: "Cloud (SaaS/Cloud Infra)" },
  { name: "Truck", label: "Truck (Logistics/Fleet)" },
  { name: "Code2", label: "Code2 (Software Engineering)" },
  { name: "Smartphone", label: "Smartphone (Mobile Apps)" },
  { name: "Server", label: "Server (Backend/APIs)" },
  { name: "Database", label: "Database (Data Systems)" },
  { name: "GitMerge", label: "Git Merge (DevOps/CI/CD)" },
  { name: "Zap", label: "Zap (High Performance)" },
  { name: "Building2", label: "Building (Enterprise/B2B)" },
  { name: "Workflow", label: "Workflow (Automation/ERP)" },
  { name: "PackageCheck", label: "Package Check (Supply Chain)" },
  { name: "Receipt", label: "Receipt (Billing/Invoicing)" },
  { name: "Users", label: "Users (CRM/Collaboration)" },
  { name: "RefreshCw", label: "Refresh (Sync/Migrations)" },
  { name: "KeyRound", label: "Key (Licensing/Security)" },
  { name: "Cpu", label: "CPU (Core Systems)" },
  { name: "ShieldCheck", label: "Shield Check (Security/Audit)" },
  { name: "AppWindow", label: "App Window (Desktop/Web)" },
  { name: "BarChart3", label: "Bar Chart (Analytics/BI)" },
  { name: "Lock", label: "Lock (Encryption/Auth)" },
  { name: "Palette", label: "Palette (Design/Creatives)" },
  { name: "Layers", label: "Layers (Architecture/Stack)" },
  { name: "Component", label: "Component (Design System)" },
  { name: "Sparkles", label: "Sparkles (Innovation/AI)" },
  { name: "Layout", label: "Layout (UI/UX Architecture)" },
  { name: "Brush", label: "Brush (Branding/Styling)" },
  { name: "Bot", label: "Bot (AI Agents/RPA)" },
  { name: "BrainCircuit", label: "Brain Circuit (Deep Learning/ML)" },
  { name: "FileSearch", label: "File Search (Audit/Discovery)" },
  { name: "TrendingUp", label: "Trending Up (Growth/Marketing)" },
  { name: "Lightbulb", label: "Lightbulb (Strategy/Consulting)" },
  { name: "Globe", label: "Globe (Global/Multi-region)" },
  { name: "Compass", label: "Compass (Direction/Strategy)" },
  { name: "CheckCircle2", label: "Check Circle (QA/Testing)" },
  { name: "Briefcase", label: "Briefcase (Professional Services)" },
  { name: "Rocket", label: "Rocket (Launch/Growth)" },
];

