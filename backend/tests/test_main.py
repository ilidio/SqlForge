from fastapi.testclient import TestClient
from main import app
import internal_db
import os

# Clean up test DB before/after
TEST_DB = "sqlforge_metadata.db"

def setup_module(module):
    # Ensure fresh start
    if os.path.exists(TEST_DB):
        os.remove(TEST_DB)

def test_read_root():
    with TestClient(app) as client:
        response = client.get("/")
        assert response.status_code == 200
        assert response.json() == {"status": "ok", "app": "SqlForge"}

def test_create_connection():
    with TestClient(app) as client:
        response = client.post("/connections", json={
            "name": "Test DB",
            "type": "sqlite",
            "database": "test.db",
            "filepath": "/tmp/test.db"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Test DB"
        assert "id" in data
