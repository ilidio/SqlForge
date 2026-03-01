import pytest
import sqlite3
import internal_db
from pro.transfer import transfer_data, transfer_all_tables
from models import ConnectionConfig

@pytest.fixture(autouse=True)
def init_db():
    internal_db.init_db()

@pytest.fixture
def sqlite_dbs(tmp_path):
    # Source DB with data
    source_path = str(tmp_path / "src_data.db")
    s_conn = sqlite3.connect(source_path)
    s_conn.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)")
    s_conn.execute("INSERT INTO users (name) VALUES ('Alice')")
    s_conn.execute("INSERT INTO users (name) VALUES ('Bob')")
    s_conn.commit()
    s_conn.close()
    
    # Target DB with same schema but empty
    target_path = str(tmp_path / "tgt_data.db")
    t_conn = sqlite3.connect(target_path)
    t_conn.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)")
    t_conn.commit()
    t_conn.close()
    
    return source_path, target_path

def test_transfer_single_table(sqlite_dbs):
    source_path, target_path = sqlite_dbs
    source_config = ConnectionConfig(id="s", name="S", type="sqlite", filepath=source_path, database="s")
    target_config = ConnectionConfig(id="t", name="T", type="sqlite", filepath=target_path, database="t")
    
    result = transfer_data(source_config, target_config, "users")
    assert result["status"] == "success"
    assert result["rows_transferred"] == 2
    
    # Verify target has data
    t_conn = sqlite3.connect(target_path)
    rows = t_conn.execute("SELECT name FROM users").fetchall()
    assert len(rows) == 2
    assert rows[0][0] == "Alice"
    t_conn.close()

def test_transfer_all_tables(sqlite_dbs):
    source_path, target_path = sqlite_dbs
    source_config = ConnectionConfig(id="s", name="S", type="sqlite", filepath=source_path, database="s")
    target_config = ConnectionConfig(id="t", name="T", type="sqlite", filepath=target_path, database="t")
    
    result = transfer_all_tables(source_config, target_config)
    assert result["status"] == "success"
    assert len(result["details"]) == 1 # only 'users' table
    assert result["details"][0]["table"] == "users"

from unittest.mock import patch, MagicMock

@patch("redis.Redis")
def test_transfer_mysql_to_redis_mock(mock_redis, tmp_path):
    # Setup source SQL (SQLite representing MySQL for simplicity in test)
    source_path = str(tmp_path / "sql_src.db")
    conn = sqlite3.connect(source_path)
    conn.execute("CREATE TABLE users (id INT, name TEXT)")
    conn.execute("INSERT INTO users VALUES (1, 'Ilidio')")
    conn.commit()
    conn.close()
    
    source_config = ConnectionConfig(id="s", type="sqlite", filepath=source_path, database="s", name="MySQL")
    target_config = ConnectionConfig(id="r", type="redis", host="localhost", port=6379, name="Redis")
    
    mock_r = MagicMock()
    mock_redis.return_value = mock_r
    pipe = mock_r.pipeline.return_value
    
    # Run transfer
    result = transfer_data(source_config, target_config, "users")
    
    assert result["status"] == "success"
    assert result["rows_transferred"] == 1
    # Verify Redis SET was called (via pipeline)
    pipe.set.assert_called_once()
    args, _ = pipe.set.call_args
    assert "users:1" in args[0]
    assert "Ilidio" in args[1]
