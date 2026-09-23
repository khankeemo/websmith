import pg from 'pg';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

let envContent = '';
try {
  envContent = fs.readFileSync(path.resolve('.env.local'), 'utf-8');
} catch {
  try {
    envContent = fs.readFileSync(path.resolve('.env'), 'utf-8');
  } catch {}
}

let connectionString = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
if (!connectionString && envContent) {
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('DATABASE_URL=') || trimmed.startsWith('NEON_DATABASE_URL=')) {
      connectionString = trimmed.split('=')[1]?.replace(/^["']|["']$/g, '');
      break;
    }
  }
}

const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false } });

const SEED_CLIENTS = [
  { name: "Logix Global Supply Chain", company: "Enterprise Logistics", address: "Global freight tracking and inventory architecture across 8 international fulfillment hubs.", description: "Global freight tracking and inventory architecture across 8 international fulfillment hubs.", email: "contact@logixglobal.com" },
  { name: "Aura Capital Partners", company: "FinTech & Wealth Management", address: "Real-time algorithmic trading and risk analytics interface with sub-50ms market execution.", description: "Real-time algorithmic trading and risk analytics interface with sub-50ms market execution.", email: "info@auracapital.com" },
  { name: "MedCare Health Network", company: "Healthcare & Telemedicine", address: "HIPAA-compliant encrypted telemedicine portals and real-time doctor consult scheduling.", description: "HIPAA-compliant encrypted telemedicine portals and real-time doctor consult scheduling.", email: "contact@medcarenetwork.com" },
  { name: "TransLogix Express", company: "Transportation & Fleet", address: "Automated telemetry dispatch, driver routing, and live geospatial vehicle tracking.", description: "Automated telemetry dispatch, driver routing, and live geospatial vehicle tracking.", email: "dispatch@translogix.com" },
  { name: "Nordic Retail Labs", company: "eCommerce Solutions", address: "Modern B2B marketplace infrastructure with automated invoicing and multi-currency tax reporting.", description: "Modern B2B marketplace infrastructure with automated invoicing and multi-currency tax reporting.", email: "partner@nordicretail.com" },
  { name: "Vanguard Cloud Systems", company: "Cloud Infrastructure", address: "Distributed license key authentication gate serving multi-region SaaS vendors.", description: "Distributed license key authentication gate serving multi-region SaaS vendors.", email: "support@vanguardcloud.com" },
  { name: "Apex Mobility", company: "Urban Transit & IoT", address: "Connected IoT asset tracking platform with sub-second device status synchronization.", description: "Connected IoT asset tracking platform with sub-second device status synchronization.", email: "ops@apexmobility.io" },
  { name: "Solaris Energy Tech", company: "Renewable Energy Analytics", address: "High-resolution telemetry dashboard for smart solar grid performance monitoring.", description: "High-resolution telemetry dashboard for smart solar grid performance monitoring.", email: "grid@solarisenergy.com" },
  { name: "Quantum Digital Assets", company: "Institutional Digital Custody", address: "Hardware-security-backed key management and cryptographic authorization gateways.", description: "Hardware-security-backed key management and cryptographic authorization gateways.", email: "custody@quantumdigital.io" },
  { name: "Horizon EdTech", company: "Adaptive Learning Systems", address: "Interactive classroom streaming platform with automated grading and student analytics.", description: "Interactive classroom streaming platform with automated grading and student analytics.", email: "hello@horizonedtech.org" },
];

const SEED_DEVELOPERS = [
  { name: "Alex Rivera", role: "Principal Cloud Architect", headline: "Principal Cloud Architect", skills: ["AWS", "Kubernetes", "Go", "PostgreSQL"], experienceYears: 10, bio: "Designs ultra-reliable, high-throughput cloud infrastructure and distributed microservices.", email: "alex.rivera@websmithdigital.com" },
  { name: "Sophia Chen", role: "Lead Full-Stack Engineer", headline: "Lead Full-Stack Engineer", skills: ["Next.js", "React 19", "TypeScript", "Node.js"], experienceYears: 8, bio: "Specializes in modern React architecture, complex interactive dashboards, and design systems.", email: "sophia.chen@websmithdigital.com" },
  { name: "Marcus Vance", role: "Enterprise Systems Architect", headline: "Enterprise Systems Architect", skills: ["Java", "Spring Boot", "PostgreSQL", "Docker"], experienceYears: 12, bio: "Architects mission-critical ERP systems, high-compliance APIs, and enterprise data sync pipelines.", email: "marcus.vance@websmithdigital.com" },
  { name: "Elena Rostova", role: "Senior Mobile & Web Engineer", headline: "Senior Mobile & Web Engineer", skills: ["React Native", "Flutter", "iOS", "TypeScript"], experienceYears: 7, bio: "Crafts silky-smooth cross-platform mobile experiences with strict offline-first resilience.", email: "elena.rostova@websmithdigital.com" },
  { name: "David Kim", role: "Senior Security & Backend Engineer", headline: "Senior Security & Backend Engineer", skills: ["Python", "FastAPI", "Redis", "Cryptography"], experienceYears: 9, bio: "Expert in AES-256 encryption, HMAC API security gates, and ultra-low-latency backend services.", email: "david.kim@websmithdigital.com" },
  { name: "Priya Sharma", role: "Lead UI/UX Engineer", headline: "Lead UI/UX Engineer", skills: ["Tailwind CSS", "Next.js", "Figma", "Design Systems"], experienceYears: 6, bio: "Obsessed with micro-interactions, responsive typography, and enterprise-grade design systems.", email: "priya.sharma@websmithdigital.com" },
];

const SEED_PROJECTS = [
  {
    name: "ApexFlow Enterprise ERP",
    slug: "apexflow-enterprise-erp",
    category: "Enterprise ERP",
    client: "Logix Global Supply Chain",
    clientCompany: "Enterprise Logistics",
    description: "End-to-end enterprise resource planning system with real-time inventory synchronization, role-based portals, and automated tax invoicing.",
    challenge: "Fragmented legacy databases causing 14% inventory discrepancies across 8 regional distribution warehouses.",
    solution: "Unified Next.js 16 and PostgreSQL ERP with live barcode event streaming and automated multi-currency tax invoicing.",
    features: ["Real-time inventory synchronization", "Multi-warehouse barcode scanning", "Automated GST/VAT invoicing", "Role-based client and vendor portals"],
    techStack: ["Next.js 16", "PostgreSQL", "Tailwind CSS", "Redis", "Docker"],
    metrics: "Reduced inventory discrepancy by 94% across 8 warehouses",
    publicUrl: "https://websmithdigital.com",
    previewImage: "/images/portfolio/apexflow_mockup.jpg",
    published: true,
    isFeatured: true,
    status: "completed",
    priority: "high",
    startDate: "2025-01-10",
    feedback: [
      {
        authorName: "David Vance",
        clientName: "David Vance",
        company: "CTO, Logix Global Supply Chain",
        rating: 5,
        comment: "Websmith delivered our entire enterprise supply chain portal 3 weeks ahead of schedule. The engineering quality and security rigor were remarkable.",
        publishedAsTestimonial: true,
        date: "2025-06-15",
      },
    ],
  },
  {
    name: "OmniLicense Universal Hub",
    slug: "omnilicense-universal-hub",
    category: "Cloud & APIs",
    client: "Desktop & Mobile Software Vendors",
    clientCompany: "Software Ecosystems",
    description: "Multi-runtime software licensing engine supporting 13 programming languages, cryptographic hardware binding, and trial grace periods.",
    challenge: "Software piracy and unauthorized device duplication eating 35% of commercial desktop software revenue.",
    solution: "Cryptographic hardware fingerprinting engine compiled across 13 native language runtimes with offline grace validation.",
    features: ["13-language native SDKs", "Hardware node-locking", "Time-bombed trial automation", "Embeddable client GUI modal"],
    techStack: ["Go", "Node.js", "Neon DB", "HMAC-SHA256", "C++ SDK"],
    metrics: "Over 25,000+ active device licenses managed with 99.99% uptime",
    publicUrl: "https://websmithdigital.com/license",
    previewImage: "/images/portfolio/license_mockup.jpg",
    published: true,
    isFeatured: true,
    status: "completed",
    priority: "high",
    startDate: "2025-02-01",
    feedback: [
      {
        authorName: "Sarah Jenkins",
        clientName: "Sarah Jenkins",
        company: "VP of Engineering, Aura Capital",
        rating: 5,
        comment: "The multi-runtime licensing hub they built handles thousands of cryptographic requests per minute without a hiccup. One of the best teams we've partnered with.",
        publishedAsTestimonial: true,
        date: "2025-07-20",
      },
    ],
  },
  {
    name: "FinPulse High-Speed Wealth Platform",
    slug: "finpulse-wealth-platform",
    category: "Web Apps",
    client: "Aura Capital Partners",
    clientCompany: "FinTech & Wealth Management",
    description: "Real-time algorithmic trading dashboard with interactive charts, sub-50ms market data streaming, and automated portfolio rebalancing.",
    challenge: "High memory consumption and laggy browser UI rendering thousands of tick updates during peak market opens.",
    solution: "Virtual canvas rendering with WebSocket delta compression and lightweight Web Workers managing calculation queues.",
    features: ["Sub-50ms market streaming", "Interactive candlestick charts", "Automated portfolio rebalancing", "Zero-lag order execution"],
    techStack: ["React 19", "Next.js", "WebSockets", "Recharts", "TypeScript"],
    metrics: "3.2x faster page load and 65% lower server memory footprint",
    publicUrl: "https://websmithdigital.com",
    previewImage: "/images/portfolio/finpulse_mockup.jpg",
    published: true,
    isFeatured: true,
    status: "completed",
    priority: "high",
    startDate: "2025-03-01",
    feedback: [],
  },
  {
    name: "PulseHealth Telemedicine App",
    slug: "pulsehealth-telemedicine",
    category: "Mobile Apps",
    client: "MedCare Health Network",
    clientCompany: "Healthcare & Telemedicine",
    description: "HIPAA-compliant cross-platform mobile application enabling secure encrypted video doctor consultations, e-prescriptions, and appointment queues.",
    challenge: "Low-bandwidth video dropouts and strict HIPAA audit requirements for patient records.",
    solution: "End-to-end encrypted WebRTC mesh rooms with automatic audio-only fallback and field-level AES-256 database encryption.",
    features: ["HIPAA-compliant video consults", "Instant e-prescriptions", "In-app appointment reminders", "Secure doctor chat"],
    techStack: ["React Native", "WebRTC", "Node.js", "AES-256", "iOS / Android"],
    metrics: "4.9-star rating with over 40,000 monthly patient consultations",
    publicUrl: "https://websmithdigital.com",
    previewImage: "/images/portfolio/telemed_mockup.jpg",
    published: true,
    isFeatured: true,
    status: "completed",
    priority: "high",
    startDate: "2025-03-15",
    feedback: [
      {
        authorName: "Dr. Julian Martinez",
        clientName: "Dr. Julian Martinez",
        company: "Chief Medical Officer, MedCare Network",
        rating: 5,
        comment: "Our telemedicine platform needed strict HIPAA compliance and zero-latency video streaming. Websmith delivered exactly what we needed with 99.99% uptime.",
        publishedAsTestimonial: true,
        date: "2025-08-10",
      },
    ],
  },
  {
    name: "TradeSphere B2B Wholesale Marketplace",
    slug: "tradesphere-b2b-marketplace",
    category: "Web Apps",
    client: "Global Sourcing Hub",
    clientCompany: "eCommerce Solutions",
    description: "High-volume wholesale marketplace featuring tiered bulk pricing, multi-currency settlement, custom RFQ workflows, and automated vendor payout.",
    challenge: "Complex custom price tier matrices causing slow cart checks and delayed multi-vendor split settlements.",
    solution: "Serverless pricing cache in Redis with automated escrow payout webhooks via Stripe Connect.",
    features: ["Tiered B2B volume pricing", "Multi-currency settlement", "Custom RFQ negotiation engine", "Automated vendor split payouts"],
    techStack: ["Next.js", "Stripe API", "Neon PostgreSQL", "Tailwind CSS"],
    metrics: "Handled $4.8M+ in quarterly bulk volume seamlessly",
    publicUrl: "https://websmithdigital.com/software-store",
    previewImage: "/images/portfolio/marketplace_mockup.jpg",
    published: true,
    isFeatured: true,
    status: "completed",
    priority: "high",
    startDate: "2025-04-01",
    feedback: [
      {
        authorName: "Elena Lindqvist",
        clientName: "Elena Lindqvist",
        company: "Operations Director, Nordic Retail",
        rating: 5,
        comment: "Websmith transformed our fragmented retail operations into a streamlined, high-speed wholesale marketplace. Responsive, deeply technical, and proactive.",
        publishedAsTestimonial: true,
        date: "2025-09-01",
      },
    ],
  },
  {
    name: "CloudMatrix Fleet & Dispatch AI",
    slug: "cloudmatrix-fleet-dispatch",
    category: "Enterprise ERP",
    client: "TransLogix Express",
    clientCompany: "Transportation & Fleet",
    description: "Automated route optimization and telematics tracking platform connecting 600+ fleet vehicles with dynamic dispatch scheduling.",
    challenge: "High vehicle fuel burn and dispatch bottlenecks due to static unoptimized driver routes.",
    solution: "Dynamic TSP routing engine integrated with live GPS telemetry streams and driver mobile dispatch app.",
    features: ["Real-time vehicle GPS telemetry", "Automated route optimization", "Driver mobile dispatch companion", "Fuel and maintenance analytics"],
    techStack: ["TypeScript", "Mapbox GL", "PostGIS", "Redis Queue", "Python"],
    metrics: "18% reduction in total fuel consumption and zero lost shipments",
    publicUrl: "https://websmithdigital.com",
    previewImage: "/images/portfolio/fleet_mockup.jpg",
    published: true,
    isFeatured: true,
    status: "completed",
    priority: "high",
    startDate: "2025-05-01",
    feedback: [
      {
        authorName: "Michael O'Connor",
        clientName: "Michael O'Connor",
        company: "COO, TransLogix Express",
        rating: 5,
        comment: "From architectural consulting to production launch, Websmith has been an indispensable engineering partner for our fleet dispatch system.",
        publishedAsTestimonial: true,
        date: "2025-09-18",
      },
    ],
  },
];

async function run() {
  const client = await pool.connect();
  try {
    console.log("Seeding CMS defaults into database...");

    // 1. Seed 10 Clients into portal_users (role: 'client', published: true)
    let clientsAdded = 0;
    for (let i = 0; i < SEED_CLIENTS.length; i++) {
      const c = SEED_CLIENTS[i];
      const existing = await client.query(
        `SELECT _id FROM portal_users WHERE data->>'email' = $1 OR data->>'name' = $2`,
        [c.email, c.name]
      );
      if (existing.rows.length === 0) {
        const _id = crypto.randomBytes(12).toString("hex");
        const customId = `CL-${String(i + 101).padStart(4, "0")}`;
        const doc = {
          _id,
          ...c,
          role: "client",
          status: "active",
          published: true,
          customId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await client.query(`INSERT INTO portal_users (_id, data) VALUES ($1, $2)`, [_id, JSON.stringify(doc)]);
        clientsAdded++;
      } else {
        const rowId = existing.rows[0]._id;
        await client.query(
          `UPDATE portal_users SET data = jsonb_set(data, '{published}', 'true') WHERE _id = $1`,
          [rowId]
        );
      }
    }
    console.log(`Clients processed: ${clientsAdded} newly added.`);

    // 2. Seed 6 Developers into portal_users (role: 'developer', published: true)
    let devsAdded = 0;
    for (let i = 0; i < SEED_DEVELOPERS.length; i++) {
      const d = SEED_DEVELOPERS[i];
      const existing = await client.query(
        `SELECT _id FROM portal_users WHERE data->>'email' = $1 OR data->>'name' = $2`,
        [d.email, d.name]
      );
      if (existing.rows.length === 0) {
        const _id = crypto.randomBytes(12).toString("hex");
        const customId = `DEV-${String(i + 101).padStart(4, "0")}`;
        const doc = {
          _id,
          ...d,
          role: "developer",
          status: "active",
          published: true,
          customId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await client.query(`INSERT INTO portal_users (_id, data) VALUES ($1, $2)`, [_id, JSON.stringify(doc)]);
        devsAdded++;
      } else {
        const rowId = existing.rows[0]._id;
        await client.query(
          `UPDATE portal_users SET data = jsonb_set(data, '{published}', 'true') WHERE _id = $1`,
          [rowId]
        );
      }
    }
    console.log(`Developers processed: ${devsAdded} newly added.`);

    // 3. Seed 6 Projects into portal_projects (published: true, with testimonials)
    let projectsAdded = 0;
    for (const p of SEED_PROJECTS) {
      const existing = await client.query(
        `SELECT _id FROM portal_projects WHERE data->>'name' = $1`,
        [p.name]
      );
      if (existing.rows.length === 0) {
        const _id = crypto.randomBytes(12).toString("hex");
        const doc = {
          _id,
          ...p,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await client.query(`INSERT INTO portal_projects (_id, data) VALUES ($1, $2)`, [_id, JSON.stringify(doc)]);
        projectsAdded++;
      } else {
        const rowId = existing.rows[0]._id;
        await client.query(
          `UPDATE portal_projects SET data = jsonb_set(jsonb_set(data, '{published}', 'true'), '{feedback}', $2::jsonb) WHERE _id = $1`,
          [rowId, JSON.stringify(p.feedback)]
        );
      }
    }
    console.log(`Projects processed: ${projectsAdded} newly added.`);

    console.log("Seeding complete!");
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
