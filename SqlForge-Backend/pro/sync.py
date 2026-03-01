import sqlglot
from sqlglot import diff, transpile, parse_one, exp
from sqlglot.diff import Insert, Remove, Update
from sqlalchemy import inspect
from database import get_engine
from models import ConnectionConfig

def get_dialect(conn_type: str) -> str:
    mapping = {
        'postgresql': 'postgres',
        'mysql': 'mysql',
        'sqlite': 'sqlite',
        'mssql': 'tsql',
        'oracle': 'oracle'
    }
    return mapping.get(conn_type, 'sqlite')

def reflect_schema_to_sql(engine, dialect: str) -> str:
    """
    Reflects the database schema and generates a sequence of CREATE TABLE statements.
    """
    inspector = inspect(engine)
    ddl_statements = []
    
    for table_name in inspector.get_table_names():
        columns = inspector.get_columns(table_name)
        pk_constraint = inspector.get_pk_constraint(table_name)
        pks = pk_constraint.get('constrained_columns', [])
        
        column_defs = []
        for c in columns:
            col_name = c['name']
            col_type = str(c['type']).upper()
            
            # Basic normalization for common types to help sqlglot
            if "VARCHAR" in col_type: col_type = "VARCHAR(255)"
            if "INTEGER" in col_type: col_type = "INT"
            
            # Only include NOT NULL, most dialects default to nullable
            nullable = "NOT NULL" if not c.get('nullable', True) else ""
            
            col_def = f"{col_name} {col_type} {nullable}".strip()
            column_defs.append(col_def)
        
        if pks:
            column_defs.append(f"PRIMARY KEY ({', '.join(pks)})")
            
        column_defs_str = ",\n  ".join(column_defs)
        create_table = f"CREATE TABLE {table_name} (\n  {column_defs_str}\n);"
        ddl_statements.append(create_table)
        
    return "\n\n".join(ddl_statements)

def generate_alter_statements(table_name: str, target_expr: exp.Create, source_expr: exp.Create, dialect: str) -> list[str]:
    """
    Attempts to generate ALTER TABLE statements for differences between target and source.
    If it's too complex, it might return an empty list, signaling a need for fallback.
    """
    statements = []
    
    # Extract column definitions
    target_columns = {c.this.name.lower(): c for c in target_expr.this.expressions if isinstance(c, exp.ColumnDef)}
    source_columns = {c.this.name.lower(): c for c in source_expr.this.expressions if isinstance(c, exp.ColumnDef)}
    
    # 1. Add missing columns
    for col_name, col_def in source_columns.items():
        if col_name not in target_columns:
            # We need to transpile the ColumnDef to the target dialect
            col_sql = transpile(col_def.sql(), read=None, write=dialect)[0]
            statements.append(f"ALTER TABLE {table_name} ADD COLUMN {col_sql}")
            
    # 2. Remove extra columns (Careful! Destructive, but requested for sync)
    for col_name, col_def in target_columns.items():
        if col_name not in source_columns:
            statements.append(f"ALTER TABLE {table_name} DROP COLUMN {col_name}")
            
    # 3. Modify existing columns (Type changes, etc.)
    for col_name, s_col_def in source_columns.items():
        if col_name in target_columns:
            t_col_def = target_columns[col_name]
            # Compare SQL representation for a simple check
            if s_col_def.sql() != t_col_def.sql():
                # This varies a lot by dialect. 
                col_sql = transpile(s_col_def.sql(), read=None, write=dialect)[0]
                if dialect == 'postgres':
                    # Extract type from col_sql (basic heuristic)
                    parts = col_sql.split(' ')
                    col_type = parts[1] if len(parts) > 1 else "TEXT"
                    statements.append(f"ALTER TABLE {table_name} ALTER COLUMN {col_name} TYPE {col_type}")
                elif dialect == 'mysql':
                    statements.append(f"ALTER TABLE {table_name} MODIFY COLUMN {col_sql}")
                else:
                    # Fallback to full recreate if we don't know the ALTER syntax
                    return []
                    
    return statements

from typing import List
from models import ConnectionConfig, TableSchema

def schema_to_ddl(schemas: List[TableSchema], dialect: str) -> str:
    """
    Converts a list of TableSchema objects into a sequence of CREATE TABLE statements.
    """
    ddl_statements = []
    for schema in schemas:
        column_defs = []
        pks = []
        for c in schema.columns:
            # Basic normalization
            col_type = c.type.upper()
            if "VARCHAR" in col_type: col_type = "TEXT"
            if "INTEGER" in col_type: col_type = "INT"
            if "DECIMAL" in col_type: col_type = "REAL"
            
            if c.primary_key:
                pks.append(c.name)
            
            col_def = f"{c.name} {col_type}".strip()
            column_defs.append(col_def)
        
        if pks:
            column_defs.append(f"PRIMARY KEY ({', '.join(pks)})")
            
        column_defs_str = ",\n  ".join(column_defs)
        create_table = f"CREATE TABLE {schema.name} (\n  {column_defs_str}\n);"
        ddl_statements.append(create_table)
        
    return "\n\n".join(ddl_statements)

def diff_provided_schema_to_db(desired_schema: List[TableSchema], target_config: ConnectionConfig) -> dict:
    """
    Compares a provided schema list (from visual editor) against a target database.
    """
    try:
        target_engine = get_engine(target_config)
        target_dialect = get_dialect(target_config.type)
        
        # Source is our visual model converted to DDL
        source_ddl = schema_to_ddl(desired_schema, target_dialect)
        # Target is the current DB state
        target_ddl = reflect_schema_to_sql(target_engine, target_dialect)
        
        source_dialect = target_dialect # They match since we generated it for target
        
        return _perform_diff(source_ddl, target_ddl, source_dialect, target_dialect, "Visual Model", target_config.name)
    except Exception as e:
        import traceback
        return {"sql_text": f"-- Error: {str(e)}\n-- {traceback.format_exc()}", "statements": []}

def _perform_diff(source_ddl: str, target_ddl: str, source_dialect: str, target_dialect: str, source_name: str, target_name: str) -> dict:
    header = [
        f"-- Migration from {source_name} to {target_name}",
        f"-- Generated by SqlForge Forward Engineering",
        ""
    ]

    if not source_ddl:
        return {"sql_text": "\n".join(header + ["-- Source schema is empty."]), "statements": []}

    if source_ddl == target_ddl:
        return {"sql_text": "\n".join(header + ["-- No changes detected."]), "statements": []}

    # Use the same dialect for reading both if possible, or read source as target_dialect
    # since we generated it using target conventions in schema_to_ddl
    source_exprs = [e for e in sqlglot.parse(source_ddl, read=target_dialect) if e]
    target_exprs = [e for e in sqlglot.parse(target_ddl, read=target_dialect) if e]
    
    target_tables = {}
    for expr in target_exprs:
        if isinstance(expr, exp.Create) and isinstance(expr.this, (exp.Table, exp.Schema)):
            t_name = expr.this.this.name.lower() if isinstance(expr.this, exp.Schema) else expr.this.name.lower()
            target_tables[t_name] = expr
    
    final_sql_parts = []
    execution_statements = []
    
    for s_expr in source_exprs:
        if not isinstance(s_expr, exp.Create) or not isinstance(s_expr.this, (exp.Table, exp.Schema)):
            continue
            
        s_table = s_expr.this.this if isinstance(s_expr.this, exp.Schema) else s_expr.this
        table_name = s_table.name.lower()
        
        if table_name not in target_tables:
            transpiled = transpile(s_expr.sql(), read=source_dialect, write=target_dialect, pretty=True)[0]
            final_sql_parts.append(f"-- Create missing table: {table_name}\n{transpiled}\n")
            execution_statements.append(transpiled)
        else:
            t_expr = target_tables[table_name]
            changes = diff(t_expr, s_expr)
            if changes:
                alter_stmts = generate_alter_statements(table_name, t_expr, s_expr, target_dialect)
                if alter_stmts:
                    final_sql_parts.append(f"-- Alter existing table: {table_name}\n" + "\n".join(alter_stmts) + "\n")
                    execution_statements.extend(alter_stmts)
                else:
                    transpiled = transpile(s_expr.sql(), read=source_dialect, write=target_dialect, pretty=True)[0]
                    final_sql_parts.append(f"-- Recreate existing table (complex changes): {table_name}\n{transpiled}\n")
                    execution_statements.append(f"DROP TABLE IF EXISTS {table_name}")
                    execution_statements.append(transpiled)

    if not final_sql_parts:
        return {"sql_text": "\n".join(header + ["-- No structural changes detected."]), "statements": []}

    return {"sql_text": "\n".join(header + final_sql_parts), "statements": execution_statements}

def diff_schemas(source_config: ConnectionConfig, target_config: ConnectionConfig) -> dict:
    """
    Compares two schemas and returns SQL statements to migrate target to source.
    Returns: {"sql_text": str, "statements": list[str]}
    """
    try:
        source_engine = get_engine(source_config)
        target_engine = get_engine(target_config)
        
        source_dialect = get_dialect(source_config.type)
        target_dialect = get_dialect(target_config.type)
        
        source_ddl = reflect_schema_to_sql(source_engine, source_dialect)
        target_ddl = reflect_schema_to_sql(target_engine, target_dialect)
        
        return _perform_diff(source_ddl, target_ddl, source_dialect, target_dialect, source_config.name, target_config.name)
        
    except Exception as e:
        import traceback
        return {"sql_text": f"-- Error: {str(e)}\n-- {traceback.format_exc()}", "statements": []}

def sync_schemas(source_config: ConnectionConfig, target_config: ConnectionConfig, dry_run: bool = True):
    """
    Execute the sync process.
    """
    from sqlalchemy import text
    result = diff_schemas(source_config, target_config)
    sql_text = result["sql_text"]
    statements = result["statements"]
    
    if dry_run:
        return {"status": "success", "message": "Dry run completed", "sql": sql_text}
    
    if not statements:
        return {"status": "success", "message": "Nothing to synchronize", "sql": sql_text}

    try:
        target_engine = get_engine(target_config)
        with target_engine.begin() as conn:
            for stmt in statements:
                # Basic cleaning of statement for sqlalchemy
                clean_stmt = stmt.strip()
                if clean_stmt.endswith(';'):
                    clean_stmt = clean_stmt[:-1]
                if clean_stmt:
                    conn.execute(text(clean_stmt))
        
        return {"status": "success", "message": "Schema synchronization completed successfully.", "sql": sql_text}
    except Exception as e:
        return {"status": "error", "message": f"Synchronization failed: {str(e)}", "sql": sql_text}