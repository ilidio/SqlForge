import pytest
import sqlite3
from fastapi.testclient import TestClient
from main import app
import os

client = TestClient(app)

@pytest.fixture
def setup_test_db(tmp_path):
    db_path = str(tmp_path / "uncovered.db")
    conn = sqlite3.connect(db_path)
    conn.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)")
    conn.commit()
    conn.close()
    
    # Register connection
    response = client.post("/connections", json={
        "name": "Uncovered Test",
        "type": "sqlite",
        "database": "uncovered.db",
        "filepath": db_path
    })
    conn_id = response.json()["id"]
    return conn_id, db_path

from unittest.mock import patch, MagicMock

client = TestClient(app)

def test_ai_models_endpoint():
    with patch('google.genai.Client') as mock_client:
        mock_instance = mock_client.return_value
        mock_model = MagicMock()
        mock_model.name = "gemini-1.5-flash"
        mock_model.display_name = "Gemini 1.5 Flash"
        mock_model.description = "Fast model"
        mock_instance.models.list.return_value = [mock_model]
        
        response = client.get("/ai/models", params={"api_key": "test-key"})
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        assert response.json()[0]["name"] == "gemini-1.5-flash"

def test_delete_all_connections():
    client.post("/connections", json={
        "name": "to_be_deleted",
        "type": "sqlite",
        "database": "del.db",
        "filepath": "del.db"
    })
    response = client.delete("/connections")
    assert response.status_code == 200
    
    conns = client.get("/connections")
    assert len(conns.json()) == 0

def test_discover_connections():
    response = client.get("/connections/discover")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_history_endpoint():
    response = client.get("/history")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_briefing_endpoint():
    response = client.get("/ai/briefing", params={"api_key": "test-key"})
    assert response.status_code == 200
    # Returns SessionSummary-like dict
    assert "summary" in response.json()

def test_monitor_processes(setup_test_db):
    conn_id, _ = setup_test_db
    response = client.get(f"/monitor/processes/{conn_id}")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_kill_process(setup_test_db):
    conn_id, _ = setup_test_db
    # Mock kill request
    response = client.post("/monitor/kill", json={
        "connection_id": conn_id,
        "pid": "12345"
    })
    # Since it's SQLite, kill might not be fully supported/implemented same way as PG
    assert response.status_code == 200

def test_benchmark_endpoint(setup_test_db):
    conn_id, _ = setup_test_db
    bench_req = {
        "connection_id": conn_id,
        "sql": "SELECT 1",
        "concurrency": 1,
        "duration": 1
    }
    response = client.post("/query/benchmark", json=bench_req)
    assert response.status_code == 200
    assert "avg_latency_ms" in response.json()

def test_automation_endpoints():
    # Test task creation
    task_req = {
        "name": "Backup Task",
        "task_type": "backup",
        "schedule_config": {"type": "interval", "minutes": 60},
        "task_config": {"connection_id": "1"},
        "enabled": True
    }
    response = client.post("/automation/tasks", json=task_req)
    assert response.status_code == 200
    task_id = response.json()["id"]
    
    # List tasks
    response = client.get("/automation/tasks")
    assert response.status_code == 200
    assert any(t["id"] == task_id for t in response.json())
    
    # Run task
    response = client.post(f"/automation/tasks/{task_id}/run")
    assert response.status_code == 200
    
    # History
    response = client.get("/automation/history", params={"task_id": task_id})
    assert response.status_code == 200
    
    # Delete
    response = client.delete(f"/automation/tasks/{task_id}")
    assert response.status_code == 200

def test_pro_sync_endpoints(setup_test_db, tmp_path):
    conn_id_1, db_path_1 = setup_test_db

    # Create a second DB
    db_path_2 = str(tmp_path / "uncovered_2.db")
    conn = sqlite3.connect(db_path_2)
    conn.execute("CREATE TABLE users (id INTEGER PRIMARY KEY)") # Missing 'name' column
    conn.commit()
    conn.close()

    r2 = client.post("/connections", json={
        "name": "Test DB 2",
        "type": "sqlite",
        "database": "uncovered_2.db",
        "filepath": db_path_2
    })
    conn_id_2 = r2.json()["id"]

    # Test diff
    sync_req = {
        "source_connection_id": conn_id_1,
        "target_connection_id": conn_id_2,
        "dry_run": True
    }
    response = client.post("/pro/sync/diff", json=sync_req)
    assert response.status_code == 200
    sql_resp = response.json()["sql"].lower()
    assert "update existing table" in sql_resp or "alter existing table" in sql_resp or "identical" in sql_resp or "create missing table" in sql_resp
    
    # Test execute
    response = client.post("/pro/sync/execute", json=sync_req)
    assert response.status_code == 200
    assert response.json()["status"] == "success"