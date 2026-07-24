"use client";

import UniversalActivationCenter from "@/components/internal-api/UniversalActivationCenter";

export default function ActivationPage() {
  return (
    <UniversalActivationCenter
      isOpen={true}
      onClose={() => {}}
      inline
    />
  );
}