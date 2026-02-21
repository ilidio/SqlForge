import pytest
import sqlite3
from pro.sync import diff_schemas, sync_schemas
from models import ConnectionConfig
from database import get_engine
from sqlalchemy import text

@pytest.fixture
def sqlite_dbs(tmp_path):
    s_path = str(tmp_path / "source.db")
    t_path = str(tmp_path / "target.db")
    
    # Create source with one table
    s_conn = sqlite3.connect(s_path)
    s_conn.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL)")
    s_conn.close()
    
    # Create empty target
    t_conn = sqlite3.connect(t_path)
    t_conn.close()
    
    return s_path, t_path

def test_sync_new_table(sqlite_dbs):
    source_path, target_path = sqlite_dbs
    source_config = ConnectionConfig(
        id="s1", name="Source", type="sqlite", filepath=source_path, database="source.db"
    )
    target_config = ConnectionConfig(
        id="t1", name="Target", type="sqlite", filepath=target_path, database="target.db"
    )
    
    # Diff should suggest creating 'users'
    result = diff_schemas(source_config, target_config)
    assert "create missing table: users" in result["sql_text"].lower()
    
    # Execute Sync
    res = sync_schemas(source_config, target_config, dry_run=False)
    assert res["status"] == "success"
    
    # Verify target has table
    target_engine = get_engine(target_config)
    with target_engine.connect() as conn:
        res = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='users'"))
        assert res.fetchone() is not None

def test_sync_identical_schemas(sqlite_dbs, tmp_path):
    source_path, _ = sqlite_dbs
    
    # Create a target identical to source
    target_path = str(tmp_path / "target_id.db")
    t_conn = sqlite3.connect(target_path)
    t_conn.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL)")
    t_conn.close()
    
    source_config = ConnectionConfig(
        id="s1", name="Source", type="sqlite", filepath=source_path, database="source.db"
    )
    target_config = ConnectionConfig(
        id="t1", name="Target", type="sqlite", filepath=target_path, database="target.db"
    )
    
    result = diff_schemas(source_config, target_config)
    sql = result["sql_text"]
    assert "no changes detected" in sql.lower()

def test_cross_dialect_transpilation_mock():
    # We test the logic of dialect mapping and transpilation without needing real PG/MySQL
    from unittest.mock import patch, MagicMock

    source_config = ConnectionConfig(id="pg", name="PG", type="postgresql", host="h", port=5432, database="db")
    target_config = ConnectionConfig(id="my", name="MY", type="mysql", host="h", port=3306, database="db")

    with patch("pro.sync.get_engine") as mock_get_engine:
        mock_source_engine = MagicMock()
        mock_target_engine = MagicMock()
        mock_get_engine.side_effect = [mock_source_engine, mock_target_engine]
        
        with patch("pro.sync.reflect_schema_to_sql") as mock_reflect:
            # Mock source having a table, target being empty
            mock_reflect.side_effect = ["CREATE TABLE users (id SERIAL PRIMARY KEY);", ""]

            result = diff_schemas(source_config, target_config)
            sql = result["sql_text"]
            
            assert "Migration from PG to MY" in sql
            assert "CREATE TABLE users" in sql