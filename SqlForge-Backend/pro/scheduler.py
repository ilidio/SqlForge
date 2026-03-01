import time
import logging
import traceback
from typing import Dict, Any
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

import internal_db
import database
from pro import backup
from pro import sync as pro_sync

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler()

def start_scheduler():
    if not scheduler.running:
        scheduler.start()
        logger.info("Scheduler started")
        reload_jobs()

def reload_jobs():
    """
    Clears current jobs and re-adds them from the database.
    This is a simple strategy; for high scale, we'd diff changes.
    """
    scheduler.remove_all_jobs()
    tasks = internal_db.get_scheduled_tasks()
    for task in tasks:
        if task["enabled"]:
            schedule_job(task)

def schedule_job(task: Dict[str, Any]):
    """
    Adds a job to the scheduler based on the task definition.
    """
    task_id = task["id"]
    schedule_config = task["schedule_config"]
    
    trigger = None
    if schedule_config.get("type") == "cron":
        # Cron string like "0 2 * * 0" (Every Sunday at 2am)
        # or dict format keys
        if "expression" in schedule_config:
            trigger = CronTrigger.from_crontab(schedule_config["expression"])
        else:
            trigger = CronTrigger(**{k: v for k, v in schedule_config.items() if k != "type"})
    elif schedule_config.get("type") == "interval":
        trigger = IntervalTrigger(**{k: v for k, v in schedule_config.items() if k != "type"})
    
    if trigger:
        scheduler.add_job(
            execute_task,
            trigger=trigger,
            args=[task_id],
            id=task_id,
            replace_existing=True
        )

def execute_task(task_id: str):
    """
    The main wrapper for executing a scheduled task.
    """
    logger.info(f"Executing task {task_id}")
    task = internal_db.get_scheduled_task(task_id)
    if not task:
        logger.error(f"Task {task_id} not found during execution")
        return

    start_time = time.time()
    status = "success"
    result = {}
    
    try:
        if task["task_type"] == "backup":
            result = run_backup_task(task["task_config"])
        elif task["task_type"] == "sync":
            result = run_sync_task(task["task_config"])
        elif task["task_type"] == "query":
            result = run_query_task(task["task_config"])
        elif task["task_type"] == "batch":
            result = run_batch_task(task["task_config"])
        else:
            status = "error"
            result = {"error": f"Unknown task type: {task['task_type']}"}
            
    except Exception as e:
        status = "error"
        result = {"error": str(e), "traceback": traceback.format_exc()}
        logger.error(f"Task {task_id} failed: {e}")

    duration = (time.time() - start_time) * 1000
    
    # Update DB
    internal_db.update_task_last_run(task_id)
    internal_db.add_task_history(task_id, status, result, duration)

def run_backup_task(config: Dict[str, Any]):
    conn_id = config.get("connection_id")
    connection = internal_db.get_connection(conn_id)
    if not connection:
        raise ValueError("Connection not found")
    
    return backup.backup_database(connection)

def run_sync_task(config: Dict[str, Any]):
    source_id = config.get("source_connection_id")
    target_id = config.get("target_connection_id")
    dry_run = config.get("dry_run", False)
    
    source = internal_db.get_connection(source_id)
    target = internal_db.get_connection(target_id)
    
    if not source or not target:
        raise ValueError("Source or target connection not found")
        
    return pro_sync.sync_schemas(source, target, dry_run=dry_run)

def run_query_task(config: Dict[str, Any]):
    conn_id = config.get("connection_id")
    sql = config.get("sql")
    
    connection = internal_db.get_connection(conn_id)
    if not connection:
        raise ValueError("Connection not found")
        
    return database.execute_query(connection, sql)

def run_batch_task(config: Dict[str, Any]):
    """
    Executes a sequence of sub-tasks.
    """
    steps = config.get("steps", [])
    step_results = []
    
    for step in steps:
        step_type = step.get("type")
        step_config = step.get("config")
        
        try:
            if step_type == "backup":
                res = run_backup_task(step_config)
            elif step_type == "sync":
                res = run_sync_task(step_config)
            elif step_type == "query":
                res = run_query_task(step_config)
            else:
                res = {"error": f"Unknown step type {step_type}"}
            
            step_results.append({"step": step.get("name"), "status": "success", "result": res})
            
        except Exception as e:
            step_results.append({"step": step.get("name"), "status": "error", "error": str(e)})
            # Stop batch on failure? For now, yes.
            raise RuntimeError(f"Batch failed at step {step.get('name')}: {e}")
            
    return {"steps": step_results}
