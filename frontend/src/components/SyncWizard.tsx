import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { api, type ConnectionConfig } from '../api';
import { toast } from 'sonner';
import { Database, ArrowRight, CheckCircle2, RefreshCw, Zap, ShieldCheck, FileCode } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SyncWizardProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mode: 'structure' | 'data' | 'transfer';
}

export default function SyncWizard({ open, onOpenChange, mode }: SyncWizardProps) {
    const [step, setStep] = useState(1);
    const [connections, setConnections] = useState<ConnectionConfig[]>([]);
    const [sourceId, setSourceId] = useState<string | null>(null);
    const [targetId, setTargetId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [diffResult, setDiffResult] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            api.getConnections().then(setConnections);
            setStep(1);
            setDiffResult(null);
        }
    }, [open]);

    const handleCompare = async () => {
        if (!sourceId || !targetId) return;
        setLoading(true);
        setStep(3);
        try {
            const result = await api.diffSchemas(sourceId, targetId, mode);
            setDiffResult(result.sql);
        } catch (e: any) {
            setDiffResult(`-- Error: ${e.response?.data?.detail || e.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleExecute = async () => {
        if (!sourceId || !targetId) return;
        setLoading(true);
        try {
            const result = await api.executeSync(sourceId, targetId, mode, false);
            if (result.status === 'success') {
                toast.success(result.message);
                onOpenChange(false);
            } else {
                toast.info(result.message);
            }
        } catch (e: any) {
            toast.error(`Error: ${e.response?.data?.detail || e.message}`);
        } finally {
            setLoading(false);
        }
    };

    const getModeTitle = () => {
        if (mode === 'structure') return 'Structure Synchronization';
        if (mode === 'data') return 'Data Synchronization';
        return 'Data Transfer';
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl p-0 overflow-hidden gap-0">
                <DialogHeader className="p-6 bg-primary/5 border-b border-primary/10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                            <RefreshCw size={20} className={cn(loading && "animate-spin")} />
                        </div>
                        <div>
                            <DialogTitle className="text-lg">{getModeTitle()}</DialogTitle>
                            <DialogDescription>Sync objects and data across different database instances.</DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="p-8">
                    {/* Stepper */}
                    <div className="flex items-center justify-center mb-10 gap-4">
                        {[1, 2, 3].map((i) => (
                            <React.Fragment key={i}>
                                <div className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                                    step === i ? "bg-primary text-primary-foreground scale-110 shadow-lg" : 
                                    step > i ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
                                )}>
                                    {step > i ? <CheckCircle2 size={16} /> : i}
                                </div>
                                {i < 3 && <div className={cn("h-0.5 w-12 transition-colors", step > i ? "bg-emerald-500" : "bg-muted")} />} 
                            </React.Fragment>
                        ))}
                    </div>

                    {step === 1 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                            <div className="text-center mb-6">
                                <h3 className="font-bold text-base">Select Source Database</h3>
                                <p className="text-sm text-muted-foreground">This is the database we will read from.</p>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                {connections.map(c => (
                                    <button 
                                        key={c.id}
                                        onClick={() => setSourceId(c.id!)}
                                        className={cn(
                                            "flex items-center gap-3 p-4 rounded-xl border transition-all text-left",
                                            sourceId === c.id ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "hover:border-primary/50"
                                        )}
                                    >
                                        <Database size={20} className="text-blue-500" />
                                        <div className="flex-1 overflow-hidden">
                                            <div className="text-sm font-bold truncate">{c.name}</div>
                                            <div className="text-[10px] text-muted-foreground uppercase">{c.type}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                            <div className="text-center mb-6">
                                <h3 className="font-bold text-base text-primary">Select Target Database</h3>
                                <p className="text-sm text-muted-foreground">Changes will be applied to this database.</p>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                {connections.filter(c => c.id !== sourceId).map(c => (
                                    <button 
                                        key={c.id}
                                        onClick={() => setTargetId(c.id!)}
                                        className={cn(
                                            "flex items-center gap-3 p-4 rounded-xl border transition-all text-left",
                                            targetId === c.id ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "hover:border-primary/50"
                                        )}
                                    >
                                        <Database size={20} className="text-emerald-500" />
                                        <div className="flex-1 overflow-hidden">
                                            <div className="text-sm font-bold truncate">{c.name}</div>
                                            <div className="text-[10px] text-muted-foreground uppercase">{c.type}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-4 animate-in fade-in zoom-in-95">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-12 gap-4">
                                    <RefreshCw className="w-10 h-10 text-primary animate-spin" />
                                    <p className="text-sm font-medium animate-pulse text-muted-foreground">Comparing schemas and calculating diff...</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg">
                                        <div className="flex items-center gap-2 text-emerald-600 text-sm font-bold">
                                            <ShieldCheck size={18} />
                                            Analysis Complete
                                        </div>
                                        <span className="text-[10px] uppercase font-bold text-emerald-600/70">Ready to deploy</span>
                                    </div>
                                    <div className="bg-muted/30 border rounded-lg overflow-hidden">
                                        <div className="px-3 py-2 bg-muted/50 border-b flex items-center justify-between">
                                            <span className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                                                <FileCode size={12} /> Execution Plan
                                            </span>
                                        </div>
                                        <pre className="p-4 text-xs font-mono text-foreground/80 max-h-[200px] overflow-auto">
                                            {diffResult}
                                        </pre>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter className="p-6 bg-muted/30 border-t flex justify-between sm:justify-between items-center">
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <div className="flex gap-2">
                        {step > 1 && step < 3 && <Button variant="outline" onClick={() => setStep(s => s - 1)}>Back</Button>}
                        {step === 1 && <Button disabled={!sourceId} onClick={() => setStep(2)}>Next: Select Target <ArrowRight size={14} className="ml-2" /></Button>}
                        {step === 2 && <Button disabled={!targetId} onClick={handleCompare} className="bg-primary hover:bg-primary/90">Compare Databases <Zap size={14} className="ml-2" /></Button>}
                        {step === 3 && !loading && (
                            <Button 
                                className="bg-emerald-600 hover:bg-emerald-700 gap-2" 
                                onClick={handleExecute}
                                disabled={loading}
                            >
                                {loading ? <RefreshCw className="animate-spin" size={14} /> : <>Execute Plan <Zap size={14} /></>}
                            </Button>
                        )}
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
