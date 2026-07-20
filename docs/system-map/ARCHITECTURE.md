# SYSTEM ARCHITECTURE

Generated: 2026-07-04T05:00:59.770350+00:00 UTC

## Frontend

* Next.js
* React
* TypeScript
* Tailwind CSS

## Backend

* Route handlers
* API layer
* Shared services
* Server-side render / static pages

## Database

* Neon PostgreSQL
* Public schema tables
* Primary keys
* Foreign keys
* Indexes

## Services

* Authentication
* File upload
* Notifications
* Payments

## Relationships

Frontend -> Next.js pages, layouts, components
Frontend -> API routes for server actions
API routes -> Services -> Database
Database -> Tables, indexes, constraints