import pytest
from fastapi.testclient import TestClient
from main import app
import os
import sqlite3
import json
import io

client = TestClient(app)

@pytest.fixture
def setup_feature_db(tmp_path):
    db_file = str(tmp_path / "features.db")
    conn = sqlite3.connect(db_file)
    conn.execute("CREATE TABLE test_table (id INTEGER PRIMARY KEY, name TEXT)")
    conn.execute("INSERT INTO test_table (id, name) VALUES (1, 'Initial')")
    conn.commit()
    conn.close()
    
    # Register connection
    conn_data = {
        "name": "Feature Test",
        "type": "sqlite",
        "database": "features.db",
        "filepath": db_file
    }
    r = client.post("/connections", json=conn_data)
    return r.json()["id"], db_file

def test_get_schema_details(setup_feature_db):
    conn_id, _ = setup_feature_db
    response = client.get(f"/connections/{conn_id}/schema")
    assert response.status_code == 200
    data = response.json()
    assert len(data) > 0
    table = next(t for t in data if t["name"] == "test_table")
    assert any(c["name"] == "id" and c["primary_key"] for c in table["columns"])
    assert any(c["name"] == "name" for c in table["columns"])

def test_alter_table_add_column(setup_feature_db):
    conn_id, db_path = setup_feature_db
    
    # Add column
    req = {
        "connection_id": conn_id,
        "table_name": "test_table",
        "action": "add_column",
        "column_def": {
            "name": "new_col",
            "type": "TEXT",
            "nullable": True
        }
    }
    response = client.post(f"/connections/{conn_id}/schema/alter", json=req)
    assert response.status_code == 200
    
    # Verify in DB
    conn = sqlite3.connect(db_path)
    cursor = conn.execute("PRAGMA table_info(test_table)")
    cols = [row[1] for row in cursor.fetchall()]
    assert "new_col" in cols
    conn.close()

def test_alter_table_rename_column(setup_feature_db):
    conn_id, db_path = setup_feature_db
    
    req = {
        "connection_id": conn_id,
        "table_name": "test_table",
        "action": "rename_column",
        "column_name": "name",
        "new_column_name": "renamed_name"
    }
    response = client.post(f"/connections/{conn_id}/schema/alter", json=req)
    assert response.status_code == 200
    
    # Verify in DB
    conn = sqlite3.connect(db_path)
    cursor = conn.execute("PRAGMA table_info(test_table)")
    cols = [row[1] for row in cursor.fetchall()]
    assert "renamed_name" in cols
    assert "name" not in cols
    conn.close()

def test_import_csv(setup_feature_db):
    conn_id, db_path = setup_feature_db
    
    csv_content = "id,name\n10,Imported CSV\n11,Another One"
    files = {'file': ('test.csv', csv_content, 'text/csv')}
    data = {'mode': 'append', 'format': 'csv'}
    
    response = client.post(f"/connections/{conn_id}/import/test_table", files=files, data=data)
    assert response.status_code == 200
    
    # Verify in DB
    conn = sqlite3.connect(db_path)
    count = conn.execute("SELECT COUNT(*) FROM test_table").fetchone()[0]
    assert count == 3 # 1 initial + 2 imported
    conn.close()

def test_import_json_truncate(setup_feature_db):
    conn_id, db_path = setup_feature_db
    
    json_content = json.dumps([
        {"id": 100, "name": "JSON 1"},
        {"id": 101, "name": "JSON 2"}
    ])
    files = {'file': ('test.json', json_content, 'application/json')}
    data = {'mode': 'truncate', 'format': 'json'}
    
    response = client.post(f"/connections/{conn_id}/import/test_table", files=files, data=data)
    assert response.status_code == 200
    
    # Verify in DB
    conn = sqlite3.connect(db_path)
    rows = conn.execute("SELECT * FROM test_table").fetchall()
    assert len(rows) == 2
    assert rows[0][1] == "JSON 1"
    conn.close()

def test_export_csv(setup_feature_db):
    conn_id, _ = setup_feature_db
    
    response = client.get(f"/connections/{conn_id}/export/test_table?format=csv")
    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]
    content = response.text
    assert "id,name" in content
    assert "1,Initial" in content

def test_export_json(setup_feature_db):
    conn_id, _ = setup_feature_db
    
    response = client.get(f"/connections/{conn_id}/export/test_table?format=json")
    assert response.status_code == 200
    assert "application/json" in response.headers["content-type"]
    data = response.json()
    assert isinstance(data, list)
    assert data[0]["name"] == "Initial"
