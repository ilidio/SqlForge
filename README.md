# SqlForge

SqlForge is a modern, high-performance, cross-database client inspired by tools like Navicat and DataGrip, focused on:

- Fast SQL workflows
- Clean, keyboard-first UX
- Built-in AI assistant
- Schema and data synchronization
- Developer-first architecture

It is designed for backend engineers, data engineers, and DBAs who want speed, power, and clarity without bloat.

---

## Key Features

- **Multi-database Support:** Postgres, MySQL, SQLite, SQL Server, Oracle, MongoDB, Redis.
- **AI SQL Assistant:** Schema-aware query generation powered by Google Gemini.
- **Advanced Object Browser:** Grouped views for Tables, Views, Functions, and Triggers.
- **Command Palette:** (⌘K / Ctrl+K) for lightning-fast navigation.
- **Data Editing:** Spreadsheet-style grid with inline editing (Pro).
- **Schema & Data Sync:** Efficient synchronization using `pysqlsync` (Pro).
- **Import/Export:** Support for CSV, JSON, and SQL Inserts.
- **Dark/Light Themes:** Modern OKLCH-based theme engine.

---

## Project Structure

```
SqlForge/
├── backend/        # FastAPI engine & DB drivers
├── frontend/       # React 19 + Tailwind 4 UI
├── scripts/        # Management & automation scripts
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

### 2. Start Test Databases
```bash
./scripts/start_dbs.sh
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
