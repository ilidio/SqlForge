import pytest
from fastapi.testclient import TestClient
from main import app
import os
import sqlite3

client = TestClient(app)

@pytest.fixture
def setup_mutation_db(tmp_path):
    db_file = str(tmp_path / "mutation.db")
    conn = sqlite3.connect(db_file)
    conn.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER)")
    conn.execute("INSERT INTO users (id, name, age) VALUES (1, 'Alice', 30)")
    conn.execute("INSERT INTO users (id, name, age) VALUES (2, 'Bob', 25)")
    conn.commit()
    conn.close()
    
    # Register connection in metadata
    conn_data = {
        "name": "Mutation Test",
        "type": "sqlite",
        "database": "mutation.db",
        "filepath": db_file
    }
    r = client.post("/connections", json=conn_data)
    return r.json()["id"], db_file

def test_batch_mutation_success(setup_mutation_db):
    conn_id, db_path = setup_mutation_db
    
    ops = [
        {
            "type": "update",
            "table": "users",
            "data": {"name": "Alicia", "age": 31},
            "where": {"id": 1, "name": "Alice", "age": 30}
        },
        {
            "type": "delete",
            "table": "users",
            "where": {"id": 2, "name": "Bob", "age": 25}
        }
    ]
    
    response = client.post("/query/batch", json={
        "connection_id": conn_id,
        "operations": ops
    })
    
    assert response.status_code == 200
    results = response.json()["results"]
    assert len(results) == 2
    assert all(r["success"] for r in results)
    
    # Verify DB state
    conn = sqlite3.connect(db_path)
    rows = conn.execute("SELECT * FROM users").fetchall()
    assert len(rows) == 1
    assert rows[0] == (1, 'Alicia', 31)
    conn.close()

def test_mutation_rollback_on_failure(setup_mutation_db):
    conn_id, db_path = setup_mutation_db
    
    ops = [
        {
            "type": "update",
            "table": "users",
            "data": {"name": "Changed"},
            "where": {"id": 1}
        },
        {
            "type": "update",
            "table": "nonexistent_table", # This will fail
            "data": {"foo": "bar"},
            "where": {"id": 1}
        }
    ]
    
    response = client.post("/query/batch", json={
        "connection_id": conn_id,
        "operations": ops
    })
    
    assert response.status_code == 200
    results = response.json()["results"]
    assert results[0]["success"] is False # Transaction rollback means everything failed
    assert "no such table" in results[0]["error"].lower()
    
    # Verify rollback: Alice should still be Alice
    conn = sqlite3.connect(db_path)
    row = conn.execute("SELECT name FROM users WHERE id = 1").fetchone()
    assert row[0] == 'Alice'
    conn.close()

def test_optimistic_concurrency_failure(setup_mutation_db):
    conn_id, db_path = setup_mutation_db
    
    ops = [
        {
            "type": "update",
            "table": "users",
            "data": {"name": "Stale Update"},
            "where": {"id": 1, "name": "Wrong Name"} # Name is Alice, so this should match 0 rows
        }
    ]
    
    response = client.post("/query/batch", json={
        "connection_id": conn_id,
        "operations": ops
    })
    
    assert response.status_code == 200
    results = response.json()["results"]
    assert results[0]["success"] is False
    assert "modified or deleted by another user" in results[0]["error"]
