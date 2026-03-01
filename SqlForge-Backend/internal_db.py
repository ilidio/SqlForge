import sqlite3
import json
import os
import sys
from models import ConnectionConfig
from typing import List, Dict, Any
from datetime import datetime

def get_data_dir():
    if sys.platform == 'win32':
        data_dir = os.path.join(os.environ.get('APPDATA', os.path.expanduser('~')), 'SqlForge')
    elif sys.platform == 'darwin':
        data_dir = os.path.join(os.path.expanduser('~'), 'Library', 'Application Support', 'SqlForge')
    else:
        data_dir = os.path.join(os.path.expanduser('~'), '.local', 'share', 'sqlforge')
    
    if not os.path.exists(data_dir):
        os.makedirs(data_dir, exist_ok=True)
    return data_dir

DB_PATH = os.path.join(get_data_dir(), "sqlforge_metadata.db")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    # Connections table
    c.execute('''CREATE TABLE IF NOT EXISTS connections
                 (id TEXT PRIMARY KEY, name TEXT, type TEXT, config TEXT)''')
    # History table
    c.execute('''CREATE TABLE IF NOT EXISTS query_history
                 (id INTEGER PRIMARY KEY AUTOINCREMENT, connection_id TEXT, sql TEXT, timestamp DATETIME, duration_ms REAL, status TEXT)''')
    
    # Scheduled Tasks table
    c.execute('''CREATE TABLE IF NOT EXISTS scheduled_tasks
                 (id TEXT PRIMARY KEY, name TEXT, task_type TEXT, schedule_config TEXT, task_config TEXT, enabled BOOLEAN, last_run DATETIME)''')

    # Task History table
    c.execute('''CREATE TABLE IF NOT EXISTS task_history
                 (id INTEGER PRIMARY KEY AUTOINCREMENT, task_id TEXT, timestamp DATETIME, status TEXT, result TEXT, duration_ms REAL)''')
    
    # Model Workspaces table (ER Diagrams)
    c.execute('''CREATE TABLE IF NOT EXISTS model_workspaces
                 (id TEXT PRIMARY KEY, connection_id TEXT, name TEXT, content TEXT, timestamp DATETIME)''')
    
    # Favorites table
    c.execute('''CREATE TABLE IF NOT EXISTS favorites
                 (id TEXT PRIMARY KEY, type TEXT, name TEXT, connection_id TEXT, target TEXT, timestamp DATETIME)''')
                 
    conn.commit()
    conn.close()

def save_favorite(fav_id: str, fav_type: str, name: str, connection_id: str, target: str):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("INSERT OR REPLACE INTO favorites (id, type, name, connection_id, target, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
              (fav_id, fav_type, name, connection_id, target, datetime.now()))
    conn.commit()
    conn.close()

def get_favorites() -> List[Dict[str, Any]]:
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT id, type, name, connection_id, target FROM favorites ORDER BY timestamp DESC")
    rows = c.fetchall()
    conn.close()
    return [{"id": r[0], "type": r[1], "name": r[2], "connection_id": r[3], "target": r[4]} for r in rows]

def delete_favorite(fav_id: str):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("DELETE FROM favorites WHERE id = ?", (fav_id,))
    conn.commit()
    conn.close()

def save_model_workspace(workspace_id: str, connection_id: str, name: str, content: Dict[str, Any]):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("INSERT OR REPLACE INTO model_workspaces (id, connection_id, name, content, timestamp) VALUES (?, ?, ?, ?, ?)",
              (workspace_id, connection_id, name, json.dumps(content), datetime.now()))
    conn.commit()
    conn.close()

def get_model_workspaces(connection_id: str) -> List[Dict[str, Any]]:
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT id, name, timestamp FROM model_workspaces WHERE connection_id = ? ORDER BY timestamp DESC", (connection_id,))
    rows = c.fetchall()
    conn.close()
    return [{"id": r[0], "name": r[1], "timestamp": r[2]} for r in rows]

def get_model_workspace(workspace_id: str) -> Dict[str, Any] | None:
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT id, connection_id, name, content, timestamp FROM model_workspaces WHERE id = ?", (workspace_id,))
    r = c.fetchone()
    conn.close()
    if r:
        return {
            "id": r[0],
            "connection_id": r[1],
            "name": r[2],
            "content": json.loads(r[3]),
            "timestamp": r[4]
        }
    return None

def delete_model_workspace(workspace_id: str):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("DELETE FROM model_workspaces WHERE id = ?", (workspace_id,))
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

def get_query_history_by_range(start: datetime, end: datetime) -> List[Dict[str, Any]]:
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT id, connection_id, sql, timestamp, duration_ms, status FROM query_history WHERE timestamp BETWEEN ? AND ? ORDER BY timestamp ASC", (start, end))
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

# --- Task Scheduling ---

def save_scheduled_task(task: Dict[str, Any]):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''INSERT OR REPLACE INTO scheduled_tasks 
                 (id, name, task_type, schedule_config, task_config, enabled, last_run) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)''',
              (task["id"], task["name"], task["task_type"], 
               json.dumps(task["schedule_config"]), json.dumps(task["task_config"]), 
               task["enabled"], task.get("last_run")))
    conn.commit()
    conn.close()

def get_scheduled_tasks() -> List[Dict[str, Any]]:
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT id, name, task_type, schedule_config, task_config, enabled, last_run FROM scheduled_tasks")
    rows = c.fetchall()
    conn.close()
    tasks = []
    for r in rows:
        tasks.append({
            "id": r[0],
            "name": r[1],
            "task_type": r[2],
            "schedule_config": json.loads(r[3]),
            "task_config": json.loads(r[4]),
            "enabled": bool(r[5]),
            "last_run": r[6]
        })
    return tasks

def get_scheduled_task(task_id: str) -> Dict[str, Any] | None:
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT id, name, task_type, schedule_config, task_config, enabled, last_run FROM scheduled_tasks WHERE id = ?", (task_id,))
    r = c.fetchone()
    conn.close()
    if r:
        return {
            "id": r[0],
            "name": r[1],
            "task_type": r[2],
            "schedule_config": json.loads(r[3]),
            "task_config": json.loads(r[4]),
            "enabled": bool(r[5]),
            "last_run": r[6]
        }
    return None

def delete_scheduled_task(task_id: str):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("DELETE FROM scheduled_tasks WHERE id = ?", (task_id,))
    conn.commit()
    conn.close()

def update_task_last_run(task_id: str):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("UPDATE scheduled_tasks SET last_run = ? WHERE id = ?", (datetime.now(), task_id))
    conn.commit()
    conn.close()

def add_task_history(task_id: str, status: str, result: Dict[str, Any], duration_ms: float):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("INSERT INTO task_history (task_id, timestamp, status, result, duration_ms) VALUES (?, ?, ?, ?, ?)",
              (task_id, datetime.now(), status, json.dumps(result), duration_ms))
    conn.commit()
    conn.close()

def get_task_history(task_id: str = None) -> List[Dict[str, Any]]:
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    if task_id:
        c.execute("SELECT id, task_id, timestamp, status, result, duration_ms FROM task_history WHERE task_id = ? ORDER BY id DESC LIMIT 50", (task_id,))
    else:
        c.execute("SELECT id, task_id, timestamp, status, result, duration_ms FROM task_history ORDER BY id DESC LIMIT 100")
    
    rows = c.fetchall()
    conn.close()
    return [
        {
            "id": r[0],
            "task_id": r[1],
            "timestamp": r[2],
            "status": r[3],
            "result": json.loads(r[4]),
            "duration_ms": r[5]
        }
        for r in rows
    ]

def get_task_history_by_range(start: datetime, end: datetime) -> List[Dict[str, Any]]:
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT id, task_id, timestamp, status, result, duration_ms FROM task_history WHERE timestamp BETWEEN ? AND ? ORDER BY timestamp ASC", (start, end))
    rows = c.fetchall()
    conn.close()
    return [
        {
            "id": r[0],
            "task_id": r[1],
            "timestamp": r[2],
            "status": r[3],
            "result": json.loads(r[4]),
            "duration_ms": r[5]
        }
        for r in rows
    ]
