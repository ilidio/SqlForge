import os
import sqlite3
import pytest
from fastapi.testclient import TestClient

import internal_db
from models import ConnectionConfig
from pro import federated
from main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_metadata():
    if os.path.exists(internal_db.DB_PATH):
        os.remove(internal_db.DB_PATH)
    internal_db.init_db()
    yield
    if os.path.exists(internal_db.DB_PATH):
        os.remove(internal_db.DB_PATH)


@pytest.fixture
def two_sqlite_sources(tmp_path):
    """Two independent SQLite 'databases' standing in for two different
    engines/servers - orders in one, users in the other - with no way to
    JOIN them except by pulling both into a shared engine, which is exactly
    what run_federated_query does via DuckDB."""
    orders_db = str(tmp_path / "orders.db")
    conn = sqlite3.connect(orders_db)
    conn.execute("CREATE TABLE orders (id INTEGER PRIMARY KEY, user_id INTEGER, amount REAL)")
    conn.executemany("INSERT INTO orders VALUES (?, ?, ?)", [
        (1, 1, 100.0), (2, 1, 50.0), (3, 2, 75.0),
    ])
    conn.commit()
    conn.close()

    users_db = str(tmp_path / "users.db")
    conn = sqlite3.connect(users_db)
    conn.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)")
    conn.executemany("INSERT INTO users VALUES (?, ?)", [(1, "Alice"), (2, "Bob")])
    conn.commit()
    conn.close()

    orders_conn = ConnectionConfig(id="orders-src-id", name="orders-src", type="sqlite", database="orders.db", filepath=orders_db)
    users_conn = ConnectionConfig(id="users-src-id", name="users-src", type="sqlite", database="users.db", filepath=users_db)
    internal_db.save_connection(orders_conn)
    internal_db.save_connection(users_conn)

    return orders_conn.id, users_conn.id


def test_federated_query_joins_across_two_independent_databases(two_sqlite_sources):
    orders_id, users_id = two_sqlite_sources

    result = federated.run_federated_query(
        sources=[
            {"alias": "orders", "connection_id": orders_id, "sql": "SELECT * FROM orders"},
            {"alias": "users", "connection_id": users_id, "sql": "SELECT * FROM users"},
        ],
        query="SELECT u.name, SUM(o.amount) AS total FROM orders o JOIN users u ON o.user_id = u.id GROUP BY u.name ORDER BY u.name",
    )

    assert result["error"] is None
    assert result["columns"] == ["name", "total"]
    rows = {r["name"]: r["total"] for r in result["rows"]}
    assert rows == {"Alice": 150.0, "Bob": 75.0}
    assert len(result["source_summaries"]) == 2
    assert {s["alias"] for s in result["source_summaries"]} == {"orders", "users"}


def test_federated_query_endpoint_end_to_end(two_sqlite_sources):
    orders_id, users_id = two_sqlite_sources
    response = client.post("/query/federated", json={
        "sources": [
            {"alias": "orders", "connection_id": orders_id, "sql": "SELECT * FROM orders"},
            {"alias": "users", "connection_id": users_id, "sql": "SELECT * FROM users"},
        ],
        "query": "SELECT COUNT(*) AS n FROM orders o JOIN users u ON o.user_id = u.id",
    })
    assert response.status_code == 200
    data = response.json()
    assert data["error"] is None
    assert data["rows"][0]["n"] == 3


def test_federated_query_requires_at_least_one_source():
    result = federated.run_federated_query(sources=[], query="SELECT 1")
    assert "At least one source" in result["error"]


def test_federated_query_requires_a_query():
    result = federated.run_federated_query(sources=[{"alias": "a", "connection_id": "x", "sql": "SELECT 1"}], query="   ")
    assert "federated query statement" in result["error"]


def test_federated_query_rejects_hostile_alias(two_sqlite_sources):
    orders_id, _ = two_sqlite_sources
    result = federated.run_federated_query(
        sources=[{"alias": "orders; DROP TABLE x;--", "connection_id": orders_id, "sql": "SELECT * FROM orders"}],
        query="SELECT 1",
    )
    assert "Invalid source alias" in result["error"]


def test_federated_query_rejects_duplicate_alias(two_sqlite_sources):
    orders_id, users_id = two_sqlite_sources
    result = federated.run_federated_query(
        sources=[
            {"alias": "same", "connection_id": orders_id, "sql": "SELECT * FROM orders"},
            {"alias": "same", "connection_id": users_id, "sql": "SELECT * FROM users"},
        ],
        query="SELECT 1",
    )
    assert "Duplicate source alias" in result["error"]


def test_federated_query_reports_unknown_connection():
    result = federated.run_federated_query(
        sources=[{"alias": "a", "connection_id": "does-not-exist", "sql": "SELECT 1"}],
        query="SELECT * FROM a",
    )
    assert "Connection not found" in result["error"]


def test_federated_query_surfaces_source_sql_errors(two_sqlite_sources):
    orders_id, _ = two_sqlite_sources
    result = federated.run_federated_query(
        sources=[{"alias": "orders", "connection_id": orders_id, "sql": "SELECT * FROM not_a_real_table"}],
        query="SELECT * FROM orders",
    )
    assert "failed" in result["error"]


def test_federated_query_surfaces_join_query_errors(two_sqlite_sources):
    orders_id, _ = two_sqlite_sources
    result = federated.run_federated_query(
        sources=[{"alias": "orders", "connection_id": orders_id, "sql": "SELECT * FROM orders"}],
        query="SELECT * FROM this_alias_does_not_exist",
    )
    assert "Federated query failed" in result["error"]


def test_federated_query_truncates_large_results(two_sqlite_sources):
    orders_id, _ = two_sqlite_sources
    result = federated.run_federated_query(
        sources=[{"alias": "orders", "connection_id": orders_id, "sql": "SELECT * FROM orders"}],
        query="SELECT * FROM orders",
        max_rows=2,
    )
    assert result["error"] is None
    assert result["truncated"] is True
    assert len(result["rows"]) == 2
