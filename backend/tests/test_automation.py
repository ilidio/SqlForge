import pytest
from unittest.mock import patch, MagicMock
from pro.automation import automation_engine

def test_save_and_delete_task():
    task = {
        "name": "Test Task",
        "task_type": "query",
        "schedule_config": {"type": "cron", "expression": "0 0 * * *"},
        "task_config": {"sql": "SELECT 1"},
        "enabled": True
    }
    
    saved = automation_engine.save_task(task)
    assert saved['id'] is not None
    assert len(automation_engine.get_tasks()) >= 1
    
    task_id = saved['id']
    automation_engine.delete_task(task_id)
    assert not any(t['id'] == task_id for t in automation_engine.get_tasks())

@patch('database.execute_query')
@patch('internal_db.get_connection')
def test_execute_query_task(mock_get_conn, mock_execute):
    mock_get_conn.return_value = MagicMock(name="Test DB")
    mock_execute.return_value = {"columns": ["1"], "rows": [{"1": 1}], "error": None}
    
    task = {
        "id": "test-query-id",
        "name": "Query Task",
        "task_type": "query",
        "task_config": {"connection_id": "conn1", "sql": "SELECT 1"}
    }
    
    # Manually trigger execution logic
    automation_engine._execute_task(task)
    
    history = automation_engine.get_history("test-query-id")
    assert len(history) == 1
    assert history[0]['status'] == 'success'
    assert history[0]['result']['rows_affected'] == 1

@patch('pro.sync.diff_schemas')
@patch('internal_db.get_connection')
def test_execute_sync_dry_run(mock_get_conn, mock_diff):
    mock_get_conn.return_value = MagicMock()
    mock_diff.return_value = {"sql_text": "ALTER TABLE ...", "diff_count": 1}
    
    task = {
        "id": "test-sync-id",
        "name": "Sync Task",
        "task_type": "sync",
        "task_config": {
            "source_connection_id": "src",
            "target_connection_id": "tgt",
            "dry_run": True
        }
    }
    
    automation_engine._execute_task(task)
    
    history = automation_engine.get_history("test-sync-id")
    assert len(history) == 1
    assert history[0]['status'] == 'success'
    assert "Dry run completed" in history[0]['result']['message']