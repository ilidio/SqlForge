from unittest.mock import patch, MagicMock
from monitor.health import HealthAuditor
from models import ConnectionConfig


# --- Oracle ---

@patch('monitor.health.get_engine')
def test_check_oracle_connections_warning(mock_get_engine):
    mock_conn = MagicMock()
    # First call: current session count (190). Second call: max sessions (200).
    mock_conn.execute.return_value.scalar.side_effect = [190, 200]

    mock_engine = MagicMock()
    mock_engine.connect.return_value.__enter__.return_value = mock_conn
    mock_get_engine.return_value = mock_engine

    config = ConnectionConfig(name="test", type="oracle", database="FREE")
    risk = HealthAuditor._check_oracle_connections(config)

    assert risk is not None
    assert risk['type'] == 'Connection Exhaustion'
    assert risk['severity'] == 'High'
    assert '95%' in risk['description']


@patch('monitor.health.get_engine')
def test_check_oracle_connections_healthy_below_threshold(mock_get_engine):
    mock_conn = MagicMock()
    mock_conn.execute.return_value.scalar.side_effect = [10, 200]

    mock_engine = MagicMock()
    mock_engine.connect.return_value.__enter__.return_value = mock_conn
    mock_get_engine.return_value = mock_engine

    config = ConnectionConfig(name="test", type="oracle", database="FREE")
    risk = HealthAuditor._check_oracle_connections(config)
    assert risk is None


@patch('monitor.health.get_engine')
def test_check_oracle_connections_skips_when_max_sessions_unavailable(mock_get_engine):
    mock_conn = MagicMock()
    mock_conn.execute.return_value.scalar.side_effect = [10, 0]

    mock_engine = MagicMock()
    mock_engine.connect.return_value.__enter__.return_value = mock_conn
    mock_get_engine.return_value = mock_engine

    config = ConnectionConfig(name="test", type="oracle", database="FREE")
    assert HealthAuditor._check_oracle_connections(config) is None


@patch('monitor.health.get_engine')
def test_check_oracle_transactions_alert(mock_get_engine):
    mock_conn = MagicMock()
    mock_conn.execute.return_value.scalar.return_value = 3

    mock_engine = MagicMock()
    mock_engine.connect.return_value.__enter__.return_value = mock_conn
    mock_get_engine.return_value = mock_engine

    config = ConnectionConfig(name="test", type="oracle", database="FREE")
    risk = HealthAuditor._check_oracle_transactions(config)

    assert risk is not None
    assert risk['type'] == 'Transaction Age'
    assert '3 transactions' in risk['description']


@patch('monitor.health.get_engine')
def test_get_health_score_routes_oracle_to_oracle_checks(mock_get_engine):
    mock_conn = MagicMock()
    mock_conn.execute.return_value.scalar.side_effect = [190, 200, 3]

    mock_engine = MagicMock()
    mock_engine.connect.return_value.__enter__.return_value = mock_conn
    mock_get_engine.return_value = mock_engine

    config = ConnectionConfig(name="test", type="oracle", database="FREE")
    audit = HealthAuditor.get_health_score(config)

    assert audit['score'] < 100
    assert len(audit['risks']) == 2


# --- SQL Server ---

@patch('monitor.health.get_engine')
def test_check_mssql_connections_warning(mock_get_engine):
    mock_conn = MagicMock()
    mock_conn.execute.return_value.scalar.side_effect = [95, 100]

    mock_engine = MagicMock()
    mock_engine.connect.return_value.__enter__.return_value = mock_conn
    mock_get_engine.return_value = mock_engine

    config = ConnectionConfig(name="test", type="mssql", database="TestDB")
    risk = HealthAuditor._check_mssql_connections(config)

    assert risk is not None
    assert risk['severity'] == 'High'
    assert '95%' in risk['description']


@patch('monitor.health.get_engine')
def test_check_mssql_connections_skips_when_dynamically_managed(mock_get_engine):
    """SQL Server reports 0 for 'user connections' when left at its default
    (dynamically managed) - there's no fixed ceiling to alert against."""
    mock_conn = MagicMock()
    mock_conn.execute.return_value.scalar.side_effect = [500, 0]

    mock_engine = MagicMock()
    mock_engine.connect.return_value.__enter__.return_value = mock_conn
    mock_get_engine.return_value = mock_engine

    config = ConnectionConfig(name="test", type="mssql", database="TestDB")
    assert HealthAuditor._check_mssql_connections(config) is None


@patch('monitor.health.get_engine')
def test_check_mssql_transactions_alert(mock_get_engine):
    mock_conn = MagicMock()
    mock_conn.execute.return_value.scalar.return_value = 2

    mock_engine = MagicMock()
    mock_engine.connect.return_value.__enter__.return_value = mock_conn
    mock_get_engine.return_value = mock_engine

    config = ConnectionConfig(name="test", type="mssql", database="TestDB")
    risk = HealthAuditor._check_mssql_transactions(config)

    assert risk is not None
    assert risk['type'] == 'Transaction Age'
    assert '2 transactions' in risk['description']


@patch('monitor.health.get_engine')
def test_get_health_score_routes_mssql_to_mssql_checks(mock_get_engine):
    mock_conn = MagicMock()
    mock_conn.execute.return_value.scalar.side_effect = [95, 100, 2]

    mock_engine = MagicMock()
    mock_engine.connect.return_value.__enter__.return_value = mock_conn
    mock_get_engine.return_value = mock_engine

    config = ConnectionConfig(name="test", type="mssql", database="TestDB")
    audit = HealthAuditor.get_health_score(config)

    assert audit['score'] < 100
    assert len(audit['risks']) == 2


# --- Unsupported engines keep the pre-existing graceful fallback ---

def test_get_health_score_unsupported_engine_still_falls_back():
    config = ConnectionConfig(name="test", type="redis", database="0")
    audit = HealthAuditor.get_health_score(config)
    assert audit['score'] == 100
    assert audit['risks'] == []
