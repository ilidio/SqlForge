import os
import pytest
from fastapi.testclient import TestClient
import database
import internal_db
from models import ConnectionConfig
from main import app


@pytest.fixture(autouse=True)
def clean_engine_cache():
    database.dispose_all_engines()
    yield
    database.dispose_all_engines()


def _sqlite_config(conn_id="conn-1", filepath="/tmp/sqlforge_engine_cache_test.db"):
    return ConnectionConfig(id=conn_id, name="cache test", type="sqlite", database="test.db", filepath=filepath)


def test_get_engine_returns_same_instance_for_same_config():
    config = _sqlite_config()
    e1 = database.get_engine(config)
    e2 = database.get_engine(config)
    assert e1 is e2


def test_get_engine_returns_different_instance_for_different_config():
    e1 = database.get_engine(_sqlite_config(conn_id="a", filepath="/tmp/sqlforge_db_a.db"))
    e2 = database.get_engine(_sqlite_config(conn_id="b", filepath="/tmp/sqlforge_db_b.db"))
    assert e1 is not e2


def test_dispose_engine_forces_a_fresh_engine():
    config = _sqlite_config()
    e1 = database.get_engine(config)
    database.dispose_engine(config.id)
    e2 = database.get_engine(config)
    assert e1 is not e2


def test_dispose_engine_is_a_noop_for_unknown_id():
    # Should not raise even if nothing was ever cached for this id.
    database.dispose_engine("no-such-connection")


def test_dispose_all_engines_clears_cache():
    c1 = _sqlite_config(conn_id="a", filepath="/tmp/sqlforge_db_a.db")
    c2 = _sqlite_config(conn_id="b", filepath="/tmp/sqlforge_db_b.db")
    e1 = database.get_engine(c1)
    e2 = database.get_engine(c2)
    database.dispose_all_engines()
    assert database.get_engine(c1) is not e1
    assert database.get_engine(c2) is not e2


def test_kwargs_bypass_the_cache_without_polluting_it():
    config = _sqlite_config()
    cached = database.get_engine(config)
    one_off = database.get_engine(config, echo=True)
    assert one_off is not cached
    # A follow-up call with no kwargs still gets the original cached engine.
    assert database.get_engine(config) is cached


def test_editing_a_connection_invalidates_its_old_engine():
    """Mirrors the main.py flow: saving an edited connection calls
    dispose_engine(id) so a changed password/host can't reuse a stale pool."""
    config = _sqlite_config(conn_id="edit-me", filepath="/tmp/sqlforge_db_orig.db")
    old_engine = database.get_engine(config)

    edited = _sqlite_config(conn_id="edit-me", filepath="/tmp/sqlforge_db_new.db")
    database.dispose_engine(edited.id)
    new_engine = database.get_engine(edited)

    assert new_engine is not old_engine


@pytest.fixture
def clean_metadata():
    if os.path.exists(internal_db.DB_PATH):
        os.remove(internal_db.DB_PATH)
    internal_db.init_db()
    yield
    if os.path.exists(internal_db.DB_PATH):
        os.remove(internal_db.DB_PATH)


def test_editing_connection_via_api_invalidates_cached_engine(clean_metadata):
    """End-to-end: POST /connections (update) must call database.dispose_engine
    so a subsequent query can't reuse a pool built from the pre-edit config."""
    with TestClient(app) as client:
        created = client.post("/connections", json={
            "name": "Cache Invalidation Test",
            "type": "sqlite",
            "database": "orig.db",
            "filepath": "/tmp/sqlforge_api_cache_orig.db",
        }).json()

        config_before = internal_db.get_connection(created["id"])
        engine_before = database.get_engine(config_before)

        updated = dict(created)
        updated["filepath"] = "/tmp/sqlforge_api_cache_new.db"
        client.post("/connections", json=updated)

        config_after = internal_db.get_connection(created["id"])
        engine_after = database.get_engine(config_after)

        assert engine_after is not engine_before
