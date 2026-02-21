import { useCallback, useEffect, useState, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  type Node,
  Position,
  useNodesState,
  useEdgesState,
  Handle,
  type NodeProps,
  addEdge,
  type Connection,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { api, type TableSchema } from '../api';
import { cn } from '../lib/utils';
import { Loader2, Play, Code, Check } from 'lucide-react';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { toast } from 'sonner';

// --- Custom Node ---
const TableNode = ({ data, id }: NodeProps) => {
  const { label, columns, selectedColumns, onColumnToggle } = data;

  return (
    <div className="border border-slate-200 rounded-md bg-white dark:bg-slate-950 dark:border-slate-800 shadow-sm min-w-[220px]">
      <Handle type="target" position={Position.Left} className="w-2 h-2 !bg-slate-400" />
      
      <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-t-md flex justify-between items-center">
        <div className="font-semibold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
           <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
           {label}
        </div>
      </div>
      
      <div className="p-2 space-y-1 max-h-[300px] overflow-y-auto">
        {columns.map((col: any) => {
            const isSelected = selectedColumns[id]?.includes(col.name);
            return (
                <div key={col.name} className="flex items-center space-x-2 text-xs hover:bg-slate-100 dark:hover:bg-slate-900 p-1 rounded">
                    <Checkbox 
                        id={`${id}-${col.name}`}
                        checked={isSelected}
                        onCheckedChange={() => onColumnToggle(id, col.name)}
                        className="h-3.5 w-3.5"
                    />
                    <label 
                        htmlFor={`${id}-${col.name}`}
                        className={cn("flex-1 cursor-pointer truncate", isSelected ? "font-medium text-primary" : "text-slate-600 dark:text-slate-400")}
                        title={col.name}
                    >
                        {col.name}
                    </label>
                    <span className="text-[10px] text-slate-300 font-mono">{col.type}</span>
                </div>
            );
        })}
      </div>

      <Handle type="source" position={Position.Right} className="w-2 h-2 !bg-slate-400" />
    </div>
  );
};

interface QueryBuilderProps {
  connectionId: string;
  onRunQuery: (sql: string) => void;
}

export function QueryBuilder({ connectionId, onRunQuery }: QueryBuilderProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  
  // State for available schemas (for drag/drop or add list)
  const [availableTables, setAvailableTables] = useState<TableSchema[]>([]);
  
  // State for selected columns: { tableName: [col1, col2] }
  const [selectedColumns, setSelectedColumns] = useState<Record<string, string[]>>({});

  const nodeTypes = useMemo(() => ({
    table: TableNode,
  }), []);

  const handleColumnToggle = useCallback((tableName: string, colName: string) => {
    setSelectedColumns(prev => {
        const current = prev[tableName] || [];
        const exists = current.includes(colName);
        let updated;
        if (exists) {
            updated = current.filter(c => c !== colName);
        } else {
            updated = [...current, colName];
        }
        return { ...prev, [tableName]: updated };
    });
  }, []);

  // Update nodes data when selectedColumns changes so checkboxes re-render
  useEffect(() => {
    setNodes(nds => nds.map(node => ({
        ...node,
        data: {
            ...node.data,
            selectedColumns,
            onColumnToggle: handleColumnToggle
        }
    })));
  }, [selectedColumns, handleColumnToggle, setNodes]);

  const fetchSchema = useCallback(async () => {
    setLoading(true);
    try {
      const schemas: TableSchema[] = await api.getSchemaDetails(connectionId);
      setAvailableTables(schemas);
      
      // Initialize with a few tables if empty
      if (nodes.length === 0 && schemas.length > 0) {
          // Add first table automatically
          const t1 = schemas[0];
          const initialNode = {
            id: t1.name,
            type: 'table',
            position: { x: 100, y: 100 },
            data: { 
                label: t1.name, 
                columns: t1.columns,
                selectedColumns: {},
                onColumnToggle: handleColumnToggle
            },
          };
          setNodes([initialNode]);
      }
    } catch (err: any) {
      toast.error("Failed to load schema: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [connectionId, setNodes, handleColumnToggle, nodes.length]);

  useEffect(() => {
    fetchSchema();
  }, [fetchSchema]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, type: 'smoothstep', animated: true, label: 'JOIN' },eds)),
    [setEdges],
  );

  const generateSQL = () => {
    if (nodes.length === 0) return "-- No tables selected";

    const selectedTables = nodes.map(n => n.id);
    const joins: string[] = [];
    
    // 1. FROM Clause
    let fromClause = selectedTables[0];
    
    // 2. JOINs
    // Simple logic: If Edge A -> B, generates "JOIN B ON A.pk = B.fk" (Naive)
    // Better logic: Look at schema FKs or just generic ON 1=1 if unknown
    // Here we will infer based on the edge.
    
    edges.forEach(edge => {
        const source = edge.source;
        const target = edge.target;
        // Try to find a common column or FK
        // For now, placeholder
        joins.push(`JOIN ${target} ON ${source}.id = ${target}.${source.toLowerCase()}_id`);
    });

    // 3. SELECT Clause
    const selectParts: string[] = [];
    Object.entries(selectedColumns).forEach(([table, cols]) => {
        cols.forEach(col => selectParts.push(`${table}.${col}`));
    });
    
    const selectClause = selectParts.length > 0 ? selectParts.join(',\n  ') : '*';

    return `SELECT \n  ${selectClause} \nFROM ${fromClause}\n${joins.join('\n')}`;
  };

  const handleRun = () => {
      const sql = generateSQL();
      onRunQuery(sql);
  };

  const addTable = (schema: TableSchema) => {
      // Check if already exists
      if (nodes.find(n => n.id === schema.name)) return;

      const newNode: Node = {
          id: schema.name,
          type: 'table',
          position: { x: Math.random() * 400, y: Math.random() * 400 },
          data: {
              label: schema.name,
              columns: schema.columns,
              selectedColumns,
              onColumnToggle: handleColumnToggle
          }
      };
      setNodes(nds => [...nds, newNode]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Loading Builder...
      </div>
    );
  }

  return (
    <div className="h-full w-full flex">
        {/* Sidebar for adding tables */}
        <div className="w-48 border-r border-border bg-muted/20 overflow-y-auto p-2">
            <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Tables</h3>
            <div className="space-y-1">
                {availableTables.map(t => (
                    <Button 
                        key={t.name} 
                        variant="ghost" 
                        size="sm" 
                        className="w-full justify-start text-xs h-7"
                        onClick={() => addTable(t)}
                    >
                        {nodes.find(n => n.id === t.name) && <Check size={10} className="mr-2 text-green-500" />}
                        {t.name}
                    </Button>
                ))}
            </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 relative h-full">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                fitView
                className="bg-slate-50 dark:bg-slate-950"
            >
                <Background gap={16} size={1} />
                <Controls />
                <Panel position="top-right" className="bg-background/80 backdrop-blur border p-2 rounded-md shadow flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => {
                        const sql = generateSQL();
                        navigator.clipboard.writeText(sql);
                        toast.success("SQL copied to clipboard");
                    }}>
                        <Code size={14} className="mr-2" /> Copy SQL
                    </Button>
                    <Button size="sm" onClick={handleRun}>
                        <Play size={14} className="mr-2" /> Run Query
                    </Button>
                </Panel>
            </ReactFlow>
        </div>
    </div>
  );
}
