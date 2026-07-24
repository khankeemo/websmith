"use client";

import UniversalActivationCenter from "@/components/internal-api/UniversalActivationCenter";

export default function LicenseReactivationPage() {
  return (
    <UniversalActivationCenter
      isOpen={true}
      onClose={() => {}}
      inline
    />
  );
}