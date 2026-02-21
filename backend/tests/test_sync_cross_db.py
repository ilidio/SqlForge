import pytest
from pro.sync import sync_schemas
from models import ConnectionConfig
from database import get_engine
from sqlalchemy import text, inspect

@pytest.fixture
def pg_config():
    return ConnectionConfig(
        id="pg-sync", name="Postgres", type="postgresql", 
        host="localhost", port=5432, username="admin", password="password", database="testdb"
    )

@pytest.fixture
def mysql_config():
    return ConnectionConfig(
        id="mysql-sync", name="MySQL", type="mysql", 
        host="localhost", port=3306, username="admin", password="password", database="testdb"
    )

def is_db_reachable(config):
    try:
        engine = get_engine(config)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except:
        return False

def test_cross_db_sync_pg_to_mysql(pg_config, mysql_config):
    if not is_db_reachable(pg_config) or not is_db_reachable(mysql_config):
        pytest.skip("Postgres or MySQL not reachable. Skipping cross-db sync test.")
        
    # 1. Setup: Create table in Postgres, ensure NOT in MySQL
    pg_engine = get_engine(pg_config)
    mysql_engine = get_engine(mysql_config)
    
    with pg_engine.begin() as conn:
        conn.execute(text("DROP TABLE IF EXISTS sync_test_table"))
        conn.execute(text("CREATE TABLE sync_test_table (id SERIAL PRIMARY KEY, val TEXT)"))
    
    with mysql_engine.begin() as conn:
        conn.execute(text("DROP TABLE IF EXISTS sync_test_table"))
    
    # Verify MySQL doesn't have it
    inspector = inspect(mysql_engine)
    assert "sync_test_table" not in inspector.get_table_names()
    
    # 2. Execute Sync
    result = sync_schemas(pg_config, mysql_config, dry_run=False)
    assert result["status"] == "success"
    
    # 3. Verify: MySQL should now have the table
    # We might need a small delay or fresh inspector
    inspector = inspect(mysql_engine)
    assert "sync_test_table" in [t.lower() for t in inspector.get_table_names()]
    
    # Cleanup
    with pg_engine.begin() as conn:
        conn.execute(text("DROP TABLE IF EXISTS sync_test_table"))
    with mysql_engine.begin() as conn:
        conn.execute(text("DROP TABLE IF EXISTS sync_test_table"))
