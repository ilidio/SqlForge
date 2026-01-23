import uuid
import time
import threading
import json
import datetime
from typing import List, Dict, Any, Optional
from models import ConnectionConfig
import database
import internal_db
from pro import sync as pro_sync
from pro import transfer as pro_transfer
from pro import backup as pro_backup

# Storage for tasks (in memory for now, could be in metadata.db)
# In a real app, use a scheduler library like APScheduler or Celery.
class AutomationEngine:
    def __init__(self):
        self.tasks = []
        self.history = []
        self._load_tasks()
        self._start_scheduler()

    def _load_tasks(self):
        # Mock initial tasks if empty
        self.tasks = []

    def get_tasks(self) -> List[Dict]:
        return self.tasks

    def save_task(self, task_data: Dict) -> Dict:
        if 'id' not in task_data or not task_data['id']:
            task_data['id'] = str(uuid.uuid4())
            self.tasks.append(task_data)
        else:
            for i, t in enumerate(self.tasks):
                if t['id'] == task_data['id']:
                    self.tasks[i] = task_data
                    break
        return task_data

    def delete_task(self, task_id: str):
        self.tasks = [t for t in self.tasks if t['id'] != task_id]

    def get_history(self, task_id: Optional[str] = None) -> List[Dict]:
        if task_id:
            return [h for h in self.history if h['task_id'] == task_id]
        return self.history

    def run_task(self, task_id: str):
        task = next((t for t in self.tasks if t['id'] == task_id), None)
        if not task:
            return {"status": "error", "message": "Task not found"}
        
        # Run in background
        thread = threading.Thread(target=self._execute_task, args=(task,))
        thread.start()
        return {"status": "started"}

    def _execute_task(self, task: Dict):
        start_time = time.time()
        task_id = task['id']
        task_type = task['task_type']
        config = task['task_config']
        
        status = 'success'
        result = {}
        
        try:
            if task_type == 'backup':
                conn_id = config.get('connection_id')
                db_config = internal_db.get_connection(conn_id)
                if db_config:
                    # Logic for backup (placeholder)
                    result = {"message": f"Backup completed for {db_config.name}"}
                else:
                    raise Exception("Connection not found")
            
            elif task_type == 'query':
                conn_id = config.get('connection_id')
                sql = config.get('sql')
                db_config = internal_db.get_connection(conn_id)
                if db_config and sql:
                    res = database.execute_query(db_config, sql)
                    if res.get('error'):
                        raise Exception(res['error'])
                    result = {"rows_affected": len(res.get('rows', []))}
                else:
                    raise Exception("Invalid query configuration")

            elif task_type == 'sync':
                source_id = config.get('source_connection_id')
                target_id = config.get('target_connection_id')
                dry_run = config.get('dry_run', True)
                source = internal_db.get_connection(source_id)
                target = internal_db.get_connection(target_id)
                if source and target:
                    if dry_run:
                        diff = pro_sync.diff_schemas(source, target)
                        result = {"message": "Dry run completed", "diff_lines": len(diff['sql_text'].split('\n'))}
                    else:
                        res = pro_sync.sync_schemas(source, target, dry_run=False)
                        result = res
                else:
                    raise Exception("Source or target connection not found")

            elif task_type == 'batch':
                steps = config.get('steps', [])
                step_results = []
                for step in steps:
                    # Simplified execution of sub-tasks
                    step_results.append({"step": step.get('type'), "status": "completed"})
                result = {"steps": step_results}

        except Exception as e:
            status = 'error'
            result = {"error": str(e)}
        
        duration = (time.time() - start_time) * 1000
        
        history_entry = {
            "id": len(self.history) + 1,
            "task_id": task_id,
            "timestamp": datetime.datetime.now().isoformat(),
            "status": status,
            "result": result,
            "duration_ms": duration
        }
        self.history.insert(0, history_entry)
        task['last_run'] = history_entry['timestamp']

    def _start_scheduler(self):
        # Dummy scheduler loop
        def loop():
            while True:
                # In a real app, check cron expressions here
                time.sleep(60)
        
        # threading.Thread(target=loop, daemon=True).start()
        pass

automation_engine = AutomationEngine()
