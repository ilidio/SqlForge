# SqlForge: The Professional Database Workbench 🛠️⚡

**SqlForge** is a high-performance, professional-grade database management tool inspired by the power of Navicat and built with a modern, AI-native architecture. It combines a sophisticated **FastAPI** backend with a polished **React/TypeScript** frontend styled with **Tailwind CSS 4** and **OKLCH** colors for a premium, high-contrast visual experience.

---

## 🔥 Key Features

### 1. Multi-Engine Mastery (SQL & NoSQL)
Seamlessly manage diverse environments within a single interface:
*   **Relational:** PostgreSQL, MySQL, SQLite, Oracle, and SQL Server (MSSQL).
*   **NoSQL & Key-Value:** MongoDB and Redis support.

### 2. AI-Powered SQL Copilot 🧠
Transform natural language into production-ready SQL queries using the integrated **Google Gemini AI**. Just describe what you need (e.g., *"Show me total revenue per month for 2024"*), and SqlForge handles the schema-aware generation.

### 3. Professional Navicat-Style UX
*   **Hierarchical Menu System:** A full desktop-class menu bar for deep feature access.
*   **Command Palette (⌘K):** A lightning-fast interface for power users to jump between connections, features, and settings.
*   **Advanced Object Browser:** Deep introspection of Tables, Views, Triggers, Functions, and Procedures.
*   **Multi-Tabbed Interface:** Manage multiple queries and data views in a unified, dockable workspace.

### 4. Developer-First Tools
*   **Auto-Discovery:** One-click "Magic Wand" scanning of `localhost` to detect and pre-configure active database services.
*   **SQL Formatter:** Integrated professional formatting to keep your queries clean and readable.
*   **Theme Engine:** Beautifully crafted Dark and Light modes using modern OKLCH color spaces.

---

## 🛠️ Setup & Installation

### Prerequisites
- **Python 3.10+**
- **Node.js 18+**
- **Docker & Docker Compose** (for testing environments)

### Quick Start
Run the automated setup script to initialize the backend virtual environment and install all dependencies:

```bash
./setup.sh
```

---

## 🏃 Running the Application

SqlForge requires both the backend and frontend to be running simultaneously.

### 1. Start the Backend (API)
```bash
./run_backend.sh
```

### 2. Start the Frontend (UI)
```bash
./run_frontend.sh
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🧪 Testing & Development Environment

SqlForge includes a complete Docker-based suite of pre-populated databases for testing and development.

### 🐳 Managing Test Databases
```bash
# Start all databases (Postgres, MySQL, Oracle, MSSQL, MongoDB, Redis)
./scripts/start_dbs.sh

# Stop all databases
./scripts/stop_dbs.sh

# Full Cleanup: Stop databases and remove all images/volumes
./scripts/clean_dbs.sh
```

### 📡 Connection Details (Docker Suite)
| Database | Host | Port | User | Password | Database |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **PostgreSQL** | `localhost` | `5432` | `admin` | `password` | `testdb` |
| **MySQL** | `localhost` | `3306` | `admin` | `password` | `testdb` |
| **MongoDB** | `localhost` | `27017` | - | - | `testdb` |
| **Redis** | `localhost` | `6379` | - | - | - |
| **SQL Server** | `localhost` | `1433` | `sa` | `Password123!` | `TestDB` |
| **Oracle** | `localhost` | `1521` | `admin` | `password` | `FREE` |

---

## 📂 Project Structure

- `backend/`: FastAPI application, SQLAlchemy logic, and database drivers.
- `frontend/`: React 19 + Vite application with Tailwind CSS 4 and Radix UI.
- `scripts/`: Utility scripts for database management and deployment.
- `tests/`: Docker configurations and automated test suites.

---

## 📜 License
MIT