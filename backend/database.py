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
from sshtunnel import SSHTunnelForwarder
import time

# --- SSH TUNNEL MANAGER ---

class TunnelManager:
    def __init__(self):
        self.tunnels = {}

    def get_tunnel(self, config: ConnectionConfig):
        if not config.ssh or not config.ssh.enabled:
            return None
        
        tunnel_id = f"{config.id}_tunnel"
        
        # Check if tunnel exists and is active
        if tunnel_id in self.tunnels:
            tunnel = self.tunnels[tunnel_id]
            if tunnel.is_active:
                return tunnel
            else:
                # Restart if inactive
                tunnel.stop()
        
        # Create new tunnel
        ssh_config = config.ssh
        
        pkey = ssh_config.private_key_path if ssh_config.private_key_path else None
        password = ssh_config.password if ssh_config.password else None
        
        # Determine remote bind address
        # For a standard DB connection string host:port, that is where the SSH server should forward to.
        remote_bind_address = (config.host, config.port)
        
        try:
            tunnel = SSHTunnelForwarder(
                (ssh_config.host, ssh_config.port),
                ssh_username=ssh_config.username,
                ssh_password=password,
                ssh_pkey=pkey,
                remote_bind_address=remote_bind_address
            )
            tunnel.start()
            self.tunnels[tunnel_id] = tunnel
            return tunnel
        except Exception as e:
            print(f"Failed to start SSH tunnel: {e}")
            raise e

    def stop_tunnel(self, config: ConnectionConfig):
        tunnel_id = f"{config.id}_tunnel"
        if tunnel_id in self.tunnels:
            self.tunnels[tunnel_id].stop()
            del self.tunnels[tunnel_id]

tunnel_manager = TunnelManager()

# --- SQL HANDLING ---

def get_connection_url(config: ConnectionConfig, local_port: int = None) -> str:
    host = "127.0.0.1" if local_port else config.host
    port = local_port if local_port else config.port

    if config.type == 'sqlite':
        return f"sqlite:///{config.filepath}"
    elif config.type == 'postgresql':
        return f"postgresql+psycopg2://{config.username}:{config.password}@{host}:{port}/{config.database}"
    elif config.type == 'mysql':
        return f"mysql+pymysql://{config.username}:{config.password}@{host}:{port}/{config.database}"
    elif config.type == 'mssql':
        return f"mssql+pymssql://{config.username}:{config.password}@{host}:{port}/{config.database}"
    elif config.type == 'oracle':
        return f"oracle+oracledb://{config.username}:{config.password}@{host}:{port}/?service_name={config.database}"
    return ""

def get_engine(config: ConnectionConfig, **kwargs) -> Engine:
    local_port = None
    
    # Handle SSH Tunnel
    if config.ssh and config.ssh.enabled:
        tunnel = tunnel_manager.get_tunnel(config)
        if tunnel:
            local_port = tunnel.local_bind_port
            print(f"Using SSH Tunnel: 127.0.0.1:{local_port} -> {config.host}:{config.port}")

    url = get_connection_url(config, local_port)
    
    # Add connect_args for timeout where possible
    connect_args = {}
    if config.type == 'postgresql':
        connect_args = {"connect_timeout": 5}
    elif config.type == 'mysql':
        connect_args = {"connect_timeout": 5}
    
    return create_engine(url, connect_args=connect_args, pool_pre_ping=True, **kwargs)

def get_schema_context(config: ConnectionConfig) -> str:
    if config.type == 'redis':
        try:
            host = config.host
            port = config.port
            if config.ssh and config.ssh.enabled:
                tunnel = tunnel_manager.get_tunnel(config)
                host = "127.0.0.1"
                port = tunnel.local_bind_port

            r = redis.Redis(host=host, port=port, password=config.password or None, db=0, decode_responses=True)
            keys = r.keys("*")[:20] # Sample 20 keys
            context = ["Redis Database", f"Total Keys: {len(r.keys('*'))}", "Sample Keys:"]
            for k in keys:
                context.append(f"- {k} ({r.type(k)})")
            return "\n".join(context)
        except:
            return "Redis Database (Metadata unavailable)"
            
    if config.type == 'mongodb':
        try:
            host = config.host
            port = config.port
            if config.ssh and config.ssh.enabled:
                tunnel = tunnel_manager.get_tunnel(config)
                host = "127.0.0.1"
                port = tunnel.local_bind_port

            client = MongoClient(f"mongodb://{config.username}:{config.password}@{host}:{port}/" if config.username else f"mongodb://{host}:{port}/", serverSelectionTimeoutMS=2000)
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
        # Tunnel Setup for Test
        host = config.host
        port = config.port
        
        if config.ssh and config.ssh.enabled:
            tunnel = tunnel_manager.get_tunnel(config)
            host = "127.0.0.1"
            port = tunnel.local_bind_port

        if config.type == 'redis':
            r = redis.Redis(host=host, port=port, password=config.password or None, db=0, socket_connect_timeout=5)
            r.ping()
            return True, "Connected to Redis successfully"
        elif config.type == 'mongodb':
            client = MongoClient(f"mongodb://{config.username}:{config.password}@{host}:{port}/" if config.username else f"mongodb://{host}:{port}/", serverSelectionTimeoutMS=5000)
            client.admin.command('ping')
            return True, "Connected to MongoDB successfully"
        else:
            # SQL
            engine = get_engine(config) # get_engine handles tunnel logic internally now
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            return True, "Connected successfully"
    except Exception as e:
        return False, str(e)

def get_tables(config: ConnectionConfig) -> list[TableInfo]:
    if config.type == 'redis':
        # ... (Keep existing Redis implementation)
        try:
            host = config.host
            port = config.port
            if config.ssh and config.ssh.enabled:
                tunnel = tunnel_manager.get_tunnel(config)
                host = "127.0.0.1"
                port = tunnel.local_bind_port

            r = redis.Redis(host=host, port=port, password=config.password or None, db=0)
            try:
                dbs_count = int(r.config_get("databases")["databases"])
            except:
                dbs_count = 16 
            
            items = []
            for i in range(dbs_count):
                r_db = redis.Redis(host=host, port=port, password=config.password or None, db=i)
                if i == 0 or r_db.dbsize() > 0:
                    items.append(TableInfo(name=f"DB{i}", type="kv"))
            return items
        except:
            return [TableInfo(name="DB0", type="kv")]
    
    if config.type == 'mongodb':
        try:
            host = config.host
            port = config.port
            if config.ssh and config.ssh.enabled:
                tunnel = tunnel_manager.get_tunnel(config)
                host = "127.0.0.1"
                port = tunnel.local_bind_port

            client = MongoClient(f"mongodb://{config.username}:{config.password}@{host}:{port}/" if config.username else f"mongodb://{host}:{port}/", serverSelectionTimeoutMS=2000)
            
            # If database is "default" or empty, list all user databases
            if config.database in ["default", "", "admin", "local", "config"]:
                dbs = client.list_database_names()
                return [TableInfo(name=db, type="collection") for db in dbs if db not in ["admin", "local", "config"]]
            
            db = client[config.database]
            return [TableInfo(name=col, type="collection") for col in db.list_collection_names()]
        except:
            return []

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
    if config.type == 'redis':
        return []

    if config.type == 'mongodb':
        try:
            client = MongoClient(f"mongodb://{config.username}:{config.password}@{config.host}:{config.port}/" if config.username else f"mongodb://{config.host}:{config.port}/", serverSelectionTimeoutMS=2000)
            db = client[config.database]
            schemas = []
            for col_name in db.list_collection_names():
                # Sample a document to infer "columns"
                sample = db[col_name].find_one()
                columns = []
                if sample:
                    for key, val in sample.items():
                        columns.append(ColumnInfo(
                            name=key,
                            type=type(val).__name__,
                            nullable=True,
                            primary_key=(key == "_id")
                        ))
                schemas.append(TableSchema(
                    name=col_name,
                    columns=columns,
                    foreign_keys=[]
                ))
            return schemas
        except Exception as e:
            print(f"Error inspecting MongoDB schema: {e}")
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
            host = config.host
            port = config.port
            if config.ssh and config.ssh.enabled:
                tunnel = tunnel_manager.get_tunnel(config)
                host = "127.0.0.1"
                port = tunnel.local_bind_port
            
            r = redis.Redis(host=host, port=port, password=config.password or None, db=0)
            if object_name.upper() == 'FLUSHDB':
                r.flushdb()
                return {"success": True, "error": None}
            r.delete(object_name)
            return {"success": True, "error": None}

        if config.type == 'mongodb':
            host = config.host
            port = config.port
            if config.ssh and config.ssh.enabled:
                tunnel = tunnel_manager.get_tunnel(config)
                host = "127.0.0.1"
                port = tunnel.local_bind_port

            client = MongoClient(f"mongodb://{config.username}:{config.password}@{host}:{port}/" if config.username else f"mongodb://{host}:{port}/")
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
            host = config.host
            port = config.port
            if config.ssh and config.ssh.enabled:
                tunnel = tunnel_manager.get_tunnel(config)
                host = "127.0.0.1"
                port = tunnel.local_bind_port

            r = redis.Redis(host=host, port=port, password=config.password or None, db=0)
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
            host = config.host
            port = config.port
            if config.ssh and config.ssh.enabled:
                tunnel = tunnel_manager.get_tunnel(config)
                host = "127.0.0.1"
                port = tunnel.local_bind_port
            
            client = MongoClient(f"mongodb://{config.username}:{config.password}@{host}:{port}/" if config.username else f"mongodb://{host}:{port}/")
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
            # Handle DB selection from query string if it matches DB[0-9]+
            db_id = 0
            actual_query = query_str.strip()
            if actual_query.startswith("DB") and actual_query[2:].isdigit():
                db_id = int(actual_query[2:])
                actual_query = "KEYS *" # Default action for DB selection
            
            host = config.host
            port = config.port
            if config.ssh and config.ssh.enabled:
                tunnel = tunnel_manager.get_tunnel(config)
                host = "127.0.0.1"
                port = tunnel.local_bind_port

            r = redis.Redis(host=host, port=port, password=config.password or None, db=db_id, decode_responses=True)
            
            # Intercept SQL-like select for Redis
            if actual_query.upper().startswith("SELECT"):
                keys = r.keys("*")
                rows = [{"key": k, "type": r.type(k)} for k in keys]
                return {"columns": ["key", "type"], "rows": rows, "error": None}

            # Smart Fetch: If it's a single word and matches a key, get its content based on type
            if " " not in actual_query and actual_query not in ["KEYS", "FLUSHDB"]:
                key_type = r.type(actual_query)
                if key_type == "string":
                    val = r.get(actual_query)
                    return {"columns": ["value"], "rows": [{"value": val}], "error": None}
                elif key_type == "hash":
                    val = r.hgetall(actual_query)
                    rows = [{"field": k, "value": str(v)} for k, v in val.items()]
                    return {"columns": ["field", "value"], "rows": rows, "error": None}
                elif key_type == "list":
                    val = r.lrange(actual_query, 0, -1)
                    rows = [{"index": i, "value": v} for i, v in enumerate(val)]
                    return {"columns": ["index", "value"], "rows": rows, "error": None}
                elif key_type == "set":
                    val = r.smembers(actual_query)
                    rows = [{"value": v} for v in val]
                    return {"columns": ["value"], "rows": rows, "error": None}
                elif key_type == "zset":
                    val = r.zrange(actual_query, 0, -1, withscores=True)
                    rows = [{"value": v, "score": s} for v, s in val]
                    return {"columns": ["value", "score"], "rows": rows, "error": None}

            try:
                parts = shlex.split(actual_query)
            except ValueError:
                parts = actual_query.split()

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
            import ast
            host = config.host
            port = config.port
            if config.ssh and config.ssh.enabled:
                tunnel = tunnel_manager.get_tunnel(config)
                host = "127.0.0.1"
                port = tunnel.local_bind_port

            client = MongoClient(f"mongodb://{config.username}:{config.password}@{host}:{port}/" if config.username else f"mongodb://{host}:{port}/", serverSelectionTimeoutMS=2000)
            
            query_str = query_str.strip()
            
            # Smart Discovery: If the query matches a database name, list its collections
            all_dbs = client.list_database_names()
            if query_str in all_dbs:
                db = client[query_str]
                cols = db.list_collection_names()
                # Return db.collection format so context is preserved on next click
                rows = [{"collection": f"{query_str}.{c}"} for c in cols]
                return {"columns": ["collection"], "rows": rows, "error": None}

            # Parse query parts: db.collection.method(args)
            parts = query_str.split('.')
            
            # Default to config database
            db_name = config.database if config.database not in ["default", ""] else "admin"
            col_name = ""
            method = "find"
            args_str = "{}"

            if len(parts) == 1:
                # Just collection name
                col_name = parts[0]
            elif len(parts) >= 2:
                # Check if first part is a database
                if parts[0] in all_dbs:
                    db_name = parts[0]
                    col_name = parts[1]
                    if len(parts) > 2:
                        method_part = ".".join(parts[2:])
                else:
                    # First part is collection, second is method
                    col_name = parts[0]
                    method_part = ".".join(parts[1:])
            
            db = client[db_name]
            
            # Handle method and args if present (e.g. find({...}))
            if "." in query_str and "(" in query_str:
                # Extract method and args from the full string after the collection name
                # find the first dot after col_name
                col_index = query_str.find(col_name)
                method_area = query_str[col_index + len(col_name) + 1:]
                if "(" in method_area:
                    method = method_area.split('(')[0]
                    args_str = method_area[method_area.find('(')+1:method_area.rfind(')')]

            # Parse args
            try:
                args = ast.literal_eval(args_str) if args_str.strip() else {}
            except:
                try:
                    args = json.loads(args_str) if args_str.strip() else {}
                except:
                    args = {}

            if method == "aggregate":
                cursor = db[col_name].aggregate(args if isinstance(args, list) else [args])
            elif method == "count":
                count = db[col_name].count_documents(args)
                return {"columns": ["count"], "rows": [{"count": count}], "error": None}
            else:
                cursor = db[col_name].find(args).limit(50)
            
            rows = []
            for doc in cursor:
                doc['_id'] = str(doc['_id'])
                rows.append(doc)
            
            if not rows:
                return {"columns": [], "rows": [], "error": f"No documents found in {db_name}.{col_name}"}
            
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
            host = config.host
            port = config.port
            if config.ssh and config.ssh.enabled:
                tunnel = tunnel_manager.get_tunnel(config)
                host = "127.0.0.1"
                port = tunnel.local_bind_port

            r = redis.Redis(host=host, port=port, password=config.password or None, db=0)
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
            host = config.host
            port = config.port
            if config.ssh and config.ssh.enabled:
                tunnel = tunnel_manager.get_tunnel(config)
                host = "127.0.0.1"
                port = tunnel.local_bind_port

            client = MongoClient(f"mongodb://{config.username}:{config.password}@{host}:{port}/" if config.username else f"mongodb://{host}:{port}/")
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
            host = config.host
            port = config.port
            if config.ssh and config.ssh.enabled:
                tunnel = tunnel_manager.get_tunnel(config)
                host = "127.0.0.1"
                port = tunnel.local_bind_port
            
            r = redis.Redis(host=host, port=port, password=config.password or None, db=0, decode_responses=True)
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
            host = config.host
            port = config.port
            if config.ssh and config.ssh.enabled:
                tunnel = tunnel_manager.get_tunnel(config)
                host = "127.0.0.1"
                port = tunnel.local_bind_port

            client = MongoClient(f"mongodb://{config.username}:{config.password}@{host}:{port}/" if config.username else f"mongodb://{host}:{port}/")
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
            host = config.host
            port = config.port
            if config.ssh and config.ssh.enabled:
                tunnel = tunnel_manager.get_tunnel(config)
                host = "127.0.0.1"
                port = tunnel.local_bind_port

            r = redis.Redis(host=host, port=port, password=config.password or None, db=0)
            if request.action == 'rename_table': # We map 'rename_table' to rename key for Redis
                r.rename(request.table_name, request.new_table_name)
                return {"success": True, "message": f"Renamed key {request.table_name} to {request.new_table_name}"}
            return {"success": False, "error": f"Action {request.action} not supported for Redis"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    if config.type == 'mongodb':
        try:
            host = config.host
            port = config.port
            if config.ssh and config.ssh.enabled:
                tunnel = tunnel_manager.get_tunnel(config)
                host = "127.0.0.1"
                port = tunnel.local_bind_port

            client = MongoClient(f"mongodb://{config.username}:{config.password}@{host}:{port}/" if config.username else f"mongodb://{host}:{port}/")
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

def get_execution_plan(config: ConnectionConfig, query_str: str):
    """
    Runs EXPLAIN (JSON) for the given query and returns the raw plan data.
    """
    engine = get_engine(config)
    
    try:
        with engine.connect() as conn:
            if config.type == 'postgresql':
                # Postgres: EXPLAIN (FORMAT JSON)
                stmt = text(f"EXPLAIN (FORMAT JSON) {query_str}")
                result = conn.execute(stmt)
                # Postgres returns a list of rows, the first row contains the JSON
                plan_json = result.scalar() 
                return {"plan": plan_json, "dialect": "postgresql", "error": None}
                
            elif config.type == 'mysql':
                # MySQL: EXPLAIN FORMAT=JSON ...
                stmt = text(f"EXPLAIN FORMAT=JSON {query_str}")
                result = conn.execute(stmt)
                # MySQL returns a single string in the 'EXPLAIN' column
                row = result.fetchone()
                plan_json = row[0] if row else "{}"
                if isinstance(plan_json, str):
                    try:
                        plan_json = json.loads(plan_json)
                    except:
                        pass
                return {"plan": plan_json, "dialect": "mysql", "error": None}
                
            elif config.type == 'sqlite':
                # SQLite: EXPLAIN QUERY PLAN ...
                stmt = text(f"EXPLAIN QUERY PLAN {query_str}")
                result = conn.execute(stmt)
                rows = [dict(row._mapping) for row in result]
                return {"plan": rows, "dialect": "sqlite", "error": None}
            
            else:
                return {"plan": None, "dialect": config.type, "error": f"Visual Explain not supported for {config.type}"}
                
    except Exception as e:
        return {"plan": None, "dialect": config.type, "error": str(e)}