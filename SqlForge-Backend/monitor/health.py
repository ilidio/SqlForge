from typing import List, Dict, Any
from sqlalchemy import text
from database import get_engine

class HealthAuditor:
    @staticmethod
    def get_health_score(config) -> Dict[str, Any]:
        """
        Runs a comprehensive health audit and returns a score and list of risks.
        """
        risks = []
        score = 100
        
        if config.type == 'postgresql':
            # 1. Connection Exhaustion
            conn_risk = HealthAuditor._check_pg_connections(config)
            if conn_risk:
                risks.append(conn_risk)
                score -= conn_risk['impact']

            # 2. Long Running Transactions
            txn_risk = HealthAuditor._check_pg_transactions(config)
            if txn_risk:
                risks.append(txn_risk)
                score -= txn_risk['impact']

            # 3. Index Bloat / Unused Indexes
            index_risk = HealthAuditor._check_pg_indexes(config)
            if index_risk:
                risks.append(index_risk)
                score -= index_risk['impact']

        elif config.type == 'mysql':
            # 1. Connection Exhaustion
            conn_risk = HealthAuditor._check_mysql_connections(config)
            if conn_risk:
                risks.append(conn_risk)
                score -= conn_risk['impact']

            # 2. Long Running Transactions
            txn_risk = HealthAuditor._check_mysql_transactions(config)
            if txn_risk:
                risks.append(txn_risk)
                score -= txn_risk['impact']

        elif config.type == 'oracle':
            # 1. Connection (session) Exhaustion
            conn_risk = HealthAuditor._check_oracle_connections(config)
            if conn_risk:
                risks.append(conn_risk)
                score -= conn_risk['impact']

            # 2. Long Running Transactions
            txn_risk = HealthAuditor._check_oracle_transactions(config)
            if txn_risk:
                risks.append(txn_risk)
                score -= txn_risk['impact']

        elif config.type == 'mssql':
            # 1. Connection Exhaustion
            conn_risk = HealthAuditor._check_mssql_connections(config)
            if conn_risk:
                risks.append(conn_risk)
                score -= conn_risk['impact']

            # 2. Long Running Transactions
            txn_risk = HealthAuditor._check_mssql_transactions(config)
            if txn_risk:
                risks.append(txn_risk)
                score -= txn_risk['impact']

        else:
            return {
                "score": 100,
                "risks": [],
                "summary": "Health audit not supported for this database type."
            }

        return {
            "score": max(0, score),
            "risks": risks,
            "summary": f"Audit complete. {len(risks)} risks identified."
        }

    @staticmethod
    def _check_pg_connections(config) -> Dict[str, Any]:
        query = """
        SELECT 
            count(*)::float / (SELECT setting::float FROM pg_settings WHERE name = 'max_connections') as usage_pct,
            count(*) as current,
            (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max
        FROM pg_stat_activity;
        """
        try:
            engine = get_engine(config)
            with engine.connect() as conn:
                res = conn.execute(text(query)).fetchone()
                usage = res[0]
                if usage > 0.8:
                    return {
                        "type": "Connection Exhaustion",
                        "severity": "High" if usage > 0.9 else "Medium",
                        "description": f"Database is using {int(usage*100)}% of max_connections ({res[1]}/{res[2]}).",
                        "impact": 20 if usage > 0.9 else 10
                    }
        except: pass
        return None

    @staticmethod
    def _check_pg_transactions(config) -> Dict[str, Any]:
        query = """
        SELECT count(*) 
        FROM pg_stat_activity 
        WHERE state != 'idle' 
        AND now() - xact_start > interval '5 minutes';
        """
        try:
            engine = get_engine(config)
            with engine.connect() as conn:
                count = conn.execute(text(query)).scalar()
                if count > 0:
                    return {
                        "type": "Transaction Age",
                        "severity": "Critical",
                        "description": f"Detected {count} transactions running for over 5 minutes. This prevents VACUUM and leads to bloat.",
                        "impact": 25
                    }
        except: pass
        return None

    @staticmethod
    def _check_pg_indexes(config) -> Dict[str, Any]:
        # Simple unused index detection
        query = """
        SELECT 
            relname as table,
            indexrelname as index,
            pg_size_pretty(pg_relation_size(indexrelid)) as size,
            pg_relation_size(indexrelid) as size_bytes
        FROM pg_stat_user_indexes 
        WHERE idx_scan = 0 
        AND pg_relation_size(indexrelid) > 1024 * 1024 * 10 -- > 10MB
        ORDER BY pg_relation_size(indexrelid) DESC
        LIMIT 5;
        """
        try:
            engine = get_engine(config)
            with engine.connect() as conn:
                res = conn.execute(text(query)).fetchall()
                if res:
                    total_bloat = sum(r[3] for r in res)
                    return {
                        "type": "Index Bloat",
                        "severity": "Medium",
                        "description": f"Identified {len(res)} large unused indexes (Total ~{total_bloat // (1024*1024)}MB).",
                        "impact": 15
                    }
        except: pass
        return None

    @staticmethod
    def _check_mysql_connections(config) -> Dict[str, Any]:
        query = "SHOW VARIABLES LIKE 'max_connections'; SHOW STATUS LIKE 'Threads_connected';"
        # Note: SHOW commands need to be executed carefully in SQLAlchemy
        try:
            engine = get_engine(config)
            with engine.connect() as conn:
                # max_connections
                res1 = conn.execute(text("SHOW VARIABLES LIKE 'max_connections'")).fetchone()
                max_conn = int(res1[1])
                # current
                res2 = conn.execute(text("SHOW STATUS LIKE 'Threads_connected'")).fetchone()
                current = int(res2[1])
                
                usage = current / max_conn
                if usage > 0.8:
                    return {
                        "type": "Connection Exhaustion",
                        "severity": "High" if usage > 0.9 else "Medium",
                        "description": f"Database is using {int(usage*100)}% of max_connections ({current}/{max_conn}).",
                        "impact": 20
                    }
        except: pass
        return None

    @staticmethod
    def _check_mysql_transactions(config) -> Dict[str, Any]:
        query = """
        SELECT count(*)
        FROM information_schema.innodb_trx
        WHERE TIME_TO_SEC(TIMEDIFF(NOW(), trx_started)) > 300;
        """
        try:
            engine = get_engine(config)
            with engine.connect() as conn:
                count = conn.execute(text(query)).scalar()
                if count > 0:
                    return {
                        "type": "Transaction Age",
                        "severity": "Critical",
                        "description": f"Detected {count} transactions running for over 5 minutes.",
                        "impact": 25
                    }
        except: pass
        return None

    @staticmethod
    def _check_oracle_connections(config) -> Dict[str, Any]:
        try:
            engine = get_engine(config)
            with engine.connect() as conn:
                current = conn.execute(text("SELECT COUNT(*) FROM v$session WHERE type = 'USER'")).scalar()
                max_sessions = conn.execute(text("SELECT value FROM v$parameter WHERE name = 'sessions'")).scalar()
                max_sessions = int(max_sessions)
                if max_sessions <= 0:
                    return None
                usage = current / max_sessions
                if usage > 0.8:
                    return {
                        "type": "Connection Exhaustion",
                        "severity": "High" if usage > 0.9 else "Medium",
                        "description": f"Database is using {int(usage*100)}% of max sessions ({current}/{max_sessions}).",
                        "impact": 20 if usage > 0.9 else 10
                    }
        except: pass
        return None

    @staticmethod
    def _check_oracle_transactions(config) -> Dict[str, Any]:
        # v$transaction.start_time is a text timestamp ('MM/DD/RR HH24:MI:SS');
        # comparing against SYSDATE this way is the standard portable approach
        # since START_SCN-based age requires extra privileges most app users
        # won't have.
        query = """
        SELECT COUNT(*)
        FROM v$transaction t
        WHERE (SYSDATE - TO_DATE(t.start_time, 'MM/DD/RR HH24:MI:SS')) * 24 * 60 > 5
        """
        try:
            engine = get_engine(config)
            with engine.connect() as conn:
                count = conn.execute(text(query)).scalar()
                if count and count > 0:
                    return {
                        "type": "Transaction Age",
                        "severity": "Critical",
                        "description": f"Detected {count} transactions running for over 5 minutes.",
                        "impact": 25
                    }
        except: pass
        return None

    @staticmethod
    def _check_mssql_connections(config) -> Dict[str, Any]:
        try:
            engine = get_engine(config)
            with engine.connect() as conn:
                current = conn.execute(text("SELECT COUNT(*) FROM sys.dm_exec_sessions WHERE is_user_process = 1")).scalar()
                max_conn = conn.execute(text("SELECT CAST(value_in_use AS INT) FROM sys.configurations WHERE name = 'user connections'")).scalar()
                # SQL Server reports 0 for 'user connections' when it's left
                # at its default (dynamically managed by available memory,
                # not a fixed cap) - there's no fixed ceiling to compare
                # against in that case, so skip the check rather than divide
                # by zero or report a misleading 100% usage.
                if not max_conn or max_conn <= 0:
                    return None
                usage = current / max_conn
                if usage > 0.8:
                    return {
                        "type": "Connection Exhaustion",
                        "severity": "High" if usage > 0.9 else "Medium",
                        "description": f"Database is using {int(usage*100)}% of configured max user connections ({current}/{max_conn}).",
                        "impact": 20 if usage > 0.9 else 10
                    }
        except: pass
        return None

    @staticmethod
    def _check_mssql_transactions(config) -> Dict[str, Any]:
        query = """
        SELECT COUNT(*)
        FROM sys.dm_tran_active_transactions at
        JOIN sys.dm_tran_session_transactions st ON at.transaction_id = st.transaction_id
        WHERE DATEDIFF(MINUTE, at.transaction_begin_time, GETDATE()) > 5
        """
        try:
            engine = get_engine(config)
            with engine.connect() as conn:
                count = conn.execute(text(query)).scalar()
                if count and count > 0:
                    return {
                        "type": "Transaction Age",
                        "severity": "Critical",
                        "description": f"Detected {count} transactions running for over 5 minutes.",
                        "impact": 25
                    }
        except: pass
        return None
