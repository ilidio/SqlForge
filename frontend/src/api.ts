import axios from 'axios';

const API_URL = 'http://localhost:8000';

export interface ConnectionConfig {
  id?: string;
  name: string;
  type: 'sqlite' | 'postgresql' | 'mysql' | 'mssql' | 'oracle' | 'redis' | 'mongodb';
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database: string;
  filepath?: string;
}

export interface ForeignKeyInfo {
  constrained_column: string;
  referred_table: string;
  referred_column: string;
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  primary_key: boolean;
}

export interface TableSchema {
  name: string;
  columns: ColumnInfo[];
  foreign_keys: ForeignKeyInfo[];
}

export interface ColumnDefinition {
  name: string;
  type: string;
  nullable: boolean;
  primary_key: boolean;
  default?: string;
}

export interface AlterTableRequest {
  connection_id: string;
  table_name: string;
  action: 'add_column' | 'drop_column' | 'rename_column' | 'alter_column';
  column_name?: string;
  new_column_name?: string;
  column_def?: ColumnDefinition;
}

export const api = {
  getConnections: () => axios.get<ConnectionConfig[]>(`${API_URL}/connections`).then(r => r.data),
  saveConnection: (config: ConnectionConfig) => axios.post<ConnectionConfig>(`${API_URL}/connections`, config).then(r => r.data),
  deleteConnection: (connId: string) => axios.delete(`${API_URL}/connections/${connId}`).then(r => r.data),
  discoverConnections: () => axios.get<Partial<ConnectionConfig>[]>(`${API_URL}/connections/discover`).then(r => r.data),
  getAiModels: (apiKey: string) => axios.get<{name: string, display_name: string, description: string}[]>(`${API_URL}/ai/models`, { params: { api_key: apiKey } }).then(r => r.data),
  testConnection: (config: ConnectionConfig) => axios.post<{success: boolean, message: string}>(`${API_URL}/connections/test`, config).then(r => r.data),
  getTables: (connId: string) => axios.get<{name: string, type: string}[]>(`${API_URL}/connections/${connId}/tables`).then(r => r.data),
  getSchemaDetails: (connId: string) => axios.get<TableSchema[]>(`${API_URL}/connections/${connId}/schema`).then(r => r.data),
  alterTable: (connId: string, request: AlterTableRequest) => axios.post<{success: boolean, message: string}>(`${API_URL}/connections/${connId}/schema/alter`, request).then(r => r.data),
  dropObject: (connId: string, name: string, type: string) => axios.post(`${API_URL}/connections/${connId}/drop`, { name, type }).then(r => r.data),
  importData: (connId: string, tableName: string, file: File, mode: 'append' | 'truncate', format: 'csv' | 'json') => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mode', mode);
      formData.append('format', format);
      return axios.post<{success: boolean, message: string}>(`${API_URL}/connections/${connId}/import/${tableName}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
      }).then(r => r.data);
  },
  getExportUrl: (connId: string, tableName: string, format: 'csv' | 'json' | 'sql') => {
      // Return the direct URL for streaming
      return `${API_URL}/connections/${connId}/export/${tableName}?format=${format}`;
  },
  runQuery: (connId: string, sql: string) => axios.post<{columns: string[], rows: Record<string, unknown>[], error: string | null}>(`${API_URL}/query`, { connection_id: connId, sql }).then(r => r.data),
  runBatchQueries: (connId: string, operations: any[]) => axios.post<{results: {success: boolean, error: string | null}[]}>(`${API_URL}/query/batch`, { connection_id: connId, operations: operations }).then(r => r.data),
  getHistory: () => axios.get<{id: string, connection_id: string, sql: string, status: string, timestamp: string, duration_ms: number}[]>(`${API_URL}/history`).then(r => r.data),
  generateSQL: (connId: string, prompt: string, apiKey: string, model: string) => axios.post<{sql: string}>(`${API_URL}/ai/generate`, { connection_id: connId, prompt, api_key: apiKey, model }).then(r => r.data),
  diffSchemas: (sourceId: string, targetId: string) => axios.post<{sql: string}>(`${API_URL}/pro/sync/diff`, { source_connection_id: sourceId, target_connection_id: targetId }).then(r => r.data),
  executeSync: (sourceId: string, targetId: string, dryRun: boolean = true) => axios.post<{status: string, message: string, sql?: string}>(`${API_URL}/pro/sync/execute`, { source_connection_id: sourceId, target_connection_id: targetId, dry_run: dryRun }).then(r => r.data)
};
