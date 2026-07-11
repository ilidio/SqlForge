import pytest
from fastapi.testclient import TestClient
from pro import sync as pro_sync
from main import app

client = TestClient(app)


def test_get_dialect_maps_known_engine_types():
    assert pro_sync.get_dialect("postgresql") == "postgres"
    assert pro_sync.get_dialect("mysql") == "mysql"
    assert pro_sync.get_dialect("mssql") == "tsql"
    assert pro_sync.get_dialect("oracle") == "oracle"
    assert pro_sync.get_dialect("sqlite") == "sqlite"


def test_translate_sql_postgres_limit_to_mssql_top():
    # Postgres/MySQL-style LIMIT has no direct equivalent in T-SQL; sqlglot
    # rewrites it to TOP (N), which is the canonical example of why this
    # can't just be a text replace and needs a real dialect-aware transpile.
    result = pro_sync.translate_sql("SELECT id, name FROM users LIMIT 10", target_type="mssql", source_type="postgresql")
    assert result["error"] is None
    assert "TOP" in result["sql"].upper()
    assert result["source_dialect"] == "postgres"
    assert result["target_dialect"] == "tsql"


def test_translate_sql_mysql_backticks_to_postgres_quotes():
    result = pro_sync.translate_sql("SELECT `id` FROM `users`", target_type="postgresql", source_type="mysql")
    assert result["error"] is None
    assert "`" not in result["sql"]


def test_translate_sql_without_source_defaults_to_auto():
    result = pro_sync.translate_sql("SELECT 1", target_type="postgresql")
    assert result["error"] is None
    assert result["source_dialect"] == "auto"


def test_translate_sql_invalid_sql_returns_error_not_exception():
    result = pro_sync.translate_sql("SELECT FROM WHERE this is not sql (((", target_type="mysql", source_type="postgresql")
    assert result["error"] is not None
    # Falls back to echoing the original SQL rather than raising, so the
    # caller (e.g. the frontend) can show the error and let the user retry
    # with AI conversion instead.
    assert result["sql"] == "SELECT FROM WHERE this is not sql ((("


def test_translate_query_endpoint():
    response = client.post("/query/translate", json={
        "sql": "SELECT * FROM orders LIMIT 5",
        "source_type": "postgresql",
        "target_type": "mssql",
    })
    assert response.status_code == 200
    data = response.json()
    assert data["error"] is None
    assert "TOP" in data["sql"].upper()


def test_translate_query_endpoint_reports_parse_errors():
    response = client.post("/query/translate", json={
        "sql": "not, valid ( sql at all ---",
        "target_type": "mysql",
    })
    assert response.status_code == 200
    data = response.json()
    assert data["error"] is not None
