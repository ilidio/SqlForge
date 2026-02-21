import { useState } from 'react';
import { api } from '../api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Timer, Users, Play, Loader2, BarChart2, AlertCircle } from 'lucide-react';

interface BenchmarkDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    connectionId: string;
    sql: string;
}

export function BenchmarkDialog({ open, onOpenChange, connectionId, sql }: BenchmarkDialogProps) {
    const [concurrency, setConcurrency] = useState(5);
    const [duration, setDuration] = useState(10);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);

    const handleRun = async () => {
        setLoading(true);
        setResult(null);
        try {
            const data = await api.runBenchmark(connectionId, sql, concurrency, duration);
            if (data.error) {
                toast.error(data.error);
            } else {
                setResult(data);
                toast.success("Benchmark completed!");
            }
        } catch (e: any) {
            toast.error("Benchmark failed: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <BarChart2 className="text-primary" size={18} />
                        Query Stress Test (Benchmark)
                    </DialogTitle>
                    <DialogDescription>
                        Run your query concurrently to measure performance under load.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-6 py-4">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold flex items-center gap-2">
                                <Users size={14} /> Concurrency (Clients)
                            </Label>
                            <Input 
                                type="number" 
                                value={concurrency} 
                                onChange={e => setConcurrency(Number(e.target.value))}
                                min={1}
                                max={50}
                            />
                            <p className="text-[10px] text-muted-foreground italic">Number of simultaneous database connections.</p>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-bold flex items-center gap-2">
                                <Timer size={14} /> Duration (Seconds)
                            </Label>
                            <Input 
                                type="number" 
                                value={duration} 
                                onChange={e => setDuration(Number(e.target.value))}
                                min={1}
                                max={60}
                            />
                            <p className="text-[10px] text-muted-foreground italic">How long to hammer the database.</p>
                        </div>
                        <Button 
                            className="w-full mt-4" 
                            onClick={handleRun} 
                            disabled={loading || !sql}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Running...
                                </>
                            ) : (
                                <>
                                    <Play className="mr-2 h-4 w-4" />
                                    Start Benchmark
                                </>
                            )}
                        </Button>
                    </div>

                    <div className="bg-muted/30 rounded-lg border border-dashed p-4 flex flex-col justify-center">
                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">Query to test</h4>
                        <div className="bg-background/50 p-2 rounded border font-mono text-[10px] break-all max-h-32 overflow-y-auto">
                            {sql || "-- No query selected"}
                        </div>
                    </div>
                </div>

                {result && (
                    <div className="mt-4 p-4 bg-primary/5 border rounded-lg space-y-4 animate-in fade-in slide-in-from-top-2">
                        <div className="grid grid-cols-3 gap-4">
                            <div className="p-3 bg-background border rounded text-center">
                                <div className="text-[10px] uppercase font-bold text-muted-foreground">Throughput</div>
                                <div className="text-lg font-bold text-primary">{result.throughput_rps} <span className="text-[10px] font-normal">req/s</span></div>
                            </div>
                            <div className="p-3 bg-background border rounded text-center">
                                <div className="text-[10px] uppercase font-bold text-muted-foreground">P95 Latency</div>
                                <div className="text-lg font-bold text-amber-600">{result.p95_latency_ms} <span className="text-[10px] font-normal">ms</span></div>
                            </div>
                            <div className="p-3 bg-background border rounded text-center">
                                <div className="text-[10px] uppercase font-bold text-muted-foreground">P99 Latency</div>
                                <div className="text-lg font-bold text-red-600">{result.p99_latency_ms} <span className="text-[10px] font-normal">ms</span></div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between text-xs border-b pb-1">
                                <span className="text-muted-foreground">Total Requests:</span>
                                <span className="font-mono">{result.total_requests}</span>
                            </div>
                            <div className="flex justify-between text-xs border-b pb-1">
                                <span className="text-muted-foreground">Successful:</span>
                                <span className="font-mono text-emerald-600">{result.successful_requests}</span>
                            </div>
                            <div className="flex justify-between text-xs border-b pb-1">
                                <span className="text-muted-foreground">Errors:</span>
                                <span className={`font-mono ${result.errors > 0 ? 'text-red-600' : ''}`}>{result.errors}</span>
                            </div>
                            <div className="flex justify-between text-xs border-b pb-1">
                                <span className="text-muted-foreground">Avg / Min / Max:</span>
                                <span className="font-mono">{result.avg_latency_ms}ms / {result.min_latency_ms}ms / {result.max_latency_ms}ms</span>
                            </div>
                        </div>
                        
                        {result.errors > 0 && (
                            <div className="flex items-center gap-2 text-[10px] text-red-600 bg-red-50 p-2 rounded border border-red-100">
                                <AlertCircle size={12} />
                                High error rate detected. Check your database logs for deadlocks or connection limits.
                            </div>
                        )}
                    </div>
                )}

                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
