import pytest
from fastapi.testclient import TestClient
from main import app
from unittest.mock import patch, MagicMock
import os
import sqlite3

import internal_db

client = TestClient(app)

@pytest.fixture(autouse=True)
def init_metadata():
    internal_db.init_db()
    yield

@pytest.fixture
def setup_test_db(tmp_path):
    db_file = str(tmp_path / "uncovered.db")
    conn = sqlite3.connect(db_file)
    conn.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)")
    conn.commit()
    conn.close()
    
    conn_data = {
        "name": "Uncovered Test",
        "type": "sqlite",
        "database": "uncovered.db",
        "filepath": db_file
    }
    r = client.post("/connections", json=conn_data)
    return r.json()["id"], db_file

def test_delete_connection(setup_test_db):
    conn_id, _ = setup_test_db
    response = client.delete(f"/connections/{conn_id}")
    assert response.status_code == 200
    assert response.json() == {"status": "deleted"}
    
    # Verify it's gone
    r_get = client.get("/connections")
    assert not any(c["id"] == conn_id for c in r_get.json())

def test_discover_connections():
    response = client.get("/connections/discover")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_test_connection(setup_test_db):
    conn_id, db_path = setup_test_db
    conn_data = {
        "name": "Valid Test",
        "type": "sqlite",
        "database": "uncovered.db",
        "filepath": db_path
    }
    response = client.post("/connections/test", json=conn_data)
    assert response.status_code == 200
    assert response.json()["success"] is True

def test_get_tables(setup_test_db):
    conn_id, _ = setup_test_db
    response = client.get(f"/connections/{conn_id}/tables")
    assert response.status_code == 200
    tables = response.json()
    assert any(t["name"] == "users" for t in tables)

def test_drop_object(setup_test_db):
    conn_id, db_path = setup_test_db
    # Create another table to drop
    conn = sqlite3.connect(db_path)
    conn.execute("CREATE TABLE to_drop (id INT)")
    conn.commit()
    conn.close()
    
    response = client.post(f"/connections/{conn_id}/drop", json={"name": "to_drop", "type": "table"})
    assert response.status_code == 200
    
    # Verify dropped
    conn = sqlite3.connect(db_path)
    cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='to_drop'")
    assert cursor.fetchone() is None
    conn.close()

@patch("google.generativeai.list_models")
def test_list_ai_models(mock_list_models):
    mock_model = MagicMock()
    mock_model.name = "models/gemini-pro"
    mock_model.display_name = "Gemini Pro"
    mock_model.description = "Test Description"
    mock_model.supported_generation_methods = ["generateContent"]
    mock_list_models.return_value = [mock_model]
    
    response = client.get("/ai/models?api_key=fake_key")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "gemini-pro"

@patch("google.generativeai.GenerativeModel")
def test_generate_sql(mock_gen_model, setup_test_db):
    conn_id, _ = setup_test_db
    
    mock_instance = MagicMock()
    mock_response = MagicMock()
    mock_response.text = "SELECT * FROM users"
    mock_instance.generate_content.return_value = mock_response
    mock_gen_model.return_value = mock_instance
    
    req = {
        "connection_id": conn_id,
        "prompt": "Get all users",
        "api_key": "fake_key",
        "model": "gemini-pro"
    }
    response = client.post("/ai/generate", json=req)
    assert response.status_code == 200
    assert response.json()["sql"] == "SELECT * FROM users"

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
    assert "suggested schema" in response.json()["sql"].lower() or "identical" in response.json()["sql"].lower()

    # Test execute
    response = client.post("/pro/sync/execute", json=sync_req)
    assert response.status_code == 200
    assert response.json()["status"] == "success"
