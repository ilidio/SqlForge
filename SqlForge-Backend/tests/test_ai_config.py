import pytest
from unittest.mock import patch, mock_open
import ai_utils
from pathlib import Path

def test_get_ai_config_no_file():
    with patch("pathlib.Path.exists") as mock_exists:
        mock_exists.return_value = False
        config = ai_utils.get_ai_config()
        assert config["api_key"] is None
        assert config["model"] is None
        assert ai_utils.is_ai_enabled() is False

def test_get_ai_config_empty_values():
    mock_json_content = '{"gemini_api_key": "", "gemini_model": ""}'
    with patch("pathlib.Path.exists") as mock_exists:
        mock_exists.return_value = True
        with patch("builtins.open", mock_open(read_data=mock_json_content)):
            config = ai_utils.get_ai_config()
            assert config["api_key"] is None
            assert config["model"] is None
            assert ai_utils.is_ai_enabled() is False

def test_get_ai_config_success():
    mock_json_content = '{"gemini_api_key": "test-key", "gemini_model": "gemini-pro"}'
    with patch("pathlib.Path.exists") as mock_exists:
        mock_exists.return_value = True
        with patch("builtins.open", mock_open(read_data=mock_json_content)):
            config = ai_utils.get_ai_config()
            assert config["api_key"] == "test-key"
            assert config["model"] == "gemini-pro"
            assert ai_utils.is_ai_enabled() is True
