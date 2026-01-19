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

- **Modern SVG Logo:** High-resolution branding integrated across the UI, featuring a stylized database cylinder being forged on an anvil with an AI pulsing spark.
- **Production-Grade Schema Sync:** Implemented a robust diffing engine using `sqlglot` for cross-dialect synchronization (e.g., SQLite to Postgres).
- **StateManager Module:** New structured state management for persisting and restoring application snapshots.
- **Monitoring Dashboard:** Integrated Prometheus and Grafana for professional-grade database and system monitoring.
- **Refined Data Editor:** spreadsheet-style grid with inline editing, batch updates, and keyboard navigation.
- **Consolidated Scripts:** All management tools are now unified in the root `/scripts` directory.

---

## Key Features

- **Multi-database Support:** Postgres, MySQL, SQLite, SQL Server, Oracle, MongoDB, Redis.
- **AI SQL Assistant:** Schema-aware query generation powered by Google Gemini.
- **Advanced Object Browser:** Grouped views for Tables, Views, Functions, Triggers, and Collections.
- **Command Palette:** (⌘K / Ctrl+K) for lightning-fast navigation.
- **Backup & Restore:** Easy wizards for managing database snapshots.
- **Import/Export:** Support for CSV, JSON, and transpiled SQL Inserts.
- **Dark/Light Themes:** Modern OKLCH-based theme engine with Radix UI components.

---

## Project Structure

```
SqlForge/
├── backend/        # FastAPI engine, DB drivers & Pro logic (Sync, Backup, State)
├── frontend/       # React 19 + Tailwind 4 + Lucide UI
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

### 2. Manage Databases
```bash
./scripts/start_dbs.sh   # Start Docker containers
./scripts/stop_dbs.sh    # Stop Docker containers
./scripts/clean_dbs.sh   # Wipe Docker containers and volumes
./scripts/remove_local_dbs.sh # Wipe local SQLite and metadata files
```

### 3. Run Application
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
* Safe by default

---

## Status
🚧 Active development
🎯 Target: Navicat-level power with modern UX and AI-native workflows