import time
import threading
from unittest.mock import MagicMock, patch
import database
from models import ConnectionConfig


class _FakeRawConn:
    """Stands in for a DBAPI connection. Real drivers unblock a pending
    execute() call (with an exception) when their underlying socket is
    closed out from under them; this fake reproduces that contract via a
    polled flag so tests don't depend on a real, slow database driver."""

    def __init__(self):
        self.closed = False

    def close(self):
        self.closed = True


def _make_slow_engine(fake_raw_conn: _FakeRawConn, work_seconds: float = 5.0):
    mock_conn = MagicMock()
    mock_conn.connection = fake_raw_conn

    def _slow_execute(*args, **kwargs):
        waited = 0.0
        step = 0.02
        while waited < work_seconds:
            if fake_raw_conn.closed:
                raise RuntimeError("connection closed")
            time.sleep(step)
            waited += step
        mock_result = MagicMock()
        mock_result.returns_rows = True
        mock_result.keys.return_value = ["n"]
        row = MagicMock()
        row._mapping = {"n": 1}
        mock_result.__iter__.return_value = iter([row])
        return mock_result

    mock_conn.execute.side_effect = _slow_execute
    mock_engine = MagicMock()
    mock_engine.connect.return_value = mock_conn
    return mock_engine, mock_conn


def _slow_pg_config():
    return ConnectionConfig(
        name="slow", type="postgresql", host="h", port=5432,
        username="u", password="p", database="d",
    )


def test_cancel_query_returns_false_for_unknown_id():
    assert database.cancel_query("totally-unknown-id") is False
    assert database.is_query_cancelled("totally-unknown-id") is False


@patch('database.get_engine')
def test_execute_query_times_out_and_aborts_connection(mock_get_engine):
    fake_raw_conn = _FakeRawConn()
    mock_engine, _ = _make_slow_engine(fake_raw_conn, work_seconds=5.0)
    mock_get_engine.return_value = mock_engine

    start = time.time()
    result = database.execute_query(_slow_pg_config(), "SELECT pg_sleep(5)", timeout_seconds=0.2)
    elapsed = time.time() - start

    assert "timed out" in result["error"]
    assert elapsed < 3, "execute_query should return shortly after the timeout, not wait for the full query"
    assert fake_raw_conn.closed is True


@patch('database.get_engine')
def test_execute_query_can_be_cancelled_mid_flight(mock_get_engine):
    fake_raw_conn = _FakeRawConn()
    mock_engine, _ = _make_slow_engine(fake_raw_conn, work_seconds=5.0)
    mock_get_engine.return_value = mock_engine

    query_id = "cancel-me-123"
    result_holder = {}

    def _run():
        result_holder["result"] = database.execute_query(
            _slow_pg_config(), "SELECT pg_sleep(5)", query_id=query_id, timeout_seconds=30,
        )

    t = threading.Thread(target=_run)
    t.start()
    time.sleep(0.3)  # let execute_query register its connection first
    cancelled = database.cancel_query(query_id)
    t.join(timeout=5)

    assert cancelled is True
    assert not t.is_alive(), "execute_query should have returned once its connection was closed"
    assert result_holder["result"]["error"] == "Query was cancelled"


@patch('database.get_engine')
def test_execute_query_registers_and_unregisters_connection(mock_get_engine):
    fake_raw_conn = _FakeRawConn()

    mock_conn = MagicMock()
    mock_conn.connection = fake_raw_conn
    mock_result = MagicMock()
    mock_result.returns_rows = True
    mock_result.keys.return_value = ["n"]
    row = MagicMock()
    row._mapping = {"n": 1}
    mock_result.__iter__.return_value = iter([row])
    mock_conn.execute.return_value = mock_result

    mock_engine = MagicMock()
    mock_engine.connect.return_value = mock_conn
    mock_get_engine.return_value = mock_engine

    query_id = "fast-query-1"
    result = database.execute_query(_slow_pg_config(), "SELECT 1", query_id=query_id, timeout_seconds=5)

    assert result["error"] is None
    assert result["rows"] == [{"n": 1}]
    # Once the call returns, the registry entry must be cleaned up so a
    # stale cancel doesn't affect a later, unrelated query with the same id.
    assert database.cancel_query(query_id) is False
