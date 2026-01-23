import pytest
from unittest.mock import patch, MagicMock
from pro.generator import generate_semantic_value, get_generation_strategy
from models import ConnectionConfig

def test_generate_semantic_value():
    email = generate_semantic_value('email')
    assert '@' in email
    assert '.' in email
    
    phone = generate_semantic_value('phone')
    assert phone.startswith('+1-')
    
    name = generate_semantic_value('name')
    assert len(name.split()) == 2

@patch('pro.generator.genai.Client')
@patch('pro.generator.get_engine')
@patch('pro.generator.inspect')
def test_get_generation_strategy_ai(mock_inspect, mock_get_engine, mock_genai_client):
    # Mock inspector
    mock_inspector = MagicMock()
    mock_inspector.get_columns.return_value = [
        {'name': 'email', 'type': 'VARCHAR'},
        {'name': 'full_name', 'type': 'VARCHAR'}
    ]
    mock_inspector.get_foreign_keys.return_value = []
    mock_inspect.return_value = mock_inspector
    
    # Mock AI response
    mock_response = MagicMock()
    mock_response.text = '{"email": "email", "full_name": "name"}'
    
    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = mock_response
    mock_genai_client.return_value = mock_client
    
    config = ConnectionConfig(name="test", type="postgresql", database="db")
    strategy = get_generation_strategy(config, "users", "fake_key", "model")
    
    assert strategy['email'] == 'email'
    assert strategy['full_name'] == 'name'
