import sqlite3
import pytest
import database
from models import ConnectionConfig, AlterTableRequest, ColumnDefinition

READ_ONLY = database.READ_ONLY_ERROR


# --- is_mutating_sql ---

@pytest.mark.parametrize("sql", [
    "SELECT * FROM users",
    "  select id from users",
    "-- a comment\nSELECT 1",
    "/* block comment */ SELECT 1",
    "WITH cte AS (SELECT 1) SELECT * FROM cte",
])
def test_is_mutating_sql_false_for_reads(sql):
    assert database.is_mutating_sql(sql) is False


@pytest.mark.parametrize("sql", [
    "INSERT INTO users (id) VALUES (1)",
    "update users set name='x'",
    "DELETE FROM users",
    "DROP TABLE users",
    "ALTER TABLE users ADD COLUMN age INT",
    "TRUNCATE TABLE users",
    "CREATE TABLE x (id INT)",
    "-- comment\nDELETE FROM users",
])
def test_is_mutating_sql_true_for_writes(sql):
    assert database.is_mutating_sql(sql) is True


# --- Integration: a read_only connection must reject mutations everywhere ---

@pytest.fixture
def seeded_sqlite():
    def _make(tmp_path, read_only: bool):
        db_file = str(tmp_path / "readonly.db")
        conn = sqlite3.connect(db_file)
        conn.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)")
        conn.execute("INSERT INTO users (id, name) VALUES (1, 'Alice')")
        conn.commit()
        conn.close()
        return ConnectionConfig(name="ro test", type="sqlite", database="readonly.db", filepath=db_file, read_only=read_only), db_file
    return _make


def _row_count(db_file):
    conn = sqlite3.connect(db_file)
    try:
        return conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    finally:
        conn.close()


def test_execute_query_select_allowed_when_read_only(tmp_path, seeded_sqlite):
    config, _ = seeded_sqlite(tmp_path, read_only=True)
    result = database.execute_query(config, "SELECT * FROM users")
    assert result["error"] is None
    assert len(result["rows"]) == 1


def test_execute_query_insert_blocked_when_read_only(tmp_path, seeded_sqlite):
    config, db_file = seeded_sqlite(tmp_path, read_only=True)
    result = database.execute_query(config, "INSERT INTO users (id, name) VALUES (2, 'Bob')")
    assert result["error"] == READ_ONLY
    assert _row_count(db_file) == 1


def test_execute_query_same_insert_allowed_when_not_read_only(tmp_path, seeded_sqlite):
    config, db_file = seeded_sqlite(tmp_path, read_only=False)
    result = database.execute_query(config, "INSERT INTO users (id, name) VALUES (2, 'Bob')")
    assert result["error"] is not None and "successfully" in result["error"]
    assert _row_count(db_file) == 2


def test_execute_batch_mutations_blocked_when_read_only(tmp_path, seeded_sqlite):
    config, db_file = seeded_sqlite(tmp_path, read_only=True)
    results = database.execute_batch_mutations(config, [
        {"type": "update", "table": "users", "data": {"name": "Eve"}, "where": {"id": 1}},
    ])
    assert results[0]["success"] is False
    assert results[0]["error"] == READ_ONLY
    conn = sqlite3.connect(db_file)
    name = conn.execute("SELECT name FROM users WHERE id = 1").fetchone()[0]
    conn.close()
    assert name == "Alice"


def test_import_data_blocked_when_read_only(tmp_path, seeded_sqlite):
    config, db_file = seeded_sqlite(tmp_path, read_only=True)
    result = database.import_data(config, "users", b"id,name\n2,Bob\n", "csv", mode="append")
    assert result["success"] is False
    assert result["error"] == READ_ONLY
    assert _row_count(db_file) == 1


def test_alter_table_blocked_when_read_only(tmp_path, seeded_sqlite):
    config, _ = seeded_sqlite(tmp_path, read_only=True)
    request = AlterTableRequest(
        connection_id=config.id or "x", table_name="users",
        action="add_column", column_def=ColumnDefinition(name="age", type="INTEGER"),
    )
    result = database.alter_table(config, request)
    assert result["success"] is False
    assert result["error"] == READ_ONLY


def test_drop_object_blocked_when_read_only(tmp_path, seeded_sqlite):
    config, db_file = seeded_sqlite(tmp_path, read_only=True)
    result = database.drop_object(config, "users", "table")
    assert result["success"] is False
    assert result["error"] == READ_ONLY
    conn = sqlite3.connect(db_file)
    exists = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").fetchone()
    conn.close()
    assert exists is not None


def test_default_read_only_is_false(tmp_path, seeded_sqlite):
    # Guards against a future default-flip: existing connections loaded
    # without the field (or via model defaults) must stay writable.
    config = ConnectionConfig(name="default", type="sqlite", database="x.db", filepath=str(tmp_path / "x.db"))
    assert config.read_only is False
