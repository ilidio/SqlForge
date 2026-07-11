import sqlite3
import pytest
import database
from models import ConnectionConfig


@pytest.fixture
def seeded_sqlite(tmp_path):
    db_file = str(tmp_path / "bounds.db")
    conn = sqlite3.connect(db_file)
    conn.execute("CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT)")
    conn.executemany("INSERT INTO items (id, name) VALUES (?, ?)", [(i, f"item-{i}") for i in range(1, 21)])
    conn.commit()
    conn.close()
    return ConnectionConfig(name="Bounds Test", type="sqlite", database="bounds.db", filepath=db_file)


def test_execute_query_truncates_when_over_limit(seeded_sqlite):
    result = database.execute_query(seeded_sqlite, "SELECT * FROM items", max_rows=5)
    assert result["error"] is None
    assert len(result["rows"]) == 5
    assert result["truncated"] is True
    assert result["row_limit"] == 5


def test_execute_query_not_truncated_when_under_limit(seeded_sqlite):
    result = database.execute_query(seeded_sqlite, "SELECT * FROM items", max_rows=100)
    assert result["error"] is None
    assert len(result["rows"]) == 20
    assert result["truncated"] is False


def test_execute_query_uses_default_cap_when_max_rows_omitted(seeded_sqlite):
    result = database.execute_query(seeded_sqlite, "SELECT * FROM items")
    assert result["error"] is None
    assert result["row_limit"] == database.DEFAULT_MAX_QUERY_ROWS
    assert result["truncated"] is False  # only 20 rows in the fixture, well under the default cap


def test_execute_query_ignores_non_positive_max_rows(seeded_sqlite):
    """max_rows=0 or negative should fall back to the server default, not fetch zero rows."""
    result = database.execute_query(seeded_sqlite, "SELECT * FROM items", max_rows=0)
    assert result["row_limit"] == database.DEFAULT_MAX_QUERY_ROWS
    assert len(result["rows"]) == 20


def test_execute_query_non_select_untouched(seeded_sqlite):
    result = database.execute_query(seeded_sqlite, "UPDATE items SET name = 'x' WHERE id = 1", max_rows=5)
    assert result["columns"] == []
    assert result["rows"] == []
    assert "successfully" in result["error"]
