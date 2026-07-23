import LicenseDialog from "@/components/license/LicenseDialog";

export const metadata = {
  title: "License Management - Websmith",
  description: "Activate, renew, or reactivate your license",
};

export default function LicensePage() {
  return <LicenseDialog />;
}
