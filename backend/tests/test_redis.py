import pytest
from unittest.mock import patch, MagicMock
import json
from database import execute_query, import_data, stream_export_data, drop_object, execute_batch_mutations, get_schema_context
from models import ConnectionConfig

@pytest.fixture
def redis_config():
    return ConnectionConfig(
        id="redis-test",
        name="Redis Test",
        type="redis",
        host="localhost",
        port=6379,
        database="0"
    )

@patch("redis.Redis")
def test_execute_query_redis_keys(mock_redis, redis_config):
    mock_r = MagicMock()
    mock_redis.return_value = mock_r
    mock_r.keys.return_value = ["key1", "key2"]
    def mock_type(k):
        if k == "key1": return "string"
        return "hash"
    mock_r.type.side_effect = mock_type
    result = execute_query(redis_config, "KEYS *")
    assert result["error"] is None
    assert len(result["rows"]) == 2

@patch("redis.Redis")
def test_execute_query_redis_select_intercept(mock_redis, redis_config):
    mock_r = MagicMock()
    mock_redis.return_value = mock_r
    mock_r.keys.return_value = ["k1"]
    mock_r.type.return_value = "string"
    result = execute_query(redis_config, "SELECT * FROM Keys (DB0) LIMIT 100")
    assert result["error"] is None
    mock_r.keys.assert_called_with("*")

@patch("redis.Redis")
def test_get_schema_context_redis(mock_redis, redis_config):
    mock_r = MagicMock()
    mock_redis.return_value = mock_r
    mock_r.keys.return_value = ["user:1", "user:2"]
    mock_r.type.return_value = "string"
    context = get_schema_context(redis_config)
    assert "Redis Database" in context
    assert "user:1 (string)" in context

@patch("redis.Redis")
def test_import_data_redis(mock_redis, redis_config):
    mock_r = MagicMock()
    mock_redis.return_value = mock_r
    pipe = mock_r.pipeline.return_value
    
    csv_content = b"key,value\nname,Alice\nage,30"
    result = import_data(redis_config, "ignored", csv_content, "csv")
    
    assert result["success"] is True
    assert "Imported 2 keys" in result["message"]
    pipe.set.assert_any_call("name", "Alice")
    pipe.set.assert_any_call("age", "30")

@patch("redis.Redis")
def test_stream_export_data_redis(mock_redis, redis_config):
    mock_r = MagicMock()
    mock_redis.return_value = mock_r
    mock_r.scan_iter.return_value = ["key1", "key2"]
    mock_r.get.side_effect = ["val1", "val2"]
    
    gen = stream_export_data(redis_config, "ignored", "json")
    content = "".join(list(gen))
    data = json.loads(content)
    assert len(data) == 2
    assert data[0]["key"] == "key1"

@patch("redis.Redis")
def test_drop_key_redis(mock_redis, redis_config):
    mock_r = MagicMock()
    mock_redis.return_value = mock_r
    result = drop_object(redis_config, "mykey", "kv")
    assert result["success"] is True
    mock_r.delete.assert_called_with("mykey")

@patch("redis.Redis")
def test_execute_batch_mutations_redis(mock_redis, redis_config):
    mock_r = MagicMock()
    mock_redis.return_value = mock_r
    pipe = mock_r.pipeline.return_value
    
    ops = [
        {"type": "update", "table": "ignored", "where": {"key": "k1"}, "data": "new_val"},
        {"type": "delete", "table": "ignored", "where": {"key": "k2"}}
    ]
    
    result = execute_batch_mutations(redis_config, ops)
    assert len(result) == 2
    pipe.set.assert_called_once_with("k1", json.dumps("new_val"))
    pipe.delete.assert_called_once_with("k2")