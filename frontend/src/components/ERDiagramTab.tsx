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
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { api, type TableSchema } from '../api';
import { cn } from '../lib/utils';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';

// --- Custom Node ---
const TableNode = ({ data }: NodeProps) => {
  return (
    <div className="border border-slate-200 rounded-md bg-white dark:bg-slate-950 dark:border-slate-800 shadow-sm min-w-[200px]">
      {/* Target Handles (Incoming Foreign Keys) */}
      <Handle type="target" position={Position.Left} className="w-2 h-2 !bg-slate-400" />
      
      <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-t-md">
        <div className="font-semibold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
           <div className="w-2 h-2 rounded-full bg-blue-500"></div>
           {data.label}
        </div>
      </div>
      
      <div className="p-2 space-y-1 max-h-[300px] overflow-y-auto">
        {data.columns.map((col: any) => (
            <div key={col.name} className="flex items-center justify-between text-xs group">
                <div className="flex items-center gap-1.5">
                    {col.primary_key && <span className="text-yellow-500 font-bold" title="Primary Key">🔑</span>}
                    <span className={cn("text-slate-700 dark:text-slate-300", col.primary_key && "font-medium")}>
                        {col.name}
                    </span>
                </div>
                <span className="text-slate-400 font-mono text-[10px] ml-2">{col.type}</span>
            </div>
        ))}
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
            columns: schema.columns 
        },
        position: { x: 0, y: 0 }, // Will be set by dagre
      }));

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
  }, [connectionId, setNodes, setEdges]);

  useEffect(() => {
    fetchAndLayout();
  }, [fetchAndLayout]);

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
      <div className="absolute top-4 right-4 z-10">
          <Button variant="secondary" size="icon" onClick={fetchAndLayout} title="Refresh Diagram">
              <RefreshCw className="w-4 h-4" />
          </Button>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        className="bg-slate-50 dark:bg-slate-950"
      >
        <Background gap={16} size={1} />
        <Controls />
      </ReactFlow>
    </div>
  );
}
