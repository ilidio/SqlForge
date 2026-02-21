import pytest
from fastapi.testclient import TestClient
from main import app
from models import ConnectionConfig
import os

client = TestClient(app)

@pytest.fixture
def setup_test_connections():
    # Create two SQLite connections for testing sync
    conn1 = {
        "name": "Source DB",
        "type": "sqlite",
        "database": "source.db",
        "filepath": "source.db"
    }
    conn2 = {
        "name": "Target DB",
        "type": "sqlite",
        "database": "target.db",
        "filepath": "target.db"
    }
    
    r1 = client.post("/connections", json=conn1)
    r2 = client.post("/connections", json=conn2)
    
    return r1.json()["id"], r2.json()["id"]

def test_sync_diff_api(setup_test_connections):
    source_id, target_id = setup_test_connections
    
    response = client.post("/pro/sync/diff", json={
        "source_connection_id": source_id,
        "target_connection_id": target_id
    })
    
    assert response.status_code == 200
    data = response.json()
    assert "sql" in data
    # Can be either a migration plan or a note that the DB is empty
    assert any(x in data["sql"] for x in ["-- Migration from Source DB", "-- Source database is empty."])

def test_sync_execute_dry_run(setup_test_connections):
    source_id, target_id = setup_test_connections
    
    response = client.post("/pro/sync/execute", json={
        "source_connection_id": source_id,
        "target_connection_id": target_id,
        "dry_run": True
    })
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "Dry run completed" in data["message"]

def test_sync_invalid_connection():
    response = client.post("/pro/sync/diff", json={
        "source_connection_id": "invalid",
        "target_connection_id": "invalid"
    })
    assert response.status_code == 404
