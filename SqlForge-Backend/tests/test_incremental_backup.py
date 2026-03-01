import pytest
import os
import json
from datetime import datetime
from pro.backup import backup_database
from models import ConnectionConfig
from sqlalchemy import create_engine, text

def test_incremental_backup(tmp_path):
    # Setup a mock SQLite database
    db_path = str(tmp_path / "test.db")
    engine = create_engine(f"sqlite:///{db_path}")
    with engine.connect() as conn:
        conn.execute(text("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, updated_at TIMESTAMP)"))
        conn.execute(text("INSERT INTO users (name, updated_at) VALUES ('Alice', '2023-01-01 10:00:00')"))
        conn.commit()

    config = ConnectionConfig(id="test_conn", name="TestConn", type="sqlite", database="test.db", filepath=db_path)
    backup_dir = str(tmp_path / "backups")

    # 1. First full backup
    report1 = backup_database(config, output_dir=backup_dir, incremental=False)
    if report1["status"] != "success":
        print(f"Backup failed: {report1['error']}")
    assert report1["status"] == "success"
    assert "users" in report1["tables"]
    
    # Check that metadata was created
    metadata_path = os.path.join(backup_dir, "metadata_test_conn.json")
    assert os.path.exists(metadata_path)

    # 2. Add more data (with a future timestamp relative to report1)
    # We sleep > 1s to ensure the timestamp is strictly greater in second precision
    import time
    time.sleep(1.2)
    now_ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with engine.connect() as conn:
        conn.execute(text(f"INSERT INTO users (name, updated_at) VALUES ('Bob', '{now_ts}')"))
        conn.commit()

    # 3. Incremental backup
    report2 = backup_database(config, output_dir=backup_dir, incremental=True)
    assert report2["status"] == "success"
    assert report2["incremental"] is True
    assert report2["last_backup_time"] is not None
    
    # Verify that only Bob is in the incremental backup
    # Find the backup folder
    backup_folders = [f for f in os.listdir(backup_dir) if os.path.isdir(os.path.join(backup_dir, f))]
    inc_folder = next(f for f in backup_folders if "incremental" in f)
    users_file = os.path.join(backup_dir, inc_folder, "users.json")
    
    with open(users_file, "r") as f:
        data = json.load(f)
        assert len(data) == 1
        assert data[0]["name"] == "Bob"

if __name__ == "__main__":
    pytest.main([__file__])
