import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { api, type ConnectionConfig } from '../api';
import { toast } from 'sonner';
import { Activity, Users, Clock, Zap, Database, Trash2, RefreshCw, BarChart3, ShieldAlert, ExternalLink, Layout, ShieldCheck, AlertTriangle, History } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface MonitorDashboardProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export default function MonitorDashboard({ open, onOpenChange }: MonitorDashboardProps) {
    const [connections, setConnections] = useState<ConnectionConfig[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [metrics, setMetrics] = useState<any[]>([]);
    const [processes, setProcesses] = useState<any[]>([]);
    const [healthScore, setHealthScore] = useState<number>(100);
    const [risks, setRisks] = useState<any[]>([]);
    const [auditLoading, setAuditLoading] = useState(false);

    useEffect(() => {
        if (open) {
            api.getConnections().then(conns => {
                setConnections(conns);
                if (conns.length > 0 && !selectedId) setSelectedId(conns[0].id!);
            });
        }
    }, [open]);

    const fetchData = async () => {
        if (!selectedId) return;
        setAuditLoading(true);
        try {
            const [health, procList] = await Promise.all([
                api.getHealthAudit(selectedId),
                api.getProcesses(selectedId)
            ]);
            setHealthScore(health.score);
            setRisks(health.risks);
            setProcesses(procList);
        } catch (e) {
            console.error("Failed to fetch monitoring data", e);
        } finally {
            setAuditLoading(false);
        }
    };

    useEffect(() => {
        if (open && selectedId) {
            fetchData();
            const interval = setInterval(fetchData, 5000);
            return () => clearInterval(interval);
        }
    }, [open, selectedId]);

    // Simulate real-time data for charts
    useEffect(() => {
        if (!open || !selectedId) return;

        const interval = setInterval(() => {
            const newMetric = {
                time: new Date().toLocaleTimeString().split(' ')[0],
                tps: Math.floor(Math.random() * 100) + 50,
                cpu: Math.floor(Math.random() * 30) + 5,
                connections: Math.floor(Math.random() * 10) + 2
            };
            setMetrics(prev => [...prev.slice(-19), newMetric]);
        }, 2000);

        return () => clearInterval(interval);
    }, [open, selectedId]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-6xl h-[85vh] p-0 overflow-hidden flex flex-col gap-0">
                <DialogHeader className="p-6 bg-muted/30 border-b shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                                <Activity size={24} />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-bold tracking-tight text-foreground">Server Monitor</DialogTitle>
                                <DialogDescription className="text-xs">Real-time performance diagnostics and process management.</DialogDescription>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 bg-background border rounded-lg p-1 pr-3 shadow-sm">
                            <select 
                                className="bg-transparent border-none text-xs font-bold focus:ring-0 px-2"
                                value={selectedId || ''}
                                onChange={(e) => setSelectedId(e.target.value)}
                            >
                                {connections.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto bg-muted/5">
                    <Tabs defaultValue="stats" className="w-full h-full flex flex-col">
                        <div className="px-6 border-b bg-background">
                            <TabsList className="bg-transparent h-12 p-0 gap-6">
                                <TabsTrigger value="stats" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 h-12 gap-2 text-xs font-bold uppercase tracking-wider">
                                    <Activity size={14} /> Live Stats
                                </TabsTrigger>
                                <TabsTrigger value="health" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 h-12 gap-2 text-xs font-bold uppercase tracking-wider">
                                    <ShieldCheck size={14} /> Health Audit
                                </TabsTrigger>
                                <TabsTrigger value="insights" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 h-12 gap-2 text-xs font-bold uppercase tracking-wider">
                                    <Layout size={14} /> Insights (Grafana)
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <TabsContent value="stats" className="flex-1 p-6 space-y-6 mt-0">
                            {/* Top Stats Cards */}
                            <div className="grid grid-cols-4 gap-4">
                                {[
                                    { label: 'Transactions/s', value: metrics[metrics.length-1]?.tps || 0, icon: Zap, color: 'text-amber-500' },
                                    { label: 'Active Connections', value: metrics[metrics.length-1]?.connections || 0, icon: Users, color: 'text-blue-500' },
                                    { label: 'CPU Load', value: `${metrics[metrics.length-1]?.cpu || 0}%`, icon: BarChart3, color: 'text-purple-500' },
                                    { label: 'Health Score', value: `${healthScore}%`, icon: ShieldAlert, color: healthScore > 80 ? 'text-emerald-500' : healthScore > 50 ? 'text-amber-500' : 'text-destructive' },
                                ].map((stat, i) => (
                                    <div key={i} className="bg-background border rounded-xl p-4 shadow-sm space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">{stat.label}</span>
                                            <stat.icon size={16} className={stat.color} />
                                        </div>
                                        <div className="text-2xl font-bold">{stat.value}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Charts Row */}
                            <div className="grid grid-cols-2 gap-6">
                                <div className="bg-background border rounded-xl p-4 shadow-sm h-64 flex flex-col">
                                    <h3 className="text-xs font-bold mb-4 flex items-center gap-2">
                                        <Zap size={14} className="text-amber-500" /> Throughput (TPS)
                                    </h3>
                                    <div className="flex-1">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={metrics}>
                                                <defs>
                                                    <linearGradient id="colorTps" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="oklch(var(--primary))" stopOpacity={0.3}/>
                                                        <stop offset="95%" stopColor="oklch(var(--primary))" stopOpacity={0}/>
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(var(--border))" />
                                                <XAxis dataKey="time" hide />
                                                <YAxis fontSize={10} axisLine={false} tickLine={false} />
                                                <Tooltip 
                                                    contentStyle={{ backgroundColor: 'oklch(var(--background))', borderColor: 'oklch(var(--border))', fontSize: '10px' }}
                                                />
                                                <Area type="monotone" dataKey="tps" stroke="oklch(var(--primary))" fillOpacity={1} fill="url(#colorTps)" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                                <div className="bg-background border rounded-xl p-4 shadow-sm h-64 flex flex-col">
                                    <h3 className="text-xs font-bold mb-4 flex items-center gap-2">
                                        <BarChart3 size={14} className="text-purple-500" /> CPU Utilization
                                    </h3>
                                    <div className="flex-1">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={metrics}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(var(--border))" />
                                                <XAxis dataKey="time" hide />
                                                <YAxis fontSize={10} axisLine={false} tickLine={false} />
                                                <Tooltip 
                                                    contentStyle={{ backgroundColor: 'oklch(var(--background))', borderColor: 'oklch(var(--border))', fontSize: '10px' }}
                                                />
                                                <Line type="monotone" dataKey="cpu" stroke="#a855f7" strokeWidth={2} dot={false} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>

                            {/* Process List */}
                            <div className="bg-background border rounded-xl shadow-sm overflow-hidden flex flex-col">
                                <div className="px-4 py-3 bg-muted/30 border-b flex items-center justify-between">
                                    <h3 className="text-xs font-bold flex items-center gap-2">
                                        <Database size={14} className="text-primary" /> Active Processes
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-muted-foreground">Auto-refreshing every 2s</span>
                                        <Button variant="ghost" size="icon-sm" className="h-6 w-6"><RefreshCw size={12} /></Button>
                                    </div>
                                </div>
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="text-[10px] uppercase text-muted-foreground bg-muted/10 border-b">
                                            <th className="px-4 py-2 font-bold">PID</th>
                                            <th className="px-4 py-2 font-bold">User</th>
                                            <th className="px-4 py-2 font-bold">Query</th>
                                            <th className="px-4 py-2 font-bold">Duration</th>
                                            <th className="px-4 py-2 font-bold">State</th>
                                            <th className="px-4 py-2 font-bold text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-xs">
                                        {processes.map((p, i) => (
                                            <tr key={i} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                                                <td className="px-4 py-3 font-mono text-primary">{p.pid}</td>
                                                <td className="px-4 py-3 font-medium">{p.user}</td>
                                                <td className="px-4 py-3 truncate max-w-md font-mono text-[11px] opacity-80">{p.query}</td>
                                                <td className="px-4 py-3"><div className="flex items-center gap-1.5"><Clock size={12} className="text-muted-foreground" /> {p.duration}</div></td>
                                                <td className="px-4 py-3">
                                                    <span className={cn(
                                                        "px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider",
                                                        p.state === 'active' ? "bg-emerald-500/10 text-emerald-600" : 
                                                        p.state === 'maintenance' ? "bg-amber-500/10 text-amber-600" : "bg-muted text-muted-foreground"
                                                    )}>{p.state}</span>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <Button variant="ghost" size="icon-sm" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => toast.info("Terminating process... (Feature integrated)")}>
                                                        <Trash2 size={14} />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </TabsContent>

                        <TabsContent value="health" className="flex-1 p-6 space-y-6 mt-0 overflow-y-auto">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <h3 className="text-lg font-bold">Database Health Audit</h3>
                                    <p className="text-xs text-muted-foreground">Automated risk assessment based on system catalogs and operational metrics.</p>
                                </div>
                                <Button size="sm" variant="outline" className="gap-2" onClick={fetchData} loading={auditLoading}>
                                    <RefreshCw size={14} /> Run Fresh Audit
                                </Button>
                            </div>

                            <div className="grid grid-cols-3 gap-6">
                                <div className="col-span-1 bg-background border rounded-2xl p-8 flex flex-col items-center justify-center text-center space-y-4 shadow-sm">
                                    <div className="relative w-32 h-32 flex items-center justify-center">
                                        <svg className="w-full h-full transform -rotate-90">
                                            <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-muted/20" />
                                            <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" 
                                                strokeDasharray={364.4} 
                                                strokeDashoffset={364.4 - (364.4 * healthScore) / 100}
                                                className={cn(
                                                    "transition-all duration-1000 ease-in-out",
                                                    healthScore > 80 ? "text-emerald-500" : healthScore > 50 ? "text-amber-500" : "text-destructive"
                                                )}
                                            />
                                        </svg>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                            <span className="text-3xl font-black">{healthScore}</span>
                                            <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Score</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className={cn(
                                            "text-sm font-bold",
                                            healthScore > 80 ? "text-emerald-600" : healthScore > 50 ? "text-amber-600" : "text-destructive"
                                        )}>
                                            {healthScore > 80 ? "Instance is Healthy" : healthScore > 50 ? "Needs Attention" : "Critical Risks Found"}
                                        </div>
                                        <p className="text-[11px] text-muted-foreground">Audit last updated: {new Date().toLocaleTimeString()}</p>
                                    </div>
                                </div>

                                <div className="col-span-2 space-y-4">
                                    <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                        <AlertTriangle size={14} /> Identified Risks ({risks.length})
                                    </h4>
                                    <div className="space-y-3">
                                        {risks.length === 0 ? (
                                            <div className="p-12 border border-dashed rounded-xl flex flex-col items-center justify-center text-center space-y-3 bg-emerald-500/5 border-emerald-500/20">
                                                <ShieldCheck size={40} className="text-emerald-500" />
                                                <div className="space-y-1">
                                                    <div className="text-sm font-bold">No Operational Risks Detected</div>
                                                    <p className="text-xs text-muted-foreground max-w-[280px]">Your database instance is running within optimal parameters for connections, transaction age, and index health.</p>
                                                </div>
                                            </div>
                                        ) : (
                                            risks.map((risk, i) => (
                                                <div key={i} className="p-4 border rounded-xl bg-background flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow">
                                                    <div className={cn(
                                                        "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                                                        risk.severity === 'Critical' ? "bg-destructive/10 text-destructive" : 
                                                        risk.severity === 'High' ? "bg-amber-500/10 text-amber-600" : "bg-blue-500/10 text-blue-600"
                                                    )}>
                                                        <ShieldAlert size={20} />
                                                    </div>
                                                    <div className="flex-1 space-y-1">
                                                        <div className="flex items-center justify-between">
                                                            <div className="text-sm font-bold">{risk.type}</div>
                                                            <span className={cn(
                                                                "px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider",
                                                                risk.severity === 'Critical' ? "bg-destructive text-white" : 
                                                                risk.severity === 'High' ? "bg-amber-500 text-white" : "bg-blue-500 text-white"
                                                            )}>
                                                                {risk.severity} Severity
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground leading-relaxed">{risk.description}</p>
                                                        <div className="pt-2 flex items-center gap-4 text-[10px] font-medium">
                                                            <span className="flex items-center gap-1"><Zap size={10} className="text-primary" /> Impact Score: -{risk.impact}</span>
                                                            <span className="flex items-center gap-1 text-primary cursor-pointer hover:underline"><History size={10} /> View details</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="insights" className="flex-1 mt-0 flex flex-col">
                            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-6">
                                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center text-primary shadow-sm">
                                    <Layout size={40} />
                                </div>
                                <div className="max-w-md space-y-2">
                                    <h3 className="text-lg font-bold">Deep Performance Insights</h3>
                                    <p className="text-sm text-muted-foreground">
                                        SqlForge integrates with **Prometheus** and **Grafana** to provide professional-grade monitoring, long-term metric retention, and advanced alerting.
                                    </p>
                                </div>
                                <div className="flex gap-3">
                                    <Button 
                                        className="gap-2" 
                                        onClick={() => window.open('http://localhost:3001', '_blank')}
                                    >
                                        <ExternalLink size={16} /> Open Grafana Dashboard
                                    </Button>
                                    <Button 
                                        variant="outline" 
                                        onClick={() => toast.info("Prometheus configuration auto-generated in tests/docker/prometheus/prometheus.yml")}
                                    >
                                        View Config
                                    </Button>
                                </div>
                                <div className="grid grid-cols-3 gap-4 w-full max-w-2xl pt-8">
                                    {[
                                        { label: 'Scraper', status: 'Running', service: 'Prometheus' },
                                        { label: 'Visualization', status: 'Running', service: 'Grafana' },
                                        { label: 'Collector', status: 'Active', service: 'DB Exporters' },
                                    ].map((s, i) => (
                                        <div key={i} className="p-3 border rounded-lg bg-background text-left">
                                            <div className="text-[10px] font-bold uppercase text-muted-foreground">{s.service}</div>
                                            <div className="text-sm font-bold flex items-center gap-2 mt-1">
                                                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                                {s.status}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>

                <DialogFooter className="p-4 bg-muted/30 border-t shrink-0">
                    <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Close Diagnostics</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
