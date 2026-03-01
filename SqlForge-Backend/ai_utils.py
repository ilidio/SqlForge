import os
import json
from pathlib import Path
from typing import Optional, Dict
import internal_db

def get_ai_config() -> Dict[str, Optional[str]]:
    """
    Reads Gemini configuration from .gemini_config.json in the data directory.
    Returns a dictionary with 'api_key' and 'model'.
    """
    config_path = Path(internal_db.get_data_dir()) / ".gemini_config.json"
    
    if not config_path.exists():
        # Fallback to current directory for dev convenience
        local_config = Path(__file__).parent.parent / ".gemini_config.json"
        if local_config.exists():
            config_path = local_config
        else:
            return {"api_key": None, "model": None}
    
    try:
        with open(config_path, "r") as f:
            data = json.load(f)
            return {
                "api_key": data.get("gemini_api_key") or None,
                "model": data.get("gemini_model") or None
            }
    except Exception as e:
        print(f"Error reading AI config: {e}")
        return {"api_key": None, "model": None}

def is_ai_enabled() -> bool:
    """
    Checks if both API key and model are configured.
    """
    config = get_ai_config()
    return bool(config["api_key"] and config["model"])
