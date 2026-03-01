from unittest.mock import patch, MagicMock
from pro import scheduler
import internal_db

@patch('internal_db.update_task_last_run')
@patch('pro.sync.sync_schemas')
@patch('internal_db.get_connection')
@patch('internal_db.get_scheduled_task')
@patch('internal_db.add_task_history')
def test_execute_sync_task(mock_add_history, mock_get_task, mock_get_conn, mock_sync, mock_update_last_run):
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
    
    mock_sync.assert_called_once()
    mock_add_history.assert_called_once()
    mock_update_last_run.assert_called_once_with("test-sync-id")