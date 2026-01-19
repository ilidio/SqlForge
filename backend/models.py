from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class ConnectionConfig(BaseModel):
    id: Optional[str] = None
    name: str
    type: str # 'sqlite', 'postgresql'
    host: Optional[str] = None
    port: Optional[int] = None
    username: Optional[str] = None
    password: Optional[str] = None
    database: str
    filepath: Optional[str] = None # For SQLite

class QueryRequest(BaseModel):
    connection_id: str
    sql: str

class TableInfo(BaseModel):
    name: str
    schema: Optional[str] = None
    type: str # 'table' or 'view'

class ColumnInfo(BaseModel):
    name: str
    type: str
    primary_key: bool

class QueryResult(BaseModel):
    columns: List[str]
    rows: List[Dict[str, Any]]
    error: Optional[str] = None

class AIRequest(BaseModel):
    connection_id: str
    prompt: str
    api_key: str
    model: str = "gemini-3-flash-preview"
