import { useState, useEffect } from 'react';
import { api } from '../api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Zap, Check, AlertTriangle, Sparkles, Copy, Database, TestTube, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

interface IndexAdvisorProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    connectionId: string;
    sql: string;
}

export function IndexAdvisor({ open, onOpenChange, connectionId, sql }: IndexAdvisorProps) {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [applying, setApplying] = useState<string | null>(null);
    
    // What-If State
    const [simulating, setSimulating] = useState<string | null>(null);
    const [simResult, setSimResult] = useState<any>(null);
    const [showSimResult, setShowSimResult] = useState(false);

    const analyze = async () => {
        setLoading(true);
        setResult(null);
        try {
            const apiKey = localStorage.getItem('gemini_api_key') || '';
            const model = localStorage.getItem('ai_model') || 'gemini-2.0-flash-exp';
            
            const data = await api.analyzeQuery(connectionId, sql, apiKey, model);
            
            if (data.error) {
                toast.error(data.error);
            } else {
                setResult(data);
            }
        } catch (e: any) {
            toast.error("Analysis failed: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open) {
            setResult(null);
            setSimResult(null);
        }
    }, [open, sql]);

    const applyIndex = async (ddl: string) => {
        setApplying(ddl);
        try {
            await api.runQuery(connectionId, ddl);
            toast.success("Index created successfully!");
            setResult((prev: any) => ({
                ...prev,
                recommendations: prev.recommendations.filter((r: any) => r.ddl !== ddl)
            }));
        } catch (e: any) {
            toast.error("Failed to create index: " + e.message);
        } finally {
            setApplying(null);
        }
    };

    const runSimulation = async (ddl: string) => {
        setSimulating(ddl);
        setSimResult(null);
        try {
            const res = await api.testVirtualIndex(connectionId, sql, ddl);
            if (res.error) {
                toast.error("Simulation failed: " + res.error);
            } else {
                setSimResult({ ...res, ddl });
                setShowSimResult(true);
            }
        } catch (e: any) {
            toast.error("Simulation failed: " + e.message);
        } finally {
            setSimulating(null);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
                <div className="p-6 pb-2 border-b">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            <Zap className="text-yellow-500 fill-yellow-500" size={20} /> 
                            Index Advisor
                        </DialogTitle>
                        <DialogDescription>
                            AI-powered analysis to identify missing indexes and improve query performance.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="flex-1 overflow-hidden bg-slate-50 dark:bg-slate-900/50 relative">
                    {!result && !loading && (
                        <div className="flex flex-col items-center justify-center h-full p-8 gap-6 text-center">
                            <div className="bg-background p-4 rounded-full shadow-sm border">
                                <Database className="w-12 h-12 text-muted-foreground/50" />
                            </div>
                            <div className="max-w-md space-y-2">
                                <h3 className="font-semibold text-lg">Ready to Analyze</h3>
                                <p className="text-sm text-muted-foreground">
                                    We will scan your query predicates against the current schema to find missing index opportunities.
                                </p>
                            </div>
                            <Button size="lg" onClick={analyze} className="gap-2">
                                <Sparkles size={16} /> Run Analysis
                            </Button>
                        </div>
                    )}

                    {loading && (
                        <div className="flex flex-col items-center justify-center h-full p-8 gap-4">
                            <Loader2 className="h-10 w-10 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground animate-pulse">Consulting the Oracle...</p>
                        </div>
                    )}

                    {result && (
                        <ScrollArea className="h-full">
                            <div className="p-6 space-y-6">
                                {/* AI Explanation */}
                                <div className="bg-background p-5 rounded-xl border shadow-sm space-y-3">
                                    <h3 className="font-semibold flex items-center gap-2 text-primary">
                                        <Sparkles className="w-4 h-4"/> Expert Analysis
                                    </h3>
                                    <div className="prose dark:prose-invert text-sm max-w-none leading-relaxed text-muted-foreground">
                                        {result.explanation.split('\n').map((line: string, i: number) => (
                                            <p key={i} className="mb-2">{line}</p>
                                        ))}
                                    </div>
                                </div>

                                {/* Recommendations */}
                                <div>
                                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                                        Recommended Actions
                                        <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                            {result.recommendations?.length || 0}
                                        </span>
                                    </h3>
                                    
                                    {!result.recommendations || result.recommendations.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center p-8 bg-green-50/50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30 rounded-xl text-center">
                                            <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-full mb-3">
                                                <Check className="w-6 h-6 text-green-600 dark:text-green-400" />
                                            </div>
                                            <h4 className="font-medium text-green-900 dark:text-green-300">Optimized</h4>
                                            <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                                                Your query appears to be well-covered by existing indexes.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {result.recommendations.map((rec: any, idx: number) => (
                                                <div key={idx} className="border rounded-xl p-0 bg-card shadow-sm overflow-hidden transition-all hover:shadow-md">
                                                    <div className="p-4 border-b bg-muted/30 flex justify-between items-start gap-4">
                                                        <div>
                                                            <div className="font-semibold text-sm flex items-center gap-2">
                                                                <Database size={14} className="text-muted-foreground"/>
                                                                {rec.table}
                                                                <span className="text-muted-foreground">/</span>
                                                                <span className="text-primary">{rec.column}</span>
                                                            </div>
                                                            <div className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5">
                                                                <AlertTriangle size={12} className="text-amber-500" />
                                                                {rec.reason}
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-2 shrink-0">
                                                            <Button
                                                                size="sm"
                                                                variant="secondary"
                                                                onClick={() => runSimulation(rec.ddl)}
                                                                disabled={simulating === rec.ddl}
                                                                className="border bg-background hover:bg-accent"
                                                            >
                                                                {simulating === rec.ddl ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <TestTube size={14} className="mr-1.5" />}
                                                                What-If?
                                                            </Button>
                                                            <Button 
                                                                size="sm" 
                                                                onClick={() => applyIndex(rec.ddl)}
                                                                disabled={applying === rec.ddl}
                                                            >
                                                                {applying === rec.ddl ? (
                                                                    <>
                                                                        <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin"/> Creating...
                                                                    </>
                                                                ) : (
                                                                    "Create"
                                                                )}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                    <div className="p-3 bg-slate-950 text-slate-50 font-mono text-[11px] overflow-x-auto flex items-center justify-between group">
                                                        <code>{rec.ddl}</code>
                                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-white opacity-0 group-hover:opacity-100" onClick={() => navigator.clipboard.writeText(rec.ddl)}>
                                                            <Copy size={12} />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </ScrollArea>
                    )}
                </div>
                
                <div className="p-4 border-t bg-background flex justify-end">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
                </div>
            </DialogContent>

            {/* Simulation Result Dialog */}
            <Dialog open={showSimResult} onOpenChange={setShowSimResult}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <TestTube className="text-blue-500" /> Simulation Results
                        </DialogTitle>
                        <DialogDescription>
                            Impact of the virtual index on query cost.
                        </DialogDescription>
                    </DialogHeader>
                    
                    {simResult && (
                        <div className="space-y-4 py-2">
                            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
                                <div className="text-center">
                                    <div className="text-xs text-muted-foreground uppercase font-bold">Current Cost</div>
                                    <div className="text-xl font-mono">{simResult.baseline_cost.toFixed(2)}</div>
                                </div>
                                <ArrowRight className="text-muted-foreground" />
                                <div className="text-center">
                                    <div className="text-xs text-muted-foreground uppercase font-bold">Projected Cost</div>
                                    <div className="text-xl font-mono text-blue-600 font-bold">{simResult.virtual_cost.toFixed(2)}</div>
                                </div>
                            </div>

                            <div className={`p-4 rounded-lg border flex items-center gap-3 ${simResult.improvement_pct > 0 ? 'bg-emerald-50 border-emerald-100 text-emerald-900' : 'bg-amber-50 border-amber-100 text-amber-900'}`}>
                                {simResult.improvement_pct > 0 ? <Zap className="text-emerald-500" /> : <AlertTriangle className="text-amber-500" />}
                                <div>
                                    <div className="font-bold">
                                        {simResult.improvement_pct > 0 
                                            ? `${simResult.improvement_pct}% Improvement` 
                                            : "No Improvement Detected"}
                                    </div>
                                    <div className="text-xs opacity-80">
                                        {simResult.improvement_pct > 0 
                                            ? "The optimizer would use this index to reduce query cost." 
                                            : "The optimizer ignored this index. It may not be selective enough."}
                                    </div>
                                </div>
                            </div>
                            
                            <div className="text-[10px] text-muted-foreground text-center">
                                * Calculated using virtual/hypothetical indexes. No actual index was created.
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button onClick={() => setShowSimResult(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Dialog>
    );
}
