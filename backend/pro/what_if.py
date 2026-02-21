from sqlalchemy import text
from database import get_engine
from models import ConnectionConfig
import json
import re

def check_virtual_index_support(config: ConnectionConfig) -> dict:
    if config.type == 'postgresql':
        engine = get_engine(config)
        try:
            with engine.connect() as conn:
                res = conn.execute(text("SELECT 1 FROM pg_extension WHERE extname = 'hypopg'"))
                if res.scalar():
                    return {"supported": True, "reason": "hypopg extension detected."}
                return {"supported": False, "reason": "PostgreSQL detected but 'hypopg' extension is not installed. Run 'CREATE EXTENSION hypopg;' to enable."}
        except Exception as e:
            return {"supported": False, "reason": f"Connection failed: {str(e)}"}
            
    elif config.type == 'mssql':
        return {"supported": True, "reason": "SQL Server Hypothetical Indexes supported (Experimental)."}
        
    return {"supported": False, "reason": f"Virtual indexes not currently supported for {config.type}."}

def _evaluate_pg(config: ConnectionConfig, query_sql: str, index_ddl: str) -> dict:
    engine = get_engine(config)
    with engine.connect() as conn:
        # A. Baseline
        res = conn.execute(text(f"EXPLAIN (FORMAT JSON) {query_sql}"))
        plan_json_base = res.scalar()
        base_cost = plan_json_base[0]['Plan']['Total Cost']
        
        # B. Create Virtual Index
        clean_ddl = index_ddl.strip().rstrip(';')
        safe_ddl = clean_ddl.replace("'", "''")
        # hypopg_create_index returns (indexrelid, indexname)
        # We need the indexname to drop it later? No, hypopg_reset() clears all.
        conn.execute(text(f"SELECT * FROM hypopg_create_index('{safe_ddl}')"))
        
        # C. Get Virtual Plan & Cost
        res_virt = conn.execute(text(f"EXPLAIN (FORMAT JSON) {query_sql}"))
        plan_json_virt = res_virt.scalar()
        virt_cost = plan_json_virt[0]['Plan']['Total Cost']
        
        # Clean up
        conn.execute(text("SELECT * FROM hypopg_reset()"))
        
        # Calculate improvement
        denom = base_cost if base_cost > 0 else 1
        improvement_pct = ((base_cost - virt_cost) / denom) * 100
        
        return {
            "baseline_cost": base_cost,
            "virtual_cost": virt_cost,
            "improvement_pct": round(improvement_pct, 2),
            "plan_comparison": {
                "baseline": plan_json_base,
                "virtual": plan_json_virt
            }
        }

def _evaluate_mssql(config: ConnectionConfig, query_sql: str, index_ddl: str) -> dict:
    # SQL Server Hypothetical Index Implementation
    # 1. Parse DDL to inject 'WITH STATISTICS_ONLY = -1'
    #    Assumption: DDL is like "CREATE INDEX name ON table (cols)"
    
    # Simple injection: append option if not present
    hypo_ddl = index_ddl.strip().rstrip(';')
    if "WITH" not in hypo_ddl.upper():
        hypo_ddl += " WITH (STATISTICS_ONLY = -1)"
    else:
        # If WITH exists, inside parens? Complex parsing needed for robust DDL.
        # MVP: Just append
        hypo_ddl = hypo_ddl.replace("WITH (", "WITH (STATISTICS_ONLY = -1, ")
    
    # Extract index name for dropping
    # Regex for "CREATE INDEX [name] ON" or "CREATE INDEX name ON"
    match = re.search(r"CREATE\s+INDEX\s+(\S+)\s+ON", index_ddl, re.IGNORECASE)
    index_name = match.group(1) if match else "hypo_idx_temp"
    # Remove brackets if present
    index_name = index_name.replace('[', '').replace(']', '')
    
    # Extract table name
    match_table = re.search(r"ON\s+(\S+)\s*\(", index_ddl, re.IGNORECASE)
    table_name = match_table.group(1) if match_table else ""
    
    engine = get_engine(config)
    try:
        with engine.connect() as conn:
            # A. Baseline Plan
            conn.execute(text("SET SHOWPLAN_XML ON"))
            res = conn.execute(text(query_sql))
            # Fetching result from SHOWPLAN is tricky with SQLAlchemy as it comes as a result set
            # For simplicity, we might look at Estimated Subtree Cost if we can parse the XML.
            # But parsing XML in python is easy.
            
            # Actually, `SET SHOWPLAN_XML ON` makes the query return a single row with XML.
            plan_xml_base = res.fetchone()[0]
            conn.execute(text("SET SHOWPLAN_XML OFF"))
            
            # Extract Cost (very rough regex or XML parsing)
            # <StmtSimple ... StatementSubTreeCost="0.0032831">
            base_cost_match = re.search(r'StatementSubTreeCost="([^"]+)"', plan_xml_base)
            base_cost = float(base_cost_match.group(1)) if base_cost_match else 0.0

            # B. Create Hypothetical Index
            # Must run in separate batch/transaction? 
            # WITH STATISTICS_ONLY = -1
            conn.execute(text(hypo_ddl))
            
            # C. Virtual Plan
            # To force consideration, we might need DBCC AUTOPILOT
            # But let's try just running explain again. Some sources say optimizer sees them.
            # If not, we need the AUTOPILOT magic.
            # "DBCC AUTOPILOT (0, 9, 0, 0, 0, 0)" -- Enable hypothetical index support
            conn.execute(text("DBCC AUTOPILOT (0, 9, 0, 0, 0, 0)"))
            
            conn.execute(text("SET SHOWPLAN_XML ON"))
            res_virt = conn.execute(text(query_sql))
            plan_xml_virt = res_virt.fetchone()[0]
            conn.execute(text("SET SHOWPLAN_XML OFF"))
            
            # Extract Cost
            virt_cost_match = re.search(r'StatementSubTreeCost="([^"]+)"', plan_xml_virt)
            virt_cost = float(virt_cost_match.group(1)) if virt_cost_match else 0.0
            
            # D. Drop Index
            # "DROP INDEX table.name"
            conn.execute(text(f"DROP INDEX {table_name}.{index_name}"))
            
            denom = base_cost if base_cost > 0 else 1
            improvement_pct = ((base_cost - virt_cost) / denom) * 100
            
            return {
                "baseline_cost": base_cost,
                "virtual_cost": virt_cost,
                "improvement_pct": round(improvement_pct, 2),
                "xml_plan": plan_xml_virt # Pass back XML if frontend can handle it (it can't yet, but good for debug)
            }
            
    except Exception as e:
        return {"error": f"MSSQL What-If failed: {str(e)}"}

def evaluate_virtual_index(config: ConnectionConfig, query_sql: str, index_ddl: str) -> dict:
    support = check_virtual_index_support(config)
    if not support['supported']:
        return {"error": support['reason']}

    try:
        if config.type == 'postgresql':
            return _evaluate_pg(config, query_sql, index_ddl)
        elif config.type == 'mssql':
            return _evaluate_mssql(config, query_sql, index_ddl)
    except Exception as e:
        return {"error": str(e)}
        
    return {"error": "Unexpected error in what-if evaluation."}
