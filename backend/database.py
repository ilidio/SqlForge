from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Engine
from models import ConnectionConfig, TableInfo, ColumnInfo, ForeignKeyInfo, TableSchema
import os
import redis
from pymongo import MongoClient
import csv
import json
import io

# --- SQL HANDLING ---

def get_connection_url(config: ConnectionConfig) -> str:
    if config.type == 'sqlite':
        return f"sqlite:///{config.filepath}"
    elif config.type == 'postgresql':
        return f"postgresql+psycopg2://{config.username}:{config.password}@{config.host}:{config.port}/{config.database}"
    elif config.type == 'mysql':
        return f"mysql+pymysql://{config.username}:{config.password}@{config.host}:{config.port}/{config.database}"
    elif config.type == 'mssql':
        return f"mssql+pymssql://{config.username}:{config.password}@{config.host}:{config.port}/{config.database}"
    elif config.type == 'oracle':
        return f"oracle+oracledb://{config.username}:{config.password}@{config.host}:{config.port}/?service_name={config.database}"
    return ""

def get_engine(config: ConnectionConfig) -> Engine:
    url = get_connection_url(config)
    # Add connect_args for timeout where possible
    connect_args = {}
    if config.type == 'postgresql':
        connect_args = {"connect_timeout": 5}
    elif config.type == 'mysql':
        connect_args = {"connect_timeout": 5}
    
    return create_engine(url, connect_args=connect_args, pool_pre_ping=True)

def get_schema_context(config: ConnectionConfig) -> str:
    # ... (Keep existing implementation for SQL)
    if config.type in ['redis', 'mongodb']:
        return "NoSQL Database (Schema not available)"
    
    try:
        engine = get_engine(config)
        inspector = inspect(engine)
        schema_lines = []

        for table_name in inspector.get_table_names():
            try:
                columns = inspector.get_columns(table_name)
                col_strings = [f"{col['name']} ({col['type']})" for col in columns]
                schema_lines.append(f"Table: {table_name}")
                schema_lines.append(f"Columns: {', '.join(col_strings)}")
            except:
                continue
        return "\n".join(schema_lines)
    except:
        return ""

# --- GENERIC INTERFACE ---

def test_connection(config: ConnectionConfig):
    try:
        if config.type == 'redis':
            r = redis.Redis(host=config.host, port=config.port, password=config.password or None, db=0, socket_connect_timeout=5)
            r.ping()
            return True, "Connected to Redis successfully"
        elif config.type == 'mongodb':
            client = MongoClient(f"mongodb://{config.username}:{config.password}@{config.host}:{config.port}/" if config.username else f"mongodb://{config.host}:{config.port}/", serverSelectionTimeoutMS=5000)
            client.admin.command('ping')
            return True, "Connected to MongoDB successfully"
        else:
            # SQL
            engine = get_engine(config)
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            return True, "Connected successfully"
    except Exception as e:
        return False, str(e)

def get_tables(config: ConnectionConfig) -> list[TableInfo]:
    if config.type == 'redis':
        # For Redis, "tables" are just a concept we mock as Keyspaces or Types, but let's just return one "DB0"
        return [TableInfo(name="Keys (DB0)", type="kv")]
    
    if config.type == 'mongodb':
        client = MongoClient(f"mongodb://{config.username}:{config.password}@{config.host}:{config.port}/" if config.username else f"mongodb://{config.host}:{config.port}/")
        db = client[config.database]
        return [TableInfo(name=col, type="collection") for col in db.list_collection_names()]

    # SQL
    engine = get_engine(config)
    inspector = inspect(engine)
    items = []
    try:
        # Standard SQLAlchemy support
        for table_name in inspector.get_table_names():
            items.append(TableInfo(name=table_name, type="table"))
        for view_name in inspector.get_view_names():
            items.append(TableInfo(name=view_name, type="view"))
        
        # Dialect specific (Triggers, Functions, Procedures)
        with engine.connect() as conn:
            if config.type == 'sqlite':
                # SQLite Triggers
                res = conn.execute(text("SELECT name FROM sqlite_master WHERE type='trigger'"))
                for row in res:
                    items.append(TableInfo(name=row[0], type="trigger"))
            
            elif config.type == 'postgresql':
                # Postgres Triggers
                res = conn.execute(text("SELECT tgname FROM pg_trigger WHERE tgisinternal = false"))
                for row in res:
                    items.append(TableInfo(name=row[0], type="trigger"))
                
                # Postgres Functions
                res = conn.execute(text("SELECT proname FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public'"))
                for row in res:
                    items.append(TableInfo(name=row[0], type="function"))

    except Exception as e:
        print(f"Error inspecting metadata: {e}")
    
    return items

def get_schema_details(config: ConnectionConfig) -> list[TableSchema]:
    if config.type in ['redis', 'mongodb']:
        return []

    engine = get_engine(config)
    inspector = inspect(engine)
    schemas = []

    try:
        for table_name in inspector.get_table_names():
            # Get Columns
            columns = []
            try:
                # Get PKs
                pks = inspector.get_pk_constraint(table_name).get('constrained_columns', [])
                
                for col in inspector.get_columns(table_name):
                    columns.append(ColumnInfo(
                        name=col['name'],
                        type=str(col['type']),
                        primary_key=col['name'] in pks
                    ))
            except Exception as e:
                print(f"Error reading columns for {table_name}: {e}")
                continue

            # Get FKs
            fks = []
            try:
                for fk in inspector.get_foreign_keys(table_name):
                    # SQLAlchemy returns constrained_columns as a list, usually one for simple FKs
                    # We'll take the first one for simplicity in this visualization or iterate
                    if fk['constrained_columns'] and fk['referred_columns']:
                        fks.append(ForeignKeyInfo(
                            constrained_column=fk['constrained_columns'][0],
                            referred_table=fk['referred_table'],
                            referred_column=fk['referred_columns'][0]
                        ))
            except Exception as e:
                print(f"Error reading FKs for {table_name}: {e}")

            schemas.append(TableSchema(
                name=table_name,
                columns=columns,
                foreign_keys=fks
            ))
            
    except Exception as e:
        print(f"Error inspecting schema: {e}")
        
    return schemas

def drop_object(config: ConnectionConfig, object_name: str, object_type: str):
    if config.type in ['redis', 'mongodb']:
        # Basic MongoDB collection drop support
        if config.type == 'mongodb' and object_type == 'collection':
            try:
                client = MongoClient(f"mongodb://{config.username}:{config.password}@{config.host}:{config.port}/" if config.username else f"mongodb://{config.host}:{config.port}/")
                db = client[config.database]
                db.drop_collection(object_name)
                return {"success": True, "error": None}
            except Exception as e:
                return {"success": False, "error": str(e)}
        return {"success": False, "error": f"Drop not yet supported for {config.type}"}
    
    engine = get_engine(config)
    # Map UI types to SQL keywords
    sql_type = object_type.upper()
    if sql_type == 'COLLECTION': sql_type = 'TABLE' # Should not happen for SQL dialects
    
    try:
        with engine.begin() as conn:
            stmt = text(f"DROP {sql_type} {object_name}")
            conn.execute(stmt)
            return {"success": True, "error": None}
    except Exception as e:
        return {"success": False, "error": str(e)}

def execute_batch_mutations(config: ConnectionConfig, operations: list[dict]):
    if config.type in ['redis', 'mongodb']:
        return [{"success": False, "error": f"Batch operations not yet supported for {config.type}"}]
    
    engine = get_engine(config)
    results = []
    
    try:
        with engine.begin() as conn: # Automatically starts and commits/rolls back a transaction
            for op in operations:
                op_type = op.get("type") # 'update' or 'delete'
                table = op.get("table")
                data = op.get("data", {}) # New values for update
                where = op.get("where", {}) # Conditions
                
                if op_type == 'update':
                    set_clause = ", ".join([f"{col} = :{col}_val" for col in data.keys()])
                    where_clause = " AND ".join([
                        f"{col} IS NULL" if val is None else f"{col} = :{col}_where" 
                        for col, val in where.items()
                    ])
                    
                    params = {f"{k}_val": v for k, v in data.items()}
                    params.update({f"{k}_where": v for k, v in where.items() if v is not None})
                    
                    stmt = text(f"UPDATE {table} SET {set_clause} WHERE {where_clause}")
                    res = conn.execute(stmt, params)
                    if res.rowcount == 0:
                        raise Exception(f"Update failed: Row in {table} was modified or deleted by another user.")
                        
                elif op_type == 'delete':
                    where_clause = " AND ".join([
                        f"{col} IS NULL" if val is None else f"{col} = :{col}_where" 
                        for col, val in where.items()
                    ])
                    params = {f"{k}_where": v for k, v in where.items() if v is not None}
                    
                    stmt = text(f"DELETE FROM {table} WHERE {where_clause}")
                    res = conn.execute(stmt, params)
                    if res.rowcount == 0:
                        raise Exception(f"Delete failed: Row in {table} no longer exists or was modified.")
                
                results.append({"success": True, "error": None})
        return results
    except Exception as e:
        # If any operation fails, the 'with engine.begin()' block rolls back EVERYTHING
        return [{"success": False, "error": str(e)}]

def execute_query(config: ConnectionConfig, query_str: str):
    if config.type == 'redis':
        try:
            r = redis.Redis(host=config.host, port=config.port, password=config.password or None, db=0)
            # Extremely basic implementation: Assume query is a command like "GET key"
            parts = query_str.split()
            cmd = parts[0].upper()
            if cmd == "KEYS":
                keys = r.keys(parts[1] if len(parts) > 1 else "*")
                rows = [{"key": k.decode('utf-8'), "type": r.type(k).decode('utf-8')} for k in keys]
                return {"columns": ["key", "type"], "rows": rows, "error": None}
            elif cmd == "GET":
                 val = r.get(parts[1])
                 return {"columns": ["value"], "rows": [{"value": val.decode('utf-8') if val else None}], "error": None}
            else:
                return {"columns": [], "rows": [], "error": "Only KEYS and GET supported in basic mode"}
        except Exception as e:
            return {"columns": [], "rows": [], "error": str(e)}

    if config.type == 'mongodb':
        try:
            client = MongoClient(f"mongodb://{config.username}:{config.password}@{config.host}:{config.port}/" if config.username else f"mongodb://{config.host}:{config.port}/")
            db = client[config.database]
            # Hacky "SQL-like" wrapper for Mongo for now. Format: "collection.find({})"
            # Real Navicat has a GUI builder, here we assume raw JS-like syntax or simple "collection" name
            col_name = query_str.split('.')[0]
            if "find" in query_str:
                # very unsafe eval-like parsing or just dump all
                cursor = db[col_name].find({}).limit(50)
            else:
                 # Just dump collection
                 cursor = db[query_str].find({}).limit(50)
            
            rows = []
            for doc in cursor:
                doc['_id'] = str(doc['_id'])
                rows.append(doc)
            
            if not rows:
                return {"columns": [], "rows": [], "error": "No documents found"}
            
            columns = list(rows[0].keys())
            return {"columns": columns, "rows": rows, "error": None}
        except Exception as e:
             return {"columns": [], "rows": [], "error": str(e)}

    # SQL
    engine = get_engine(config)
    try:
        with engine.connect() as conn:
            result = conn.execute(text(query_str))
            if result.returns_rows:
                columns = result.keys()
                rows = [dict(row._mapping) for row in result]
                return {"columns": list(columns), "rows": rows, "error": None}
            else:
                conn.commit()
                return {"columns": [], "rows": [], "error": "Query executed successfully (no rows returned)"}
    except Exception as e:
        return {"columns": [], "rows": [], "error": str(e)}

def import_data(config: ConnectionConfig, table_name: str, file_contents: bytes, file_format: str, mode: str = 'append'):
    if config.type in ['redis', 'mongodb']:
        return {"success": False, "error": f"Import not yet supported for {config.type}"}

    engine = get_engine(config)
    
    # 1. Parse Data
    data_rows = []
    columns = []
    
    try:
        if file_format == 'csv':
            # Decode bytes to string
            content_str = file_contents.decode('utf-8')
            csv_reader = csv.DictReader(io.StringIO(content_str))
            columns = csv_reader.fieldnames
            for row in csv_reader:
                # Handle basic type conversion if needed (e.g. empty string to None)
                cleaned_row = {k: (None if v == '' else v) for k, v in row.items()}
                data_rows.append(cleaned_row)
                
        elif file_format == 'json':
            content_str = file_contents.decode('utf-8')
            data_rows = json.loads(content_str)
            if isinstance(data_rows, list) and len(data_rows) > 0:
                columns = list(data_rows[0].keys())
            else:
                return {"success": False, "error": "Invalid JSON format. Expected list of objects."}
        else:
            return {"success": False, "error": "Unsupported file format"}
            
    except Exception as e:
        return {"success": False, "error": f"Failed to parse file: {str(e)}"}

    if not data_rows:
        return {"success": True, "message": "No data found in file"}

    # 2. Insert Data
    try:
        with engine.begin() as conn:
            if mode == 'truncate':
                conn.execute(text(f"DELETE FROM {table_name}"))
            
            # Use SQLAlchemy's insert
            # We construct a parameterized insert statement
            # INSERT INTO table (col1, col2) VALUES (:col1, :col2)
            
            # Naive approach: Insert one by one or in chunks. SQLAlchemy can handle list of dicts.
            # However, we must ensure the dict keys match table columns.
            # For this prototype, we assume the file headers MATCH the table columns.
            
            placeholders = ", ".join([f":{col}" for col in columns])
            stmt = text(f"INSERT INTO {table_name} ({', '.join(columns)}) VALUES ({placeholders})")
            
            conn.execute(stmt, data_rows)
            
        return {"success": True, "message": f"Successfully imported {len(data_rows)} rows into {table_name}"}
            
    except Exception as e:
        return {"success": False, "error": f"Database error: {str(e)}"}