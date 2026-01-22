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

class QueryRequest(BaseModel):
    connection_id: str
    sql: str
    analyze: bool = False

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

class AIRequest(BaseModel):
    connection_id: str
    prompt: str
    api_key: str
    model: str = "gemini-3-flash-preview"

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
