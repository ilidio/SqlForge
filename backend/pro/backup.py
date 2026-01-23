import os
import time
import json
from datetime import datetime
import database
from models import ConnectionConfig

BACKUP_DIR = "backups"

def backup_database(config: ConnectionConfig, output_dir: str = BACKUP_DIR):
    """
    Creates a backup of the entire database (all tables).
    For now, this exports all tables to JSON files in a timestamped folder.
    """
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = os.path.join(output_dir, f"{config.name}_{timestamp}")
    os.makedirs(backup_path)
    
    report = {
        "timestamp": timestamp,
        "connection": config.name,
        "tables": [],
        "status": "success",
        "error": None
    }

    try:
        tables = database.get_tables(config)
        for table in tables:
            # We use stream_export_data but consume it all here
            # In a real heavy-duty backup, we'd stream to file directly.
            # database.stream_export_data yields strings (CSV rows or JSON chunks)
            
            file_path = os.path.join(backup_path, f"{table.name}.json")
            
            # Use JSON for safer type preservation in backups
            generator = database.stream_export_data(config, table.name, format="json")
            
            with open(file_path, "w") as f:
                for chunk in generator:
                    f.write(chunk)
            
            report["tables"].append(table.name)
            
    except Exception as e:
        report["status"] = "error"
        report["error"] = str(e)
        
    # Save report
    with open(os.path.join(backup_path, "backup_report.json"), "w") as f:
        json.dump(report, f, indent=2)
        
    return report
