import { useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  type Node,
  type Edge,
  Position,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  type NodeProps,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { cn } from '@/lib/utils';
import { Activity, Clock, Database, Filter, Layers } from 'lucide-react';

// --- Helper: Color Logic ---
const getCostColor = (cost: number, maxCost: number) => {
    if (maxCost === 0) return 'border-slate-200 bg-white dark:bg-slate-950';
    const ratio = cost / maxCost;
    if (ratio > 0.8) return 'border-red-500 bg-red-50 dark:bg-red-950/30';
    if (ratio > 0.4) return 'border-amber-500 bg-amber-50 dark:bg-amber-950/30';
    return 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30';
};

// --- Custom Node ---
const PlanNode = ({ data }: NodeProps) => {
  const { label, type, cost, rows, time, colorClass } = data;
  
  const getIcon = () => {
      if (type.includes('Scan')) return <Database size={14} className="text-blue-500" />;
      if (type.includes('Join')) return <Layers size={14} className="text-purple-500" />;
      if (type.includes('Sort')) return <Filter size={14} className="text-orange-500" />;
      return <Activity size={14} className="text-slate-500" />;
  };

  return (
    <div className={cn("border-2 rounded-lg shadow-sm min-w-[200px] text-xs transition-colors", colorClass)}>
      <Handle type="target" position={Position.Top} className="w-2 h-2 !bg-slate-400" />
      
      <div className="px-3 py-2 border-b border-inherit/20 flex items-center gap-2 font-bold">
        {getIcon()}
        <span className="truncate">{type}</span>
      </div>
      
      <div className="p-2 space-y-1">
        {label && <div className="text-[10px] text-muted-foreground truncate" title={label}>{label}</div>}
        
        <div className="grid grid-cols-2 gap-2 mt-2">
            <div className="flex flex-col">
                <span className="text-[9px] uppercase text-muted-foreground font-bold">Cost</span>
                <span className="font-mono">{cost ? cost.toFixed(1) : '-'}</span>
            </div>
            <div className="flex flex-col">
                <span className="text-[9px] uppercase text-muted-foreground font-bold">Rows</span>
                <span className="font-mono">{rows}</span>
            </div>
        </div>
        
        {time && (
             <div className="flex items-center gap-1 mt-1 text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                <Clock size={10} /> {time.toFixed(2)}ms
             </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="w-2 h-2 !bg-slate-400" />
    </div>
  );
};

const nodeTypes = {
  planNode: PlanNode,
};

// --- Parser: Postgres ---
const parsePostgresPlan = (plan: any): { nodes: Node[], edges: Edge[] } => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    let idCounter = 0;
    let maxTotalCost = 0;

    const traverse = (node: any, parentId?: string) => {
        const id = `node-${idCounter++}`;
        const type = node['Node Type'];
        const cost = node['Total Cost'] || 0;
        const rows = node['Plan Rows'] || 0;
        const label = node['Relation Name'] || node['Index Name'] || '';
        
        if (cost > maxTotalCost) maxTotalCost = cost;

        nodes.push({
            id,
            type: 'planNode',
            data: { 
                label, 
                type, 
                cost, 
                rows,
                raw: node 
            },
            position: { x: 0, y: 0 }, // Layout will fix this
        });

        if (parentId) {
            edges.push({
                id: `e-${parentId}-${id}`,
                source: parentId,
                target: id,
                type: 'smoothstep',
                markerEnd: { type: MarkerType.ArrowClosed },
                animated: true, // Data flows up
            });
        }

        if (node.Plans) {
            node.Plans.forEach((child: any) => traverse(child, id));
        }
    };

    if (Array.isArray(plan)) {
        plan.forEach((p) => traverse(p.Plan || p));
    } else {
        traverse(plan.Plan || plan);
    }

    // Apply colors
    nodes.forEach(n => {
        n.data.colorClass = getCostColor(n.data.cost, maxTotalCost);
    });

    return { nodes, edges };
};

// --- Layout ---
const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  // Direction: Bottom-Up (standard for plans usually, but Top-Down is easier to read as a tree)
  // Let's go Top-Down (Root node at top)
  dagreGraph.setGraph({ rankdir: 'TB' });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 220, height: 100 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - 110,
        y: nodeWithPosition.y - 50,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

interface VisualExplainProps {
    plan: any;
    dialect: string;
}

export function VisualExplain({ plan, dialect }: VisualExplainProps) {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    useEffect(() => {
        if (!plan) return;

        let data: { nodes: Node[], edges: Edge[] } = { nodes: [], edges: [] };
        
        if (dialect === 'postgresql') {
            data = parsePostgresPlan(plan);
        } else {
            // Fallback / Placeholder for others
            // Only simple visualization if not PG for now
            console.warn("Visual explain optimized for Postgres. Others might be basic.");
            // If we have a simple structure, we could try generic parsing, but for now empty
        }

        if (data.nodes.length > 0) {
            const layout = getLayoutedElements(data.nodes, data.edges);
            setNodes(layout.nodes);
            setEdges(layout.edges);
        }
    }, [plan, dialect, setNodes, setEdges]);

    return (
        <div className="h-full w-full bg-slate-50 dark:bg-slate-950">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                fitView
                attributionPosition="bottom-right"
            >
                <Background gap={16} size={1} />
                <Controls />
                <Panel position="top-left" className="bg-background/80 backdrop-blur p-2 rounded border shadow-sm text-xs">
                    <div className="font-bold mb-1">Cost Heatmap</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-50 border-2 border-red-500 rounded"></div> High Cost</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 bg-amber-50 border-2 border-amber-500 rounded"></div> Medium Cost</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 bg-emerald-50 border-2 border-emerald-500 rounded"></div> Low Cost</div>
                </Panel>
            </ReactFlow>
        </div>
    );
}
