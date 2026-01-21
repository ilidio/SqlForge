import pytest
from unittest.mock import patch, MagicMock
from pro.what_if import evaluate_virtual_index
from models import ConnectionConfig

@patch('pro.what_if.get_engine')
def test_evaluate_virtual_index_pg_success(mock_get_engine):
    # Setup mock connection and responses
    mock_conn = mock_get_engine.return_value.connect.return_value.__enter__.return_value
    
    # 1. Check support (hypopg exists)
    # 2. Baseline Explain
    # 3. Create Index
    # 4. Virtual Explain
    # 5. Reset
    mock_conn.execute.side_effect = [
        MagicMock(scalar=lambda: 1), # Check hypopg extension
        MagicMock(scalar=lambda: [{'Plan': {'Total Cost': 100.0}}]), # Baseline
        None, # Create index
        MagicMock(scalar=lambda: [{'Plan': {'Total Cost': 40.0}}]), # Virtual
        None # Reset
    ]

    config = ConnectionConfig(name="test", type="postgresql", database="db")
    sql = "SELECT * FROM t WHERE x = 1"
    ddl = "CREATE INDEX ON t (x)"
    
    res = evaluate_virtual_index(config, sql, ddl)
    
    assert res['improvement_pct'] == 60.0
    assert res['baseline_cost'] == 100.0
    assert res['virtual_cost'] == 40.0

def test_evaluate_virtual_index_unsupported_dialect():
    config = ConnectionConfig(name="test", type="mysql", database="db")
    res = evaluate_virtual_index(config, "SELECT 1", "CREATE INDEX")
    assert "supported for PostgreSQL only" in res['error']
