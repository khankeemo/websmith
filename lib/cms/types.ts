// FILE: lib/cms/types.ts
// PURPOSE: Unified CMS data types and seed fixtures for Industries, Services, Portfolio, Clients, Developers, and Testimonials.

export interface CmsIndustry {
  _id?: string;
  name: string;
  slug: string;
  icon: string;
  shortDescription: string;
  badge?: string;
  headline?: string;
  description?: string;
  stats?: Array<{ label: string; value: string }>;
  challenges?: Array<{ problem: string; solution: string }>;
  architecture?: string[];
  techStack?: string[];
  caseStudy?: {
    client: string;
    metrics: string;
    summary: string;
  };
  displayOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CmsServiceCategory {
  _id?: string;
  name: string;
  title?: string;
  slug: string;
  icon: string;
  description: string;
  badge?: string;
  displayOrder: number;
  isActive: boolean;
  services?: CmsServiceItem[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CmsServiceItem {
  _id?: string;
  categoryId: string;
  categoryName?: string;
  name: string;
  title?: string;
  slug: string;
  icon: string;
  shortDescription: string;
  description?: string;
  deliverables?: string[];
  techStack?: string[];
  displayOrder: number;
  isActive: boolean;
  showInMenu: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// ============================================================================
// DEFAULT SEED FIXTURES (Extracted from existing hardcoded frontends)
// ============================================================================

export const SEED_INDUSTRIES: Omit<CmsIndustry, "_id">[] = [
  {
    name: "FinTech & Banking",
    slug: "fintech",
    icon: "Landmark",
    shortDescription: "High-security payment gateways & wallet systems",
    badge: "PCI-DSS Level 1 & SOC2",
    headline: "Mission-Critical Financial Core & Low-Latency Transaction Engines",
    description: "We architect bulletproof banking platforms, sub-millisecond trading pipelines, and multi-currency cryptographic payment ledgers engineered for zero tolerance to downtime or data inconsistency.",
    stats: [
      { label: "Tx Latency SLA", value: "< 18ms" },
      { label: "Historical Uptime", value: "99.999%" },
      { label: "Daily Ledger Volume", value: "$42M+" },
      { label: "Security Compliance", value: "PCI-DSS" },
    ],
    challenges: [
      {
        problem: "Race conditions in high-concurrency wallet balance deductions",
        solution: "Pessimistic serializable locking combined with event-sourced idempotent transactions.",
      },
      {
        problem: "Regulatory auditing across multi-jurisdiction jurisdictions",
        solution: "Immutable cryptographic audit trails stamped with append-only ledger partitions.",
      },
      {
        problem: "Automated fraud detection at checkout with sub-50ms budget",
        solution: "Edge-computed rule heuristics & machine learning anomaly scoring before DB dispatch.",
      },
    ],
    architecture: [
      "Distributed Event-Sourced Ledger with Kafka & Redis Cluster",
      "AES-256-GCM Envelope Encryption for Customer Keys & Cards",
      "Hardware-Locked API Gateway with HMAC-SHA256 Request Signing",
      "Multi-region Active-Active Database Failover with Neon & PostgreSQL",
    ],
    techStack: ["Next.js 14", "PostgreSQL", "Kafka", "Redis Enterprise", "Stripe Connect", "AWS KMS", "Docker"],
    caseStudy: {
      client: "FinPulse Global Capital",
      metrics: "3.2x throughput increase, 0 duplicate charges over 14M transactions",
      summary: "Modernized a legacy core banking sync pipeline into a distributed microservice engine processing payments across 18 countries.",
    },
    displayOrder: 1,
    isActive: true,
  },
  {
    name: "E-Commerce & Retail",
    slug: "ecommerce",
    icon: "ShoppingCart",
    shortDescription: "Multi-vendor marketplaces & high-speed checkout",
    badge: "Sub-Second Checkout",
    headline: "High-Volume Omnichannel Marketplaces & Real-Time Inventory Engines",
    description: "Scalable digital storefronts and headless commerce engines designed to withstand Black Friday traffic surges, live flash sales, and complex multi-vendor commission splits without dropping carts.",
    stats: [
      { label: "Cart Conversion Lift", value: "+34%" },
      { label: "Page Load (FCP)", value: "0.42s" },
      { label: "Flash Sale Concurrency", value: "50k/min" },
      { label: "Payment Routing Reliability", value: "99.98%" },
    ],
    challenges: [
      {
        problem: "Overselling stock during split-second flash sale checkout peaks",
        solution: "Redis atomic decrement counters coupled with asynchronous PostgreSQL reconciliation queues.",
      },
      {
        problem: "Complex multi-vendor commission settlements & split payouts",
        solution: "Automated escrow ledger calculating regional VAT and provider fees before batch transfer.",
      },
      {
        problem: "Slow faceted search across millions of catalog SKU combinations",
        solution: "Edge-cached Elasticsearch pipelines with sub-25ms prefix filtering and typo tolerance.",
      },
    ],
    architecture: [
      "Headless Storefront with Server-Side Incremental Static Regeneration",
      "Distributed Cart Sessions stored in in-memory memory grids",
      "Multi-Gateway Smart Failover (Stripe, Razorpay, PayPal, Crypto)",
      "Automated Order Processing Microservices with BullMQ queues",
    ],
    techStack: ["React 19", "Next.js", "PostgreSQL", "Redis", "Elasticsearch", "Stripe", "Tailwind CSS"],
    caseStudy: {
      client: "Nordic Retail Hub",
      metrics: "Handled 140,000 orders in 4 hours with 0 checkout drops",
      summary: "Re-engineered a legacy monolithic Magento catalog into a headless Next.js system with 80% reduced server overhead.",
    },
    displayOrder: 2,
    isActive: true,
  },
  {
    name: "Healthcare & MedTech",
    slug: "healthcare",
    icon: "HeartPulse",
    shortDescription: "Compliant patient portals & telehealth systems",
    badge: "HIPAA & GDPR Certified",
    headline: "Zero-Knowledge Telehealth Portals & Medical Diagnostics Systems",
    description: "Engineered for uncompromising patient privacy, end-to-end encrypted video consults, Electronic Health Record (EHR) interoperability, and automated clinical appointment scheduling.",
    stats: [
      { label: "Data Encryption", value: "AES-256" },
      { label: "Consultation Video Latency", value: "< 120ms" },
      { label: "HIPAA Audit Pass", value: "100%" },
      { label: "Monthly Patient Sessions", value: "85,000+" },
    ],
    challenges: [
      {
        problem: "Strict HIPAA/GDPR constraints on Protected Health Information (PHI)",
        solution: "Column-level field encryption with cryptographic customer keys never logged or stored in cleartext.",
      },
      {
        problem: "Unstable video streaming over erratic mobile cellular networks",
        solution: "Adaptive bitrate WebRTC mesh network with automatic audio fallback and local buffer resilience.",
      },
      {
        problem: "Siloed legacy clinic EHR formats preventing unified charts",
        solution: "HL7/FHIR-compliant ingestion translation bridges formatting data into standardized patient streams.",
      },
    ],
    architecture: [
      "End-to-End Encrypted Peer-to-Peer WebRTC Consultation Rooms",
      "FHIR-Compliant Healthcare Integration Microservices",
      "Role-Based Access Control (RBAC) with Hardware Token Enforcement",
      "Immutable Audit Trail for Every Chart Access & Modification",
    ],
    techStack: ["Next.js", "WebRTC", "PostgreSQL", "Node.js", "AWS KMS", "Docker", "FHIR Standards"],
    caseStudy: {
      client: "MedCare Telehealth Network",
      metrics: "99.99% video uptime across 40,000+ monthly clinical sessions",
      summary: "Developed a HIPAA-compliant cross-platform telehealth platform reducing clinic patient wait times by 62%.",
    },
    displayOrder: 3,
    isActive: true,
  },
  {
    name: "Enterprise SaaS & B2B",
    slug: "saas",
    icon: "Cloud",
    shortDescription: "Multi-tenant platforms & subscription billing",
    badge: "Multi-Tenant Cloud",
    headline: "Hyperscale Multi-Tenant Architectures & Automated B2B Workflows",
    description: "Robust B2B software foundations with isolated tenant data partitions, granular role-based permissions, automated usage-metered billing, and enterprise Single Sign-On (SSO).",
    stats: [
      { label: "Tenant Isolation", value: "Row-Level" },
      { label: "SSO Protocols", value: "SAML 2.0" },
      { label: "API Response P99", value: "45ms" },
      { label: "Active Tenants", value: "1,200+" },
    ],
    challenges: [
      {
        problem: "Noisy neighbor syndrome in shared database instances",
        solution: "PostgreSQL row-level security (RLS) coupled with dynamic tenant connection connection pools.",
      },
      {
        problem: "Complex usage-based metering and tier threshold calculations",
        solution: "Event streaming pipeline recording tenant compute units with idempotent monthly invoice generation.",
      },
      {
        problem: "Enterprise security demands for custom Okta/Azure AD SSO",
        solution: "Plug-and-play SAML 2.0 and OIDC federation engine with Just-In-Time (JIT) provisioning.",
      },
    ],
    architecture: [
      "PostgreSQL Multi-Tenant Row Level Security (RLS) Engine",
      "Event-Driven Distributed Queue System with BullMQ & Redis",
      "Federated Identity Provider for SAML, Okta, and Google Workspace",
      "Dynamic Rate Limiting and Quota Enforcement per Tenant Tier",
    ],
    techStack: ["Next.js 16", "PostgreSQL", "Neon", "Redis", "TypeScript", "Tailwind CSS", "Docker"],
    caseStudy: {
      client: "ApexFlow Enterprise Platform",
      metrics: "Scaled to 1,200 enterprise tenants with zero cross-tenant leaks",
      summary: "Architected a multi-tenant business operating suite replacing four disparate legacy tools with a single fast web platform.",
    },
    displayOrder: 4,
    isActive: true,
  },
  {
    name: "Logistics & Supply Chain",
    slug: "logistics",
    icon: "Truck",
    shortDescription: "Fleet tracking & automated warehouse ERP",
    badge: "Real-Time Telematics",
    headline: "Geospatial Fleet Telematics & Automated Warehouse Inventory Systems",
    description: "Live GPS fleet dispatching, barcode scanning warehouse management, and AI-powered route optimization engines engineered for high-throughput supply chain operations.",
    stats: [
      { label: "GPS Telemetry Ping", value: "Sub-Second" },
      { label: "Route Fuel Savings", value: "18.4%" },
      { label: "Inventory Accuracy", value: "99.8%" },
      { label: "Active Fleet Units", value: "2,500+" },
    ],
    challenges: [
      {
        problem: "High-frequency geospatial telemetry pings overwhelming database writes",
        solution: "Timescale/PostgreSQL time-series partitions buffering writes via high-throughput Redis streams.",
      },
      {
        problem: "Sub-optimal vehicle routing resulting in costly transit delays",
        solution: "Heuristic TSP path-finding algorithms recalculating dynamic routes on live traffic incidents.",
      },
      {
        problem: "Warehouse barcode scanner connectivity drops in cold-storage zones",
        solution: "Offline-first Progressive Web App (PWA) with local IndexedDB sync on reconnect.",
      },
    ],
    architecture: [
      "Geospatial Ingestion Engine handling 5,000 telemetry events/sec",
      "Dynamic Route Optimization Microservice using Graph Algorithms",
      "Offline-Resilient Warehouse Barcode Progressive Web App",
      "Automated Bill of Lading (BOL) & Dispatch Document Generation",
    ],
    techStack: ["TypeScript", "PostGIS", "Redis Streams", "Mapbox GL", "Next.js", "Docker", "Go"],
    caseStudy: {
      client: "TransLogix Express Fleet",
      metrics: "18% reduction in route fuel burn, 0 lost shipments across 8 hubs",
      summary: "Built a centralized fleet telemetry and barcode warehouse dispatch system managing 600+ transport vehicles.",
    },
    displayOrder: 5,
    isActive: true,
  },
];

export const SEED_SERVICE_CATEGORIES = [
  {
    id: "software-engineering",
    name: "Software Engineering",
    slug: "software-engineering",
    icon: "Code2",
    description: "Modern, high-performance web systems and mobile applications built with sub-second response times.",
    badge: "High-Scale",
    displayOrder: 1,
    isActive: true,
    services: [
      {
        name: "Web App Development",
        slug: "web-app-development",
        icon: "Code2",
        shortDescription: "Scalable Next.js & React architectures",
        description: "Production Next.js 16 & React 19 web applications with sub-second response times and scalable cloud infrastructure.",
        deliverables: ["Production Next.js 16 & React 19 web applications", "Edge caching & Core Web Vitals 95+", "REST & GraphQL API integrations", "Comprehensive TypeScript testing"],
        techStack: ["Next.js", "React", "TypeScript", "Node.js", "Tailwind CSS"],
        displayOrder: 1,
        isActive: true,
        showInMenu: true,
      },
      {
        name: "Mobile App Development",
        slug: "mobile-app-development",
        icon: "Smartphone",
        shortDescription: "Cross-platform iOS & Android experiences",
        description: "Native-grade cross-platform iOS & Android mobile applications built using React Native and Flutter with offline resilience.",
        deliverables: ["Cross-platform iOS & Android mobile development", "Offline-first data sync & SQLite caching", "Native push notifications & biometric auth", "App Store & Play Store publication"],
        techStack: ["React Native", "Flutter", "iOS", "Android", "TypeScript"],
        displayOrder: 2,
        isActive: true,
        showInMenu: true,
      },
      {
        name: "Microservices & APIs",
        slug: "microservices-apis",
        icon: "Server",
        shortDescription: "High-throughput backend architectures",
        description: "Decoupled microservice architectures and high-throughput REST and gRPC gateways designed for immense concurrency.",
        deliverables: ["High-throughput REST/GraphQL APIs", "Event-driven messaging with Redis & Kafka", "Distributed rate limiting & circuit breakers", "Automated OpenAPI / Swagger docs"],
        techStack: ["Node.js", "Go", "Docker", "PostgreSQL", "Redis"],
        displayOrder: 3,
        isActive: true,
        showInMenu: true,
      },
      {
        name: "Database & Cloud Cache",
        slug: "database-cloud-cache",
        icon: "Database",
        shortDescription: "Neon Serverless PostgreSQL & Redis",
        description: "Optimized relational and serverless database schemas with sub-millisecond in-memory cache layers.",
        deliverables: ["Serverless PostgreSQL query tuning", "Redis distributed caching & session stores", "Automated zero-downtime database migrations", "Read replica & failover configuration"],
        techStack: ["PostgreSQL", "Neon", "Redis", "Prisma", "SQL"],
        displayOrder: 4,
        isActive: true,
        showInMenu: true,
      },
      {
        name: "DevOps & CI/CD Pipelines",
        slug: "devops-cicd",
        icon: "GitMerge",
        shortDescription: "Automated containerization & deployments",
        description: "Rock-solid continuous deployment pipelines, automated linting/testing, and containerized cloud setups.",
        deliverables: ["Automated GitHub Actions CI/CD workflows", "Docker containerization & multi-stage builds", "Cloud infrastructure provisioning (AWS/Vercel)", "Zero-downtime blue/green deployment setup"],
        techStack: ["Docker", "GitHub Actions", "AWS", "Linux", "Kubernetes"],
        displayOrder: 5,
        isActive: true,
        showInMenu: true,
      },
      {
        name: "Software Modernization",
        slug: "software-modernization",
        icon: "Zap",
        shortDescription: "Legacy system refactoring & optimization",
        description: "Transform legacy architectures into fast, modern micro-frontends and scalable cloud backends.",
        deliverables: ["Legacy codebase audits & refactoring plans", "Database normalization & data migration", "Performance bottleneck resolution (3x-10x speedup)", "Security vulnerability remediation"],
        techStack: ["Next.js", "TypeScript", "Node.js", "PostgreSQL"],
        displayOrder: 6,
        isActive: true,
        showInMenu: true,
      },
    ],
  },
  {
    id: "erp-crm",
    name: "Enterprise ERP & CRM",
    slug: "erp-crm",
    icon: "Building2",
    description: "Centralize your entire company operations into a unified, secure dashboard with real-time tracking.",
    badge: "Automation",
    displayOrder: 2,
    isActive: true,
    services: [
      {
        name: "Custom Enterprise ERP",
        slug: "custom-erp",
        icon: "Building2",
        shortDescription: "Tailored operations & reporting systems",
        description: "Tailored ERP systems designed around your exact business logic with multi-department synchronization.",
        deliverables: ["Tailored ERP systems designed around exact business logic", "Real-time KPI reporting & analytics dashboards", "Departmental workflow automation", "Multi-branch / location management"],
        techStack: ["Next.js", "PostgreSQL", "Redis", "TypeScript"],
        displayOrder: 1,
        isActive: true,
        showInMenu: true,
      },
      {
        name: "CRM Workflow Automation",
        slug: "crm-workflow",
        icon: "Workflow",
        shortDescription: "Intelligent lead pipeline & deal tracking",
        description: "Streamline customer touchpoints, lead scoring, deal velocity, and automated communication triggers.",
        deliverables: ["Visual Kanban lead pipeline tracking", "Automated email & SMS follow-up triggers", "Customer interaction audit history", "Sales rep quota & performance metrics"],
        techStack: ["React", "Node.js", "PostgreSQL", "Tailwind CSS"],
        displayOrder: 2,
        isActive: true,
        showInMenu: true,
      },
      {
        name: "Inventory & Supply Chain",
        slug: "inventory-supply-chain",
        icon: "PackageCheck",
        shortDescription: "Real-time stock tracking & barcode systems",
        description: "Barcode and QR-enabled warehouse tracking with multi-location stock replenishment triggers.",
        deliverables: ["Real-time inventory sync & barcode/QR operations", "Low stock alerts & auto-reorder thresholds", "Warehouse bin & pallet mapping", "Purchase order reconciliation"],
        techStack: ["PostgreSQL", "PWA", "Redis", "Docker"],
        displayOrder: 3,
        isActive: true,
        showInMenu: true,
      },
      {
        name: "Billing & Invoicing Engine",
        slug: "billing-invoicing",
        icon: "Receipt",
        shortDescription: "Multi-currency tax & subscription billing",
        description: "Automated recurring invoices, tax calculations (GST/VAT), payment gateway sync, and audit reports.",
        deliverables: ["Multi-currency billing, GST/VAT tax calculation", "Automated PDF invoice generation & delivery", "Payment gateway webhook integration", "Overdue payment reminders & dunning"],
        techStack: ["Node.js", "PostgreSQL", "Stripe", "Razorpay"],
        displayOrder: 4,
        isActive: true,
        showInMenu: true,
      },
      {
        name: "Role-Based Client Portals",
        slug: "client-portals",
        icon: "Users",
        shortDescription: "Secure enterprise workspaces for clients",
        description: "Dedicated client collaboration portals for tracking deliverables, invoices, tickets, and agreements.",
        deliverables: ["Role-based portals with granular permissions (RBAC)", "Secure document sharing & deliverable signoff", "Client messaging & support desk integration", "Activity and login audit logs"],
        techStack: ["Next.js", "JWT", "PostgreSQL", "Tailwind CSS"],
        displayOrder: 5,
        isActive: true,
        showInMenu: true,
      },
      {
        name: "Third-Party Data Sync",
        slug: "third-party-sync",
        icon: "RefreshCw",
        shortDescription: "ERP, SAP, and accounting integrations",
        description: "Bi-directional data bridges between Websmith systems and existing SAP, QuickBooks, Salesforce, and legacy setups.",
        deliverables: ["Automated two-way data sync pipelines", "Webhook listeners & event transformers", "Conflict resolution heuristics", "Historical data migration scripts"],
        techStack: ["Node.js", "PostgreSQL", "Kafka", "REST API"],
        displayOrder: 6,
        isActive: true,
        showInMenu: true,
      },
    ],
  },
  {
    id: "licensing-ulp",
    name: "Universal Licensing (ULP)",
    slug: "licensing-ulp",
    icon: "KeyRound",
    description: "Commercial software licensing infrastructure for desktop, server, and mobile software vendors.",
    badge: "Proprietary Tech",
    displayOrder: 3,
    isActive: true,
    services: [
      {
        name: "Universal Licensing Engine",
        slug: "licensing-engine",
        icon: "KeyRound",
        shortDescription: "Cryptographic license generation & verification",
        description: "Multi-runtime software licensing engine supporting cryptographic hardware binding, node locking, and trial grace periods.",
        deliverables: ["Hardware fingerprinting (CPU, MAC, Motherboard)", "Cryptographic license key signing & validation", "Offline grace period validation", "Centralized license lifecycle dashboard"],
        techStack: ["Go", "Node.js", "HMAC-SHA256", "Neon PostgreSQL"],
        displayOrder: 1,
        isActive: true,
        showInMenu: true,
      },
      {
        name: "13-Language Native SDKs",
        slug: "language-sdks",
        icon: "Cpu",
        shortDescription: "Python, Go, C++, Rust, C#, Java, Swift, etc.",
        description: "Automated SDK compilation across 13 programming languages enabling one-line license checks.",
        deliverables: ["Production-ready client libraries for 13 runtimes", "Anti-tamper & memory integrity checks", "Zero external dependency binaries", "Complete code examples & documentation"],
        techStack: ["C++", "Rust", "Go", "Python", "C#", "Java"],
        displayOrder: 2,
        isActive: true,
        showInMenu: true,
      },
      {
        name: "Trial Automation Engine",
        slug: "trial-automation",
        icon: "ShieldCheck",
        shortDescription: "Automated hardware-bound evaluations",
        description: "Prevent trial resets and abuse with cryptographic hardware binding and automatic expiry clocks.",
        deliverables: ["Time-bombed trial evaluation periods", "Cryptographic trial abuse detection", "Automated email/SMS trial conversion prompts", "Seamless upgrade to commercial keys"],
        techStack: ["PostgreSQL", "Redis", "AES-256-GCM"],
        displayOrder: 3,
        isActive: true,
        showInMenu: true,
      },
      {
        name: "Universal License Center (ULC)",
        slug: "license-center-gui",
        icon: "AppWindow",
        shortDescription: "Embeddable desktop GUI client",
        description: "Turnkey GUI modal for end-user key activation, trial countdowns, and renewal payments.",
        deliverables: ["Turnkey activation GUI dialogs", "White-label branding for software vendors", "Direct renewal checkout links", "Offline license file importer"],
        techStack: ["Electron", "React", "Tailwind CSS"],
        displayOrder: 4,
        isActive: true,
        showInMenu: true,
      },
    ],
  },
  {
    id: "design-product",
    name: "Design & Product",
    slug: "design-product",
    icon: "Palette",
    description: "World-class interface design, design systems, and product research for enterprise platforms.",
    badge: "Design-Led",
    displayOrder: 4,
    isActive: true,
    services: [
      {
        name: "UI/UX Architecture",
        slug: "ui-ux-architecture",
        icon: "Layout",
        shortDescription: "High-conversion enterprise interfaces",
        description: "Clean, intuitive enterprise UI/UX with modern typography, dark modes, and effortless user journeys.",
        deliverables: ["Complete Figma design libraries & wireframes", "Interactive prototypes & user testing", "Design token systems (colors, spacing, type)", "Accessibility (WCAG 2.1 AA) compliance"],
        techStack: ["Figma", "Design Tokens", "Tailwind CSS"],
        displayOrder: 1,
        isActive: true,
        showInMenu: true,
      },
      {
        name: "Design Systems & Components",
        slug: "design-systems",
        icon: "Component",
        shortDescription: "Reusable React design system libraries",
        description: "Custom, scalable UI component libraries aligned to your brand identity.",
        deliverables: ["Atomic component library in React/Tailwind", "Living documentation with Storybook", "Consistent dark/light mode theming", "Micro-interaction animations"],
        techStack: ["React", "TypeScript", "Tailwind CSS", "Framer Motion"],
        displayOrder: 2,
        isActive: true,
        showInMenu: true,
      },
      {
        name: "Product Prototyping",
        slug: "product-prototyping",
        icon: "Sparkles",
        shortDescription: "Rapid validation prototypes & MVPs",
        description: "From concept to clickable MVP in weeks with proven user research and validation.",
        deliverables: ["Rapid interactive proof-of-concept", "User interview synthesis & persona mapping", "Clickable high-fidelity stakeholder demo", "Technical feasibility assessment"],
        techStack: ["Next.js", "Figma", "React"],
        displayOrder: 3,
        isActive: true,
        showInMenu: true,
      },
    ],
  },
  {
    id: "ai-solutions",
    name: "AI Solutions",
    slug: "ai-solutions",
    icon: "Bot",
    description: "Production-grade AI integrations, autonomous agent workflows, and private LLM fine-tuning.",
    badge: "Next-Gen",
    displayOrder: 5,
    isActive: true,
    services: [
      {
        name: "AI Agent Orchestration",
        slug: "ai-agents",
        icon: "Bot",
        shortDescription: "Autonomous task-executing AI agents",
        description: "Autonomous multi-agent workflows executing customer support, data extraction, and report generation.",
        deliverables: ["Autonomous multi-agent task execution", "Tool calling & database querying integrations", "Human-in-the-loop approval gates", "Token cost monitoring & rate limiting"],
        techStack: ["Python", "LangChain", "OpenAI", "Anthropic", "Redis"],
        displayOrder: 1,
        isActive: true,
        showInMenu: true,
      },
      {
        name: "Private LLMs & RAG Engines",
        slug: "private-llm-rag",
        icon: "BrainCircuit",
        shortDescription: "Secure internal enterprise intelligence",
        description: "Retrieval-Augmented Generation (RAG) over proprietary enterprise documentation with zero data leakage.",
        deliverables: ["Vector database setup (pgvector/Pinecone)", "Document chunking & embedding ingestion pipelines", "Hybrid keyword & semantic vector search", "Zero data retention enterprise guarantees"],
        techStack: ["pgvector", "PostgreSQL", "Python", "FastAPI"],
        displayOrder: 2,
        isActive: true,
        showInMenu: true,
      },
      {
        name: "Intelligent Document Processing",
        slug: "document-processing",
        icon: "FileSearch",
        shortDescription: "Automated OCR & unstructured data parsing",
        description: "Transform scanned invoices, legal contracts, and medical forms into structured JSON records.",
        deliverables: ["Multimodal OCR & tabular data extraction", "Automated contract clause comparison", "Real-time validation against business rules", "Export to ERP & accounting systems"],
        techStack: ["Python", "OpenCV", "Tesseract", "FastAPI"],
        displayOrder: 3,
        isActive: true,
        showInMenu: true,
      },
    ],
  },
];
