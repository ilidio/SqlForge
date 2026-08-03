import sqlite3
import pytest
import database
from pro import transfer as pro_transfer
from models import ConnectionConfig, AlterTableRequest, ColumnDefinition


# --- Unit tests for the validators themselves ---

@pytest.mark.parametrize("name", ["users", "_private", "col1", "Order_Items", "a" * 40])
def test_validate_identifier_accepts_plain_names(name):
    assert database.validate_identifier(name) == name


@pytest.mark.parametrize("name", [
    "users; DROP TABLE users;--",
    "users)-- comment",
    "1users",
    "user name",
    "user-name",
    "user.name",
    "",
    None,
    "user`name",
    "user'name",
])
def test_validate_identifier_rejects_anything_else(name):
    with pytest.raises(ValueError):
        database.validate_identifier(name)


def test_validate_drop_type_accepts_whitelisted_keywords():
    assert database.validate_drop_type("table") == "TABLE"
    assert database.validate_drop_type("VIEW") == "VIEW"


def test_validate_drop_type_rejects_unknown_keywords():
    with pytest.raises(ValueError):
        database.validate_drop_type("TABLE; DROP DATABASE prod;--")
    with pytest.raises(ValueError):
        database.validate_drop_type("DATABASE")  # not in the whitelist


# --- Integration tests: a hostile name must not reach the database ---

@pytest.fixture
def seeded_sqlite(tmp_path):
    db_file = str(tmp_path / "identifiers.db")
    conn = sqlite3.connect(db_file)
    conn.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)")
    conn.execute("INSERT INTO users (id, name) VALUES (1, 'Alice')")
    conn.commit()
    conn.close()
    return ConnectionConfig(name="ident test", type="sqlite", database="identifiers.db", filepath=db_file), db_file


def _table_still_exists(db_file, table="users"):
    conn = sqlite3.connect(db_file)
    try:
        cur = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,))
        return cur.fetchone() is not None
    finally:
        conn.close()


def test_drop_object_rejects_hostile_object_name(seeded_sqlite):
    config, db_file = seeded_sqlite
    result = database.drop_object(config, "users; DROP TABLE users;--", "table")
    assert result["success"] is False
    assert _table_still_exists(db_file), "the injected DROP must never have reached SQLite"


def test_drop_object_rejects_unknown_object_type(seeded_sqlite):
    config, db_file = seeded_sqlite
    result = database.drop_object(config, "users", "table; ATTACH DATABASE '/etc/passwd' AS x;--")
    assert result["success"] is False
    assert _table_still_exists(db_file)


def test_execute_batch_mutations_rejects_hostile_table_name(seeded_sqlite):
    config, db_file = seeded_sqlite
    ops = [{"type": "update", "table": "users; DROP TABLE users;--", "data": {"name": "Eve"}, "where": {"id": 1}}]
    results = database.execute_batch_mutations(config, ops)
    assert results[0]["success"] is False
    assert _table_still_exists(db_file)


def test_execute_batch_mutations_rejects_hostile_column_name(seeded_sqlite):
    config, db_file = seeded_sqlite
    ops = [{"type": "update", "table": "users", "data": {"name); DROP TABLE users;--": "Eve"}, "where": {"id": 1}}]
    results = database.execute_batch_mutations(config, ops)
    assert results[0]["success"] is False
    assert _table_still_exists(db_file)


def test_import_data_rejects_hostile_table_name(seeded_sqlite):
    config, db_file = seeded_sqlite
    csv_bytes = b"id,name\n2,Bob\n"
    result = database.import_data(config, "users; DROP TABLE users;--", csv_bytes, "csv", mode="append")
    assert result["success"] is False
    assert _table_still_exists(db_file)


def test_import_data_rejects_hostile_column_header(seeded_sqlite):
    config, db_file = seeded_sqlite
    csv_bytes = b"id,name); DROP TABLE users;--\n2,Bob\n"
    result = database.import_data(config, "users", csv_bytes, "csv", mode="append")
    assert result["success"] is False
    assert _table_still_exists(db_file)


def test_alter_table_rejects_hostile_table_name(seeded_sqlite):
    config, db_file = seeded_sqlite
    request = AlterTableRequest(
        connection_id=config.id or "x", table_name="users; DROP TABLE users;--",
        action="add_column", column_def=ColumnDefinition(name="age", type="INTEGER"),
    )
    result = database.alter_table(config, request)
    assert result["success"] is False
    assert _table_still_exists(db_file)


def test_alter_table_rejects_hostile_column_name(seeded_sqlite):
    config, db_file = seeded_sqlite
    request = AlterTableRequest(
        connection_id=config.id or "x", table_name="users",
        action="add_column", column_def=ColumnDefinition(name="age); DROP TABLE users;--", type="INTEGER"),
    )
    result = database.alter_table(config, request)
    assert result["success"] is False
    assert _table_still_exists(db_file)


def test_transfer_get_data_from_source_rejects_hostile_table_name(seeded_sqlite):
    config, _ = seeded_sqlite
    with pytest.raises(ValueError):
        pro_transfer.get_data_from_source(config, "users; DROP TABLE users;--")


def test_transfer_write_data_to_target_rejects_hostile_table_name(seeded_sqlite):
    config, db_file = seeded_sqlite
    with pytest.raises(ValueError):
        pro_transfer.write_data_to_target(config, "users; DROP TABLE users;--", [{"id": 2, "name": "Bob"}])
    assert _table_still_exists(db_file)


def test_stream_export_data_rejects_hostile_table_name_eagerly(seeded_sqlite):
    config, _ = seeded_sqlite
    with pytest.raises(ValueError):
        # Should raise synchronously, before returning the generator, so an
        # API caller gets a clean error instead of a truncated download.
        database.stream_export_data(config, "users; DROP TABLE users;--", "csv")


# --- A legitimate name must keep working end-to-end ---

def test_legitimate_names_still_work(seeded_sqlite):
    config, db_file = seeded_sqlite
    result = database.execute_batch_mutations(config, [
        {"type": "update", "table": "users", "data": {"name": "Alicia"}, "where": {"id": 1}},
    ])
    assert result[0]["success"] is True

    conn = sqlite3.connect(db_file)
    row = conn.execute("SELECT name FROM users WHERE id = 1").fetchone()
    conn.close()
    assert row[0] == "Alicia"
