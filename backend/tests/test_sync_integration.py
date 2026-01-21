import pytest
import sqlite3
import os
from pro.sync import diff_schemas, sync_schemas
from models import ConnectionConfig
import internal_db

@pytest.fixture(autouse=True)
def init_db():
    internal_db.init_db()

@pytest.fixture
def sqlite_dbs(tmp_path):
    # Create Source DB with a table
    source_path = str(tmp_path / "source.db")
    s_conn = sqlite3.connect(source_path)
    s_conn.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL)")
    s_conn.close()
    
    # Create Target DB empty
    target_path = str(tmp_path / "target.db")
    t_conn = sqlite3.connect(target_path)
    t_conn.close()
    
    return source_path, target_path

def test_sync_sqlite_to_sqlite(sqlite_dbs):
    source_path, target_path = sqlite_dbs
    source_config = ConnectionConfig(
        id="s1", name="Source", type="sqlite", filepath=source_path, database="source.db"
    )
    target_config = ConnectionConfig(
        id="t1", name="Target", type="sqlite", filepath=target_path, database="target.db"
    )
    
    # 1. Test Diff
    result = diff_schemas(source_config, target_config)
    sql = result["sql_text"]
    assert "CREATE TABLE users" in sql
    assert "INTEGER" in sql
    
    # 2. Test Sync Execute (Dry Run)
    result = sync_schemas(source_config, target_config, dry_run=True)
    assert result["status"] == "success"
    assert "CREATE TABLE users" in result["sql"]

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
    assert "identical" in sql.lower()

def test_cross_dialect_transpilation_mock():
    # We test the logic of dialect mapping and transpilation without needing real PG/MySQL
    # By providing configs of different types and checking if it attempts to use sqlglot correctly
    # Note: reflect_schema_to_sql still needs an engine, so we'd need to mock the engine/inspector
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
            
            assert "Migration from PG (postgresql) to MY (mysql)" in sql
            # Since we mocked reflect_schema_to_sql to return SERIAL (PG), 
            # and target is MySQL, sqlglot should ideally transpile to something MySQL-ish
            # or at least contain the source table in the output.
            assert "CREATE TABLE users" in sql
