import sqlglot
from sqlglot import exp
from sqlalchemy import inspect
from database import get_engine
from models import ConnectionConfig
from google import genai
from typing import List, Dict, Any
import json

def generate_index_recommendations(config: ConnectionConfig, sql_query: str, api_key: str, model_name: str) -> Dict[str, Any]:
    # 1. Parse SQL
    try:
        parsed = sqlglot.parse_one(sql_query)
    except Exception as e:
        return {"error": f"Parsing failed: {str(e)}"}

    # 2. Extract Tables and Candidates
    tables_found = set()
    # map alias -> table_name
    table_aliases = {} 
    
    # Find all tables first to resolve aliases
    for table in parsed.find_all(exp.Table):
        name = table.name
        alias = table.alias
        tables_found.add(name)
        if alias:
            table_aliases[alias] = name
        table_aliases[name] = name # Implicit alias

    candidates = {} # (table, column) -> list of reasons

    def process_col(col_node, reason):
        table_alias = col_node.table
        col_name = col_node.name
        
        target_table = None
        if table_alias:
            target_table = table_aliases.get(table_alias)
        elif len(tables_found) == 1:
            target_table = list(tables_found)[0]
            
        if target_table:
            key = (target_table, col_name)
            if key not in candidates: candidates[key] = []
            candidates[key].append(reason)

    # Walk Predicates
    for where in parsed.find_all(exp.Where):
        for col in where.find_all(exp.Column):
            process_col(col, "WHERE clause filter")

    for join in parsed.find_all(exp.Join):
        on_clause = join.args.get("on")
        if on_clause:
            for col in on_clause.find_all(exp.Column):
                process_col(col, "JOIN condition")

    for order in parsed.find_all(exp.Order):
        for col in order.find_all(exp.Column):
            process_col(col, "ORDER BY sorting")
            
    for group in parsed.find_all(exp.Group):
        for col in group.find_all(exp.Column):
            process_col(col, "GROUP BY aggregation")

    if not candidates:
        return {"recommendations": [], "explanation": "No indexable columns detected in the query."}

    # 3. Check against Database Metadata (Only for relevant tables)
    engine = get_engine(config)
    inspector = inspect(engine)
    
    recommendations = []
    
    # We cache schema info to avoid repeated DB calls for same table
    schema_cache = {}

    for (table_name, col_name), reasons in candidates.items():
        if table_name not in schema_cache:
            try:
                # Check if table exists
                if not inspector.has_table(table_name):
                    schema_cache[table_name] = None
                    continue
                
                indexes = inspector.get_indexes(table_name)
                # Also get PK
                pk_constraint = inspector.get_pk_constraint(table_name)
                pks = pk_constraint.get('constrained_columns', []) if pk_constraint else []
                
                schema_cache[table_name] = {
                    "indexes": indexes,
                    "pks": pks
                }
            except Exception as e:
                print(f"Error inspecting {table_name}: {e}")
                schema_cache[table_name] = None
                continue
        
        schema = schema_cache[table_name]
        if not schema:
            continue

        # Check existence
        is_covered = False
        
        # Check PK
        if col_name in schema['pks']:
            is_covered = True
            
        # Check Indexes (Leading column matches)
        if not is_covered:
            for idx in schema['indexes']:
                if idx['column_names'] and idx['column_names'][0] == col_name:
                    is_covered = True
                    break
        
        if not is_covered:
            reason_str = "; ".join(set(reasons))
            idx_name = f"idx_{table_name}_{col_name}"
            recommendations.append({
                "table": table_name,
                "column": col_name,
                "reason": reason_str,
                "ddl": f"CREATE INDEX {idx_name} ON {table_name} ({col_name});"
            })

    # 4. Generate AI Explanation
    explanation = "No recommendations found."
    if recommendations:
        explanation = "Generating analysis..."
        if api_key and model_name:
            prompt = f"""
            You are a Database Performance Expert.
            
            I have analyzed a SQL query and identified missing indexes.
            
            Query:
            ```sql
            {sql_query}
            ```
            
            Missing Indexes Found:
            {json.dumps(recommendations, indent=2)}
            
            Database Dialect: {config.type}
            
            Task:
            1. Validate if these indexes make sense.
            2. Provide a concise, professional explanation of WHY these specific indexes will improve performance for THIS query.
            3. Explain the impact (e.g., "Changes a Full Table Scan to an Index Seek").
            4. Keep it short (under 150 words).
            """
            
            try:
                client = genai.Client(api_key=api_key)
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt
                )
                explanation = response.text
            except Exception as e:
                explanation = f"AI Analysis failed: {str(e)}"
        else:
            explanation = "Configure Gemini API Key to get detailed AI analysis."

    return {
        "recommendations": recommendations,
        "explanation": explanation
    }