"""
Encryption helpers for secrets (connection passwords) persisted in the local
SQLite metadata store (`internal_db.py`).

Previously `ConnectionConfig.password` / `SSHConfig.password` were written to
`sqlforge_metadata.db` as plain text inside a JSON blob. Anyone with read
access to that file (or a backup of it) could read every stored database
password. This module encrypts those fields at rest using a locally
generated Fernet key that lives outside the metadata database, in the same
per-user data directory (`internal_db.get_data_dir()`).

Design notes:
- The key file (`secret.key`) is created on first use with 0600 permissions
  and is never written to the SQLite file or the git repo.
- Encrypted values are tagged with a small prefix (`ENC_PREFIX`) so we can
  tell them apart from legacy plaintext rows written before this change.
  Legacy plaintext values are returned as-is by `decrypt_value` and will be
  transparently re-encrypted the next time the connection is saved.
- `encrypt_value`/`decrypt_value` are no-ops for None/empty strings.
"""
import os
from cryptography.fernet import Fernet, InvalidToken

ENC_PREFIX = "enc:v1:"

_fernet_instance = None


def _key_path() -> str:
    # Imported lazily to avoid a circular import at module load time
    # (internal_db imports crypto_utils).
    from internal_db import get_data_dir
    return os.path.join(get_data_dir(), "secret.key")


def _load_or_create_key() -> bytes:
    path = _key_path()
    if os.path.exists(path):
        with open(path, "rb") as f:
            key = f.read().strip()
            if key:
                return key
    key = Fernet.generate_key()
    with open(path, "wb") as f:
        f.write(key)
    try:
        os.chmod(path, 0o600)
    except OSError:
        # Best-effort on platforms where chmod semantics differ (e.g. Windows).
        pass
    return key


def _get_fernet() -> Fernet:
    global _fernet_instance
    if _fernet_instance is None:
        _fernet_instance = Fernet(_load_or_create_key())
    return _fernet_instance


def reset_cached_key():
    """Test hook: forces the next encrypt/decrypt call to reload the key from disk."""
    global _fernet_instance
    _fernet_instance = None


def encrypt_value(value: str | None) -> str | None:
    if not value:
        return value
    if value.startswith(ENC_PREFIX):
        return value  # already encrypted; avoid double-wrapping
    token = _get_fernet().encrypt(value.encode("utf-8")).decode("utf-8")
    return ENC_PREFIX + token


def decrypt_value(value: str | None) -> str | None:
    if not value:
        return value
    if not value.startswith(ENC_PREFIX):
        # Legacy plaintext row from before encryption was introduced.
        return value
    token = value[len(ENC_PREFIX):]
    try:
        return _get_fernet().decrypt(token.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        # Corrupt value or key mismatch - surface the raw stored value rather
        # than crashing the caller; the connection test/use will simply fail
        # with a clear auth error instead of an opaque decryption error.
        return value
