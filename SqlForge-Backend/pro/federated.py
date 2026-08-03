"""
Federated (cross-connection) query support.

The repo's earlier multi-DB audit (MULTI_DB_QUERY_AUDIT.md) identified this
as the single highest-leverage gap for a product that markets itself as a
"premium multi-database SQL client": every other query path in SqlForge
(`database.execute_query`, the sync engine, transfer, etc.) operates on
exactly one connection at a time. There was no way to `JOIN` data pulled
from two different connections/engines in a single statement.

This module closes that gap with the standard approach other tools use:
pull a bounded result set from each source connection through the existing
`database.execute_query` path (so it inherits whatever guardrails that path
already has), load each into an in-memory DuckDB table under a
caller-chosen alias, and let the caller write ordinary SQL against those
aliases - including joins/unions across engines that could otherwise never
talk to each other (e.g. a Postgres table joined to a MySQL table).
"""
import re
from typing import Any, Dict, List, Optional

import duckdb
import pandas as pd

import database
import internal_db

_ALIAS_RE = re.compile(r'^[A-Za-z_][A-Za-z0-9_]*$')
DEFAULT_MAX_ROWS = 5000


def _to_native(value: Any) -> Any:
    """DuckDB/pandas can hand back numpy scalar types (int64, etc.) that
    FastAPI's default JSON encoder doesn't know how to serialize."""
    if hasattr(value, "item"):
        try:
            return value.item()
        except Exception:
            return value
    return value


def run_federated_query(sources: List[Dict[str, Any]], query: str, max_rows: Optional[int] = None) -> Dict[str, Any]:
    limit = max_rows if max_rows and max_rows > 0 else DEFAULT_MAX_ROWS
    source_summaries: List[Dict[str, Any]] = []

    if not sources:
        return {"columns": [], "rows": [], "error": "At least one source is required.", "truncated": False, "source_summaries": source_summaries}
    if not query or not query.strip():
        return {"columns": [], "rows": [], "error": "A federated query statement is required.", "truncated": False, "source_summaries": source_summaries}

    con = duckdb.connect(database=":memory:")
    try:
        seen_aliases = set()
        for source in sources:
            alias = source.get("alias") or ""
            connection_id = source.get("connection_id")
            source_sql = source.get("sql")

            if not _ALIAS_RE.match(alias):
                return {"columns": [], "rows": [], "error": f"Invalid source alias {alias!r}: use letters, digits and underscores only, and don't start with a digit.", "truncated": False, "source_summaries": source_summaries}
            if alias in seen_aliases:
                return {"columns": [], "rows": [], "error": f"Duplicate source alias: {alias!r}", "truncated": False, "source_summaries": source_summaries}
            seen_aliases.add(alias)

            if not source_sql or not source_sql.strip():
                return {"columns": [], "rows": [], "error": f"Source {alias!r} is missing a SQL statement.", "truncated": False, "source_summaries": source_summaries}

            config = internal_db.get_connection(connection_id)
            if not config:
                return {"columns": [], "rows": [], "error": f"Connection not found for source {alias!r} (id={connection_id}).", "truncated": False, "source_summaries": source_summaries}

            result = database.execute_query(config, source_sql)
            if result.get("error"):
                return {"columns": [], "rows": [], "error": f"Source {alias!r} failed: {result['error']}", "truncated": False, "source_summaries": source_summaries}

            df = pd.DataFrame(result.get("rows") or [], columns=result.get("columns") or None)
            con.register(alias, df)
            source_summaries.append({"alias": alias, "connection_id": connection_id, "rows": len(df)})

        try:
            result_df = con.execute(query).fetch_df()
        except Exception as e:
            return {"columns": [], "rows": [], "error": f"Federated query failed: {str(e)}", "truncated": False, "source_summaries": source_summaries}

        truncated = len(result_df) > limit
        if truncated:
            result_df = result_df.head(limit)

        columns = list(result_df.columns)
        rows = [
            {k: _to_native(v) for k, v in row.items()}
            for row in result_df.to_dict(orient="records")
        ]

        return {"columns": columns, "rows": rows, "error": None, "truncated": truncated, "source_summaries": source_summaries}
    finally:
        con.close()
