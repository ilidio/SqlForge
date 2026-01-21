import { useState } from 'react';
import { api } from '../api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2, Sparkles, CheckCircle, FlaskConical } from 'lucide-react';
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
    const [testResult, setTestResult] = useState<any>(null);
    const [testingIndex, setTestingIndex] = useState<string | null>(null);

    const handleTestIndex = async (ddl: string) => {
        setTestingIndex(ddl);
        setTestResult(null);
        try {
            const res = await api.testVirtualIndex(connectionId, sql, ddl);
            if (res.error) {
                toast.error(res.error);
            } else {
                setTestResult(res);
            }
        } catch (e: any) {
            toast.error("Test failed: " + e.message);
        } finally {
            setTestingIndex(null);
        }
    };

    const analyze = async () => {
        setLoading(true);
        try {
            const apiKey = localStorage.getItem('gemini_api_key') || '';
            const model = localStorage.getItem('ai_model') || '';
            
            if (!sql.trim()) {
                toast.error("Please enter a query first.");
                return;
            }

            const res = await api.analyzeQuery(connectionId, sql, apiKey, model);
            
            let parsedData = res.data;
            if (res.source === 'ai' && typeof res.data === 'string') {
                try {
                    parsedData = JSON.parse(res.data);
                } catch (e) {
                    console.error("Failed to parse AI JSON", e);
                }
            }
            
            setResult({ source: res.source, data: parsedData });
        } catch (e: any) {
            toast.error("Analysis failed: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    // Auto-analyze on open if not already done
    if (open && !loading && !result) {
        // analyze(); // Uncomment to auto-run, but maybe safer to let user click "Analyze"
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="text-purple-500" size={18} />
                        AI Index Advisor
                    </DialogTitle>
                    <DialogDescription>
                        Analyze your query to find missing indexes and performance bottlenecks.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-auto p-4 space-y-4">
                    {!result && !loading && (
                        <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-center">
                            <p className="mb-4">Ready to analyze query efficiency.</p>
                            <Button onClick={analyze}>Run Analysis</Button>
                        </div>
                    )}

                    {loading && (
                        <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                            <Loader2 className="w-8 h-8 animate-spin mb-2 text-primary" />
                            <p>Analyzing schema and execution plan...</p>
                        </div>
                    )}

                    {result && (
                        <div className="space-y-6">
                            {result.source === 'ai' && result.data.summary && (
                                <div className="p-4 bg-muted/30 rounded-lg border">
                                    <h4 className="font-semibold mb-2 text-sm">Analysis Summary</h4>
                                    <p className="text-sm text-muted-foreground">{result.data.summary}</p>
                                </div>
                            )}

                            <div>
                                <h4 className="font-semibold mb-3 text-sm flex items-center gap-2">
                                    <CheckCircle size={14} className="text-emerald-500" /> 
                                    Recommended Indexes
                                </h4>
                                
                                {result.source === 'algo' && result.data.length === 0 && (
                                    <p className="text-sm text-muted-foreground italic">No obvious missing indexes detected based on static analysis.</p>
                                )}

                                {result.source === 'algo' && result.data.map((rec: any, i: number) => (
                                    <div key={i} className="mb-3 p-3 border rounded-md bg-card">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-mono text-xs font-bold text-primary">{rec.table}.{rec.column}</span>
                                            <span className="text-[10px] bg-secondary px-2 py-0.5 rounded text-secondary-foreground">{rec.reason}</span>
                                        </div>
                                        <div className="bg-muted p-2 rounded text-xs font-mono overflow-x-auto flex justify-between items-center group">
                                            <code>{rec.ddl}</code>
                                            <div className="flex gap-1">
                                                <Button variant="ghost" size="icon-sm" onClick={() => handleTestIndex(rec.ddl)} title="Test Virtual Index (Postgres only)">
                                                    <FlaskConical size={12} className={testingIndex === rec.ddl ? "animate-pulse text-purple-500" : ""} />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {result.source === 'ai' && result.data.refined_suggestions?.map((rec: any, i: number) => (
                                    <div key={i} className="mb-3 p-3 border rounded-md bg-card">
                                        <div className="mb-2 text-sm text-foreground/80">{rec.explanation}</div>
                                        <div className="bg-muted p-2 rounded text-xs font-mono overflow-x-auto flex justify-between items-center group">
                                            <code>{rec.ddl}</code>
                                            <div className="flex gap-1">
                                                <Button variant="ghost" size="icon-sm" onClick={() => handleTestIndex(rec.ddl)} title="Test Virtual Index (Postgres only)">
                                                    <FlaskConical size={12} className={testingIndex === rec.ddl ? "animate-pulse text-purple-500" : ""} />
                                                </Button>
                                                <Button variant="ghost" size="icon-sm" onClick={() => {
                                                    navigator.clipboard.writeText(rec.ddl);
                                                    toast.success("Copied to clipboard");
                                                }}>
                                                    <Sparkles size={12} />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {testResult && (
                        <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg animate-in slide-in-from-bottom-2">
                            <h4 className="font-bold text-sm mb-2 flex items-center gap-2">
                                <FlaskConical size={14} className="text-purple-600" />
                                Virtual Index Simulation Results
                            </h4>
                            <div className="grid grid-cols-3 gap-4 text-center">
                                <div className="p-2 bg-background rounded border">
                                    <div className="text-[10px] text-muted-foreground uppercase font-bold">Original Cost</div>
                                    <div className="text-lg font-mono">{testResult.baseline_cost.toFixed(2)}</div>
                                </div>
                                <div className="p-2 bg-background rounded border">
                                    <div className="text-[10px] text-muted-foreground uppercase font-bold">Virtual Cost</div>
                                    <div className="text-lg font-mono">{testResult.virtual_cost.toFixed(2)}</div>
                                </div>
                                <div className="p-2 bg-background rounded border">
                                    <div className="text-[10px] text-muted-foreground uppercase font-bold">Improvement</div>
                                    <div className={`text-lg font-bold ${testResult.improvement_pct > 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                                        {testResult.improvement_pct}%
                                    </div>
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-3 text-center">
                                {testResult.improvement_pct > 0 
                                    ? "Great news! This index would improve performance." 
                                    : "This index might not help. The query planner didn't find it cheaper."}
                            </p>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
