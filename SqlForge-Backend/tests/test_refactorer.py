import pytest
from unittest.mock import patch, MagicMock
from pro.refactorer import refactor_sql
from models import ConnectionConfig

@patch('pro.refactorer.genai.Client')
@patch('database.get_schema_context')
def test_refactor_sql_success(mock_get_schema, mock_genai_client):
    # Setup mocks
    mock_get_schema.return_value = "Table users (id, name, created_at)"
    
    mock_response = MagicMock()
    mock_response.text = """
    {
        "refactored_sql": "SELECT * FROM users WHERE created_at >= '2023-01-01' AND created_at < '2024-01-01'",
        "explanation": "Converted YEAR(created_at) to a SARGable range comparison.",
        "changes": [
            {"type": "SARGability", "description": "Fixed non-SARGable YEAR() function"}
        ]
    }
    """
    
    mock_model = MagicMock()
    mock_model.generate_content.return_value = mock_response
    
    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = mock_response
    mock_genai_client.return_value = mock_client
    
    config = ConnectionConfig(name="test", type="postgresql", database="db")
    sql = "SELECT * FROM users WHERE YEAR(created_at) = 2023"
    
    result = refactor_sql(config, sql, "fake_key", "gemini-pro")
    
    assert "refactored_sql" in result
    assert "SELECT *" in result["refactored_sql"]
    assert "SARGable" in result["explanation"]
    assert result["changes"][0]["type"] == "SARGability"

@patch('pro.refactorer.genai.Client')
def test_refactor_sql_no_config(mock_genai_client):
    config = ConnectionConfig(name="test", type="postgresql", database="db")
    result = refactor_sql(config, "SELECT 1", None, None)
    assert "error" in result
    assert "configuration missing" in result["error"]

@patch('pro.refactorer.genai.Client')
def test_refactor_sql_ai_error(mock_genai_client):
    mock_client = MagicMock()
    mock_client.models.generate_content.side_effect = Exception("AI unreachable")
    mock_genai_client.return_value = mock_client
    
    config = ConnectionConfig(name="test", type="postgresql", database="db")
    result = refactor_sql(config, "SELECT 1", "key", "model")
    assert "error" in result
    assert "AI unreachable" in result["error"]
