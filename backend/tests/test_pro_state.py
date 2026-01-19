import os
import shutil
import pytest
from pro.state import StateManager

STATE_DIR = "test_states"

@pytest.fixture
def manager():
    if os.path.exists(STATE_DIR):
        shutil.rmtree(STATE_DIR)
    m = StateManager(STATE_DIR)
    yield m
    if os.path.exists(STATE_DIR):
        shutil.rmtree(STATE_DIR)

def test_save_load_state(manager):
    test_data = {"user": "admin", "theme": "dark"}
    state_id = "snapshot_1"
    
    path = manager.save_state(state_id, test_data)
    assert os.path.exists(path)
    
    loaded = manager.load_state(state_id)
    assert loaded["data"] == test_data
    assert loaded["version"] == "1.0"

def test_list_states(manager):
    manager.save_state("s1", {"id": 1})
    manager.save_state("s2", {"id": 2})
    
    states = manager.list_states()
    assert "s1" in states
    assert "s2" in states
    assert len(states) == 2

def test_load_nonexistent(manager):
    assert manager.load_state("nope") is None
