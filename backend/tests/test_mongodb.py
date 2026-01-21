import pytest
from unittest.mock import patch, MagicMock
import json
import io
from database import execute_query, import_data, stream_export_data, drop_object, execute_batch_mutations, get_schema_context
from models import ConnectionConfig

@pytest.fixture
def mongo_config():
    return ConnectionConfig(
        id="mongo-test",
        name="Mongo Test",
        type="mongodb",
        host="localhost",
        port=27017,
        database="testdb"
    )

@patch("database.MongoClient")
def test_get_schema_context_mongo(mock_client, mongo_config):
    mock_db = MagicMock()
    mock_client.return_value.__getitem__.return_value = mock_db
    mock_db.list_collection_names.return_value = ["users"]
    mock_db["users"].find_one.return_value = {"_id": "1", "name": "John"}
    
    context = get_schema_context(mongo_config)
    assert "MongoDB Database" in context
    assert "users (Fields: _id, name)" in context

@patch("database.MongoClient")
def test_import_data_mongo(mock_client, mongo_config):
    mock_db = MagicMock()
    mock_client.return_value.__getitem__.return_value = mock_db
    
    csv_content = b"name,age\nAlice,30\nBob,25"
    result = import_data(mongo_config, "people", csv_content, "csv")
    
    assert result["success"] is True
    assert "Imported 2 documents" in result["message"]
    mock_db["people"].insert_many.assert_called_once()

@patch("database.MongoClient")
def test_stream_export_data_mongo(mock_client, mongo_config):
    mock_db = MagicMock()
    mock_client.return_value.__getitem__.return_value = mock_db
    mock_db["people"].find.return_value = [
        {"_id": "1", "name": "Alice"},
        {"_id": "2", "name": "Bob"}
    ]
    
    gen = stream_export_data(mongo_config, "people", "json")
    content = "".join(list(gen))
    
    data = json.loads(content)
    assert len(data) == 2
    assert data[0]["name"] == "Alice"

@patch("database.MongoClient")
def test_drop_collection_mongo(mock_client, mongo_config):
    mock_db = MagicMock()
    mock_client.return_value.__getitem__.return_value = mock_db
    
    result = drop_object(mongo_config, "to_drop", "collection")
    assert result["success"] is True
    mock_db.drop_collection.assert_called_with("to_drop")

@patch("database.MongoClient")
def test_execute_batch_mutations_mongo(mock_client, mongo_config):
    mock_db = MagicMock()
    mock_client.return_value.__getitem__.return_value = mock_db
    
    ops = [
        {"type": "update", "table": "users", "where": {"name": "Alice"}, "data": {"age": 31}},
        {"type": "delete", "table": "users", "where": {"name": "Bob"}}
    ]
    
    result = execute_batch_mutations(mongo_config, ops)
    assert len(result) == 2
    assert all(r["success"] for r in result)
    mock_db["users"].bulk_write.assert_called_once()
