from sqlalchemy import text
from database import get_engine
from models import ConnectionConfig
import json

def check_virtual_index_support(config: ConnectionConfig) -> dict:
    if config.type != 'postgresql':
        return {"supported": False, "reason": "Virtual indexes currently supported for PostgreSQL only."}
    
    engine = get_engine(config)
    try:
        with engine.connect() as conn:
            res = conn.execute(text("SELECT 1 FROM pg_extension WHERE extname = 'hypopg'"))
            if res.scalar():
                return {"supported": True, "reason": "hypopg extension detected."}
            return {"supported": False, "reason": "PostgreSQL detected but 'hypopg' extension is not installed."}
    except Exception as e:
        return {"supported": False, "reason": f"Connection failed: {str(e)}"}

def evaluate_virtual_index(config: ConnectionConfig, query_sql: str, index_ddl: str) -> dict:
    support = check_virtual_index_support(config)
    if not support['supported']:
        return {"error": support['reason']}

    engine = get_engine(config)
    try:
        with engine.connect() as conn:
            # A. Baseline
            res = conn.execute(text(f"EXPLAIN (FORMAT JSON) {query_sql}"))
            plan_json_base = res.scalar()
            base_cost = plan_json_base[0]['Plan']['Total Cost']
            
            # B. Create Virtual Index
            clean_ddl = index_ddl.strip().rstrip(';')
            safe_ddl = clean_ddl.replace("'", "''")
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
    except Exception as e:
        return {"error": str(e)}