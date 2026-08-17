"use client";

import { useAnalytics } from "@/hooks/useAnalytics";

export default function AnalyticsTracker() {
  useAnalytics();
  return null;
}