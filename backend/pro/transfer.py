from sqlalchemy import text, inspect
from database import get_engine
from models import ConnectionConfig
import logging

logger = logging.getLogger(__name__)

def transfer_data(
    source_config: ConnectionConfig, 
    target_config: ConnectionConfig, 
    table_name: str,
    limit: int = 10000
):
    """
    Transfers data from source table to target table.
    Assumes target table already exists and has compatible schema.
    """
    try:
        source_engine = get_engine(source_config)
        target_engine = get_engine(target_config)
        
        # 1. Fetch data from source
        with source_engine.connect() as source_conn:
            # We use stream_results if supported, or just fetch in batches
            # For this implementation, we fetch up to 'limit' rows
            result = source_conn.execute(text(f"SELECT * FROM {table_name} LIMIT {limit}"))
            columns = result.keys()
            rows = [dict(row._mapping) for row in result]
            
        if not rows:
            return {"status": "success", "message": f"Source table {table_name} is empty. No data transferred.", "rows_transferred": 0}

        # 2. Insert into target
        # We use batch insertion for performance
        placeholders = ", ".join([f":{col}" for col in columns])
        insert_sql = f"INSERT INTO {table_name} ({', '.join(columns)}) VALUES ({placeholders})"
        
        total_transferred = 0
        batch_size = 1000
        
        with target_engine.begin() as target_conn:
            # Optional: Clear target table if requested? 
            # For now, we just append.
            
            for i in range(0, len(rows), batch_size):
                batch = rows[i:i + batch_size]
                target_conn.execute(text(insert_sql), batch)
                total_transferred += len(batch)
        
        return {
            "status": "success", 
            "message": f"Successfully transferred {total_transferred} rows from {source_config.name} to {target_config.name}.",
            "rows_transferred": total_transferred
        }

    except Exception as e:
        logger.error(f"Data transfer failed: {str(e)}")
        return {"status": "error", "message": f"Data transfer failed: {str(e)}", "rows_transferred": 0}

def transfer_all_tables(source_config: ConnectionConfig, target_config: ConnectionConfig):
    """
    Discover all tables in source and transfer them to target.
    """
    try:
        source_engine = get_engine(source_config)
        inspector = inspect(source_engine)
        tables = inspector.get_table_names()
        
        results = []
        for table in tables:
            res = transfer_data(source_config, target_config, table)
            results.append({"table": table, "result": res})
            
        return {
            "status": "success", 
            "message": f"Batch transfer completed for {len(tables)} tables.",
            "details": results
        }
    except Exception as e:
        return {"status": "error", "message": f"Batch transfer failed: {str(e)}"}
