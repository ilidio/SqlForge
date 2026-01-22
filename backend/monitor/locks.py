from sqlalchemy import text
from database import get_engine
from models import ConnectionConfig

def get_lock_tree(config: ConnectionConfig) -> dict:
    """
    Returns a list of nodes and edges representing the blocking chain.
    """
    engine = get_engine(config)
    nodes = {}
    edges = []
    
    try:
        with engine.connect() as conn:
            if config.type == 'postgresql':
                # Modern Postgres approach
                sql = """
                SELECT 
                    a.pid, 
                    a.usename, 
                    a.query, 
                    a.state, 
                    a.wait_event, 
                    now() - a.query_start as duration,
                    pg_blocking_pids(a.pid) as blocking_pids,
                    (
                        SELECT string_agg(c.relname, ', ')
                        FROM pg_locks l
                        JOIN pg_class c ON l.relation = c.oid
                        WHERE l.pid = a.pid 
                        AND l.granted = true 
                        AND l.locktype = 'relation'
                        AND c.relkind = 'r'
                    ) as locked_tables
                FROM pg_stat_activity a
                WHERE a.pid != pg_backend_pid()
                """
                result = conn.execute(text(sql))
                rows = [dict(row._mapping) for row in result]
                
                # Build graph
                for row in rows:
                    pid = str(row['pid'])
                    # Add node if not exists
                    if pid not in nodes:
                        nodes[pid] = {
                            "id": pid,
                            "label": f"PID {pid} ({row['usename']})",
                            "user": row['usename'],
                            "query": row['query'],
                            "state": row['state'],
                            "duration": str(row['duration']),
                            "wait_event": row['wait_event'],
                            "locked_tables": row['locked_tables'],
                            "is_blocked": False,
                            "is_blocking": False
                        }
                    
                    blocking = row['blocking_pids']
                    if blocking:
                        nodes[pid]['is_blocked'] = True
                        for blocker_pid in blocking:
                            b_pid = str(blocker_pid)
                            # Ensure blocker node exists (it might not be in the rows if it's not active in the same way or filtered)
                            if b_pid not in nodes:
                                # Fetch info for blocker if possible, or create stub
                                nodes[b_pid] = {
                                    "id": b_pid,
                                    "label": f"PID {b_pid} (Blocker)",
                                    "state": "unknown",
                                    "is_blocking": True
                                }
                            else:
                                nodes[b_pid]['is_blocking'] = True
                                
                            edges.append({
                                "id": f"e{b_pid}-{pid}",
                                "source": b_pid,
                                "target": pid,
                                "label": "Blocks"
                            })
                            
            elif config.type == 'mysql':
                # Try sys schema or information_schema
                # Simplified query for MySQL 5.7+
                sql = """
                SELECT 
                    r.trx_mysql_thread_id AS waiting_pid,
                    r.trx_query AS waiting_query,
                    b.trx_mysql_thread_id AS blocking_pid,
                    b.trx_query AS blocking_query
                FROM information_schema.innodb_lock_waits w
                INNER JOIN information_schema.innodb_trx b ON b.trx_id = w.blocking_trx_id
                INNER JOIN information_schema.innodb_trx r ON r.trx_id = w.requesting_trx_id;
                """
                try:
                    result = conn.execute(text(sql))
                    rows = [dict(row._mapping) for row in result]
                    
                    for row in rows:
                        w_pid = str(row['waiting_pid'])
                        b_pid = str(row['blocking_pid'])
                        
                        if w_pid not in nodes:
                            nodes[w_pid] = {"id": w_pid, "label": f"Thread {w_pid}", "query": row['waiting_query'], "is_blocked": True}
                        if b_pid not in nodes:
                            nodes[b_pid] = {"id": b_pid, "label": f"Thread {b_pid}", "query": row['blocking_query'], "is_blocking": True}
                        
                        edges.append({
                            "id": f"e{b_pid}-{w_pid}",
                            "source": b_pid,
                            "target": w_pid,
                            "label": "Blocks"
                        })
                except Exception as e:
                    return {"nodes": [], "edges": [], "error": "MySQL Lock monitoring requires permissions on information_schema: " + str(e)}

            else:
                return {"nodes": [], "edges": [], "error": f"Lock monitoring not yet supported for {config.type}"}

    except Exception as e:
        return {"nodes": [], "edges": [], "error": str(e)}

    return {"nodes": list(nodes.values()), "edges": edges}

def kill_session(config: ConnectionConfig, pid: str) -> dict:
    engine = get_engine(config)
    try:
        with engine.connect() as conn:
            if config.type == 'postgresql':
                # Use pg_terminate_backend
                stmt = text("SELECT pg_terminate_backend(:pid)")
                conn.execute(stmt, {"pid": int(pid)})
                return {"success": True, "message": f"Session {pid} terminated."}
            
            elif config.type == 'mysql':
                # KILL QUERY or KILL CONNECTION
                stmt = text(f"KILL {int(pid)}")
                conn.execute(stmt)
                return {"success": True, "message": f"Thread {pid} killed."}
            
            else:
                return {"success": False, "error": f"Kill not supported for {config.type}"}
                
    except Exception as e:
        return {"success": False, "error": str(e)}
