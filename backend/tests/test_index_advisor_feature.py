import pytest
from pro import index_advisor
from models import ConnectionConfig
from unittest.mock import MagicMock, patch

def test_index_advisor_detection_logic():
    # 1. Setup
    config = ConnectionConfig(id="test", name="test", type="postgresql", database="test")
    sql = "SELECT * FROM users JOIN orders ON users.id = orders.user_id WHERE users.email = 'test@example.com' ORDER BY orders.created_at"
    
    # 2. Mock Database Inspector
    with patch('pro.index_advisor.get_engine') as mock_get_engine:
        mock_inspector = MagicMock()
        with patch('pro.index_advisor.inspect', return_value=mock_inspector):
            # Mock table existence
            mock_inspector.has_table.side_effect = lambda t: t in ['users', 'orders']
            
            # Mock indexes: users.id is PK, users.email is NOT indexed
            # orders.user_id is NOT indexed, orders.created_at is NOT indexed
            mock_inspector.get_pk_constraint.side_effect = lambda t: {'constrained_columns': ['id']} if t == 'users' else {}
            mock_inspector.get_indexes.return_value = [] # No indexes initially
            
            # 3. Run Analysis (AI part mocked)
            result = index_advisor.generate_index_recommendations(config, sql, api_key=None, model_name=None)
            
            # 4. Verify Recommendations
            recs = result["recommendations"]
            # We expect recommendations for:
            # - users.email (WHERE)
            # - orders.user_id (JOIN)
            # - orders.created_at (ORDER BY)
            # users.id is covered by PK
            
            rec_keys = [(r["table"], r["column"]) for r in recs]
            assert ("users", "email") in rec_keys
            assert ("orders", "user_id") in rec_keys
            assert ("orders", "created_at") in rec_keys
            assert ("users", "id") not in rec_keys # Should be ignored as PK

def test_index_advisor_parsing_failure():
    config = ConnectionConfig(id="test", name="test", type="postgresql", database="test")
    sql = "NOT A VALID SQL QUERY"
    result = index_advisor.generate_index_recommendations(config, sql, api_key=None, model_name=None)
    assert "error" in result
    assert "Parsing failed" in result["error"]
