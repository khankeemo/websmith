"use client";

import { useState } from "react";
import UniversalActivationCenter from "@/components/internal-api/UniversalActivationCenter";

export default function LicenseDialog() {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <UniversalActivationCenter
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
    />
  );
}