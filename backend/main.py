from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import uuid
from typing import List, Dict, Any
import time

# Import from local modules
from models import ConnectionConfig, QueryRequest, QueryResult, TableInfo, AIRequest, SyncRequest, TableSchema, AlterTableRequest
import database
import internal_db
from google import genai
from pro import sync as pro_sync
from pro import transfer as pro_transfer
from pro import index_advisor
from pro import what_if
from monitor import locks
from pro import benchmark

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

@app.delete("/connections")
def delete_all_connections_endpoint():
    internal_db.delete_all_connections()
    return {"status": "all deleted"}

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
                    "database": "testdb" if db_type == "mongodb" else "default",
                    "name": f"Discovered {db_type.capitalize()} (localhost:{port})"
                })
    return discovered

@app.post("/connections/test")
def test_connection_endpoint(config: ConnectionConfig):
    success, msg = database.test_connection(config)
    return {"success": success, "message": msg}

@app.get("/connections/health")
def connections_health():
    connections = internal_db.get_connections()
    health_status = {}
    for conn in connections:
        success, _ = database.test_connection(conn)
        health_status[conn.id] = "online" if success else "offline"
    return health_status

@app.get("/connections/{conn_id}/tables", response_model=List[TableInfo])
def get_tables_endpoint(conn_id: str):
    config = internal_db.get_connection(conn_id)
    if not config:
        raise HTTPException(status_code=404, detail="Connection not found")
    try:
        return database.get_tables(config)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/connections/{conn_id}/schema", response_model=List[TableSchema])
def get_schema_details_endpoint(conn_id: str):
    config = internal_db.get_connection(conn_id)
    if not config:
        raise HTTPException(status_code=404, detail="Connection not found")
    try:
        return database.get_schema_details(config)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/connections/{conn_id}/schema/alter")
def alter_table_endpoint(conn_id: str, request: AlterTableRequest):
    if conn_id != request.connection_id:
         raise HTTPException(status_code=400, detail="Connection ID mismatch")
         
    config = internal_db.get_connection(conn_id)
    if not config:
        raise HTTPException(status_code=404, detail="Connection not found")
        
    result = database.alter_table(config, request)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    return result

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

@app.post("/query/explain")
def explain_query(query: QueryRequest):
    config = internal_db.get_connection(query.connection_id)
    if not config:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    result = database.get_execution_plan(config, query.sql)
    return result

@app.post("/query/benchmark")
def run_query_benchmark(request: Dict[str, Any]):
    # request: { connection_id, sql, concurrency, duration }
    conn_id = request.get("connection_id")
    sql = request.get("sql")
    concurrency = int(request.get("concurrency", 5))
    duration = int(request.get("duration", 5))
    
    config = internal_db.get_connection(conn_id)
    if not config:
        raise HTTPException(status_code=404, detail="Connection not found")
        
    return benchmark.run_benchmark(config, sql, concurrency, duration)

@app.post("/query/batch")
def run_batch_queries(request: Dict[str, Any]):
    # request format: { connection_id: str, operations: List[Dict] }
    conn_id = request.get("connection_id")
    operations = request.get("operations", [])
    
    config = internal_db.get_connection(conn_id)
    if not config:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    results = database.execute_batch_mutations(config, operations)
    return {"results": results}

@app.get("/history", response_model=List[Dict[str, Any]])
def get_history_endpoint():
    return internal_db.get_history()

@app.get("/ai/models")
def list_ai_models(api_key: str):
    try:
        client = genai.Client(api_key=api_key)
        models = []
        for m in client.models.list():
            # In new SDK, capabilities might be different, 
            # but usually we want those that support content generation
            models.append({
                "name": m.name,
                "display_name": m.display_name or m.name,
                "description": m.description or ""
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
        
        # 2. Initialize Client
        client = genai.Client(api_key=request.api_key)
        
        # 3. Construct Prompt
        db_type_map = {
            'redis': 'Redis (Output should be raw Redis commands like SET, GET, KEYS, etc.)',
            'mongodb': 'MongoDB (Output should be just the collection name to find, or collection.find({...}) syntax)',
            'postgresql': 'PostgreSQL',
            'mysql': 'MySQL',
            'sqlite': 'SQLite',
            'mssql': 'SQL Server',
            'oracle': 'Oracle'
        }
        db_desc = db_type_map.get(config.type, config.type)

        system_prompt = f"""
        You are a database expert. Convert the user's natural language request into a valid query for {db_desc}.
        
        Database Metadata/Schema:
        {schema_context}
        
        Rules:
        - Return ONLY the query/command. No markdown formatting (like ```sql), no explanations.
        - For Redis, return the full command (e.g., SET key value).
        - For MongoDB, return either the collection name to list it, or a find query (e.g., users.find({{"age": {{"$gt": 18}}}})).
        - For SQL, return a valid SQL statement.
        - If the request is ambiguous, make a reasonable guess based on the metadata provided.
        """
        
        full_prompt = f"{system_prompt}\n\nUser Request: {request.prompt}"
        
        # 4. Generate Content
        response = client.models.generate_content(
            model=request.model,
            contents=full_prompt
        )
        
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

@app.post("/pro/index-advisor/analyze")
def analyze_query_performance(request: AIRequest):
    config = internal_db.get_connection(request.connection_id)
    if not config:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    # We use the AIRequest model because it has 'prompt' (which we use for SQL) and 'api_key'/'model'
    result = index_advisor.generate_index_recommendations(
        config, 
        request.prompt, 
        request.api_key, 
        request.model
    )
    return result

@app.post("/pro/what-if/analyze")
def run_what_if_analysis(request: Dict[str, Any]):
    # request: { connection_id, sql, index_ddl }
    conn_id = request.get("connection_id")
    sql = request.get("sql")
    index_ddl = request.get("index_ddl")
    
    config = internal_db.get_connection(conn_id)
    if not config:
        raise HTTPException(status_code=404, detail="Connection not found")
        
    return what_if.evaluate_virtual_index(config, sql, index_ddl)

@app.get("/monitor/locks/{conn_id}")
def get_locks(conn_id: str):
    config = internal_db.get_connection(conn_id)
    if not config:
        raise HTTPException(status_code=404, detail="Connection not found")
    return locks.get_lock_tree(config)

@app.post("/monitor/kill")
def kill_session_endpoint(request: Dict[str, str]):
    # request: { connection_id, pid }
    conn_id = request.get("connection_id")
    pid = request.get("pid")
    config = internal_db.get_connection(conn_id)
    if not config:
        raise HTTPException(status_code=404, detail="Connection not found")
    return locks.kill_session(config, pid)

@app.post("/pro/sync/diff")
def schema_diff(request: SyncRequest):
    source = internal_db.get_connection(request.source_connection_id)
    target = internal_db.get_connection(request.target_connection_id)
    
    if not source or not target:
        raise HTTPException(status_code=404, detail="Source or target connection not found")
    
    if request.mode in ['transfer', 'data']:
        return {"sql": f"-- DATA TRANSFER PLAN\n-- Source: {source.name}\n-- Target: {target.name}\n-- Action: Transfer all rows for all matching tables.\n-- Note: This will append data to existing tables."}
    
    result = pro_sync.diff_schemas(source, target)
    return {"sql": result["sql_text"]}

@app.post("/pro/sync/execute")
def schema_sync(request: SyncRequest):
    source = internal_db.get_connection(request.source_connection_id)
    target = internal_db.get_connection(request.target_connection_id)
    
    if not source or not target:
        raise HTTPException(status_code=404, detail="Source or target connection not found")
    
    if request.mode in ['transfer', 'data']:
        if request.dry_run:
            return {"status": "success", "message": "Dry run completed for data transfer."}
        return pro_transfer.transfer_all_tables(source, target)
    
    result = pro_sync.sync_schemas(source, target, dry_run=request.dry_run)
    return result

@app.post("/connections/{conn_id}/drop")
def drop_db_object(conn_id: str, request: Dict[str, str]):
    # request format: { "name": str, "type": str }
    config = internal_db.get_connection(conn_id)
    if not config:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    result = database.drop_object(config, request.get("name", ""), request.get("type", "table"))
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    return result

@app.post("/connections/{conn_id}/import/{table_name}")
async def import_table_data(
    conn_id: str, 
    table_name: str,
    file: UploadFile = File(...),
    mode: str = Form("append"), # 'append' or 'truncate'
    format: str = Form("csv")   # 'csv' or 'json'
):
    config = internal_db.get_connection(conn_id)
    if not config:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    content = await file.read()
    
    result = database.import_data(config, table_name, content, format, mode)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
        
    return result

@app.get("/connections/{conn_id}/export/{table_name}")
def export_table_data(conn_id: str, table_name: str, format: str = "csv"):
    config = internal_db.get_connection(conn_id)
    if not config:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    try:
        gen = database.stream_export_data(config, table_name, format)
        
        media_types = {
            "csv": "text/csv",
            "json": "application/json"
        }
        
        return StreamingResponse(
            gen, 
            media_type=media_types.get(format, "text/plain"),
            headers={"Content-Disposition": f"attachment; filename={table_name}.{format}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)