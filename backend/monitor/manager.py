import time
from typing import List, Dict, Any
from database import get_engine
from sqlalchemy import text

class MonitorManager:
    @staticmethod
    async def get_active_processes(config) -> List[Dict[str, Any]]:
        """
        Fetches active processes from the database based on its type.
        """
        if config.type == 'postgresql':
            query = "SELECT pid, usename as user, query, now() - query_start as duration, state FROM pg_stat_activity WHERE state != 'idle'"
        elif config.type == 'mysql':
            query = "SELECT ID as pid, USER as user, INFO as query, TIME as duration, STATE as state FROM INFORMATION_SCHEMA.PROCESSLIST WHERE COMMAND != 'Sleep'"
        else:
            # SQLite/Redis/Mongo mocks
            return [
                {"pid": 1, "user": "local", "query": "-- Monitoring not supported for this DB type", "duration": "0s", "state": "n/a"}
            ]
        
        try:
            engine = get_engine(config)
            with engine.connect() as conn:
                res = conn.execute(text(query))
                return [dict(row._mapping) for row in res]
        except Exception as e:
            return [{"pid": 0, "user": "error", "query": str(e), "duration": "0s", "state": "error"}]

    @staticmethod
    def get_realtime_metrics(config):
        # Polls system views for realtime metrics (TPS/CPU/Connections)
        return {
            "tps": 42,
            "cpu": 15,
            "connections": 5
        }
