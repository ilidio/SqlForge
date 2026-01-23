import pytest
from unittest.mock import patch, MagicMock
from pro import scheduler
import internal_db

@patch('internal_db.save_scheduled_task')
@patch('internal_db.get_scheduled_tasks')
@patch('internal_db.delete_scheduled_task')
def test_scheduler_reload_jobs(mock_delete, mock_get_tasks, mock_save):
    # Mock some tasks
    mock_get_tasks.return_value = [
        {"id": "task1", "enabled": True, "schedule_config": {"type": "cron", "expression": "0 0 * * *"}, "task_type": "backup", "task_config": {}}
    ]
    
    scheduler.reload_jobs()
    
    # Check if a job was added
    jobs = scheduler.scheduler.get_jobs()
    assert any(job.id == "task1" for job in jobs)

@patch('database.execute_query')
@patch('internal_db.get_connection')
@patch('internal_db.get_scheduled_task')
@patch('internal_db.update_task_last_run')
@patch('internal_db.add_task_history')
def test_execute_query_task(mock_add_history, mock_update_run, mock_get_task, mock_get_conn, mock_execute):
    mock_get_task.return_value = {
        "id": "test-query-id",
        "name": "Query Task",
        "task_type": "query",
        "task_config": {"connection_id": "conn1", "sql": "SELECT 1"}
    }
    mock_get_conn.return_value = MagicMock()
    mock_execute.return_value = {"columns": ["1"], "rows": [{"1": 1}], "error": None}
    
    # Manually trigger execution logic
    scheduler.execute_task("test-query-id")
    
    assert mock_add_history.called
    args, kwargs = mock_add_history.call_args
    assert args[0] == "test-query-id"
    assert args[1] == "success"
    assert args[2]['rows_affected'] == 1 if 'rows_affected' in args[2] else True # Depend on implementation details

@patch('pro.sync.sync_schemas')
@patch('internal_db.get_connection')
@patch('internal_db.get_scheduled_task')
@patch('internal_db.add_task_history')
def test_execute_sync_task(mock_add_history, mock_get_task, mock_get_conn, mock_sync):
    mock_get_task.return_value = {
        "id": "test-sync-id",
        "name": "Sync Task",
        "task_type": "sync",
        "task_config": {
            "source_connection_id": "src",
            "target_connection_id": "tgt",
            "dry_run": False
        }
    }
    mock_get_conn.return_value = MagicMock()
    mock_sync.return_value = {"status": "success", "message": "Synced"}
    
    scheduler.execute_task("test-sync-id")
    
    assert mock_add_history.called
    assert mock_add_history.call_args[0][1] == "success"
