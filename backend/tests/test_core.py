import pytest
from internal_db import init_db, save_connection, get_connections, add_history, get_history
from models import ConnectionConfig
from monitor.manager import MonitorManager
import os
import sqlite3

# Use a temporary DB for internal tests
DB_PATH = "sqlforge_metadata.db"

@pytest.fixture(autouse=True)
def clean_metadata():
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
    init_db()
    yield
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)

def test_internal_db_connections():
    config = ConnectionConfig(
        id="test-1",
        name="Internal Test",
        type="sqlite",
        database="test.db"
    )
    save_connection(config)
    
    conns = get_connections()
    assert len(conns) == 1
    assert conns[0].name == "Internal Test"

def test_internal_db_history():
    add_history("test-1", "SELECT 1", 10.5, "success")
    history = get_history()
    assert len(history) == 1
    assert history[0]["sql"] == "SELECT 1"
    assert history[0]["duration_ms"] == 10.5

@pytest.mark.anyio
async def test_monitor_manager_sqlite():
    config = ConnectionConfig(name="SQLite", type="sqlite", database="foo.db")
    processes = await MonitorManager.get_active_processes(config)
    assert len(processes) == 1
    assert "not supported" in processes[0]["query"]

def test_monitor_metrics():
    config = ConnectionConfig(name="SQLite", type="sqlite", database="foo.db")
    metrics = MonitorManager.get_realtime_metrics(config)
    assert "cpu" in metrics
    assert "tps" in metrics
