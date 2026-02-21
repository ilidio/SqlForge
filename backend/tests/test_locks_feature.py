import pytest
from monitor import locks
from models import ConnectionConfig
from unittest.mock import MagicMock, patch

def test_get_lock_tree_structure():
    # Mock connection config
    config = ConnectionConfig(
        id="test",
        name="test",
        type="postgresql",
        host="localhost",
        port=5432,
        database="test"
    )
    
    # Mock database result
    mock_row = {
        "pid": 123,
        "usename": "testuser",
        "query": "SELECT 1",
        "state": "active",
        "wait_event": None,
        "duration": "00:00:01",
        "blocking_pids": [456],
        "locked_tables": "table1"
    }
    
    # Mock engine and connection
    with patch('monitor.locks.get_engine') as mock_get_engine:
        mock_conn = MagicMock()
        mock_get_engine.return_value.connect.return_value.__enter__.return_value = mock_conn
        
        # Mock result set
        mock_result = MagicMock()
        mock_result._mapping = mock_row
        mock_conn.execute.return_value = [mock_result]
        
        result = locks.get_lock_tree(config)
        
        assert "nodes" in result
        assert "edges" in result
        assert len(result["nodes"]) > 0
        
        node = result["nodes"][0]
        assert node["id"] == "123"
        assert node["locked_tables"] == "table1"
        
        # Ensure blocker node was created
        assert any(n["id"] == "456" for n in result["nodes"])
        assert len(result["edges"]) == 1
        assert result["edges"][0]["source"] == "456"
        assert result["edges"][0]["target"] == "123"

def test_kill_session_call():
    config = ConnectionConfig(
        id="test",
        name="test",
        type="postgresql",
        host="localhost",
        port=5432,
        database="test"
    )
    
    with patch('monitor.locks.get_engine') as mock_get_engine:
        mock_conn = MagicMock()
        mock_get_engine.return_value.connect.return_value.__enter__.return_value = mock_conn
        
        result = locks.kill_session(config, "123")
        
        assert result["success"] is True
        assert "Session 123 terminated" in result["message"]
        # Verify correct SQL called
        mock_conn.execute.assert_called_once()
        args, _ = mock_conn.execute.call_args
        assert "pg_terminate_backend" in str(args[0])
