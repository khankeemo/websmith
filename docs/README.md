# WebSmith — Documentation Library

This directory is the developer documentation library for the **WebSmith Universal
License Platform** (also referred to as *Websmith Digital* / the *Universal License
API Center*).

It is a navigable companion to the two governance documents already in this folder:

| File | Role |
|---|---|
| `AGENTS.md` | Always-read standing rules, registered as a global opencode instruction. |
| `UNIVERSAL_LICENSE_PLATFORM_IMPLEMENTATION.md` | The master single-source-of-truth implementation document (architecture + full session history). |
| `README.md` | This index. |

## Reading order

1. `01-System-Overview.md` — what the platform is and its main areas.
2. `02-Architecture.md` — layers, stack, directories, and diagrams.
3. `03-Workflows.md` — customer, admin, and machine workflows with sequence diagrams.
4. `04-Roadmap.md` — status of phases and areas that are known to be incomplete.
5. `05-Deployment.md` — Vercel, environment variables, database, queues.
6. `06-Administrator-Guide.md` — operating the internal API Center.
7. `07-API-Reference.md` — public `/api/v1` and internal `/internal/backend` endpoints.
8. `08-Database.md` — the PostgreSQL schema and migrations.
9. `09-AWS-01-Rules.md` — the mandatory execution rules and invariants.
10. `app/internal/publisher/template/python/Integrations.md` — the SDK Integration Guide
    shipped inside generated Python SDKs (rewritten copy lives in the template; this index
    links to the source-of-truth version).

## Source-of-truth hierarchy

Master Implementation Document → Language Templates → SDK Publisher → Generated SDK.

Per AWS-01 rules these documentation files must always reflect the **current** state of
the codebase. When behavior changes, update this library, `AGENTS.md`, and the master
document on the same task.
