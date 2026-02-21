import pytest
from pro import what_if
from models import ConnectionConfig
from unittest.mock import MagicMock, patch
import json

def test_what_if_pg_logic():
    config = ConnectionConfig(id="test", name="test", type="postgresql", database="test")
    sql = "SELECT * FROM test WHERE id = 1"
    ddl = "CREATE INDEX idx_test_id ON test(id)"
    
    # Mocking DB calls for Postgres
    with patch('pro.what_if.get_engine') as mock_get_engine:
        mock_conn = MagicMock()
        mock_get_engine.return_value.connect.return_value.__enter__.return_value = mock_conn
        
        # Mock check_virtual_index_support to return success
        with patch('pro.what_if.check_virtual_index_support', return_value={"supported": True}):
            
            # Mock EXPLAIN results
            # Base plan cost: 100
            # Virtual plan cost: 10
            mock_result_base = MagicMock()
            mock_result_base.scalar.return_value = [{"Plan": {"Total Cost": 100.0}}]
            
            mock_result_virt = MagicMock()
            mock_result_virt.scalar.return_value = [{"Plan": {"Total Cost": 10.0}}]
            
            mock_conn.execute.side_effect = [
                mock_result_base, # Baseline EXPLAIN
                MagicMock(),      # hypopg_create_index
                mock_result_virt, # Virtual EXPLAIN
                MagicMock()       # hypopg_reset
            ]
            
            result = what_if.evaluate_virtual_index(config, sql, ddl)
            
            assert result["baseline_cost"] == 100.0
            assert result["virtual_cost"] == 10.0
            assert result["improvement_pct"] == 90.0

def test_what_if_unsupported_dialect():
    config = ConnectionConfig(id="test", name="test", type="mysql", database="test")
    result = what_if.evaluate_virtual_index(config, "SELECT 1", "CREATE INDEX ...")
    assert "error" in result
    assert "not currently supported" in result["error"]
