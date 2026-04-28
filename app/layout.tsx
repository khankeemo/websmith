// C:\websmith\app\layout.tsx
// Root Layout - Server Component for metadata
// Features: Metadata configuration, imports client layout for conditional sidebar

import ClientLayout from "./ClientLayout";
import "./globals.css";
import { getSiteUrl } from "../core/config/site";

export const metadata = {
  title: "Websmith - Your On-Demand Tech Partner",
  description: "Websmith - Freelancer/SaaS Web Development Agency Management Platform. Connect with top-tier developers.",
  metadataBase: new URL(getSiteUrl()),
  other: {
    "breachme-verify": "breachme-verify=31c45e09d95fec00f33d4c4bef16d2d9",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
