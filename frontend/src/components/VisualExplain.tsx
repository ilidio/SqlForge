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
import { Activity, Clock, Filter, Layers, AlertTriangle, Search, Table } from 'lucide-react';

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
  const { label, type, cost, rows, actualRows, time, colorClass, isFullScan, isIndexScan } = data;
  
  // Cardinality Check
  const misestimate = actualRows && rows && (Math.abs(actualRows - rows) > 1000 || actualRows / rows > 10 || rows / actualRows > 10);
  
  const getIcon = () => {
      if (type.includes('Scan')) {
          return isFullScan ? <Table size={14} className="text-red-500" /> : <Search size={14} className="text-emerald-500" />;
      }
      if (type.includes('Join')) return <Layers size={14} className="text-purple-500" />;
      if (type.includes('Sort')) return <Filter size={14} className="text-orange-500" />;
      return <Activity size={14} className="text-slate-500" />;
  };

  return (
    <div className={cn("border-2 rounded-lg shadow-sm min-w-[220px] text-xs transition-colors relative", colorClass)}>
      <Handle type="target" position={Position.Top} className="w-2 h-2 !bg-slate-400" />
      
      {/* Visual IO Badges */}
      {isFullScan && (
          <div className="absolute -top-2.5 -right-2 bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold shadow-sm uppercase tracking-wide">
              Full Scan
          </div>
      )}
       {isIndexScan && (
          <div className="absolute -top-2.5 -right-2 bg-emerald-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold shadow-sm uppercase tracking-wide">
              Index
          </div>
      )}

      {/* Misestimate Badge */}
      {misestimate && (
           <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold shadow-sm flex items-center gap-1 z-10" title={`Estimated: ${rows}, Actual: ${actualRows}`}>
              <AlertTriangle size={10} /> Bad Estimate
          </div>
      )}

      <div className="px-3 py-2 border-b border-inherit/20 flex items-center gap-2 font-bold bg-white/50 dark:bg-black/20">
        {getIcon()}
        <span className="truncate" title={type}>{type}</span>
      </div>
      
      <div className="p-2 space-y-2">
        {label && <div className="text-[10px] text-muted-foreground truncate font-medium" title={label}>{label}</div>}
        
        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px]">
            <div className="flex flex-col">
                <span className="text-[9px] uppercase text-muted-foreground font-bold">Cost</span>
                <span className="font-mono">{cost ? cost.toFixed(1) : '-'}</span>
            </div>
            
             <div className="flex flex-col">
                <span className="text-[9px] uppercase text-muted-foreground font-bold">Rows (Est)</span>
                <span className="font-mono">{rows}</span>
            </div>

            {actualRows !== undefined && (
                <>
                 <div className="flex flex-col col-span-2 pt-1 mt-1 border-t border-dashed border-slate-200 dark:border-slate-700">
                    <span className="text-[9px] uppercase text-muted-foreground font-bold">Actual Rows</span>
                    <span className={cn("font-mono font-bold", misestimate ? "text-amber-600" : "text-emerald-600")}>
                        {actualRows}
                    </span>
                 </div>
                </>
            )}
        </div>
        
        {time && (
             <div className="flex items-center gap-1 mt-1 text-[10px] text-blue-600 dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded self-start">
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
export const parsePostgresPlan = (plan: any): { nodes: Node[], edges: Edge[] } => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    let idCounter = 0;
    let maxTotalCost = 0;

    const traverse = (node: any, parentId?: string) => {
        const id = `node-${idCounter++}`;
        const type = node['Node Type'];
        const cost = node['Total Cost'] || 0;
        const rows = node['Plan Rows'] || 0;
        const actualRows = node['Actual Rows']; // Only available with EXPLAIN ANALYZE
        const time = node['Actual Total Time']; // Only available with EXPLAIN ANALYZE
        
        let label = node['Relation Name'] || node['Index Name'] || '';
        if (!label && node['Output'] && node['Output'].length > 0) {
            // Fallback to output alias if relation name missing
             label = "Computed / Temp";
        }

        const isFullScan = type === 'Seq Scan';
        const isIndexScan = type.includes('Index Scan') || type.includes('Bitmap Heap Scan');

        if (cost > maxTotalCost) maxTotalCost = cost;

        nodes.push({
            id,
            type: 'planNode',
            data: { 
                label, 
                type, 
                cost, 
                rows,
                actualRows,
                time,
                isFullScan,
                isIndexScan,
                raw: node 
            },
            position: { x: 0, y: 0 }, 
        });

        if (parentId) {
            edges.push({
                id: `e-${parentId}-${id}`,
                source: parentId,
                target: id,
                type: 'smoothstep',
                markerEnd: { type: MarkerType.ArrowClosed },
                animated: true, 
                style: { strokeWidth: 1.5, stroke: '#94a3b8' }
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

// --- Parser: MySQL ---
export const parseMysqlPlan = (plan: any): { nodes: Node[], edges: Edge[] } => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    let idCounter = 0;
    let maxCost = 0;

    // MySQL JSON format is different. It usually starts with { "query_block": ... }
    
    const traverse = (node: any, parentId?: string) => {
        // MySQL structures are nested in various keys like 'table', 'nested_loop', etc.
        // We need to identify the "operation"
        
        let currentId = `node-${idCounter++}`;
        let label = '';
        let type = 'Unknown';
        let cost = 0;
        let rows = 0;
        let children: any[] = [];
        let isFullScan = false;
        let isIndexScan = false;

        // Extract Node Info based on keys
        if (node.query_block) {
            type = 'Query Block';
            label = `Select #${node.query_block.select_id}`;
            cost = parseFloat(node.query_block.cost_info?.query_cost || '0');
            // Recurse into query_block
            traverse(node.query_block, parentId);
            return; // query_block is a container, not a node in the visual tree usually, or we treat its content as the root
        } 
        
        if (node.table) {
            const t = node.table;
            type = t.access_type ? `Access: ${t.access_type.toUpperCase()}` : 'Table Access';
            label = t.table_name;
            cost = parseFloat(t.cost_info?.eval_cost || '0') + parseFloat(t.cost_info?.read_cost || '0');
            rows = parseInt(t.rows_examined_per_scan || '0');
            
            isFullScan = t.access_type === 'ALL';
            isIndexScan = ['ref', 'eq_ref', 'const', 'range', 'index'].includes(t.access_type);
        } else if (node.nested_loop) {
            type = 'Nested Loop Join';
            children = node.nested_loop;
        } else if (node.grouping_operation) {
             type = 'Grouping';
             children = [node.grouping_operation]; // Usually has nested table/nested_loop
        } else if (node.ordering_operation) {
            type = 'Ordering';
             children = [node.ordering_operation];
        }
        
        if (cost > maxCost) maxCost = cost;

        // If we identified a node type (other than wrapper query_block which returned early)
        nodes.push({
            id: currentId,
            type: 'planNode',
            data: { 
                label, 
                type, 
                cost, 
                rows,
                isFullScan,
                isIndexScan,
                raw: node 
            },
            position: { x: 0, y: 0 },
        });

        if (parentId) {
             edges.push({
                id: `e-${parentId}-${currentId}`,
                source: parentId,
                target: currentId,
                type: 'smoothstep',
                markerEnd: { type: MarkerType.ArrowClosed },
                animated: true,
                style: { strokeWidth: 1.5, stroke: '#94a3b8' }
            });
        }

        // Handle Children
        children.forEach(child => traverse(child, currentId));
    };

    if (plan.query_block) {
        // Start from children of query_block usually to avoid single root
        // But let's just traverse the root
        traverse(plan);
    } else {
        // Unknown structure or array
        console.warn("Unknown MySQL Plan Structure", plan);
    }

     // Apply colors
    nodes.forEach(n => {
        n.data.colorClass = getCostColor(n.data.cost, maxCost);
    });

    return { nodes, edges };
};


// --- Layout ---
const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  dagreGraph.setGraph({ rankdir: 'TB', ranksep: 80, nodesep: 50 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 240, height: 120 });
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
        x: nodeWithPosition.x - 120,
        y: nodeWithPosition.y - 60,
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
        
        try {
            if (dialect === 'postgresql') {
                data = parsePostgresPlan(plan);
            } else if (dialect === 'mysql') {
                data = parseMysqlPlan(plan);
            } else {
                console.warn(`Visual explain not fully supported for ${dialect}.`);
            }
        } catch (e) {
            console.error("Failed to parse plan", e);
        }

        if (data.nodes.length > 0) {
            const layout = getLayoutedElements(data.nodes, data.edges);
            setNodes(layout.nodes);
            setEdges(layout.edges);
        } else {
             setNodes([]);
             setEdges([]);
        }
    }, [plan, dialect, setNodes, setEdges]);

    return (
        <div className="h-full w-full bg-slate-50 dark:bg-slate-950 flex flex-col">
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
                <Panel position="top-left" className="bg-background/90 backdrop-blur p-3 rounded-lg border shadow-sm text-xs space-y-2">
                    <div className="font-bold border-b pb-1">Legend</div>
                    <div className="space-y-1">
                        <div className="font-semibold text-muted-foreground mb-1">Cost / Performance</div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-50 border-2 border-red-500 rounded"></div> High Relative Cost</div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-amber-50 border-2 border-amber-500 rounded"></div> Medium Cost</div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-emerald-50 border-2 border-emerald-500 rounded"></div> Low Cost</div>
                    </div>
                    <div className="space-y-1 pt-1 border-t">
                         <div className="font-semibold text-muted-foreground mb-1">Indicators</div>
                         <div className="flex items-center gap-2">
                             <span className="bg-red-500 text-white text-[9px] px-1 rounded-full">FULL SCAN</span>
                             <span>Table Scan (Slow)</span>
                         </div>
                         <div className="flex items-center gap-2">
                             <span className="bg-emerald-500 text-white text-[9px] px-1 rounded-full">INDEX</span>
                             <span>Index Seek (Fast)</span>
                         </div>
                         <div className="flex items-center gap-2">
                             <span className="bg-amber-500 text-white text-[9px] px-1 rounded-full"><AlertTriangle size={8}/></span>
                             <span>Cardinality Mismatch</span>
                         </div>
                    </div>
                </Panel>
            </ReactFlow>
        </div>
    );
}