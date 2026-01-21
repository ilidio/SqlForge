import { useCallback, useEffect, useState } from 'react';
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
import { api } from '../api';
import { Button } from './ui/button';
import { RefreshCw, Skull, AlertOctagon, User, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
import { ConfirmDialog } from './ui/ConfirmDialog';

// --- Custom Node ---
const LockNode = ({ data }: NodeProps) => {
  const { label, user, query, state, duration, is_blocking, onKill } = data;
  
  return (
    <ContextMenu>
        <ContextMenuTrigger>
            <div className={`border-2 rounded-lg shadow-sm min-w-[220px] text-xs transition-colors bg-white dark:bg-slate-950 ${is_blocking ? 'border-red-500' : 'border-slate-300'}`}>
            <Handle type="target" position={Position.Top} className="w-2 h-2 !bg-slate-400" />
            
            <div className={`px-3 py-2 border-b border-inherit/20 flex items-center gap-2 font-bold ${is_blocking ? 'bg-red-50 dark:bg-red-900/20 text-red-600' : 'bg-slate-50 dark:bg-slate-900'}`}>
                {is_blocking ? <AlertOctagon size={14} /> : <User size={14} />}
                <span className="truncate">{label}</span>
            </div>
            
            <div className="p-3 space-y-2">
                <div className="flex justify-between">
                    <span className="text-muted-foreground">User:</span>
                    <span className="font-mono">{user || '-'}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-muted-foreground">State:</span>
                    <span className={`uppercase font-bold ${state === 'active' ? 'text-green-600' : 'text-slate-500'}`}>{state || 'unknown'}</span>
                </div>
                {duration && (
                    <div className="flex items-center gap-1 text-amber-600 font-mono">
                        <Clock size={12} /> {duration}
                    </div>
                )}
                {query && (
                    <div className="mt-2 p-1.5 bg-muted/50 rounded border border-border/50 font-mono text-[10px] truncate max-w-[200px]" title={query}>
                        {query}
                    </div>
                )}
            </div>

            <Handle type="source" position={Position.Bottom} className="w-2 h-2 !bg-slate-400" />
            </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
            <ContextMenuItem className="text-destructive gap-2 focus:text-destructive" onClick={onKill}>
                <Skull size={14} /> Kill Session
            </ContextMenuItem>
        </ContextMenuContent>
    </ContextMenu>
  );
};

const nodeTypes = {
  lockNode: LockNode,
};

const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: 'TB' });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 240, height: 150 });
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
        y: nodeWithPosition.y - 75,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

interface LockVisualizerProps {
    connectionId: string;
}

export function LockVisualizer({ connectionId }: LockVisualizerProps) {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [loading, setLoading] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [killTarget, setKillTarget] = useState<string | null>(null);

    const fetchLocks = useCallback(async () => {
        setLoading(true);
        try {
            const data = await api.getLocks(connectionId);
            if (data.error) {
                toast.error(data.error);
                return;
            }

            if (data.nodes.length === 0) {
                setNodes([]);
                setEdges([]);
                return;
            }

            const flowNodes: Node[] = data.nodes.map(n => ({
                id: n.id,
                type: 'lockNode',
                data: { ...n, onKill: () => setKillTarget(n.id) },
                position: { x: 0, y: 0 }
            }));

            const flowEdges: Edge[] = data.edges.map(e => ({
                id: e.id,
                source: e.source,
                target: e.target,
                type: 'smoothstep',
                animated: true,
                style: { stroke: '#ef4444', strokeWidth: 2 },
                markerEnd: { type: MarkerType.ArrowClosed, color: '#ef4444' },
                label: 'BLOCKS',
                labelStyle: { fill: '#ef4444', fontWeight: 700 }
            }));

            const layout = getLayoutedElements(flowNodes, flowEdges);
            setNodes(layout.nodes);
            setEdges(layout.edges);

        } catch (e: any) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [connectionId, setNodes, setEdges]);

    useEffect(() => {
        fetchLocks();
        const interval = setInterval(fetchLocks, 5000);
        return () => clearInterval(interval);
    }, [fetchLocks, refreshKey]);

    const handleKill = async () => {
        if (!killTarget) return;
        try {
            await api.killSession(connectionId, killTarget);
            toast.success(`Session ${killTarget} killed.`);
            setRefreshKey(prev => prev + 1);
        } catch (e: any) {
            toast.error("Failed to kill session: " + e.message);
        } finally {
            setKillTarget(null);
        }
    };

    return (
        <div className="h-full w-full bg-slate-50 dark:bg-slate-950 relative">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                fitView
            >
                <Background gap={16} size={1} />
                <Controls />
                <Panel position="top-right" className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={fetchLocks} disabled={loading}>
                        <RefreshCw size={14} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </Panel>
                {nodes.length === 0 && !loading && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="text-center text-muted-foreground">
                            <CheckCircleIcon size={48} className="mx-auto mb-2 text-emerald-500 opacity-50" />
                            <p className="font-medium">No locks detected</p>
                            <p className="text-xs">The database is healthy.</p>
                        </div>
                    </div>
                )}
            </ReactFlow>

            <ConfirmDialog 
                open={!!killTarget} 
                onOpenChange={(o) => !o && setKillTarget(null)}
                title="Kill Session"
                description={`Are you sure you want to terminate session/process ${killTarget}? This will rollback any active transaction.`}
                confirmText="Kill Session"
                variant="destructive"
                onConfirm={handleKill}
            />
        </div>
    );
}

// Icon helper since I missed importing it
const CheckCircleIcon = ({ size, className }: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
);
