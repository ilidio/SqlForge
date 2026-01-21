import pytest
from pro.index_advisor import analyze_query_ast, generate_index_recommendations
from models import ConnectionConfig
from unittest.mock import patch, MagicMock

def test_analyze_query_ast_simple_select():
    sql = "SELECT * FROM users WHERE email = 'test@example.com' AND status = 1"
    analysis = analyze_query_ast(sql)
    
    assert 'users' in analysis
    assert 'email' in analysis['users']['where']
    assert 'status' in analysis['users']['where']

def test_analyze_query_ast_join():
    sql = "SELECT u.name, o.id FROM users u JOIN orders o ON u.id = o.user_id WHERE o.total > 100"
    analysis = analyze_query_ast(sql)
    
    assert 'users' in analysis
    assert 'id' in analysis['users']['join']
    assert 'orders' in analysis
    assert 'user_id' in analysis['orders']['join']
    assert 'total' in analysis['orders']['where']

def test_analyze_query_ast_order_by():
    sql = "SELECT * FROM products ORDER BY created_at DESC, price ASC"
    analysis = analyze_query_ast(sql)
    
    assert 'products' in analysis
    assert 'created_at' in analysis['products']['order']
    assert 'price' in analysis['products']['order']

@patch('pro.index_advisor.get_table_indexes')
@patch('pro.index_advisor.get_engine')
def test_generate_recommendations_detects_missing(mock_engine, mock_get_indexes):
    # Mock: No indexes exist
    mock_get_indexes.return_value = []
    
    config = ConnectionConfig(name="test", type="postgresql", database="db")
    sql = "SELECT * FROM users WHERE email = 'abc'"
    
    res = generate_index_recommendations(config, sql)
    
    assert res['source'] == 'algo'
    assert len(res['data']) == 1
    assert res['data'][0]['column'] == 'email'
    assert "CREATE INDEX idx_users_email" in res['data'][0]['ddl']

@patch('pro.index_advisor.get_table_indexes')
@patch('pro.index_advisor.get_engine')
def test_generate_recommendations_skips_existing(mock_engine, mock_get_indexes):
    # Mock: Index on email already exists
    mock_get_indexes.return_value = [{'name': 'idx_email', 'column_names': ['email']}]
    
    config = ConnectionConfig(name="test", type="postgresql", database="db")
    sql = "SELECT * FROM users WHERE email = 'abc'"
    
    res = generate_index_recommendations(config, sql)
    
    assert len(res['data']) == 0 # No new recommendations needed
