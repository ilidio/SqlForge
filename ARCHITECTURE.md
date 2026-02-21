# SqlForge Architecture

SqlForge follows a modular, service-oriented desktop architecture with a local backend engine and a modern frontend UI.

---

## High-Level Overview

```
┌──────────── Frontend (Web UI) ─────────────┐
│                                            │
│  Menu System │ Command Palette │ Panels    │
│                                            │
└─────────────── HTTP / IPC Bridge ──────────┘
               │
┌──────────────────── Backend (Python) ────────────────────┐
│ Connection Manager │ Query Engine │ Metadata Cache │ AI   │
│ Import/Export │ Sync Engine │ Task Scheduler │ Security  │
└───────────────┬───────────────┬───────────────┬──────────┘
               │               │               │
┌───────▼───────┐ ┌─────▼─────┐ ┌───────▼───────┐
│ DB Drivers     │ │ Sync Core  │ │ AI Providers  │
│ async drivers  │ │ (sqlglot)  │ │ (Gemini/etc)  │
└───────────────┘ └─────────────┘ └───────────────┘
```

---

## Backend Responsibilities (`backend/`)

The backend acts as the **execution engine** and **security boundary**.

Core services:
- **Connection Manager:** Handles lifecycle of DB sessions.
- **Metadata Explorer:** Introspects tables, views, and procedures.
- **Query Engine:** Executes SQL and streams results.
- **AI Proxy Layer:** Context-aware prompt engineering for Gemini.
- **Sync Engine:** Powered by `sqlglot` for schema/data diffs.

---

## Frontend Responsibilities (`frontend/`)

The frontend is responsible for:
- **UI Rendering:** React 19 with Tailwind CSS 4.
- **Editor Experience:** SQL highlighting and formatting.
- **Command Palette:** Global action registry.
- **Theme Engine:** OKLCH-based high-contrast styling.

---

## Core Architectural Principles

| Principle | Meaning |
|----------|---------|
| Async-first | All DB operations are non-blocking |
| Stateless UI | Backend owns all database connection state |
| Preview before mutate | All destructive ops show generated SQL first |
| Dialect-aware | SQL generation tailored per database engine |

---

## Security Model

- Credentials stored encrypted at rest.
- SSL/TLS enforced for all remote connections.
- SSH tunneling support for secure perimeter access.

---

## Sync Engine

Schema and data synchronization are implemented via a dedicated service using `sqlglot`.
This service exposes a structured API:
- `diff(source, target)`: Computes structural differences.
- `generate_plan(diff)`: Creates a migration script.
- `apply(plan)`: Executes changes within a transaction.