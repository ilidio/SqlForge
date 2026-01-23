import pytest
from unittest.mock import patch, MagicMock
from monitor.health import HealthAuditor
from models import ConnectionConfig

@patch('monitor.health.get_engine')
def test_check_pg_connections_warning(mock_get_engine):
    # Mock usage: 95% (19/20)
    mock_conn = MagicMock()
    mock_conn.execute.return_value.fetchone.return_value = [0.95, 19, 20]
    
    mock_engine = MagicMock()
    mock_engine.connect.return_value.__enter__.return_value = mock_conn
    mock_get_engine.return_value = mock_engine
    
    config = ConnectionConfig(name="test", type="postgresql", database="db")
    risk = HealthAuditor._check_pg_connections(config)
    
    assert risk is not None
    assert risk['severity'] == 'High'
    assert '95%' in risk['description']

@patch('monitor.health.get_engine')
def test_check_pg_transactions_alert(mock_get_engine):
    # Mock: 5 long transactions
    mock_conn = MagicMock()
    mock_conn.execute.return_value.scalar.return_value = 5
    
    mock_engine = MagicMock()
    mock_engine.connect.return_value.__enter__.return_value = mock_conn
    mock_get_engine.return_value = mock_engine
    
    config = ConnectionConfig(name="test", type="postgresql", database="db")
    risk = HealthAuditor._check_pg_transactions(config)
    
    assert risk is not None
    assert risk['type'] == 'Transaction Age'
    assert '5 transactions' in risk['description']

@patch('monitor.health.get_engine')
def test_get_health_score_aggregation(mock_get_engine):
    # Mock multiple risks
    mock_conn = MagicMock()
    # 1. Connections (95%)
    # 2. Transactions (5)
    # 3. Indexes (None for simplicity here, or mock it)
    mock_conn.execute.return_value.fetchone.return_value = [0.95, 19, 20]
    mock_conn.execute.return_value.scalar.return_value = 5
    mock_conn.execute.return_value.fetchall.return_value = [] # No index bloat
    
    mock_engine = MagicMock()
    mock_engine.connect.return_value.__enter__.return_value = mock_conn
    mock_get_engine.return_value = mock_engine
    
    config = ConnectionConfig(name="test", type="postgresql", database="db")
    audit = HealthAuditor.get_health_score(config)
    
    assert audit['score'] < 100
    assert len(audit['risks']) == 2
