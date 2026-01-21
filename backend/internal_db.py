import sqlite3
import json
from models import ConnectionConfig
from typing import List, Dict, Any
from datetime import datetime

DB_PATH = "sqlforge_metadata.db"

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    # Connections table
    c.execute('''CREATE TABLE IF NOT EXISTS connections
                 (id TEXT PRIMARY KEY, name TEXT, type TEXT, config TEXT)''')
    # History table
    c.execute('''CREATE TABLE IF NOT EXISTS query_history
                 (id INTEGER PRIMARY KEY AUTOINCREMENT, connection_id TEXT, sql TEXT, timestamp DATETIME, duration_ms REAL, status TEXT)''')
    conn.commit()
    conn.close()

def save_connection(config: ConnectionConfig):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    # Serialize the full config to JSON for flexible storage
    c.execute("INSERT OR REPLACE INTO connections (id, name, type, config) VALUES (?, ?, ?, ?)",
              (config.id, config.name, config.type, config.model_dump_json()))
    conn.commit()
    conn.close()

def get_connections() -> List[ConnectionConfig]:
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT config FROM connections")
    rows = c.fetchall()
    conn.close()
    return [ConnectionConfig.model_validate_json(row[0]) for row in rows]

def get_connection(conn_id: str) -> ConnectionConfig | None:
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT config FROM connections WHERE id = ?", (conn_id,))
    row = c.fetchone()
    conn.close()
    if row:
        return ConnectionConfig.model_validate_json(row[0])
    return None

def delete_connection(conn_id: str):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("DELETE FROM connections WHERE id = ?", (conn_id,))
    conn.commit()
    conn.close()

def delete_all_connections():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("DELETE FROM connections")
    conn.commit()
    conn.close()

def add_history(connection_id: str, sql: str, duration_ms: float, status: str):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("INSERT INTO query_history (connection_id, sql, timestamp, duration_ms, status) VALUES (?, ?, ?, ?, ?)",
              (connection_id, sql, datetime.now(), duration_ms, status))
    conn.commit()
    conn.close()

def get_history() -> List[Dict[str, Any]]:
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT id, connection_id, sql, timestamp, duration_ms, status FROM query_history ORDER BY id DESC LIMIT 50")
    rows = c.fetchall()
    conn.close()
    return [
        {
            "id": r[0],
            "connection_id": r[1],
            "sql": r[2],
            "timestamp": r[3],
            "duration_ms": r[4],
            "status": r[5]
        }
        for r in rows
    ]
