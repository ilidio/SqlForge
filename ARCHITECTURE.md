# SqlForge Architecture

## Overview
SqlForge is a modern, cross-platform database management tool inspired by Navicat. It allows users to connect to various databases (SQLite, PostgreSQL), browse tables, run SQL queries, and visualize results.

## System Components

### 1. Frontend (Web Client)
- **Technology:** React 18, TypeScript, Vite.
- **Styling:** Tailwind CSS.
- **Icons:** Lucide React.
- **State Management:** React Hooks (local state).
- **Communication:** Axios (HTTP REST API).

**Key Components:**
- `Sidebar`: Displays connection tree and tables.
- `QueryTab`: SQL editor and results viewer.
- `ConnectionModal`: Form to create/edit connections.
- `ResultsTable`: Data grid for query results.

### 2. Backend (API Server)
- **Technology:** Python, FastAPI.
- **Database ORM:** SQLAlchemy (for abstracting DB interactions).
- **Driver Support:** `aiosqlite` (SQLite), `psycopg2` (PostgreSQL - to be added).
- **API Documentation:** Auto-generated via Swagger UI.

**Key Modules:**
- `main.py`: Entry point and API route definitions.
- `models.py`: Pydantic models for data validation (requests/responses).
- `database.py`: Core logic for database connections, introspection, and query execution.

## Data Flow
1. User interacts with Frontend (e.g., clicks "Run").
2. Frontend sends HTTP POST request to Backend (e.g., `/query`).
3. Backend receives request, validates schema via Pydantic.
4. `database.py` uses SQLAlchemy engine to execute query on the target database.
5. Results are formatted and returned as JSON.
6. Frontend renders JSON data in `ResultsTable`.

## Future Roadmap
- SSH Tunneling support.
- Visual Query Builder.
- Schema Designer/ER Diagram.
- Data synchronization tools.
