from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import internal_db
from google import genai
import logging
import os

logger = logging.getLogger(__name__)

class DailyTimeline(BaseModel):
    id: str
    dateTime: str
    content: str
    noteIds: List[int] = []

class SessionSummary(BaseModel):
    date: str
    summary: str
    timelines: List[DailyTimeline]

def generate_daily_briefing(api_key: Optional[str] = None, model: str = "gemini-1.5-flash") -> SessionSummary:
    """
    Analyzes activity from the last 24 hours (or current day) and returns a summary.
    """
    end_time = datetime.now()
    start_time = end_time - timedelta(days=1) # Briefing for last 24h
    
    # 1. Fetch Data
    queries = internal_db.get_query_history_by_range(start_time, end_time)
    tasks = internal_db.get_task_history_by_range(start_time, end_time)
    
    if not queries and not tasks:
        return SessionSummary(
            date=end_time.strftime("%Y-%m-%d"),
            summary="No activity recorded in the last 24 hours.",
            timelines=[]
        )

    # 2. Process Data for Prompt
    # Group by connection
    activity_log = []
    
    timelines = []

    for q in queries:
        conn = internal_db.get_connection(q["connection_id"])
        conn_name = conn.name if conn else "Unknown Connection"
        sql_snippet = q["sql"][:100] + "..." if len(q["sql"]) > 100 else q["sql"]
        status = "failed" if q["status"] == "error" else "succeeded"
        
        # Categorize
        if q["sql"].strip().upper().startswith(("CREATE", "ALTER", "DROP", "TRUNCATE")):
            category = "DDL Change"
        elif q["sql"].strip().upper().startswith(("INSERT", "UPDATE", "DELETE")):
            category = "Data Modification"
        else:
            category = "Data Query"
            
        activity_log.append(f"[{q['timestamp']}] {category} on {conn_name}: {sql_snippet} ({status})")
        
        timelines.append(DailyTimeline(
            id=f"q-{q['id']}",
            dateTime=q['timestamp'],
            content=f"{category} on {conn_name}: {sql_snippet}",
            noteIds=[]
        ))

    for t in tasks:
        task_def = internal_db.get_scheduled_task(t["task_id"])
        task_name = task_def["name"] if task_def else "Unknown Task"
        status = t["status"]
        
        activity_log.append(f"[{t['timestamp']}] Task Execution '{task_name}': {status}")
        
        timelines.append(DailyTimeline(
            id=f"t-{t['id']}",
            dateTime=t['timestamp'],
            content=f"Executed task '{task_name}' ({status})",
            noteIds=[]
        ))

    # 3. Generate AI Summary
    summary_text = "Detailed activity log is available below."
    
    if api_key:
        try:
            client = genai.Client(api_key=api_key)
            prompt = f"""
            You are 'Chronos', an AI assistant for a database developer.
            Analyze the following log of database activities from the user's session in SqlForge.
            
            Generate a concise, friendly "Daily Brief" (max 3-4 sentences).
            - Highlight key accomplishments (e.g., "You refactored the User table...", "You ran a backup...").
            - Group similar actions (e.g., "Executed 50 read queries on Production DB").
            - Mention any failures gently.
            - Start with "Good morning!" or "Here is your session summary:".
            
            Activity Log:
            {chr(10).join(activity_log[:100])} 
            (Truncated if too long)
            """
            
            response = client.models.generate_content(
                model=model,
                contents=prompt
            )
            summary_text = response.text
        except Exception as e:
            logger.error(f"Failed to generate AI summary: {e}")
            summary_text = "AI summary unavailable. " + summary_text
    else:
        # Fallback simplistic summary
        ddl_count = len([x for x in activity_log if "DDL Change" in x])
        dml_count = len([x for x in activity_log if "Data Modification" in x])
        task_count = len(tasks)
        summary_text = f"In the last 24h, you performed {len(queries)} queries ({ddl_count} schema changes, {dml_count} data updates) and ran {task_count} automation tasks."

    return SessionSummary(
        date=end_time.strftime("%Y-%m-%d"),
        summary=summary_text,
        timelines=sorted(timelines, key=lambda x: x.dateTime, reverse=True)
    )
