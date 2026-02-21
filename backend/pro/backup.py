import os
import time
import json
import subprocess
from datetime import datetime
import database
from models import ConnectionConfig

BACKUP_DIR = "backups"

def execute_sql_file(config: ConnectionConfig, file_path: str):
    """Executes a SQL file against the target connection."""
    if not os.path.exists(file_path):
        return {"status": "error", "message": "File not found"}
    
    try:
        with open(file_path, 'r') as f:
            sql = f.read()
        
        # Split by semicolon for basic execution if needed, 
        # or use engine.execute(text(sql)) for the whole block
        # For large dumps, we might need a more robust parser or use CLI tools.
        from sqlalchemy import text
        engine = database.get_engine(config)
        with engine.begin() as conn:
            # Simple approach: execute as a single block. 
            # Note: Some dialects might fail if multiple statements are passed without configuration.
            conn.execute(text(sql))
        
        return {"status": "success", "message": "SQL file executed successfully"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

def execute_redis_commands(config: ConnectionConfig, file_path: str):
    """Executes a file containing Redis commands (one per line)."""
    if not os.path.exists(file_path):
        return {"status": "error", "message": "File not found"}
    
    try:
        import redis
        import shlex
        r = redis.Redis(host=config.host, port=config.port, password=config.password or None, db=0)
        
        with open(file_path, 'r') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'): continue
                
                parts = shlex.split(line)
                r.execute_command(*parts)
        
        return {"status": "success", "message": "Redis commands executed successfully"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

def backup_database(config: ConnectionConfig, output_dir: str = BACKUP_DIR, incremental: bool = False, native: bool = True):
    """
    Creates a backup of the entire database.
    If native=True, uses CLI tools like pg_dump, mysqldump, mongodump if available.
    """
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_folder = os.path.join(output_dir, f"{config.name}_{timestamp}")
    os.makedirs(backup_folder)
    
    report = {
        "timestamp": timestamp,
        "connection": config.name,
        "type": config.type,
        "native": native,
        "status": "success",
        "file_path": None
    }

    try:
        if native:
            file_name = f"dump_{timestamp}.sql"
            full_path = os.path.join(backup_folder, file_name)
            
            if config.type == 'postgresql':
                env = os.environ.copy()
                if config.password: env["PGPASSWORD"] = config.password
                cmd = ["pg_dump", "-h", config.host, "-p", str(config.port), "-U", config.username, "-d", config.database, "-f", full_path]
                subprocess.run(cmd, env=env, check=True)
                report["file_path"] = full_path
                
            elif config.type == 'mysql':
                cmd = ["mysqldump", "-h", config.host, "-P", str(config.port), "-u", config.username, f"-p{config.password}", config.database, "--result-file=" + full_path]
                subprocess.run(cmd, check=True)
                report["file_path"] = full_path
                
            elif config.type == 'mongodb':
                # MongoDB uses mongodump, usually creating a folder
                mongo_path = os.path.join(backup_folder, "mongo_dump")
                cmd = ["mongodump", "--host", config.host, "--port", str(config.port), "--db", config.database, "--out", mongo_path]
                if config.username: cmd += ["--username", config.username, "--password", config.password]
                subprocess.run(cmd, check=True)
                report["file_path"] = mongo_path
                
            elif config.type == 'sqlite':
                # SQLite is just a file copy
                import shutil
                sqlite_path = os.path.join(backup_folder, "backup.db")
                shutil.copy2(config.filepath, sqlite_path)
                report["file_path"] = sqlite_path
            
            elif config.type == 'redis':
                # Redis uses SAVE command or copies rdb file
                # Simplest via CLI: redis-cli
                rdb_path = os.path.join(backup_folder, "dump.rdb")
                cmd = ["redis-cli", "-h", config.host, "-p", str(config.port), "--rdb", rdb_path]
                if config.password: cmd += ["-a", config.password]
                subprocess.run(cmd, check=True)
                report["file_path"] = rdb_path
            
            else:
                # Fallback to logical JSON backup
                return logical_json_backup(config, backup_folder, incremental)
        else:
            return logical_json_backup(config, backup_folder, incremental)
            
    except Exception as e:
        report["status"] = "error"
        report["error"] = str(e)
        
    return report

def logical_json_backup(config: ConnectionConfig, backup_path: str, incremental: bool):
    # (Moved existing logic here)
    metadata_path = os.path.join(os.path.dirname(backup_path), f"metadata_{config.id}.json")
    last_backup_time = None
    if incremental and os.path.exists(metadata_path):
        with open(metadata_path, "r") as f:
            last_backup_time = json.load(f).get("last_backup_time")

    current_backup_iso = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    report = {"status": "success", "tables": []}
    try:
        tables = database.get_tables(config)
        for table in tables:
            if table.type != 'table': continue
            file_path = os.path.join(backup_path, f"{table.name}.json")
            generator = database.stream_export_data(config, table.name, file_format="json")
            with open(file_path, "w") as f:
                for chunk in generator: f.write(chunk)
            report["tables"].append(table.name)
        
        with open(metadata_path, "w") as f:
            json.dump({"last_backup_time": current_backup_iso}, f)
    except Exception as e:
        report["status"] = "error"
        report["error"] = str(e)
    return report

def restore_database(config: ConnectionConfig, backup_path: str):
    """Restores a database from a backup file/folder."""
    try:
        if backup_path.endswith(".sql"):
            return execute_sql_file(config, backup_path)
        
        # Handle native formats
        if config.type == 'postgresql':
            env = os.environ.copy()
            if config.password: env["PGPASSWORD"] = config.password
            cmd = ["psql", "-h", config.host, "-p", str(config.port), "-U", config.username, "-d", config.database, "-f", backup_path]
            subprocess.run(cmd, env=env, check=True)
            
        elif config.type == 'mysql':
            cmd = ["mysql", "-h", config.host, "-P", str(config.port), "-u", config.username, f"-p{config.password}", config.database, "-e", f"source {backup_path}"]
            subprocess.run(cmd, check=True)
            
        elif config.type == 'mongodb':
            cmd = ["mongorestore", "--host", config.host, "--port", str(config.port), "--db", config.database, backup_path]
            if config.username: cmd += ["--username", config.username, "--password", config.password]
            subprocess.run(cmd, check=True)
            
        return {"status": "success", "message": "Restore completed"}
    except Exception as e:
        return {"status": "error", "message": str(e)}