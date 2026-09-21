# WebSmith Digital Platform — Complete Codebase Architecture & System Reference

> **Comprehensive Technical Reference & Codebase Study**  
> **Repository:** `Websmith` (WebSmith Digital Universal Platform)  
> **Framework:** Next.js 16 (App Router), React 19, TypeScript  
> **Database:** Neon Serverless PostgreSQL (with SQL & Mongo-Compatible Document Layer)  
> **Outbound Engines:** Nodemailer (PrivateEmail SMTP), Fast2SMS, Upstash Redis/QStash  

---

## Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [Technology Stack & Dependencies](#2-technology-stack--dependencies)
3. [Repository Directory Structure](#3-repository-directory-structure)
4. [Core Architectural Subsystems](#4-core-architectural-subsystems)
   - [4.1 Public Website & Lead Conversion Funnel](#41-public-website--lead-conversion-funnel)
   - [4.2 Get-in-Touch, Tickets & Real-Time Secure Chat](#42-get-in-touch-tickets--real-time-secure-chat)
   - [4.3 Client Portal & Authentication](#43-client-portal--authentication)
   - [4.4 Admin Console & Query Inbox](#44-admin-console--query-inbox)
   - [4.5 Universal License Platform (ULP)](#45-universal-license-platform-ulp)
   - [4.6 Multi-Runtime SDK Publisher (13 Languages)](#46-multi-runtime-sdk-publisher-13-languages)
   - [4.7 Software Storefront, Cart & Checkout](#47-software-storefront-cart--checkout)
   - [4.8 Communications Center & Outbound Mailer Engine](#48-communications-center--outbound-mailer-engine)
5. [Database Architecture & Hybrid Document Engine](#5-database-architecture--hybrid-document-engine)
6. [API Architecture & Route Reference](#6-api-architecture--route-reference)
   - [6.1 Public v1 API (`/api/v1/*`)](#61-public-v1-api-apiv1)
   - [6.2 Tickets & Chat API (`/api/tickets/*`, `/api/chat/*`)](#62-tickets--chat-api-apitickets-apichat)
   - [6.3 Internal API Center (`/internal/backend/*`)](#63-internal-api-center-internalbackend)
7. [Security, Authentication & Anti-Spam Architecture](#7-security-authentication--anti-spam-architecture)
8. [Configuration & Environment Variables](#8-configuration--environment-variables)
9. [Build, Development & Verification Workflows](#9-build-development--verification-workflows)

---

## 1. Executive Summary

**WebSmith Digital** is an enterprise-grade digital services, software distribution, and universal licensing platform. The codebase powers three interrelated ecosystems:
1. **Public Agency & Storefront**: Agency services showcase, interactive consultation scheduling with 418 IANA world timezones and dual-time conversion, public contact forms, direct encrypted customer chat, and a self-service software store with digital checkout and license delivery.
2. **Universal License Platform (ULP)**: End-to-end licensing infrastructure for desktop, mobile, and server software. Enables software vendors to issue licenses, manage trial periods, enforce hardware binding (MAC, CPU, Disk, Motherboard), handle activations/reactivations, renewals, and offline grace periods.
3. **Multi-Runtime SDK Publisher**: An automated compiler and packager that outputs production-grade SDKs across **13 programming languages** (Python, Node.js, Go, Rust, Java, .NET/C#, C++, C, PHP, JavaScript, TypeScript, Bun, Deno) embedding the Universal License Center (ULC) UI and HMAC-signed API client.
4. **Unified Operations Center**: Centralized administration console featuring a real-time Query Inbox, client portal onboarding, automated credential issuance, ticket message threads, IMAP/SMTP mailboxes, and event-driven notifications.

---

## 2. Technology Stack & Dependencies

| Layer | Primary Technology | Key Dependencies | Notes |
|---|---|---|---|
| **Frontend Framework** | Next.js 16.2.1, React 19.2.4 | `next`, `react`, `react-dom` | Full App Router implementation with Server Components & Client Hydration |
| **Styling & Animation** | Tailwind CSS 3.4.19, Framer Motion | `tailwindcss`, `framer-motion`, `lucide-react`, `react-icons` | Dark/light glassmorphic UI, responsive grids, micro-animations |
| **Charts & Metrics** | Recharts 3.8.1 | `recharts` | Admin dashboards, activation analytics, revenue graphs |
| **Primary Datastore** | Neon Serverless PostgreSQL | `@neondatabase/serverless`, `pg` | Relational schema (`licenses`, `products`, `orders`) + Mongo document adapter (`portal_*`) |
| **Caching & Queues** | Upstash Redis, QStash, Workflow | `@upstash/redis`, `@upstash/qstash`, `@upstash/workflow` | Distributed rate limiting, nonce replay tracking, SDK compilation queue |
| **Email Engine** | Nodemailer (Pooled SMTP) | `nodemailer`, `mailparser`, `imap` | PrivateEmail SMTP delivery, multi-mailbox IMAP sync, HTML templating |
| **SMS Gateway** | Fast2SMS Bulk V2 | Native fetch client in `lib/sms/fast2sms.ts` | Mobile OTP verification, instant client SMS alerts |
| **Authentication & Crypto** | JOSE, JWT, BCrypt | `jose`, `jsonwebtoken`, `bcryptjs`, `crypto` | Edge middleware auth gate, AES-256-GCM credential encryption at rest |
| **Packaging** | Archiver 8.0.0 | `archiver` | In-memory stream packaging of generated multi-language SDK zips |

---

## 3. Repository Directory Structure

```
websmith/
├── app/                              # Next.js 16 App Router (274+ pages & routes)
│   ├── page.tsx                      # Main Agency Landing Page & Contact/Schedule Form
│   ├── layout.tsx                    # Root HTML layout with providers & fonts
│   ├── ClientLayout.tsx              # Global navigation header, theme, & footer
│   ├── (public)/                     # Public marketing pages & service details
│   ├── admin/                        # Admin Portal & Query Inbox
│   │   ├── messages/                 # Query Inbox & two-way ticket reply threads
│   │   ├── clients/                  # Client directory & account management
│   │   ├── licenses/                 # License generation & management UI
│   │   └── invoices/                 # Billing & invoice management
│   ├── api/                          # Public & customer-facing API routes
│   │   ├── v1/                       # Public License & Store API (HMAC guarded)
│   │   │   ├── activations/          # Device activation & validation
│   │   │   ├── checkout/             # Payment processing & license creation
│   │   │   ├── store/                # Product catalog & pricing plans
│   │   │   ├── license/              # Status lookup, hardware reset, renewal
│   │   │   └── support/              # In-app SDK support tickets & replies
│   │   ├── tickets/                  # Public website tickets & welcome emails
│   │   ├── chat/                     # Direct encrypted customer chat API
│   │   └── portal/                   # Client portal session & data APIs
│   ├── client/                       # Client Portal Pages (Projects, Licenses, Support)
│   ├── internal/                     # API Center & Universal Licensing Publisher
│   │   ├── api/                      # Protected Admin API Center frontend pages
│   │   ├── backend/                  # Internal REST API route handlers
│   │   └── publisher/                # Multi-language SDK generation engine
│   ├── software-store/               # Public software shopping cart & checkout
│   ├── license/                      # Public customer self-service license portal
│   └── chat/                         # Direct browser-to-admin encrypted chat UI
├── components/                       # Modular Reusable React Components
│   ├── admin/                        # Admin tables, metric cards, modal dialogs
│   ├── internal-api/                 # Universal Licensing dialogs & SDK controls
│   ├── layout/                       # Headers, Footers, Navigation drawers
│   └── ui/                           # Glassmorphic buttons, inputs, badge components
├── core/                             # Enterprise Core Configuration & Services
│   ├── config/                       # Site constants, branding, OAuth settings
│   ├── services/                     # Business logic (Client greeting, timezones)
│   └── utils/                        # Phone validation, sanitization, currency formatters
├── lib/                              # Shared Backend Libraries & Integrations
│   ├── backend-db/                   # Neon PostgreSQL raw connection pool & migrations
│   ├── server/                       # MongoDB-compatible document engine over PostgreSQL
│   ├── email/                        # Outbound mailer, template renderer, IMAP mailbox
│   ├── tickets/                      # Ticket generation, WSD-XXXXXX IDs, resolution emails
│   ├── sms/                          # Fast2SMS gateway client
│   ├── license/                      # Hardware hash computation & license key algorithms
│   └── public-api/                   # HMAC signature verification & rate limiting
├── docs/                             # Architecture specs, master implementation docs, rules
├── proxy.ts                          # Edge middleware security gate for /internal/*
├── package.json                      # Project dependencies & build scripts
└── tsconfig.json                     # TypeScript strict configuration
```

---

## 4. Core Architectural Subsystems

### 4.1 Public Website & Lead Conversion Funnel
- **File**: [`app/page.tsx`](file:///f:/PRojects/WSD/websmith/app/page.tsx)
- **Features**:
  - **Dynamic Showcase**: Hero section, full digital services matrix (Web, Mobile, Cloud, AI, Licensing), client reviews, live portfolio counters.
  - **Global Consultation Scheduler**:
    - Complete **418 IANA world timezone database** grouped by global continents/regions with automatic browser detection (`Intl.DateTimeFormat`).
    - 8 two-hour granular appointment slots spanning `08:00 AM – 12:00 AM Midnight`.
    - **Dual-Time Preview Card**: Converts the selected client slot in real time into **India Standard Time (IST)** so both client and agency sales teams are synchronized.
    - Full client contact capture: Dual phone inputs (Calling Phone + WhatsApp Phone with country codes), Company, Subject, and Project Description.

### 4.2 Get-in-Touch, Tickets & Real-Time Secure Chat
- **Files**:
  - Route: [`app/api/tickets/public/route.ts`](file:///f:/PRojects/WSD/websmith/app/api/tickets/public/route.ts)
  - Ticket Engine: [`lib/tickets/email.ts`](file:///f:/PRojects/WSD/websmith/lib/tickets/email.ts)
  - Direct Chat: [`lib/tickets/chat.ts`](file:///f:/PRojects/WSD/websmith/lib/tickets/chat.ts), [`app/chat/[ticketId]/page.tsx`](file:///f:/PRojects/WSD/websmith/app/chat/[ticketId]/page.tsx)
- **Workflow**:
  1. **Submission**: User submits the public contact form.
  2. **Account Creation / Linking**: If user does not have a client account, an account is automatically created in `users` (`role: "client"`) with an encrypted one-time temporary password (`temporaryPasswordEnc` via AES-256-GCM).
  3. **Human Request ID**: A non-ambiguous tracking code (`WSD-XXXXXX`, e.g., `WSD-FJZT4K`) is generated avoiding confusing characters (`0/O`, `1/I/L`).
  4. **Immediate Admin Alert**: Dispatched via `no-reply@websmithdigital.com` to `digitalwebsmith@gmail.com` with customer name, phone, direct WhatsApp chat link (`wa.me`), client timezone, preferred date, converted IST call time, customer message, and a direct button to `/admin/messages`.
  5. **Client Confirmation Email**: Dispatched immediately from `no-reply@websmithdigital.com` with subject `Thank You for Contacting Websmith Digital - {{request_id}}`. Contains inquiry confirmation, Client Portal link (`/login`), and a **Direct Encrypted Chat Link**.
  6. **Direct Secure Chat**: Embeds a signed JWT in the URL granting the customer direct two-way encrypted chat with the admin team without requiring password login.

### 4.3 Client Portal & Authentication
- **Files**: [`app/client/*`](file:///f:/PRojects/WSD/websmith/app/client), [`app/login/page.tsx`](file:///f:/PRojects/WSD/websmith/app/login/page.tsx)
- **Features**:
  - Secure role-based client portal for tracking software projects, download links, active licenses, renewal dates, support queries, and payment invoices.
  - Multi-factor support and password reset via automated OTP email.

### 4.4 Admin Console & Query Inbox
- **Files**: [`app/admin/messages/AdminMessagesClient.tsx`](file:///f:/PRojects/WSD/websmith/app/admin/messages/AdminMessagesClient.tsx)
- **Features**:
  - **Query Inbox**: Real-time list of all incoming tickets from the public website, client portal, and in-app SDK support requests.
  - **Two-Way Message Thread**: Chat bubble interface displaying client inbound messages, outbound admin email replies, and delivery statuses.
  - **Client Onboarding Drawer**: One-click action to reveal encrypted client passwords, copy access credentials, or dispatch the formal "Client Portal Access" email.
  - **Status & Priority**: Transition tickets between `open`, `in_progress`, `resolved`, and `closed`.

### 4.5 Universal License Platform (ULP)
- **Files**: [`lib/license/*`](file:///f:/PRojects/WSD/websmith/lib/license), [`app/internal/api/licenses/*`](file:///f:/PRojects/WSD/websmith/app/internal/api/licenses)
- **Features**:
  - **License Types**: Node-locked (hardware bound), Floating/Concurrent, Perpetual, Time-limited Subscription, Trial.
  - **Hardware Fingerprinting**: Evaluates SHA-256 hashes of motherboard UUID, CPU serial, primary MAC address, and disk volume serial number. Tolerates single component changes (graceful re-binding).
  - **Reactivation & Reset**: Admin approval workflows for hardware transfers and device resets.

### 4.6 Multi-Runtime SDK Publisher (13 Languages)
- **Files**: [`app/internal/publisher/*`](file:///f:/PRojects/WSD/websmith/app/internal/publisher)
- **Runtimes**:
  `Python`, `Node.js`, `Go`, `Rust`, `Java`, `.NET/C#`, `C++`, `C`, `PHP`, `JavaScript`, `TypeScript`, `Bun`, `Deno`.
- **Generated Components**:
  - `LicenseEngine`: Core cryptographic verification, local SQLite cache, clock-tamper protection, offline grace period counter.
  - `UniversalLicenseCenter (ULC)`: Native UI dialog for customer license entry, hardware binding, and status inspection.
  - `UniversalEmailDialog`: Built-in customer support & renewal request dialog that routes back to the central inbox.
  - **Verification Pipeline**: Automatically runs syntax and structure checks (`tests/sdk-generation/`) before outputting the final ZIP archive.

### 4.7 Software Storefront, Cart & Checkout
- **Files**: [`app/software-store/*`](file:///f:/PRojects/WSD/websmith/app/software-store), [`app/api/v1/checkout/*`](file:///f:/PRojects/WSD/websmith/app/api/v1/checkout)
- **Features**:
  - Product catalog showcasing desktop and server software applications.
  - Plan selector (Standard, Professional, Enterprise, Annual vs Monthly).
  - Shopping cart with coupon code redemption.
  - Payment checkout integration that provisions licenses immediately upon successful payment callback.

### 4.8 Communications Center & Outbound Mailer Engine
- **Files**: [`lib/email/mailer.ts`](file:///f:/PRojects/WSD/websmith/lib/email/mailer.ts), [`lib/sms/fast2sms.ts`](file:///f:/PRojects/WSD/websmith/lib/sms/fast2sms.ts)
- **Features**:
  - **Strict Sender Rule**: All autogenerated outgoing messages route from `no-reply@websmithdigital.com` with display name "Websmith Digital" or "Websmith Digital Alerts".
  - **Support Routing**: Replies are routed to `support@websmithdigital.com`.
  - **Template Interpolation**: Global dynamic substitution (`{{request_id}}`, `{{customer_name}}`, `{{subject}}`) applied to subject, HTML body, and plain text.
  - **Delivery Logging**: Every outbound email is recorded in `notification_logs` with status (`sent` or `failed`), provider message ID, and timestamp.
  - **Unsubscribe Management**: Compliant footer with unsubscribe links for marketing/non-transactional emails.

---

## 5. Database Architecture & Hybrid Document Engine

The platform operates on a single **Neon PostgreSQL** database configured with a hybrid storage model:

```mermaid
flowchart TD
    App[Next.js Application] -->|Relational Queries (SQL)| Relational[Neon PostgreSQL Tables]
    App -->|Document Queries (Mongo API)| DocEngine[lib/server/db.ts]
    DocEngine -->|JSONB Document Operations| PortalTables[portal_* PostgreSQL Tables]
    
    subgraph Relational Tables
        licenses
        products
        plans
        activations
        orders
        notification_logs
        sdk_jobs
    end
    
    subgraph Document Collections (portal_*)
        portal_tickets[portal_tickets (Tickets, messages, history)]
        portal_users[portal_users (Clients, staff, credentials)]
        portal_resolution_templates[portal_resolution_templates (Email templates)]
        portal_settings[portal_settings (Contact info, site config)]
    end
```

### 1. Relational PostgreSQL Tables (Core Licensing & Store)
Managed via `lib/backend-db/index.ts`:
- `products`, `plans`, `licenses`, `activations`, `license_hardware`
- `orders`, `order_items`, `subscriptions`, `coupons`
- `notification_logs`, `sms_templates`, `email_templates`
- `sdk_jobs`, `api_keys`, `api_request_logs`

### 2. MongoDB-Compatible Document Engine (`lib/server/db.ts`)
A custom TypeScript abstraction that executes Mongo-style operations (`findOne`, `insertOne`, `updateOne`, `$set`, `$push`, `$regex`, `ObjectId`) over PostgreSQL tables prefixed with `portal_*`:
- `portal_tickets`: Stores public inquiries, support requests, and message threads.
- `portal_users`: Stores client profiles, hashed passwords, and encrypted temporary passwords.
- `portal_resolution_templates`: Database-backed email templates editable from the admin UI.

---

## 6. API Architecture & Route Reference

### 6.1 Public v1 API (`/api/v1/*`)
Used by generated SDKs and the public software storefront:
- `POST /api/v1/activations/verify`: Heartbeat validation of active software instances.
- `POST /api/v1/activations/activate`: First-time hardware binding and activation.
- `POST /api/v1/trials/start`: Starts a time-limited evaluation license.
- `POST /api/v1/reactivations/submit`: Requests license transfer to a new device.
- `POST /api/v1/store/products`: Retrieves active store products and pricing tiers.
- `POST /api/v1/checkout/create-order`: Initiates order processing and digital payment.

### 6.2 Tickets & Chat API (`/api/tickets/*`, `/api/chat/*`)
- `POST /api/tickets/public`: Public contact form receiver. Performs rate-limiting, creates/links client account, generates `WSD-XXXXXX` ID, and triggers admin alert and client thank-you emails.
- `GET /api/tickets/[id]`: Fetches conversation history.
- `POST /api/tickets/[id]/reply`: Appends customer or admin replies to the message thread.
- `GET /api/chat/[ticketId]/token`: Verifies direct chat JWT access token.

### 6.3 Internal API Center (`/internal/backend/*`)
Protected by edge security middleware (`proxy.ts`):
- `/internal/backend/licenses/*`: CRUD for license keys, hardware resets, and batch operations.
- `/internal/backend/publisher/*`: Triggers SDK compilation, monitors job progress, and generates download links.
- `/internal/backend/communications/*`: Manages connected mailboxes, reads IMAP threads, and sends outbound emails.

---

## 7. Security, Authentication & Anti-Spam Architecture

1. **Edge Middleware (`proxy.ts`)**:
   - Inspects all incoming requests targeting `/internal/*`.
   - Validates `api_center_token` JWT via `jose`.
   - Extracts user identity and injects headers: `x-api-center-user-id`, `x-api-center-user-email`, `x-api-center-user-role`.
   - Rejects unauthorized requests or redirects browser navigation to `/internal/api/auth/login`.

2. **Public API Security (HMAC & Nonces)**:
   - SDK requests to `/api/v1/*` must present an `X-API-Key`.
   - Requests include timestamp, nonce, and `X-Signature` computed via HMAC-SHA256 over request body and secret.
   - Nonces are cached in Redis to prevent replay attacks; requests older than 5 minutes are rejected.

3. **Rate Limiting & Anti-Abuse**:
   - Public form submission (`POST /api/tickets/public`) uses an IP sliding-window rate limit (max 5 requests per 10 minutes per IP).
   - Phone numbers (calling & WhatsApp) are validated against international E.164 phone formats via `validatePhoneNumber`.
   - All text inputs are sanitized against control characters (`[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]`) to prevent injection attacks.

4. **Credential Encryption at Rest**:
   - One-time temporary passwords generated for public form submitters are never stored in plaintext.
   - Encrypted with **AES-256-GCM** using keys derived from `JWT_SECRET` (`temporaryPasswordEnc`).

---

## 8. Configuration & Environment Variables

Key configuration variables in `.env`:

```bash
# Server & Port
PORT=3000
WEBSITE_URL="https://websmithdigital.com"

# Database Connection (Neon Serverless PostgreSQL)
DATABASE_URL="postgresql://neondb_owner:***@ep-***.aws.neon.tech/neondb?sslmode=require"

# Security & Secrets
JWT_SECRET="***"
API_CENTER_JWT_SECRET="***"

# Administrator Notifications
ADMIN_ALERT_EMAIL="digitalwebsmith@gmail.com"

# Outbound SMTP Engine (Namecheap PrivateEmail)
SMTP_HOST="mail.privateemail.com"
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER="no-reply@websmithdigital.com"
SMTP_PASS="***"

# Authoritative From & Reply Addresses
MAIL_FROM_ADDRESS="no-reply@websmithdigital.com"
MAIL_FROM_NAME="Websmith Digital"
MAIL_SUPPORT_ADDRESS="support@websmithdigital.com"
MAIL_SUPPORT_NAME="Websmith Digital Support Team"
MAIL_SALES_ADDRESS="sales@websmithdigital.com"
MAIL_SALES_NAME="Websmith Digital Sales Team"

# SMS Gateway (Fast2SMS)
FAST2SMS_API_KEY="***"

# Distributed Caching & Queues (Upstash)
UPSTASH_REDIS_REST_URL="***"
UPSTASH_REDIS_REST_TOKEN="***"
QSTASH_TOKEN="***"
```

---

## 9. Build, Development & Verification Workflows

### Development Server
```powershell
npm run dev
# Starts Next.js development server on http://localhost:3000
```

### Type Checking & Build Validation
```powershell
# Verify full TypeScript integrity
npx tsc --noEmit

# Compile production bundle
npm run build
```

### SDK Generation Tests
```powershell
# Runs SDK syntax and generation tests across supported runtimes
npm run test:generation
npm run test:multi-runtime
```
