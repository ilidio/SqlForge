import json
import os
from typing import Any, Dict, Optional
import datetime

class StateManager:
    """
    Handles persisting and restoring application state.
    Inspired by structured state dumping patterns.
    """
    def __init__(self, state_dir: str = "states"):
        self.state_dir = state_dir
        if not os.path.exists(state_dir):
            os.makedirs(state_dir)

    def save_state(self, state_id: str, data: Dict[str, Any]):
        """
        Saves a snapshot of the current state.
        """
        filepath = os.path.join(self.state_dir, f"{state_id}.json")
        payload = {
            "version": "1.0",
            "timestamp": datetime.datetime.now().isoformat(),
            "data": data
        }
        with open(filepath, 'w') as f:
            json.dump(payload, f, indent=2)
        return filepath

    def load_state(self, state_id: str) -> Optional[Dict[str, Any]]:
        """
        Loads a snapshot of the state.
        """
        filepath = os.path.join(self.state_dir, f"{state_id}.json")
        if not os.path.exists(filepath):
            return None
        with open(filepath, 'r') as f:
            return json.load(f)

    def list_states(self):
        """
        Lists all available state snapshots.
        """
        return [f.replace('.json', '') for f in os.listdir(self.state_dir) if f.endswith('.json')]

# Global instance
manager = StateManager()
