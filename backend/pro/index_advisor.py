import sqlglot
from sqlglot import exp
from sqlalchemy import inspect
from database import get_engine
from models import ConnectionConfig
import google.generativeai as genai
import os

def get_table_indexes(engine, table_name):
    try:
        inspector = inspect(engine)
        return inspector.get_indexes(table_name)
    except Exception as e:
        print(f"Error fetching indexes for {table_name}: {e}")
        return []

def analyze_query_ast(sql: str):
    try:
        parsed = sqlglot.parse_one(sql)
    except:
        return {}

    candidates = {}
    alias_map = {}
    
    # 1. Map aliases to real table names
    for table_expr in parsed.find_all(exp.Table):
        real_name = table_expr.this.name.lower()
        alias = table_expr.alias
        candidates[real_name] = {'where': set(), 'join': set(), 'order': set()}
        if alias:
            alias_map[alias.lower()] = real_name
        else:
            alias_map[real_name] = real_name

    def add_candidate(table_ref, column, type_):
        if not column: return
        column = column.lower()
        
        # Resolve alias
        table_name = None
        if table_ref:
            table_name = alias_map.get(table_ref.lower())
        
        if table_name:
            if table_name in candidates:
                candidates[table_name][type_].add(column)
        else:
            # Ambiguous (no table ref or alias not found)
            if len(candidates) == 1:
                t = list(candidates.keys())[0]
                candidates[t][type_].add(column)
            else:
                for t in candidates:
                    candidates[t][type_].add(column)

    for node in parsed.walk():
        if isinstance(node, exp.Where):
            for col_node in node.find_all(exp.Column):
                add_candidate(col_node.table, col_node.this.name, 'where')

        if isinstance(node, exp.Join):
            on_expr = node.args.get('on')
            if on_expr:
                for col_node in on_expr.find_all(exp.Column):
                    add_candidate(col_node.table, col_node.this.name, 'join')

        if isinstance(node, exp.Order):
            for ordered in node.find_all(exp.Ordered):
                for col_node in ordered.find_all(exp.Column):
                    add_candidate(col_node.table, col_node.this.name, 'order')

    return candidates

def generate_index_recommendations(config: ConnectionConfig, sql: str, api_key: str = None, model: str = None):
    engine = get_engine(config)
    analysis = analyze_query_ast(sql)
    
    recommendations = []
    
    for table, usage in analysis.items():
        if not table: continue
        
        existing_indexes = get_table_indexes(engine, table)
        existing_leading_cols = set()
        for idx in existing_indexes:
            if idx.get('column_names'):
                existing_leading_cols.add(idx['column_names'][0].lower())
        
        candidates = usage['where'].union(usage['join'])
        
        for col in candidates:
            if col not in existing_leading_cols:
                idx_name = f"idx_{table}_{col}"
                recommendations.append({
                    "table": table,
                    "column": col,
                    "reason": "Used in filtering or joining",
                    "ddl": f"CREATE INDEX {idx_name} ON {table} ({col});"
                })
        
        for col in usage['order']:
            if col not in existing_leading_cols:
                 if not any(r['table'] == table and r['column'] == col for r in recommendations):
                    idx_name = f"idx_{table}_{col}_sort"
                    recommendations.append({
                        "table": table,
                        "column": col,
                        "reason": "Used for sorting",
                        "ddl": f"CREATE INDEX {idx_name} ON {table} ({col});"
                    })

    if api_key and model and recommendations:
        try:
            genai.configure(api_key=api_key)
            ai_model = genai.GenerativeModel(model)
            
            prompt = f"Act as a DB expert. Review these index recommendations for query: {sql}. Recommendations: {recommendations}. Output valid JSON: {{ 'summary': '...', 'refined_suggestions': [{{ 'ddl': '...', 'explanation': '...' }}] }}"
            response = ai_model.generate_content(prompt)
            ai_text = response.text
            if "```json" in ai_text:
                ai_text = ai_text.split("```json")[1].split("```")[0]
            elif "```" in ai_text:
                ai_text = ai_text.split("```")[1].split("```")[0]
            return {"source": "ai", "data": ai_text.strip()}
        except:
            return {"source": "algo", "data": recommendations}

    return {"source": "algo", "data": recommendations}
