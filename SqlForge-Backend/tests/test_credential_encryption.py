import os
import sqlite3
import pytest
from internal_db import init_db, save_connection, get_connections, get_connection, DB_PATH
from models import ConnectionConfig, SSHConfig
import crypto_utils


@pytest.fixture(autouse=True)
def clean_metadata():
    key_path = crypto_utils._key_path()
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
    if os.path.exists(key_path):
        os.remove(key_path)
    crypto_utils.reset_cached_key()
    init_db()
    yield
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
    if os.path.exists(key_path):
        os.remove(key_path)
    crypto_utils.reset_cached_key()


def test_password_encrypted_at_rest_in_sqlite():
    config = ConnectionConfig(
        id="enc-1", name="Encrypted Test", type="postgresql",
        host="localhost", port=5432, username="admin", password="s3cr3t-pw",
        database="testdb",
    )
    save_connection(config)

    # Read the raw row directly, bypassing internal_db's decrypt path, to
    # simulate someone opening sqlforge_metadata.db with a plain SQLite tool.
    conn = sqlite3.connect(DB_PATH)
    raw = conn.execute("SELECT config FROM connections WHERE id = ?", ("enc-1",)).fetchone()[0]
    conn.close()

    assert "s3cr3t-pw" not in raw
    assert crypto_utils.ENC_PREFIX in raw


def test_password_roundtrips_through_save_and_get():
    config = ConnectionConfig(
        id="enc-2", name="Roundtrip", type="mysql",
        host="localhost", port=3306, username="root", password="hunter2",
        database="testdb",
    )
    save_connection(config)

    loaded = get_connection("enc-2")
    assert loaded.password == "hunter2"

    all_conns = get_connections()
    assert all_conns[0].password == "hunter2"


def test_ssh_password_also_encrypted():
    config = ConnectionConfig(
        id="enc-3", name="SSH Test", type="postgresql",
        host="db.internal", port=5432, username="admin", password="pw1",
        database="testdb",
        ssh=SSHConfig(enabled=True, host="bastion.example.com", username="tunnel", password="ssh-pw"),
    )
    save_connection(config)

    conn = sqlite3.connect(DB_PATH)
    raw = conn.execute("SELECT config FROM connections WHERE id = ?", ("enc-3",)).fetchone()[0]
    conn.close()
    assert "ssh-pw" not in raw

    loaded = get_connection("enc-3")
    assert loaded.ssh.password == "ssh-pw"


def test_legacy_plaintext_row_still_readable():
    """Rows written before encryption was introduced must not break on read."""
    config = ConnectionConfig(
        id="legacy-1", name="Legacy", type="sqlite", database="legacy.db", password="plain-old-pw",
    )
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        "INSERT OR REPLACE INTO connections (id, name, type, config) VALUES (?, ?, ?, ?)",
        (config.id, config.name, config.type, config.model_dump_json()),
    )
    conn.commit()
    conn.close()

    loaded = get_connection("legacy-1")
    assert loaded.password == "plain-old-pw"


def test_encrypt_value_is_idempotent_and_reversible():
    enc = crypto_utils.encrypt_value("hello")
    assert enc != "hello"
    assert enc.startswith(crypto_utils.ENC_PREFIX)
    # Re-encrypting an already-encrypted value should not double-wrap it.
    assert crypto_utils.encrypt_value(enc) == enc
    assert crypto_utils.decrypt_value(enc) == "hello"


def test_encrypt_value_handles_none_and_empty():
    assert crypto_utils.encrypt_value(None) is None
    assert crypto_utils.encrypt_value("") == ""
    assert crypto_utils.decrypt_value(None) is None
    assert crypto_utils.decrypt_value("") == ""
