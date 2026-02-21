import pytest
from unittest.mock import patch, MagicMock
from database import get_tables
from models import ConnectionConfig, TableInfo
from sqlalchemy import text

@patch('database.get_engine')
@patch('database.inspect')
def test_get_tables_postgres_procedures(mock_inspect, mock_get_engine):
    # Mock setup
    mock_inspector = MagicMock()
    mock_inspector.get_table_names.return_value = ['users']
    mock_inspector.get_view_names.return_value = ['v_users']
    mock_inspect.return_value = mock_inspector
    
    mock_conn = MagicMock()
    # Mock result for pg_proc query
    # row[0] = proname, row[1] = prokind ('p' for procedure, 'f' for function)
    mock_result = [
        ('calculate_tax', 'f'),
        ('process_orders', 'p')
    ]
    mock_conn.execute.return_value = mock_result
    
    mock_engine = MagicMock()
    mock_engine.connect.return_value.__enter__.return_value = mock_conn
    mock_get_engine.return_value = mock_engine
    
    config = ConnectionConfig(name="test", type="postgresql", database="db")
    items = get_tables(config)
    
    # Assertions
    assert any(i.name == 'users' and i.type == 'table' for i in items)
    assert any(i.name == 'calculate_tax' and i.type == 'function' for i in items)
    assert any(i.name == 'process_orders' and i.type == 'procedure' for i in items)

@patch('database.get_engine')
@patch('database.inspect')
def test_get_tables_mysql_procedures(mock_inspect, mock_get_engine):
    mock_inspector = MagicMock()
    mock_inspector.get_table_names.return_value = []
    mock_inspector.get_view_names.return_value = []
    mock_inspect.return_value = mock_inspector
    
    mock_conn = MagicMock()
    # MySQL: SHOW PROCEDURE STATUS returns row where index 1 is Name
    mock_conn.execute.side_effect = [
        [('db', 'my_proc', 'PROCEDURE', 'def', '...', '...') ], # Procedures
        [('db', 'my_func', 'FUNCTION', 'def', '...', '...') ]   # Functions
    ]
    
    mock_engine = MagicMock()
    mock_engine.connect.return_value.__enter__.return_value = mock_conn
    mock_get_engine.return_value = mock_engine
    
    config = ConnectionConfig(name="test", type="mysql", database="db")
    items = get_tables(config)
    
    assert any(i.name == 'my_proc' and i.type == 'procedure' for i in items)
    assert any(i.name == 'my_func' and i.type == 'function' for i in items)

@patch('database.get_engine')
@patch('database.inspect')
def test_get_tables_mssql_procedures(mock_inspect, mock_get_engine):
    mock_inspector = MagicMock()
    mock_inspector.get_table_names.return_value = []
    mock_inspector.get_view_names.return_value = []
    mock_inspect.return_value = mock_inspector
    
    mock_conn = MagicMock()
    mock_conn.execute.side_effect = [
        [('sp_test',)], # Procedures
        [('fn_test',)]  # Functions
    ]
    
    mock_engine = MagicMock()
    mock_engine.connect.return_value.__enter__.return_value = mock_conn
    mock_get_engine.return_value = mock_engine
    
    config = ConnectionConfig(name="test", type="mssql", database="db")
    items = get_tables(config)
    
    assert any(i.name == 'sp_test' and i.type == 'procedure' for i in items)
    assert any(i.name == 'fn_test' and i.type == 'function' for i in items)
