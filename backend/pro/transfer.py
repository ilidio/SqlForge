import logging
import json
import redis
from pymongo import MongoClient
from sqlalchemy import text, inspect
from database import get_engine
from models import ConnectionConfig

logger = logging.getLogger(__name__)

def get_data_from_source(config: ConnectionConfig, table_name: str, limit: int = 10000) -> list[dict]:
    """Helper to fetch rows from any supported source."""
    if config.type == 'redis':
        # For Redis, 'table_name' is interpreted as a key pattern or DB name
        db_id = int(table_name[2:]) if table_name.startswith("DB") else 0
        r = redis.Redis(host=config.host, port=config.port, password=config.password or None, db=db_id, decode_responses=True)
        keys = r.keys("*")[:limit]
        rows = []
        for k in keys:
            val = r.get(k)
            try:
                # Assume JSON for structured transfer
                data = json.loads(val)
                if isinstance(data, dict):
                    data['_key'] = k
                    rows.append(data)
                else:
                    rows.append({"key": k, "value": val})
            except:
                rows.append({"key": k, "value": val})
        return rows

    if config.type == 'mongodb':
        client = MongoClient(f"mongodb://{config.username}:{config.password}@{config.host}:{config.port}/" if config.username else f"mongodb://{config.host}:{config.port}/")
        db = client[config.database]
        cursor = db[table_name].find({}).limit(limit)
        rows = []
        for doc in cursor:
            doc['_id'] = str(doc['_id'])
            rows.append(doc)
        return rows

    # SQL
    engine = get_engine(config)
    with engine.connect() as conn:
        result = conn.execute(text(f"SELECT * FROM {table_name} LIMIT {limit}"))
        return [dict(row._mapping) for row in result]

def write_data_to_target(config: ConnectionConfig, table_name: str, rows: list[dict]):
    """Helper to write rows to any supported target."""
    if not rows: return 0

    if config.type == 'redis':
        db_id = int(table_name[2:]) if table_name.startswith("DB") else 0
        r = redis.Redis(host=config.host, port=config.port, password=config.password or None, db=db_id)
        pipe = r.pipeline()
        for i, row in enumerate(rows):
            # Generate a key: table_name:id or similar
            key_val = row.get('id') or row.get('_key') or row.get('_id') or i
            r_key = f"{table_name}:{key_val}"
            pipe.set(r_key, json.dumps(row, default=str))
        pipe.execute()
        return len(rows)

    if config.type == 'mongodb':
        client = MongoClient(f"mongodb://{config.username}:{config.password}@{config.host}:{config.port}/" if config.username else f"mongodb://{config.host}:{config.port}/")
        db = client[config.database]
        # Clean up _id if it's already there to avoid duplicates if re-transferring
        cleaned_rows = []
        for r in rows:
            new_r = r.copy()
            if '_id' in new_r: del new_r['_id']
            cleaned_rows.append(new_r)
        db[table_name].insert_many(cleaned_rows)
        return len(rows)

    # SQL
    engine = get_engine(config)
    columns = list(rows[0].keys())
    # SQL tables don't like MongoDB's _id or Redis specific keys usually
    columns = [c for c in columns if c not in ['_id', '_key']]
    
    placeholders = ", ".join([f":{col}" for col in columns])
    insert_sql = f"INSERT INTO {table_name} ({', '.join(columns)}) VALUES ({placeholders})"
    
    with engine.begin() as conn:
        # Filter rows to only contain relevant columns
        filtered_rows = []
        for r in rows:
            filtered_rows.append({col: r.get(col) for col in columns})
        conn.execute(text(insert_sql), filtered_rows)
    return len(rows)

def transfer_data(
    source_config: ConnectionConfig, 
    target_config: ConnectionConfig, 
    table_name: str,
    limit: int = 10000
):
    try:
        rows = get_data_from_source(source_config, table_name, limit)
        if not rows:
            return {"status": "success", "message": "No data found to transfer.", "rows_transferred": 0}
        
        # In NoSQL -> NoSQL, table_name is maintained. 
        # In SQL -> NoSQL, table_name is used as prefix.
        # In NoSQL -> SQL, we assume target table exists with table_name.
        count = write_data_to_target(target_config, table_name, rows)
        
        return {
            "status": "success", 
            "message": f"Successfully transferred {count} rows from {source_config.type} to {target_config.type}.",
            "rows_transferred": count
        }
    except Exception as e:
        logger.error(f"Transfer error: {str(e)}")
        return {"status": "error", "message": f"Transfer failed: {str(e)}", "rows_transferred": 0}

def transfer_all_tables(source_config: ConnectionConfig, target_config: ConnectionConfig):
    try:
        tables = []
        if source_config.type == 'redis':
            tables = ["DB0"] # For Redis we just sync DB0 by default
        elif source_config.type == 'mongodb':
            client = MongoClient(f"mongodb://{source_config.username}:{source_config.password}@{source_config.host}:{source_config.port}/" if source_config.username else f"mongodb://{source_config.host}:{source_config.port}/")
            db = client[source_config.database]
            tables = db.list_collection_names()
        else:
            engine = get_engine(source_config)
            tables = inspect(engine).get_table_names()
        
        results = []
        for table in tables:
            res = transfer_data(source_config, target_config, table)
            results.append({"table": table, "result": res})
            
        return {
            "status": "success", 
            "message": f"Cross-paradigm transfer completed.",
            "details": results
        }
    except Exception as e:
        return {"status": "error", "message": f"Batch transfer failed: {str(e)}"}
