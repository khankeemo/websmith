// FILE: D:\websmith\app\internal\api\page.tsx
// PURPOSE: Main entry point for License Operations Center
// BEHAVIOR: Redirects to the full 9-tab License Admin UI
// RULE 02: All code stays inside /internal - no main website interference

import { redirect } from "next/navigation";

export default function InternalApiPage() {
  // Redirect to the complete license management UI
  redirect("/internal/api/licenses/generate");
}