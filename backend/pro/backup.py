import os
import time
import json
from datetime import datetime
import database
from models import ConnectionConfig

BACKUP_DIR = "backups"

def backup_database(config: ConnectionConfig, output_dir: str = BACKUP_DIR, incremental: bool = False):
    """
    Creates a backup of the entire database (all tables).
    If incremental is True, it only backs up data modified since the last backup.
    Requires an 'updated_at' or 'timestamp' column in tables to work.
    """
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    metadata_path = os.path.join(output_dir, f"metadata_{config.id}.json")
    last_backup_time = None
    
    if incremental and os.path.exists(metadata_path):
        with open(metadata_path, "r") as f:
            metadata = json.load(f)
            last_backup_time = metadata.get("last_backup_time")

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    current_backup_iso = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    backup_path = os.path.join(output_dir, f"{config.name}_{timestamp}")
    if incremental:
        backup_path += "_incremental"
    os.makedirs(backup_path)
    
    report = {
        "timestamp": timestamp,
        "connection": config.name,
        "incremental": incremental,
        "last_backup_time": last_backup_time,
        "tables": [],
        "status": "success",
        "error": None
    }

    try:
        tables = database.get_tables(config)
        for table in tables:
            file_path = os.path.join(backup_path, f"{table.name}.json")
            
            where_clause = None
            ts_col_debug = None
            if incremental and last_backup_time:
                # Heuristic: find a timestamp column
                schema = database.get_schema_details(config)
                table_schema = next((s for s in schema if s.name == table.name), None)
                if table_schema:
                    ts_col = next((c.name for c in table_schema.columns if 'TIMESTAMP' in c.type.upper() or 'DATETIME' in c.type.upper() or c.name.lower() in ['updated_at', 'modified_at']), None)
                    if ts_col:
                        where_clause = f"{ts_col} > '{last_backup_time}'"
                        ts_col_debug = ts_col

            generator = database.stream_export_data(config, table.name, file_format="json", where_clause=where_clause)
            
            with open(file_path, "w") as f:
                for chunk in generator:
                    f.write(chunk)
            
            report["tables"].append(table.name)
            
        # Update metadata
        with open(metadata_path, "w") as f:
            json.dump({"last_backup_time": current_backup_iso}, f)
            
    except Exception as e:
        import traceback
        traceback.print_exc()
        report["status"] = "error"
        report["error"] = str(e)
        
    # Save report
    with open(os.path.join(backup_path, "backup_report.json"), "w") as f:
        json.dump(report, f, indent=2)
        
    return report