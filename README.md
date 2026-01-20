# SqlForge

[![GitHub](https://img.shields.io/badge/GitHub-SqlForge-blue?logo=github)](https://github.com/ilidio/SqlForge)

SqlForge is a modern, high-performance, cross-database client inspired by tools like Navicat and DataGrip, focused on:

- Fast SQL workflows
- Clean, keyboard-first UX
- Built-in AI assistant
- Schema and data synchronization
- Developer-first architecture

It is designed for backend engineers, data engineers, and DBAs who want speed, power, and clarity without bloat.

---

## 🚀 Recent Updates

- **Unlocked Pro Features:** Transactional data editing, schema synchronization, and monitoring are now fully implemented and free for all users.
- **Safe Data Editing:** Spreadsheet-style grid with inline editing, row deletions, batch updates, and optimistic concurrency protection.
- **Transactional Logic:** Batch mutations are wrapped in SQL transactions—if one operation fails, the entire set rolls back safely.
- **Context-Aware Navigation:** Menus and shortcuts (F9/F10) intelligently enable/disable based on your active connection and tab.
- **Modern SVG Logo:** High-resolution branding integrated across the UI and Help system.
- **Automated Test Lifecycle:** `test.sh` now manages the entire database environment (Docker + SQLite) fresh for every run.

---

## Key Features

- **Multi-database Support:** Postgres, MySQL, SQLite, SQL Server, Oracle, MongoDB, Redis.
- **AI SQL Assistant:** Schema-aware query generation powered by Google Gemini.
- **Transactional Data Editor:** Edit cells or delete rows directly in the results grid with full rollback safety.
- **Advanced Object Browser:** Grouped views for Tables, Views, Functions, Triggers, and Collections with right-click context menus.
- **Keyboard-First Navigation:** 
    - `⌘ K`: Command Palette
    - `F9`: Focus Query Editor
    - `F10`: Focus Result Grid
    - `⌘ Enter`: Execute Query
- **Export Wizard:** Multi-format export (CSV, JSON, SQL Insert statements) with detailed configuration options.
- **Schema & Data Sync:** Robust diffing engine using `sqlglot` for cross-dialect synchronization.
- **Monitoring Dashboard:** Integrated Prometheus and Grafana for professional-grade database diagnostics.
- **Dark/Light Themes:** Modern OKLCH-based theme engine with beautiful `sonner` notifications.

---

## Project Structure

```
SqlForge/
├── backend/        # FastAPI engine, DB drivers & Core logic (Sync, Backup, State)
├── frontend/       # React 19 + Tailwind 4 + Radix UI
├── scripts/        # Centralized management & automation scripts
├── tests/          # Docker DB suite & test cases
├── ARCHITECTURE.md # System design & sync logic
├── USER_STORIES.md # Product requirements
└── README.md       # This file
```

---

## Quick Start

### 1. Setup
```bash
./setup.sh
```

### 2. Run Tests (Automated Environment)
This script will stop existing DBs, clean local files, start fresh containers, and run all tests.
```bash
./test.sh
```

### 3. Manage Databases Manually
```bash
./scripts/start_dbs.sh   # Start Docker containers
./scripts/stop_dbs.sh    # Stop Docker containers
./scripts/remove_local_dbs.sh # Wipe local SQLite databases (preserves metadata)
./scripts/remove_local_dbs.sh --all # Full wipe including connection metadata
```

### 4. Run Application
In separate terminals:
```bash
./run_backend.sh
./run_frontend.sh
```

---

## Philosophy

SqlForge is built around these principles:
* SQL-first, not ORM-first
* Keyboard over mouse
* Preview before mutate
* Async everywhere
* No blocking UI
* Safe by default (Parameterized queries & Concurrency checks)

---

## Status
🚧 Active development
🎯 Target: Navicat-level power with modern UX and AI-native workflows
