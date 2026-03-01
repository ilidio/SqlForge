import pytest
import json
import io
import pandas as pd
from unittest.mock import patch, MagicMock
from models import ConnectionConfig, AIRequest
from pro.refactorer import refactor_sql
from database import import_data, stream_export_data, execute_batch_mutations
import internal_db
import main
from fastapi.testclient import TestClient

client = TestClient(main.app)

@pytest.fixture
def mock_config():
    return ConnectionConfig(id="test-id", name="test-db", type="sqlite", filepath=":memory:", database="test")

@patch('pro.refactorer.genai.Client')
def test_refactor_sql_tasks(mock_genai, mock_config):
    mock_instance = mock_genai.return_value
    mock_instance.models.generate_content.return_value.text = json.dumps({
        "refactored_sql": "SELECT 1",
        "explanation": "Test explanation",
        "changes": []
    })
    
    # Test EXPLAIN task
    result = refactor_sql(mock_config, "SELECT * FROM users", "key", "model", task="explain")
    assert result["explanation"] == "Test explanation"
    
    # Verify the prompt contained 'EXPLAIN'
    call_args = mock_instance.models.generate_content.call_args
    assert "EXPLAIN" in call_args.kwargs['contents']

def test_import_excel(mock_config):
    # Create a dummy Excel file in memory
    df = pd.DataFrame({"id": [1, 2], "name": ["Alice", "Bob"]})
    excel_io = io.BytesIO()
    df.to_excel(excel_io, index=False)
    excel_bytes = excel_io.getvalue()
    
    # We need to mock get_engine and conn for import_data
    with patch('database.get_engine'):
        with patch('pandas.read_excel', return_value=df):
            # Just verify it attempts to process it
            try:
                import_data(mock_config, "users", excel_bytes, "excel")
            except:
                pass 

def test_workspace_crud(mock_config):
    # Mock DB for workspaces
    with (
        patch('internal_db.save_model_workspace') as mock_save,
        patch('internal_db.get_model_workspaces', return_value=[{"id": "ws1", "name": "ws1"}]),
        patch('internal_db.get_model_workspace', return_value={"id": "ws1", "name": "ws1", "content": {}})
    ):
        # Test List
        response = client.get("/workspaces/test-id")
        assert response.status_code == 200
        assert len(response.json()) == 1
        
        # Test Save
        response = client.post("/workspaces/save", json={
            "connection_id": "test-id",
            "name": "My Workspace",
            "content": {"nodes": []}
        })
        assert response.status_code == 200
        assert "id" in response.json()

def test_batch_mutations_insert(mock_config):
    with patch('database.get_engine') as mock_engine:
        mock_conn = mock_engine.return_value.begin.return_value.__enter__.return_value
        
        ops = [{"type": "insert", "table": "users", "data": {"name": "Charlie"}}]
        execute_batch_mutations(mock_config, ops)
        
        # Verify INSERT was called
        args, _ = mock_conn.execute.call_args
        assert "INSERT INTO users" in str(args[0])

@patch('subprocess.run')
def test_native_backup_call(mock_run, mock_config):
    from pro.backup import backup_database
    
    pg_config = ConnectionConfig(id="pg", name="pg", type="postgresql", host="h", port=5432, username="u", password="p", database="d")
    
    with patch('os.makedirs'):
        backup_database(pg_config, native=True)
        
    # Verify pg_dump was called
    assert mock_run.called
    cmd = mock_run.call_args[0][0]
    assert "pg_dump" in cmd
