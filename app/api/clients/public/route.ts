// FILE: app/api/clients/public/route.ts
// PURPOSE: Public API for published clients with automatic initial database seeding

import { apiHandler, json } from "@/lib/server/api";

const SEED_CLIENTS = [
  { name: "Logix Global Supply Chain", company: "Enterprise Logistics", address: "Global freight tracking and inventory architecture across 8 international fulfillment hubs.", email: "contact@logixglobal.com" },
  { name: "Aura Capital Partners", company: "FinTech & Wealth Management", address: "Real-time algorithmic trading and risk analytics interface with sub-50ms market execution.", email: "info@auracapital.com" },
  { name: "MedCare Health Network", company: "Healthcare & Telemedicine", address: "HIPAA-compliant encrypted telemedicine portals and real-time doctor consult scheduling.", email: "contact@medcarenetwork.com" },
  { name: "TransLogix Express", company: "Transportation & Fleet", address: "Automated telemetry dispatch, driver routing, and live geospatial vehicle tracking.", email: "dispatch@translogix.com" },
  { name: "Nordic Retail Labs", company: "eCommerce Solutions", address: "Modern B2B marketplace infrastructure with automated invoicing and multi-currency tax reporting.", email: "partner@nordicretail.com" },
  { name: "Vanguard Cloud Systems", company: "Cloud Infrastructure", address: "Distributed license key authentication gate serving multi-region SaaS vendors.", email: "support@vanguardcloud.com" },
  { name: "Apex Mobility", company: "Urban Transit & IoT", address: "Connected IoT asset tracking platform with sub-second device status synchronization.", email: "ops@apexmobility.io" },
  { name: "Solaris Energy Tech", company: "Renewable Energy Analytics", address: "High-resolution telemetry dashboard for smart solar grid performance monitoring.", email: "grid@solarisenergy.com" },
  { name: "Quantum Digital Assets", company: "Institutional Digital Custody", address: "Hardware-security-backed key management and cryptographic authorization gateways.", email: "custody@quantumdigital.io" },
  { name: "Horizon EdTech", company: "Adaptive Learning Systems", address: "Interactive classroom streaming platform with automated grading and student analytics.", email: "hello@horizonedtech.org" },
];

export const GET = apiHandler(async ({ db }) => {
  try {
    const collection = db.collection("users");
    let clients = await collection.find({ role: "client", published: true }).sort({ name: 1 }).toArray();

    if (clients.length === 0) {
      for (const item of SEED_CLIENTS) {
        await collection.insertOne({
          ...item,
          role: "client",
          status: "active",
          published: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      clients = await collection.find({ role: "client", published: true }).sort({ name: 1 }).toArray();
    }

    const data = clients.map((c) => ({
      _id: c._id.toString(),
      name: c.name,
      email: c.email,
      phone: c.phone ?? "",
      company: c.company ?? "",
      address: c.address ?? "",
      description: c.address ?? "",
      status: c.status ?? "active",
      customId: c.customId,
      published: Boolean(c.published),
    }));
    return json({ data });
  } catch (error) {
    console.warn("Public clients read warning (returning empty list):", error instanceof Error ? error.message : error);
    return json({ data: [] });
  }
});
