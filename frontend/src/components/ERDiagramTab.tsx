import { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  type Edge,
  type Node,
  Position,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  type NodeProps,
  addEdge,
  type Connection,
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { api, type TableSchema } from '../api';
import { cn } from '../lib/utils';
import { Loader2, RefreshCw, Plus, Save, Edit2, Trash2, X, Settings2 } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { ConfirmDialog } from './ui/ConfirmDialog';

// --- Custom Node ---
const TableNode = ({ data }: NodeProps) => {
  const isEditMode = data.editMode;
  
  return (
    <div className={cn(
        "border rounded-md bg-white dark:bg-slate-950 shadow-sm min-w-[200px]",
        isEditMode ? "border-blue-500 ring-1 ring-blue-500/20" : "border-slate-200 dark:border-slate-800"
    )}>
      {/* Target Handles (Incoming Foreign Keys) */}
      <Handle type="target" position={Position.Left} className="w-2 h-2 !bg-slate-400" />
      
      <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-t-md flex justify-between items-center">
        <div className="font-semibold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
           <div className="w-2 h-2 rounded-full bg-blue-500"></div>
           {data.label}
        </div>
        {isEditMode && (
            <Button variant="ghost" size="icon" className="h-5 w-5 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={(e) => {
                e.stopPropagation();
                data.onDelete?.(data.label);
            }}>
                <Trash2 className="w-3 h-3" />
            </Button>
        )}
      </div>
      
      <div className="p-2 space-y-1 max-h-[300px] overflow-y-auto">
        {data.columns.map((col: any) => (
            <div 
                key={col.name} 
                className={cn(
                    "flex items-center justify-between text-xs group p-1 rounded transition-colors",
                    isEditMode ? "hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer" : ""
                )}
                onClick={() => isEditMode && data.onEditColumn?.(data.label, col)}
            >
                <div className="flex items-center gap-1.5">
                    {col.primary_key && <span className="text-yellow-500 font-bold" title="Primary Key">🔑</span>}
                    <span className={cn("text-slate-700 dark:text-slate-300", col.primary_key && "font-medium")}>
                        {col.name}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-mono text-[10px]">{col.type}</span>
                    {isEditMode && (
                         <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                             <Button variant="ghost" size="icon" className="h-4 w-4" onClick={(e) => {
                                 e.stopPropagation();
                                 data.onEditColumn?.(data.label, col);
                             }}>
                                 <Settings2 className="w-2.5 h-2.5" />
                             </Button>
                             <Button variant="ghost" size="icon" className="h-4 w-4 text-red-500" onClick={(e) => {
                                 e.stopPropagation();
                                 data.onRemoveColumn?.(data.label, col.name);
                             }}>
                                 <X className="w-2.5 h-2.5" />
                             </Button>
                         </div>
                    )}
                </div>
            </div>
        ))}
        {isEditMode && (
            <Button 
                variant="ghost" 
                size="sm" 
                className="w-full h-6 text-[10px] mt-1 border-dashed border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900"
                onClick={() => data.onAddColumn?.(data.label)}
            >
                <Plus className="w-3 h-3 mr-1" /> Add Column
            </Button>
        )}
      </div>

      {/* Source Handles (Outgoing Foreign Keys) */}
      <Handle type="source" position={Position.Right} className="w-2 h-2 !bg-slate-400" />
    </div>
  );
};

const nodeTypes = {
  table: TableNode,
};

// --- Layout Helper ---
const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'LR') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const nodeWidth = 220;
  const nodeHeight = 200; // Approx

  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    // We are shifting the dagre node position (anchor=center center) to the top left
    // so it matches the React Flow node anchor point (top left).
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

interface ERDiagramTabProps {
  connectionId: string;
}

export function ERDiagramTab({ connectionId }: ERDiagramTabProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  // Dialog States
  const [isColumnDialogOpen, setIsColumnDialogOpen] = useState(false);
  const [isTableDialogOpen, setIsTableDialogOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  
  const [editingTable, setEditingTable] = useState<string | null>(null);
  const [editingColumn, setEditingColumn] = useState<any | null>(null);
  const [newTableName, setNewTableName] = useState('');
  const [columnForm, setColumnForm] = useState({ name: '', type: 'VARCHAR(255)', primary_key: false });

  const onAddColumn = useCallback((tableName: string) => {
    setEditingTable(tableName);
    setEditingColumn(null);
    setColumnForm({ name: '', type: 'VARCHAR(255)', primary_key: false });
    setIsColumnDialogOpen(true);
  }, []);

  const onEditColumn = useCallback((tableName: string, column: any) => {
    setEditingTable(tableName);
    setEditingColumn(column);
    setColumnForm({ ...column });
    setIsColumnDialogOpen(true);
  }, []);

  const saveColumn = () => {
    if (!columnForm.name) {
        toast.error("Column name is required");
        return;
    }

    setNodes((nds) => nds.map((node) => {
        if (node.id === editingTable) {
            const columns = [...node.data.columns];
            if (editingColumn) {
                // Update existing
                const idx = columns.findIndex(c => c.name === editingColumn.name);
                if (idx !== -1) columns[idx] = columnForm;
            } else {
                // Add new
                if (columns.some(c => c.name === columnForm.name)) {
                    toast.error("Column already exists");
                    return node;
                }
                columns.push(columnForm);
            }
            return { ...node, data: { ...node.data, columns } };
        }
        return node;
    }));
    setIsColumnDialogOpen(false);
  };

  const onRemoveColumn = useCallback((tableName: string, colName: string) => {
      setNodes((nds) => nds.map((node) => {
          if (node.id === tableName) {
              return {
                  ...node,
                  data: {
                      ...node.data,
                      columns: node.data.columns.filter((c: any) => c.name !== colName)
                  }
              };
          }
          return node;
      }));
  }, [setNodes]);

  const onDeleteTable = useCallback((tableName: string) => {
      setEditingTable(tableName);
      setIsConfirmDeleteOpen(true);
  }, []);

  const confirmDeleteTable = () => {
      if (!editingTable) return;
      setNodes((nds) => nds.filter((n) => n.id !== editingTable));
      setEdges((eds) => eds.filter((e) => e.source !== editingTable && e.target !== editingTable));
      setEditingTable(null);
  };

  const onAddTable = useCallback(() => {
      setNewTableName('');
      setIsTableDialogOpen(true);
  }, []);

  const confirmAddTable = () => {
      if (!newTableName) {
          toast.error("Table name is required");
          return;
      }
      
      const newNode: Node = {
          id: newTableName,
          type: 'table',
          position: { x: 100, y: 100 },
          data: {
              label: newTableName,
              columns: [{ name: 'id', type: 'INT', primary_key: true }],
              editMode: isEditMode,
              onAddColumn,
              onEditColumn,
              onRemoveColumn,
              onDelete: onDeleteTable
          }
      };
      setNodes((nds) => [...nds, newNode]);
      setIsTableDialogOpen(false);
  };

  const onConnect = useCallback((params: Connection) => {
      setEdges((eds) => addEdge({
          ...params,
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#94a3b8' },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' }
      }, eds));
  }, [setEdges]);

  const saveModel = async () => {
      toast.success("Design saved!", {
          description: "Generating DDL migration script... (Prototype: Migration shown in Sync tab)"
      });
      setIsEditMode(false);
  };

  const fetchAndLayout = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const schemas: TableSchema[] = await api.getSchemaDetails(connectionId);
      
      const newNodes: Node[] = schemas.map((schema) => ({
        id: schema.name,
        type: 'table',
        data: { 
            label: schema.name, 
            columns: schema.columns,
            editMode: isEditMode,
            onAddColumn,
            onEditColumn,
            onRemoveColumn,
            onDelete: onDeleteTable
        },
        position: { x: 0, y: 0 }, // Will be set by dagre
      }));

      // ... rest of fetchAndLayout

      const newEdges: Edge[] = [];
      schemas.forEach((schema) => {
          schema.foreign_keys.forEach((fk, idx) => {
              newEdges.push({
                  id: `e-${schema.name}-${fk.referred_table}-${idx}`,
                  source: schema.name,
                  target: fk.referred_table,
                  type: 'smoothstep',
                  animated: true,
                  style: { stroke: '#94a3b8' },
                  markerEnd: {
                      type: MarkerType.ArrowClosed,
                      color: '#94a3b8',
                  },
              });
          });
      });

      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        newNodes,
        newEdges
      );

      setNodes(layoutedNodes);
      setEdges(layoutedEdges);

    } catch (err: any) {
      setError(err.message || 'Failed to load schema');
    } finally {
      setLoading(false);
    }
  }, [connectionId, setNodes, setEdges, isEditMode, onAddColumn, onRemoveColumn, onDeleteTable]);

  useEffect(() => {
    fetchAndLayout();
  }, [fetchAndLayout]);

  // Update nodes when editMode changes
  useEffect(() => {
    setNodes((nds) => nds.map((node) => ({
        ...node,
        data: { ...node.data, editMode: isEditMode }
    })));
  }, [isEditMode, setNodes]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Generating Diagram...
      </div>
    );
  }

  if (error) {
    return (
        <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="text-red-500">Error: {error}</div>
            <Button variant="outline" onClick={fetchAndLayout}>Retry</Button>
        </div>
    );
  }

  return (
    <div className="h-full w-full relative group">
      <div className="absolute top-4 right-4 z-10 flex gap-2">
          {isEditMode ? (
              <>
                <Button variant="default" size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700" onClick={saveModel}>
                    <Save className="w-4 h-4" /> Save Design
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={onAddTable}>
                    <Plus className="w-4 h-4" /> Add Table
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setIsEditMode(false)}>
                    Cancel
                </Button>
              </>
          ) : (
              <Button variant="default" size="sm" className="gap-1.5" onClick={() => setIsEditMode(true)}>
                  <Edit2 className="w-4 h-4" /> Edit Model
              </Button>
          )}
          <Button variant="secondary" size="icon" onClick={fetchAndLayout} title="Refresh Diagram">
              <RefreshCw className="w-4 h-4" />
          </Button>
      </div>
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
      </ReactFlow>

      {/* --- Add/Edit Column Dialog --- */}
      <Dialog open={isColumnDialogOpen} onOpenChange={setIsColumnDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                  <DialogTitle>{editingColumn ? 'Edit Column' : 'Add Column'} to {editingTable}</DialogTitle>
                  <DialogDescription>
                      Define the column name and data type for this table.
                  </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="name" className="text-right text-xs">Name</Label>
                      <Input 
                        id="name" 
                        value={columnForm.name} 
                        onChange={e => setColumnForm({...columnForm, name: e.target.value})} 
                        className="col-span-3 h-8 text-xs" 
                        placeholder="e.g. user_email"
                      />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="type" className="text-right text-xs">Type</Label>
                      <Input 
                        id="type" 
                        value={columnForm.type} 
                        onChange={e => setColumnForm({...columnForm, type: e.target.value})} 
                        className="col-span-3 h-8 text-xs font-mono" 
                        placeholder="INT, TEXT, VARCHAR(255)..."
                      />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="pk" className="text-right text-xs">Primary Key</Label>
                      <div className="col-span-3 flex items-center">
                          <input 
                            type="checkbox" 
                            id="pk" 
                            checked={columnForm.primary_key} 
                            onChange={e => setColumnForm({...columnForm, primary_key: e.target.checked})}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                      </div>
                  </div>
              </div>
              <DialogFooter>
                  <Button variant="ghost" size="sm" onClick={() => setIsColumnDialogOpen(false)}>Cancel</Button>
                  <Button size="sm" onClick={saveColumn}>Save Changes</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

      {/* --- Add Table Dialog --- */}
      <Dialog open={isTableDialogOpen} onOpenChange={setIsTableDialogOpen}>
          <DialogContent className="sm:max-w-[400px]">
              <DialogHeader>
                  <DialogTitle>Create New Table</DialogTitle>
                  <DialogDescription>
                      Enter a name for the new table. It will be initialized with a primary key 'id'.
                  </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="tableName" className="text-right text-xs">Name</Label>
                      <Input 
                        id="tableName" 
                        value={newTableName} 
                        onChange={e => setNewTableName(e.target.value)} 
                        className="col-span-3 h-8 text-xs" 
                        placeholder="e.g. products"
                      />
                  </div>
              </div>
              <DialogFooter>
                  <Button variant="ghost" size="sm" onClick={() => setIsTableDialogOpen(false)}>Cancel</Button>
                  <Button size="sm" onClick={confirmAddTable}>Create Table</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

      {/* --- Confirm Delete Dialog --- */}
      <ConfirmDialog 
        open={isConfirmDeleteOpen}
        onOpenChange={setIsConfirmDeleteOpen}
        title={`Delete Table '${editingTable}'?`}
        description="Are you sure you want to remove this table from the model? This action cannot be undone."
        onConfirm={confirmDeleteTable}
        confirmText="Delete"
        variant="destructive"
      />
    </div>
  );
}
