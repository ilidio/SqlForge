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

- **Federated (cross-database) queries:** Run a single SQL statement across multiple connections at once via an embedded DuckDB engine — attach two or more sources under aliases and `JOIN` them directly (Tools → Federated Query).
- **Deterministic dialect translation:** Rewrite a query for another engine (Postgres/MySQL/SQL Server/Oracle/SQLite) via `sqlglot` — a one-click action next to the AI Actions menu, no LLM round-trip required.
- **Connection environments & read-only guard:** Tag connections as development/staging/production. Production connections default to read-only, enforced server-side — mutating statements are rejected even if sent directly to `/query`.
- **Oracle & SQL Server health parity:** The health-scoring dashboard now covers all seven supported engines, not just Postgres/MySQL.
- **Query timeout & cancellation:** Queries get a server-side statement timeout by default, and a Stop button lets you cancel a running query mid-flight from the UI.
- **Bounded query results:** Ad-hoc `SELECT`s are capped (5,000 rows by default) so a runaway `SELECT *` can't freeze the UI or exhaust memory; the grid shows a "truncated" notice when it happens.
- **Cached SQLAlchemy engines:** Connections now reuse a pooled engine instead of creating a new one per query, cutting latency and avoiding connection exhaustion under load.
- **Validated SQL identifiers:** Table/column names used in DDL/DML are validated against an allowlist before being interpolated, closing an identifier-injection gap.
- **Encrypted credentials at rest:** Connection passwords are encrypted (Fernet) in the local metadata store instead of stored as plaintext.
- **CI now runs the test suite:** `build-all.yml` gates release builds on `pytest` + `vitest` passing, instead of only compiling installers.
- **Advanced Features:** Transactional data editing, schema synchronization, and monitoring are now fully implemented and free for all users.
- **Safe Data Editing:** Spreadsheet-style grid with inline editing, row deletions, batch updates, and optimistic concurrency protection.
- **Transactional Logic:** Batch mutations are wrapped in SQL transactions—if one operation fails, the entire set rolls back safely.
- **Context-Aware Navigation:** Menus and shortcuts (F9/F10) intelligently enable/disable based on your active connection and tab.
- **Modern SVG Logo:** High-resolution branding integrated across the UI and Help system.
- **Automated Test Lifecycle:** `test.sh` now manages the entire database environment (Docker + SQLite) fresh for every run.

---

## Key Features

### Connectivity
- **Multi-database Support:** Postgres, MySQL, SQLite, SQL Server, Oracle, MongoDB, Redis.
- **Connection Management:** Create/edit/test connections, auto-discovery via port scanning, and per-connection health checks.
- **Secure Access:** SSH tunneling and SSL/TLS for remote connections.
- **Environments & Guardrails:** Tag connections as development/staging/production; production connections can be locked read-only, enforced by the backend regardless of what the UI sends.

### SQL Editor & Execution
- **Monaco Editor:** Syntax highlighting, autocomplete, and SQL formatting.
- **History & Workspaces:** Query history, saved favorites, and persistent workspaces.
- **Visual Explain:** Graphical query-plan visualization.
- **Query Benchmarking:** Concurrency/load testing for query performance.
- **Timeout & Cancellation:** Server-side statement timeout by default, with a Stop button to cancel a running query.
- **Bounded Results:** Ad-hoc query results are capped by default to protect memory and keep the UI responsive.
- **Dialect Translation:** Deterministic, one-click SQL rewriting between engines via `sqlglot`.
- **Keyboard-First Navigation:**
    - `⌘ K`: Command Palette
    - `F9`: Focus Query Editor
    - `F10`: Focus Result Grid
    - `⌘ Enter`: Execute Query

### Data Editing
- **Transactional Data Editor:** Edit cells or delete rows in the results grid with full rollback safety, optimistic-concurrency protection, and Excel/Sheets copy-paste.

### Schema & Objects
- **Advanced Object Browser:** Grouped views for Tables, Views, Functions, Triggers, and Collections with right-click context menus.
- **Schema Editor, ER Diagrams, Visual Query Builder, and Data Dictionary.**

### Import / Export / Sync
- **Import & Export Wizards:** CSV, JSON, and SQL Insert statements.
- **Schema & Data Sync:** Robust `sqlglot` diffing engine (`diff → plan → apply`) for transactional, cross-dialect synchronization and cross-engine data transfer.

### Multi-Database Query
- **Federated Query:** Join data live across two or more connections (even different engines) in a single statement, powered by an embedded DuckDB engine (Tools → Federated Query).
- **Dialect Translation:** Rewrite a query for a different target engine deterministically, without relying on the AI assistant.

### AI Assistant (Google Gemini)
- **AI SQL Assistant:** Schema-aware natural-language → SQL generation.
- **Index Advisor:** Recommends indexes for a given query.
- **SQL Refactorer:** AI-assisted query optimization and rewriting.
- **Data Generator (Hydrate):** Synthetic/test-data generation.
- **What-If Analysis:** Hypothetical (virtual) index impact assessment.
- **Daily Briefing:** AI summary of database activity.

### Automation & Operations
- **Task Scheduler:** Create, run, and track scheduled tasks with run history.
- **Backup & Restore:** Backup, restore, and SQL-script execution.

### Monitoring & Diagnostics
- **Monitoring Dashboard:** Integrated Prometheus and Grafana diagnostics.
- **Health Auditing, Lock Visualizer, and Process Management:** Health scoring (all seven supported engines, including Oracle and SQL Server), deadlock/lock-tree inspection, and active-process kill.

### Security & UX
- **Data Masking:** PII detection and masking.
- **Encrypted Credentials:** Connection passwords are encrypted at rest (Fernet), not stored as plaintext.
- **Validated Identifiers:** Table/column names are validated against an allowlist wherever they're interpolated into SQL, closing an identifier-injection gap.
- **Dark/Light Themes:** Modern OKLCH-based theme engine with `sonner` notifications.

---

## Project Structure

```
SqlForge/
├── SqlForge-Backend/  # FastAPI engine, DB drivers & core logic (Sync, Backup, State)
├── SqlForge/          # Electron + React 18 + Vite + Tailwind 4 + Radix UI
├── scripts/           # Centralized management & automation scripts
├── tests/             # Docker DB suite & test cases
├── ARCHITECTURE.md    # System design & sync logic
├── USER_STORIES.md    # Product requirements
└── README.md          # This file
```

---

## 🤖 AI Configuration

To enable the built-in AI SQL Assistant, you need to provide your Google Gemini credentials.

1.  Locate the `.gemini_config.json` file in the project root.
2.  Add your API key and preferred model:
    ```json
    {
      "gemini_api_key": "YOUR_API_KEY",
      "gemini_model": "gemini-1.5-flash"
    }
    ```
3.  The backend will automatically detect these settings and enable AI features across the application.

*Note: The `.gemini_config.json` file is explicitly listed in `.gitignore` to keep your credentials secure and prevent them from being committed to the repository.*

---

## 🛠 Development & Test Environment

SqlForge includes a pre-configured Docker-based lab environment to test its multi-database features. When you run `./test.sh` or `./scripts/start_dbs.sh`, the following components are deployed:

### **1. Databases (Functional Testing)**
*   **Relational (SQL):** `Postgres`, `MySQL`, `MSSQL`, and `Oracle` instances for testing queries, schema migrations, and ER diagram generation.
*   **NoSQL / KV:** `MongoDB` and `Redis` for validating document and key-value management features.

### **2. Monitoring Stack (Observability)**
*   **Prometheus & Grafana:** Powers the real-time health charts in the Monitor Dashboard.
*   **Exporters:** Dedicated bridge containers (`postgres-exporter`, `mysql-exporter`) that feed database performance metrics into Prometheus.

### **3. Infrastructure**
*   **Virtual Network:** All components reside on a private Docker network (`docker_default`), allowing the backend to communicate securely with all instances.

### **4. Connection Details (Docker Suite)**
| Database | Host | Port | User | Password | Database |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **PostgreSQL** | `localhost` | `5432` | `admin` | `password` | `testdb` |
| **MySQL** | `localhost` | `3306` | `admin` | `password` | `testdb` |
| **MongoDB** | `localhost` | `27017` | - | - | `testdb` |
| **Redis** | `localhost` | `6379` | - | - | - |
| **SQL Server** | `localhost` | `1433` | `sa` | `Password123!` | `TestDB` |
| **Oracle** | `localhost` | `1521` | `admin` | `password` | `FREE` |

---

## Quick Start

### 1. Setup
> Note: `setup.sh` is stale (it references the old `backend/`/`frontend/` paths). Use the commands below.
```bash
# Backend
cd SqlForge-Backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cd ..

# Frontend
cd SqlForge
npm install
cd ..
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

## Known Gaps / Roadmap

Test debt and exploratory ideas not yet built, kept here so they aren't lost:

- **Test coverage:** `QueryTab.tsx`, `ResultsTable.tsx`, `MonitorDashboard.tsx`, and `SchemaEditor.tsx` don't have dedicated test files despite being the most logic-heavy frontend components. Oracle has zero backend test fixtures; SQL Server has one.
- **Frontend state:** `App.tsx` and `Sidebar.tsx` hold most of the app's state directly (no Redux/Zustand/Context store); worth extracting before more features land on top.
- **Multi-target fan-out:** run the same query across several connections and diff/aggregate results (useful for sharded fleets) — no endpoint yet.
- **Shared/parameterized query library:** favorites currently only store a raw SQL string, not parameters or a target connection.
- **Arbitrary query-result export:** export today is per-table (`stream_export_data`); ad-hoc query results aren't covered the same way.
- **Scheduler failure notifications:** the task scheduler records run history but doesn't actively alert (toast/email) when a scheduled task fails.
- **Query plan before/after comparison:** `VisualExplain` and `IndexAdvisor` exist independently; there's no single view comparing a plan before and after a suggested index.
- **Export/import connection config** (without passwords) to share team setups as text.

---

## Status
🚧 Active development
🎯 Target: Navicat-level power with modern UX and AI-native workflows
