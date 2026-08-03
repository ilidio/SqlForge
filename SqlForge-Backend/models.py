from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class SSHConfig(BaseModel):
    enabled: bool = False
    host: str
    port: int = 22
    username: str
    password: Optional[str] = None
    private_key_path: Optional[str] = None

class ConnectionConfig(BaseModel):
    id: Optional[str] = None
    name: str
    type: str # 'sqlite', 'postgresql', etc.
    host: Optional[str] = None
    port: Optional[int] = None
    username: Optional[str] = None
    password: Optional[str] = None
    database: Optional[str] = None
    filepath: Optional[str] = None # For SQLite
    ssh: Optional[SSHConfig] = None
    environment: Optional[str] = None  # e.g. 'development', 'staging', 'production' - UI hint only
    read_only: bool = False  # when true, the backend rejects mutating statements on this connection

class QueryRequest(BaseModel):
    connection_id: str
    sql: str
    analyze: bool = False
    max_rows: Optional[int] = None  # caps the result set; server default applies if omitted
    query_id: Optional[str] = None  # client-generated id, lets /query/cancel abort this run
    timeout_seconds: Optional[float] = None  # overrides the server default statement timeout

class CancelQueryRequest(BaseModel):
    query_id: str

class TranslateQueryRequest(BaseModel):
    sql: str
    target_type: str  # a ConnectionConfig.type value, e.g. 'postgresql', 'mysql'
    source_type: Optional[str] = None  # omit to let sqlglot auto-detect the source dialect

class TranslateQueryResult(BaseModel):
    sql: str
    error: Optional[str] = None
    source_dialect: str
    target_dialect: str

class TableInfo(BaseModel):
    name: str
    db_schema: Optional[str] = None
    type: str # 'table' or 'view'

class ColumnInfo(BaseModel):
    name: str
    type: str
    nullable: bool
    primary_key: bool

class ForeignKeyInfo(BaseModel):
    constrained_column: str
    referred_table: str
    referred_column: str

class IndexInfo(BaseModel):
    name: str
    columns: List[str]
    unique: bool = False

class TableSchema(BaseModel):
    name: str
    columns: List[ColumnInfo]
    foreign_keys: List[ForeignKeyInfo]
    indexes: List[IndexInfo] = []

class QueryResult(BaseModel):
    columns: List[str]
    rows: List[Dict[str, Any]]
    error: Optional[str] = None
    truncated: bool = False
    row_limit: Optional[int] = None

class FederatedSource(BaseModel):
    alias: str  # referenced as a table name inside the federated `query`
    connection_id: str
    sql: str  # the pull query run against this connection via the normal /query path

class FederatedQueryRequest(BaseModel):
    sources: List[FederatedSource]
    query: str  # DuckDB SQL, may reference every source's alias (e.g. a JOIN across them)
    max_rows: Optional[int] = None

class FederatedQueryResult(BaseModel):
    columns: List[str]
    rows: List[Dict[str, Any]]
    error: Optional[str] = None
    truncated: bool = False
    source_summaries: List[Dict[str, Any]] = []

class AIRequest(BaseModel):
    connection_id: str
    prompt: str
    api_key: str
    model: str = "gemini-3-flash-preview"
    task: Optional[str] = "refactor" # refactor, explain, optimize, format, fix, convert

class SyncRequest(BaseModel):
    source_connection_id: str
    target_connection_id: str
    mode: Optional[str] = "structure" # "structure", "data", "transfer"
    dry_run: bool = True

class ColumnDefinition(BaseModel):
    name: str
    type: str
    nullable: bool = True
    primary_key: bool = False
    default: Optional[str] = None

class AlterTableRequest(BaseModel):
    connection_id: str
    table_name: str
    action: str # 'add_column', 'drop_column', 'rename_column', 'alter_column'
    column_name: Optional[str] = None # Target column for drop/rename/alter
    new_column_name: Optional[str] = None # For rename
    column_def: Optional[ColumnDefinition] = None # For add/alter
