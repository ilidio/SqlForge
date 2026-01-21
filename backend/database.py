from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Engine
from models import ConnectionConfig, TableInfo, ColumnInfo, ForeignKeyInfo, TableSchema, AlterTableRequest, ColumnDefinition
import os
import redis
from pymongo import MongoClient
import csv
import json
import io
import shlex

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
    if config.type == 'redis':
        try:
            r = redis.Redis(host=config.host, port=config.port, password=config.password or None, db=0, decode_responses=True)
            keys = r.keys("*")[:20] # Sample 20 keys
            context = ["Redis Database", f"Total Keys: {len(r.keys('*'))}", "Sample Keys:"]
            for k in keys:
                context.append(f"- {k} ({r.type(k)})")
            return "\n".join(context)
        except:
            return "Redis Database (Metadata unavailable)"
            
    if config.type == 'mongodb':
        try:
            client = MongoClient(f"mongodb://{config.username}:{config.password}@{config.host}:{config.port}/" if config.username else f"mongodb://{config.host}:{config.port}/", serverSelectionTimeoutMS=2000)
            db = client[config.database]
            collections = db.list_collection_names()
            context = ["MongoDB Database", f"Database: {config.database}", "Collections:"]
            for col in collections:
                sample = db[col].find_one()
                fields = list(sample.keys()) if sample else []
                context.append(f"- {col} (Fields: {', '.join(fields)})")
            return "\n".join(context)
        except:
            return "MongoDB Database (Metadata unavailable)"

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
                        nullable=col.get('nullable', True),
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
    try:
        if config.type == 'redis':
            r = redis.Redis(host=config.host, port=config.port, password=config.password or None, db=0)
            if object_name.upper() == 'FLUSHDB':
                r.flushdb()
                return {"success": True, "error": None}
            r.delete(object_name)
            return {"success": True, "error": None}

        if config.type == 'mongodb':
            client = MongoClient(f"mongodb://{config.username}:{config.password}@{config.host}:{config.port}/" if config.username else f"mongodb://{config.host}:{config.port}/")
            db = client[config.database]
            if object_type == 'collection':
                db.drop_collection(object_name)
                return {"success": True, "error": None}
            return {"success": False, "error": f"Drop not supported for object type: {object_type}"}
    except Exception as e:
        return {"success": False, "error": str(e)}
    
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
    if config.type == 'redis':
        try:
            r = redis.Redis(host=config.host, port=config.port, password=config.password or None, db=0)
            pipe = r.pipeline()
            for op in operations:
                if op['type'] == 'update':
                    # For Redis, update is just SET. If we have multiple fields, we might use HSET
                    # but since the UI sends table-like updates, we assume key-value or JSON
                    key = op['where'].get('key')
                    if key:
                        pipe.set(key, json.dumps(op['data']))
                elif op['type'] == 'delete':
                    key = op['where'].get('key')
                    if key:
                        pipe.delete(key)
            pipe.execute()
            return [{"success": True, "error": None}] * len(operations)
        except Exception as e:
            return [{"success": False, "error": str(e)}]

    if config.type == 'mongodb':
        try:
            from pymongo import UpdateOne, DeleteOne
            client = MongoClient(f"mongodb://{config.username}:{config.password}@{config.host}:{config.port}/" if config.username else f"mongodb://{config.host}:{config.port}/")
            db = client[config.database]
            
            bulk_ops = []
            for op in operations:
                col = op['table']
                if op['type'] == 'update':
                    bulk_ops.append(UpdateOne(op['where'], {"$set": op['data']}))
                elif op['type'] == 'delete':
                    bulk_ops.append(DeleteOne(op['where']))
            
            if bulk_ops:
                # Group by collection since bulk_write is per collection
                from collections import defaultdict
                col_ops = defaultdict(list)
                # Need to know which op belongs to which collection... 
                # actually 'operations' usually target one table in the UI flow.
                # We'll assume the first op's table for now or group them.
                for op, b_op in zip(operations, bulk_ops):
                    col_ops[op['table']].append(b_op)
                
                for col, ops in col_ops.items():
                    db[col].bulk_write(ops)
                    
            return [{"success": True, "error": None}] * len(operations)
        except Exception as e:
            return [{"success": False, "error": str(e)}]

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
            r = redis.Redis(host=config.host, port=config.port, password=config.password or None, db=0, decode_responses=True)
            
            # Intercept SQL-like select for Redis
            if query_str.upper().strip().startswith("SELECT"):
                keys = r.keys("*")
                rows = [{"key": k, "type": r.type(k)} for k in keys]
                return {"columns": ["key", "type"], "rows": rows, "error": None}

            try:
                parts = shlex.split(query_str)
            except ValueError:
                # Fallback to simple split if shlex fails (e.g. unbalanced quotes)
                parts = query_str.split()

            if not parts:
                return {"columns": [], "rows": [], "error": "Empty query"}
            
            cmd = parts[0].upper()
            if cmd == "KEYS":
                pattern = parts[1] if len(parts) > 1 else "*"
                keys = r.keys(pattern)
                rows = [{"key": k, "type": r.type(k)} for k in keys]
                return {"columns": ["key", "type"], "rows": rows, "error": None}
            
            # Support generic Redis commands
            res = r.execute_command(*parts)
            
            # Format result for the grid
            if isinstance(res, list):
                rows = [{"item": str(i)} for i in res]
                return {"columns": ["item"], "rows": rows, "error": None}
            elif isinstance(res, dict):
                rows = [{"key": k, "value": str(v)} for k, v in res.items()]
                return {"columns": ["key", "value"], "rows": rows, "error": None}
            else:
                return {"columns": ["result"], "rows": [{"result": str(res)}], "error": None}
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
    def get_rows():
        if file_format == 'csv':
            content_str = file_contents.decode('utf-8')
            csv_reader = csv.DictReader(io.StringIO(content_str))
            for row in csv_reader:
                yield {k: (None if v == '' else v) for k, v in row.items()}
        elif file_format == 'json':
            content_str = file_contents.decode('utf-8')
            data = json.loads(content_str)
            if isinstance(data, list):
                for row in data:
                    yield row
            else:
                raise Exception("Invalid JSON format. Expected list of objects.")

    if config.type == 'redis':
        try:
            r = redis.Redis(host=config.host, port=config.port, password=config.password or None, db=0)
            if mode == 'truncate':
                r.flushdb()
            
            pipe = r.pipeline()
            total = 0
            for row in get_rows():
                key = row.get('key') or row.get('id') or f"imported:{total}"
                pipe.set(key, json.dumps(row) if len(row) > 2 or 'value' not in row else row.get('value', ''))
                total += 1
                if total % 1000 == 0:
                    pipe.execute()
                    pipe = r.pipeline()
            pipe.execute()
            return {"success": True, "message": f"Imported {total} keys into Redis"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    if config.type == 'mongodb':
        try:
            client = MongoClient(f"mongodb://{config.username}:{config.password}@{config.host}:{config.port}/" if config.username else f"mongodb://{config.host}:{config.port}/")
            db = client[config.database]
            if mode == 'truncate':
                db[table_name].delete_many({})
            
            batch = []
            total = 0
            for row in get_rows():
                batch.append(row)
                if len(batch) >= 1000:
                    db[table_name].insert_many(batch)
                    total += len(batch)
                    batch = []
            if batch:
                db[table_name].insert_many(batch)
                total += len(batch)
            return {"success": True, "message": f"Imported {total} documents into {table_name}"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    engine = get_engine(config)
    batch_size = 1000
    
    try:
        # 1. Prepare Data Generator
        def get_rows():
            if file_format == 'csv':
                content_str = file_contents.decode('utf-8')
                csv_reader = csv.DictReader(io.StringIO(content_str))
                for row in csv_reader:
                    yield {k: (None if v == '' else v) for k, v in row.items()}
            elif file_format == 'json':
                content_str = file_contents.decode('utf-8')
                data = json.loads(content_str)
                if isinstance(data, list):
                    for row in data:
                        yield row
                else:
                    raise Exception("Invalid JSON format. Expected list of objects.")

        # 2. Execute in Batches
        row_gen = get_rows()
        total_imported = 0
        
        with engine.begin() as conn:
            if mode == 'truncate':
                conn.execute(text(f"DELETE FROM {table_name}"))
            
            while True:
                batch = []
                try:
                    for _ in range(batch_size):
                        batch.append(next(row_gen))
                except StopIteration:
                    pass
                
                if not batch:
                    break
                
                columns = list(batch[0].keys())
                placeholders = ", ".join([f":{col}" for col in columns])
                stmt = text(f"INSERT INTO {table_name} ({', '.join(columns)}) VALUES ({placeholders})")
                conn.execute(stmt, batch)
                total_imported += len(batch)
                
        return {"success": True, "message": f"Successfully imported {total_imported} rows into {table_name}"}
            
    except Exception as e:
        return {"success": False, "error": f"Database error: {str(e)}"}

def stream_export_data(config: ConnectionConfig, table_name: str, file_format: str):
    if config.type == 'redis':
        def generate_redis():
            r = redis.Redis(host=config.host, port=config.port, password=config.password or None, db=0, decode_responses=True)
            keys = r.scan_iter("*")
            if file_format == 'csv':
                yield "key,value\n"
                for k in keys:
                    v = r.get(k)
                    yield f'"{k}","{str(v).replace(chr(34), chr(34)+chr(34))}"\n'
            else: # JSON
                yield "[\n"
                first = True
                for k in keys:
                    if not first: yield ",\n"
                    yield json.dumps({"key": k, "value": r.get(k)})
                    first = False
                yield "\n]"
        return generate_redis()

    if config.type == 'mongodb':
        def generate_mongo():
            client = MongoClient(f"mongodb://{config.username}:{config.password}@{config.host}:{config.port}/" if config.username else f"mongodb://{config.host}:{config.port}/")
            db = client[config.database]
            cursor = db[table_name].find({})
            if file_format == 'csv':
                first_doc = db[table_name].find_one()
                if not first_doc: return
                columns = list(first_doc.keys())
                yield ",".join(columns) + "\n"
                for doc in cursor:
                    doc['_id'] = str(doc['_id'])
                    yield ",".join([f'"{str(doc.get(c, "")).replace(chr(34), chr(34)+chr(34))}"' for c in columns]) + "\n"
            else: # JSON
                yield "[\n"
                first = True
                for doc in cursor:
                    if not first: yield ",\n"
                    doc['_id'] = str(doc['_id'])
                    yield json.dumps(doc)
                    first = False
                yield "\n]"
        return generate_mongo()

    engine = get_engine(config)
    
    def generate():
        with engine.connect() as conn:
            # For massive tables, we should use stream_results=True if supported by dialect
            result = conn.execution_options(stream_results=True).execute(text(f"SELECT * FROM {table_name}"))
            columns = result.keys()
            
            if file_format == 'csv':
                # Header
                yield ",".join(columns) + "\n"
                for row in result:
                    # Very basic CSV quoting
                    values = []
                    for val in row:
                        s = str(val) if val is not None else ""
                        if "," in s or '"' in s or "\n" in s:
                            s = '"' + s.replace('"', '""') + '"'
                        values.append(s)
                    yield ",".join(values) + "\n"
            
            elif file_format == 'json':
                yield "[\n"
                first = True
                for row in result:
                    if not first:
                        yield ",\n"
                    # Create dict for JSON
                    row_dict = dict(row._mapping)
                    # Convert non-serializable objects (dates, etc)
                    for k, v in row_dict.items():
                        if hasattr(v, 'isoformat'):
                            row_dict[k] = v.isoformat()
                    
                    yield json.dumps(row_dict)
                    first = False
                yield "\n]"

    return generate()

def alter_table(config: ConnectionConfig, request: AlterTableRequest):
    if config.type == 'redis':
        try:
            r = redis.Redis(host=config.host, port=config.port, password=config.password or None, db=0)
            if request.action == 'rename_table': # We map 'rename_table' to rename key for Redis
                r.rename(request.table_name, request.new_table_name)
                return {"success": True, "message": f"Renamed key {request.table_name} to {request.new_table_name}"}
            return {"success": False, "error": f"Action {request.action} not supported for Redis"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    if config.type == 'mongodb':
        try:
            client = MongoClient(f"mongodb://{config.username}:{config.password}@{config.host}:{config.port}/" if config.username else f"mongodb://{config.host}:{config.port}/")
            db = client[config.database]
            if request.action == 'rename_table':
                db[request.table_name].rename(request.new_table_name)
                return {"success": True, "message": f"Renamed collection {request.table_name} to {request.new_table_name}"}
            return {"success": False, "error": f"Action {request.action} not supported for MongoDB"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    if config.type in ['redis', 'mongodb']:
        return {"success": False, "error": f"Schema modification not supported for {config.type}"}

    engine = get_engine(config)
    
    try:
        with engine.begin() as conn:
            table = request.table_name
            action = request.action
            
            # Basic sanitization (very rudimentary, relies on internal use)
            # In a real app, use SQLAlchemy's schema manipulation tools (Alembic) or robust quoting.
            
            if action == 'add_column':
                col_def = request.column_def
                if not col_def:
                    raise Exception("Missing column definition for add_column")
                
                type_str = col_def.type.upper()
                nullable_str = "NULL" if col_def.nullable else "NOT NULL"
                default_str = f"DEFAULT {col_def.default}" if col_def.default else ""
                
                sql = f"ALTER TABLE {table} ADD COLUMN {col_def.name} {type_str} {nullable_str} {default_str}"
                conn.execute(text(sql))
                
            elif action == 'drop_column':
                if not request.column_name:
                    raise Exception("Missing column name for drop_column")
                
                # SQLite does not support DROP COLUMN in older versions, but modern ones (3.35+) do.
                # Assuming modern SQLite or standard SQL DBs.
                sql = f"ALTER TABLE {table} DROP COLUMN {request.column_name}"
                conn.execute(text(sql))
                
            elif action == 'rename_column':
                if not request.column_name or not request.new_column_name:
                    raise Exception("Missing column names for rename_column")
                
                sql = f"ALTER TABLE {table} RENAME COLUMN {request.column_name} TO {request.new_column_name}"
                conn.execute(text(sql))
                
            # 'alter_column' is complex across dialects (modifying type/constraints).
            # We'll skip deep support for now or implement a basic "modify type" if dialect permits.
            elif action == 'alter_column':
                col_def = request.column_def
                if not col_def or not request.column_name:
                    raise Exception("Missing data for alter_column")
                
                type_str = col_def.type.upper()
                nullable_str = "NULL" if col_def.nullable else "NOT NULL"
                
                if config.type == 'postgresql':
                    # Postgres uses ALTER COLUMN ... TYPE ... and SET/DROP NOT NULL
                    sql_type = f"ALTER TABLE {table} ALTER COLUMN {request.column_name} TYPE {type_str}"
                    conn.execute(text(sql_type))
                    
                    null_action = "DROP NOT NULL" if col_def.nullable else "SET NOT NULL"
                    sql_null = f"ALTER TABLE {table} ALTER COLUMN {request.column_name} {null_action}"
                    conn.execute(text(sql_null))
                    
                elif config.type == 'mysql':
                    # MySQL uses MODIFY COLUMN
                    sql = f"ALTER TABLE {table} MODIFY COLUMN {request.column_name} {type_str} {nullable_str}"
                    conn.execute(text(sql))
                    
                else:
                    # Generic fallback or warning for SQLite
                    if config.type == 'sqlite':
                        raise Exception("SQLite does not support altering column types directly. Table recreation is required.")
                    
                    sql = f"ALTER TABLE {table} ALTER COLUMN {request.column_name} {type_str} {nullable_str}"
                    conn.execute(text(sql))
            
            else:
                 return {"success": False, "error": f"Unknown action: {action}"}
                 
        return {"success": True, "message": f"Schema change '{action}' applied successfully."}
            
    except Exception as e:
        return {"success": False, "error": str(e)}