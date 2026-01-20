from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uuid
from typing import List, Dict, Any
import time

# Import from local modules
from models import ConnectionConfig, QueryRequest, QueryResult, TableInfo, AIRequest, SyncRequest
import database
import internal_db
import google.generativeai as genai
from pro import sync as pro_sync

app = FastAPI(title="SqlForge API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    internal_db.init_db()

@app.get("/")
def read_root():
    return {"status": "ok", "app": "SqlForge"}

@app.get("/connections", response_model=List[ConnectionConfig])
def get_connections():
    return internal_db.get_connections()

@app.post("/connections")
def save_connection(config: ConnectionConfig):
    if not config.id:
        config.id = str(uuid.uuid4())
    
    # For SQLite, if database is missing, use filename from filepath
    if config.type == "sqlite" and not config.database and config.filepath:
        config.database = config.filepath.split("/")[-1] or "sqlite.db"
    elif not config.database:
        config.database = "default"
        
    internal_db.save_connection(config)
    return config

@app.delete("/connections/{conn_id}")
def delete_connection_endpoint(conn_id: str):
    internal_db.delete_connection(conn_id)
    return {"status": "deleted"}

@app.get("/connections/discover")
def discover_local_databases():
    import socket
    import os
    
    discovered = []
    
    # 1. Discover SQLite files in backend directory
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    for file in os.listdir(backend_dir):
        if file.endswith(".db") and file != "sqlforge_metadata.db":
            discovered.append({
                "type": "sqlite",
                "filepath": os.path.join(backend_dir, file),
                "name": f"Discovered SQLite ({file})"
            })

    # 2. Discover networked databases via port scanning
    common_ports = {
        5432: "postgresql",
        3306: "mysql",
        27017: "mongodb",
        6379: "redis",
        1433: "mssql",
        1521: "oracle"
    }
    
    discovered = []
    for port, db_type in common_ports.items():
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.1) # Fast scan
            result = s.connect_ex(('127.0.0.1', port))
            if result == 0:
                discovered.append({
                    "type": db_type,
                    "host": "localhost",
                    "port": port,
                    "name": f"Discovered {db_type.capitalize()} (localhost:{port})"
                })
    return discovered

@app.post("/connections/test")
def test_connection_endpoint(config: ConnectionConfig):
    success, msg = database.test_connection(config)
    return {"success": success, "message": msg}

@app.get("/connections/{conn_id}/tables", response_model=List[TableInfo])
def get_tables_endpoint(conn_id: str):
    config = internal_db.get_connection(conn_id)
    if not config:
        raise HTTPException(status_code=404, detail="Connection not found")
    try:
        return database.get_tables(config)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/query", response_model=QueryResult)
def run_query(query: QueryRequest):
    config = internal_db.get_connection(query.connection_id)
    if not config:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    start_time = time.time()
    result = database.execute_query(config, query.sql)
    duration_ms = (time.time() - start_time) * 1000
    
    status = "error" if result.get("error") else "success"
    internal_db.add_history(query.connection_id, query.sql, duration_ms, status)
    
    return result

@app.get("/history", response_model=List[Dict[str, Any]])
def get_history_endpoint():
    return internal_db.get_history()

@app.get("/ai/models")
def list_ai_models(api_key: str):
    try:
        genai.configure(api_key=api_key)
        models = []
        for m in genai.list_models():
            if 'generateContent' in m.supported_generation_methods:
                models.append({
                    "name": m.name.replace('models/', ''),
                    "display_name": m.display_name,
                    "description": m.description
                })
        return models
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ai/generate")
def generate_sql(request: AIRequest):
    config = internal_db.get_connection(request.connection_id)
    if not config:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    try:
        # 1. Get Schema Context
        schema_context = database.get_schema_context(config)
        
        # 2. Configure Gemini
        genai.configure(api_key=request.api_key)
        model = genai.GenerativeModel(request.model)
        
        # 3. Construct Prompt
        system_prompt = f"""
        You are a SQL expert. Convert the user's natural language request into a valid SQL query.
        
        Database Schema:
        {schema_context}
        
        Rules:
        - Return ONLY the SQL query. No markdown formatting (like ```sql), no explanations.
        - Use standard SQL compatible with the database type if possible (currently mostly SQLite).
        - If the request is ambiguous, make a reasonable guess based on column names.
        """
        
        full_prompt = f"{system_prompt}\n\nUser Request: {request.prompt}"
        
        # 4. Generate Content
        response = model.generate_content(full_prompt)
        
        # 5. Clean up response
        sql = response.text.strip()
        if sql.startswith("```sql"):
            sql = sql[6:]
        if sql.startswith("```"):
            sql = sql[3:]
        if sql.endswith("```"):
            sql = sql[:-3]
            
        return {"sql": sql.strip()}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/pro/sync/diff")
def schema_diff(request: SyncRequest):
    source = internal_db.get_connection(request.source_connection_id)
    target = internal_db.get_connection(request.target_connection_id)
    
    if not source or not target:
        raise HTTPException(status_code=404, detail="Source or target connection not found")
    
    sql = pro_sync.diff_schemas(source, target)
    return {"sql": sql}

@app.post("/pro/sync/execute")
def schema_sync(request: SyncRequest):
    source = internal_db.get_connection(request.source_connection_id)
    target = internal_db.get_connection(request.target_connection_id)
    
    if not source or not target:
        raise HTTPException(status_code=404, detail="Source or target connection not found")
    
    result = pro_sync.sync_schemas(source, target, dry_run=request.dry_run)
    return result

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)