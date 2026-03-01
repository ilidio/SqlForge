import random
import string
import datetime
import json
from sqlalchemy import text, inspect
from google import genai
from models import ConnectionConfig
from database import get_engine
from typing import Dict, Any, List

def get_generation_strategy(config: ConnectionConfig, table_name: str, api_key: str, model_name: str) -> Dict[str, Any]:
    """
    Asks AI to analyze the table columns and suggest a semantic data type for each.
    """
    engine = get_engine(config)
    inspector = inspect(engine)
    
    columns = inspector.get_columns(table_name)
    fks = inspector.get_foreign_keys(table_name)
    
    col_info = []
    for col in columns:
        col_info.append({
            "name": col['name'],
            "type": str(col['type'])
        })
        
    fk_info = []
    for fk in fks:
        fk_info.append({
            "constrained_columns": fk['constrained_columns'],
            "referred_table": fk['referred_table'],
            "referred_columns": fk['referred_columns']
        })

    prompt = f"""
    You are a Data Engineering Expert. I need to generate realistic mock data for a database table.
    
    Table: {table_name}
    Columns: {json.dumps(col_info)}
    Foreign Keys: {json.dumps(fk_info)}
    
    Task: For each column (except primary keys that are auto-increment/serial or foreign keys), 
    assign a semantic data type from this list:
    - name, first_name, last_name
    - email
    - phone
    - address, city, country, zip
    - credit_card
    - company
    - job_title
    - sentence, paragraph
    - date, datetime
    - integer, float
    - boolean
    - uuid
    
    Return a JSON object where keys are column names and values are the semantic types.
    Only include columns that are NOT foreign keys and NOT auto-incrementing primary keys.
    
    Example:
    {{
      "email_address": "email",
      "user_name": "name",
      "age": "integer"
    }}
    
    Return ONLY the JSON.
    """

    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model=model_name,
            contents=prompt
        )
        text_resp = response.text.strip()
        if text_resp.startswith("```json"):
            text_resp = text_resp[7:]
        if text_resp.startswith("```"):
            text_resp = text_resp[3:]
        if text_resp.endswith("```"):
            text_resp = text_resp[:-3]
            
        return json.loads(text_resp.strip())
    except Exception as e:
        print(f"AI strategy failed: {e}")
        # Fallback to basic type mapping
        strategy = {}
        for col in columns:
            cname = col['name'].lower()
            ctype = str(col['type']).lower()
            if 'email' in cname: strategy[col['name']] = 'email'
            elif 'name' in cname: strategy[col['name']] = 'name'
            elif 'int' in ctype: strategy[col['name']] = 'integer'
            else: strategy[col['name']] = 'sentence'
        return strategy

def generate_semantic_value(semantic_type: str):
    if semantic_type == 'name':
        return f"{random.choice(['John', 'Jane', 'Alice', 'Bob', 'Charlie'])} {random.choice(['Smith', 'Doe', 'Brown', 'Wilson'])}"
    if semantic_type == 'first_name':
        return random.choice(['John', 'Jane', 'Alice', 'Bob', 'Charlie'])
    if semantic_type == 'last_name':
        return random.choice(['Smith', 'Doe', 'Brown', 'Wilson'])
    if semantic_type == 'email':
        user = ''.join(random.choices(string.ascii_lowercase, k=8))
        domain = random.choice(['gmail.com', 'outlook.com', 'company.ai'])
        return f"{user}@{domain}"
    if semantic_type == 'phone':
        return f"+1-{random.randint(100,999)}-{random.randint(100,999)}-{random.randint(1000,9999)}"
    if semantic_type == 'address':
        return f"{random.randint(10, 999)} {random.choice(['Main St', 'Oak Ave', 'Broadway', 'Sunset Blvd'])}"
    if semantic_type == 'credit_card':
        return '-'.join([''.join(random.choices(string.digits, k=4)) for _ in range(4)])
    if semantic_type == 'integer':
        return random.randint(1, 1000)
    if semantic_type == 'float':
        return round(random.uniform(1.0, 1000.0), 2)
    if semantic_type == 'boolean':
        return random.choice([True, False])
    if semantic_type == 'date':
        return (datetime.date.today() - datetime.timedelta(days=random.randint(0, 3650))).isoformat()
    if semantic_type == 'datetime':
        return (datetime.datetime.now() - datetime.timedelta(days=random.randint(0, 3650))).isoformat()
    
    return "Sample Data"

def hydrate_table(config: ConnectionConfig, table_name: str, count: int, api_key: str, model_name: str) -> Dict[str, Any]:
    engine = get_engine(config)
    inspector = inspect(engine)
    
    # 1. Get Strategy
    strategy = get_generation_strategy(config, table_name, api_key, model_name)
    
    # 2. Identify Foreign Keys and fetch sample IDs
    fks = inspector.get_foreign_keys(table_name)
    fk_values = {} # col -> list of values
    
    with engine.connect() as conn:
        for fk in fks:
            ref_table = fk['referred_table']
            ref_col = fk['referred_columns'][0]
            local_col = fk['constrained_columns'][0]
            
            # Fetch up to 100 sample IDs
            try:
                res = conn.execute(text(f"SELECT {ref_col} FROM {ref_table} LIMIT 100"))
                ids = [row[0] for row in res]
                if ids:
                    fk_values[local_col] = ids
            except:
                pass

    # 3. Generate Data
    columns = inspector.get_columns(table_name)
    data_to_insert = []
    
    for _ in range(count):
        row = {}
        for col in columns:
            cname = col['name']
            
            # Skip auto-increment PKs if possible (or let DB handle it)
            # Simple check: if it's primary key and it's not in strategy or FKs, skip it
            is_pk = col.get('primary_key', False)
            
            if cname in fk_values:
                row[cname] = random.choice(fk_values[cname])
            elif cname in strategy:
                row[cname] = generate_semantic_value(strategy[cname])
            elif not is_pk:
                # Fallback for columns not in strategy
                if 'int' in str(col['type']).lower(): row[cname] = random.randint(1, 100)
                else: row[cname] = "Data"
        
        if row:
            data_to_insert.append(row)

    # 4. Insert in batches
    batch_size = 1000
    total_inserted = 0
    
    try:
        with engine.begin() as conn:
            for i in range(0, len(data_to_insert), batch_size):
                batch = data_to_insert[i:i+batch_size]
                cols = list(batch[0].keys())
                placeholders = ", ".join([f":{c}" for c in cols])
                stmt = text(f"INSERT INTO {table_name} ({', '.join(cols)}) VALUES ({placeholders})")
                conn.execute(stmt, batch)
                total_inserted += len(batch)
                
        return {"success": True, "count": total_inserted}
    except Exception as e:
        return {"success": False, "error": str(e)}
