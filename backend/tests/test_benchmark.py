import pytest
from unittest.mock import patch, MagicMock
from pro.benchmark import run_benchmark
from models import ConnectionConfig

@patch('pro.benchmark.get_engine')
def test_run_benchmark_logic(mock_get_engine):
    # Mock engine and connection
    mock_conn = mock_get_engine.return_value.connect.return_value.__enter__.return_value
    
    config = ConnectionConfig(name="test", type="sqlite", database=":memory:")
    sql = "SELECT 1"
    
    # Run a very short benchmark (1s) with low concurrency
    res = run_benchmark(config, sql, concurrency=2, duration=1)
    
    assert 'throughput_rps' in res
    assert 'p95_latency_ms' in res
    assert res['concurrency'] == 2
    assert res['successful_requests'] > 0
    assert res['errors'] == 0

@patch('pro.benchmark.get_engine')
def test_run_benchmark_handles_errors(mock_get_engine):
    mock_conn = mock_get_engine.return_value.connect.return_value.__enter__.return_value
    mock_conn.execute.side_effect = Exception("DB Error")
    
    config = ConnectionConfig(name="test", type="sqlite", database=":memory:")
    res = run_benchmark(config, "INVALID SQL", concurrency=1, duration=1)
    
    assert res['errors'] > 0
    assert res['successful_requests'] == 0
