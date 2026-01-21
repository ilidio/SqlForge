import pytest
from unittest.mock import patch, MagicMock
from monitor.locks import get_lock_tree
from models import ConnectionConfig

@patch('monitor.locks.get_engine')
def test_get_lock_tree_postgresql(mock_get_engine):
    mock_conn = mock_get_engine.return_value.connect.return_value.__enter__.return_value
    
    # Mock data showing PID 100 blocking PID 200
    mock_result = [
        {'pid': 100, 'usename': 'admin', 'query': 'UPDATE t1 SET x=1', 'state': 'active', 'wait_event': None, 'duration': '0:01:00', 'blocking_pids': []},
        {'pid': 200, 'usename': 'user1', 'query': 'SELECT * FROM t1', 'state': 'active', 'wait_event': 'Lock', 'duration': '0:00:30', 'blocking_pids': [100]}
    ]
    
    # Setup mock iterator for sqlalchemy result
    mock_res_obj = MagicMock()
    mock_res_obj._mapping = mock_result[0] # This won't work easily for lists, side_effect is better
    
    # Re-setup mock_conn.execute
    def mock_execute(stmt):
        m = MagicMock()
        m._mapping = {}
        # Simple list return for test
        return [MagicMock(_mapping=r) for r in mock_result]
        
    mock_conn.execute.side_effect = mock_execute

    config = ConnectionConfig(name="test", type="postgresql", database="db")
    res = get_lock_tree(config)
    
    assert len(res['nodes']) == 2
    assert len(res['edges']) == 1
    assert res['edges'][0]['source'] == '100'
    assert res['edges'][0]['target'] == '200'
    assert any(n['id'] == '100' and n['is_blocking'] for n in res['nodes'])
