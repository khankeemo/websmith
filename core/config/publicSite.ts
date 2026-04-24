import {
  BookOpen,
  Briefcase,
  Code2,
  Compass,
  FileText,
  Headphones,
  Layers3,
  LifeBuoy,
  ShieldCheck,
  Sparkles,
  Workflow,
  type LucideIcon,
} from "lucide-react";

export type FooterLink = {
  label: string;
  href: string;
};

export type FooterSection = {
  title: string;
  links: FooterLink[];
};

export type SocialLink = {
  label: string;
  href: string;
};

export type BlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  category: "Development" | "Design" | "Business";
  publishedAt: string;
  readTime: string;
  content: Array<{
    heading: string;
    body: string[];
  }>;
};

export type CareerRole = {
  id: string;
  title: string;
  location: string;
  type: string;
  summary: string;
  responsibilities: string[];
};

export type DocSection = {
  id: string;
  title: string;
  icon: LucideIcon;
  items: string[];
};

export const publicPrimaryNav = [
  { name: "Home", href: "/" },
  { name: "About", href: "/about" },
  { name: "Careers", href: "/careers" },
  { name: "Blog", href: "/blog" },
  { name: "Documentation", href: "/documentation" },
  { name: "Support", href: "/support" },
  { name: "Contact", href: "/#contact" },
] as const;

export const publicFooterConfig = {
  brand: {
    name: "WebSmith Digital",
    tagline: "Building powerful digital ecosystems and smart solutions that work for your business.",
  },
  socials: [
    { label: "Twitter", href: "https://twitter.com/websmith" },
    { label: "Instagram", href: "https://instagram.com/websmith" },
    { label: "GitHub", href: "https://github.com/websmith" },
    { label: "Facebook", href: "https://facebook.com/websmith" },
  ] satisfies SocialLink[],
  sections: [
    {
      title: "Company",
      links: [
        { label: "About", href: "/about" },
        { label: "Careers", href: "/careers" },
        { label: "Blog", href: "/blog" },
      ],
    },
    {
      title: "Resources",
      links: [
        { label: "Documentation", href: "/documentation" },
        { label: "Support", href: "/support" },
        { label: "Contact", href: "/#contact" },
      ],
    },
    {
      title: "Legal",
      links: [
        { label: "Privacy Policy", href: "/privacy" },
        { label: "Terms of Services", href: "/terms" },
      ],
    },
  ] satisfies FooterSection[],
} as const;

export const aboutDifferentiators = [
  {
    title: "Embedded delivery leadership",
    description: "Senior product and engineering coordination is built into every engagement, so scope, execution, and communication stay aligned from kickoff to launch.",
  },
  {
    title: "Operational transparency",
    description: "Clients see project status, shared files, approvals, invoices, and notifications in one workspace instead of juggling disconnected tools.",
  },
  {
    title: "Launch-to-support continuity",
    description: "The same team that ships your product can keep maintaining, iterating, and documenting it after release without a handoff gap.",
  },
];

export const careerRoles: CareerRole[] = [
  {
    id: "frontend-engineer",
    title: "Frontend Engineer",
    location: "Remote",
    type: "Full-time",
    summary: "Build polished, resilient product interfaces across marketing sites and client portals.",
    responsibilities: [
      "Ship production-ready React and Next.js experiences",
      "Collaborate with design on reusable interface systems",
      "Improve performance, accessibility, and frontend quality",
    ],
  },
  {
    id: "product-designer",
    title: "Product Designer",
    location: "Remote",
    type: "Contract",
    summary: "Turn ambiguous business goals into flows, interfaces, and UX systems that teams can build with confidence.",
    responsibilities: [
      "Lead discovery and workflow mapping",
      "Create interface concepts and handoff-ready specs",
      "Partner with engineering during implementation",
    ],
  },
  {
    id: "delivery-manager",
    title: "Delivery Manager",
    location: "Hybrid",
    type: "Full-time",
    summary: "Keep cross-functional delivery on track across timelines, communication loops, and milestone quality.",
    responsibilities: [
      "Own sprint planning and stakeholder updates",
      "Track dependencies and delivery risks",
      "Keep scope and progress visible to clients",
    ],
  },
];

export const blogPosts: BlogPost[] = [
  {
    slug: "shipping-client-portals-that-reduce-chaos",
    title: "Shipping Client Portals That Reduce Delivery Chaos",
    excerpt: "A practical look at turning scattered project communication into one structured client experience.",
    category: "Development",
    publishedAt: "2026-04-10",
    readTime: "6 min read",
    content: [
      {
        heading: "Centralize the truth",
        body: [
          "When timelines, approvals, and files live in separate tools, every update becomes manual translation. A client portal works best when it becomes the place where project status and communication are already happening.",
          "That means tying project health, notifications, file sharing, and billing into one surface clients can trust.",
        ],
      },
      {
        heading: "Design for reassurance",
        body: [
          "Clients do not need every internal detail. They need the current state, what changed recently, what is expected next, and how to ask for help.",
          "The most effective portals reduce anxiety by making progress visible and action paths obvious.",
        ],
      },
    ],
  },
  {
    slug: "design-systems-for-small-fast-teams",
    title: "Design Systems for Small, Fast-Moving Teams",
    excerpt: "Why lightweight standards beat bloated libraries when your team needs speed and consistency at the same time.",
    category: "Design",
    publishedAt: "2026-04-06",
    readTime: "5 min read",
    content: [
      {
        heading: "Start with decisions, not components",
        body: [
          "A useful design system begins with clear choices about spacing, typography, color, states, and interaction patterns.",
          "Once those choices are stable, components become faster to build and easier to maintain.",
        ],
      },
      {
        heading: "Keep the system usable",
        body: [
          "Small teams need systems that explain decisions quickly. Documentation, examples, and consistent naming often matter more than sheer component count.",
        ],
      },
    ],
  },
  {
    slug: "what-business-leaders-actually-need-from-an-agency",
    title: "What Business Leaders Actually Need From an Agency Partner",
    excerpt: "Reliable communication, predictable execution, and visible outcomes matter more than impressive buzzwords.",
    category: "Business",
    publishedAt: "2026-03-28",
    readTime: "4 min read",
    content: [
      {
        heading: "Clarity beats theater",
        body: [
          "Leaders want confidence that priorities are understood, milestones are real, and tradeoffs are surfaced early.",
          "The strongest partnerships come from transparent reporting and disciplined follow-through.",
        ],
      },
      {
        heading: "Sustainable delivery wins",
        body: [
          "A healthy delivery model does not optimize for one dramatic sprint. It builds repeatable momentum that keeps product quality high after launch as well.",
        ],
      },
    ],
  },
];

export const documentationSections: DocSection[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    icon: Compass,
    items: [
      "Start with a discovery call and define delivery goals",
      "Choose the service mix that matches your current stage",
      "Receive timeline, scope, and workspace setup before kickoff",
    ],
  },
  {
    id: "features-overview",
    title: "Features Overview",
    icon: Layers3,
    items: [
      "Project tracking with status, progress, and timeline visibility",
      "Shared files, invoices, and payment history in one portal",
      "Role-based admin, client, and developer workspaces",
    ],
  },
  {
    id: "api-integrations",
    title: "API / Integrations",
    icon: Workflow,
    items: [
      "Stripe-powered billing and payment workflows",
      "Notification delivery across internal and client-facing modules",
      "Service forms and lead capture hooks for public requests",
    ],
  },
  {
    id: "faqs",
    title: "FAQs",
    icon: LifeBuoy,
    items: [
      "How fast can a project start after approval?",
      "Can clients review progress without seeing internal admin tools?",
      "Do hosted project URLs and deliverables stay visible after launch?",
    ],
  },
];

export const supportFaqs = [
  {
    question: "How do I contact support?",
    answer: "Use the contact support CTA on this page or email support@websmith.dev and our team will triage the request.",
  },
  {
    question: "What happens after I submit a support request?",
    answer: "We log the request, route it to the right team, and update you with next steps and timing.",
  },
  {
    question: "Can I report billing or launch issues here?",
    answer: "Yes. Support covers delivery questions, billing follow-up, account access, and live project issues.",
  },
];

export const privacySections = [
  {
    title: "Data collection",
    points: [
      "We collect contact details, project details, support submissions, and account activity required to deliver services.",
      "We may collect payment-related metadata and operational analytics needed to maintain the platform.",
    ],
  },
  {
    title: "Data usage",
    points: [
      "Collected data is used to provide services, communicate project updates, process payments, and improve delivery operations.",
      "We limit internal access to data based on role and operational need.",
    ],
  },
  {
    title: "Cookies",
    points: [
      "Cookies and similar storage may be used for sessions, authentication state, preferences, and performance measurement.",
    ],
  },
  {
    title: "Third-party services",
    points: [
      "We may use providers such as Stripe for payments and analytics tools for usage insights and platform reliability.",
      "Third-party providers only receive data required for their specific service role.",
    ],
  },
];

export const termsSections = [
  {
    title: "User responsibilities",
    points: [
      "Users must provide accurate information, maintain account security, and use the platform lawfully.",
      "Clients are responsible for timely feedback, approvals, and access needed to progress delivery.",
    ],
  },
  {
    title: "Payment and refund policy",
    points: [
      "Project billing, milestones, and payment timing are governed by the agreed commercial scope.",
      "Refund decisions depend on the service stage, completed work, and any written agreement in effect.",
    ],
  },
  {
    title: "Limitation of liability",
    points: [
      "To the fullest extent permitted by law, liability is limited to fees paid for the relevant services.",
      "We are not responsible for indirect, incidental, or consequential damages arising from platform use or delays outside reasonable control.",
    ],
  },
];

export const aboutHighlights = [
  { label: "Mission", text: "Help teams ship digital products with more clarity, accountability, and confidence." },
  { label: "Vision", text: "Build a delivery model where public experience, project operations, and long-term support work as one system." },
];

export const aboutMetrics = [
  { label: "Delivery Ops", value: "Visible progress from kickoff to launch" },
  { label: "Public Presence", value: "Structured pages for trust, support, and discovery" },
  { label: "Post-Launch", value: "Support, documentation, and payment continuity" },
];

export const documentationHighlights = [
  {
    title: "Structured onboarding",
    description: "Clients move from interest to kickoff with clear service selection, discovery, and portal visibility.",
    icon: Sparkles,
  },
  {
    title: "Platform-first operations",
    description: "Project, invoice, notification, and support flows are designed to reduce manual coordination.",
    icon: Code2,
  },
  {
    title: "Launch-ready governance",
    description: "Documentation, legal pages, and support pathways keep the public experience professional and dependable.",
    icon: ShieldCheck,
  },
];

export const supportStatus = {
  label: "System status",
  state: "Operational",
  detail: "Client portal, project updates, and billing workflows are operating normally.",
};

export const careerValues = [
  "Ownership without drama",
  "Clear communication over performative status updates",
  "Thoughtful design and engineering collaboration",
];

export const blogCategories = ["Development", "Design", "Business"] as const;

export const homeFooterCta = {
  href: "/services",
  label: "Start a Project",
};

export const publicPageIcons = {
  about: Compass,
  careers: Briefcase,
  blog: BookOpen,
  docs: FileText,
  support: Headphones,
};
