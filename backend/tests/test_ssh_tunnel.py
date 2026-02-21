import pytest
from unittest.mock import patch, MagicMock
from database import TunnelManager, get_engine
from models import ConnectionConfig, SSHConfig

@pytest.fixture
def mock_ssh_forwarder():
    with patch('database.SSHTunnelForwarder') as MockClass:
        mock_instance = MockClass.return_value
        mock_instance.local_bind_port = 12345
        mock_instance.is_active = True
        yield MockClass

@pytest.fixture
def tunnel_manager():
    return TunnelManager()

def test_tunnel_manager_starts_tunnel(tunnel_manager, mock_ssh_forwarder):
    config = ConnectionConfig(
        id="test-conn",
        name="Test DB",
        type="postgresql",
        host="db.example.com",
        port=5432,
        ssh=SSHConfig(
            enabled=True,
            host="bastion.example.com",
            username="user",
            password="password"
        )
    )

    tunnel = tunnel_manager.get_tunnel(config)

    assert tunnel is not None
    mock_ssh_forwarder.assert_called_once()
    assert tunnel.local_bind_port == 12345
    assert tunnel_manager.tunnels["test-conn_tunnel"] == tunnel

def test_tunnel_manager_reuses_active_tunnel(tunnel_manager, mock_ssh_forwarder):
    config = ConnectionConfig(
        id="test-conn",
        name="Test DB",
        type="postgresql",
        host="db.example.com",
        port=5432,
        ssh=SSHConfig(enabled=True, host="bastion", username="u")
    )

    # First call
    t1 = tunnel_manager.get_tunnel(config)
    
    # Second call should return same instance
    t2 = tunnel_manager.get_tunnel(config)
    
    assert t1 == t2
    mock_ssh_forwarder.assert_called_once() # Should not be called twice

def test_tunnel_manager_restarts_inactive_tunnel(tunnel_manager, mock_ssh_forwarder):
    config = ConnectionConfig(
        id="test-conn",
        name="Test DB",
        type="postgresql",
        host="db.example.com",
        port=5432,
        ssh=SSHConfig(enabled=True, host="bastion", username="u")
    )

    # First call
    t1 = tunnel_manager.get_tunnel(config)
    
    # Simulate inactivity
    t1.is_active = False
    
    # Second call should restart
    t2 = tunnel_manager.get_tunnel(config)
    
    assert t2 is not None
    assert mock_ssh_forwarder.call_count == 2
    t1.stop.assert_called_once() # Should have stopped the old one

@patch('database.create_engine')
@patch('database.tunnel_manager')
def test_get_engine_uses_tunnel_port(mock_tm, mock_create_engine):
    # Setup Tunnel Mock
    mock_tunnel = MagicMock()
    mock_tunnel.local_bind_port = 9999
    mock_tm.get_tunnel.return_value = mock_tunnel

    config = ConnectionConfig(
        id="test-conn",
        name="Test DB",
        type="postgresql",
        host="db.remote.com",
        port=5432,
        database="mydb",
        username="pguser",
        password="pgpassword",
        ssh=SSHConfig(enabled=True, host="bastion", username="u")
    )

    get_engine(config)

    # Verify create_engine was called with localhost and the tunnel port
    args, _ = mock_create_engine.call_args
    connection_url = args[0]
    
    assert "127.0.0.1" in connection_url
    assert "9999" in connection_url
    assert "db.remote.com" not in connection_url # Should not use remote host directly
