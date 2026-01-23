import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles, CheckCircle2, ChevronRight, Zap, Users, ShieldCheck, BarChart3, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '../api';
import { toast } from 'sonner';
import { Slider } from '@/components/ui/slider';

interface HydrateWizardProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    connectionId: string | null;
    tableName: string | null;
}

export default function HydrateWizard({ open, onOpenChange, connectionId, tableName }: HydrateWizardProps) {
    const [step, setStep] = useState(1);
    const [count, setCount] = useState(100);
    const [hydrating, setHydrating] = useState(false);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState('');
    
    const [apiKey, setApiKey] = useState('');
    const [aiModel, setAiModel] = useState('');

    useEffect(() => {
        if (open) {
            setStep(1);
            setProgress(0);
            setStatus('');
            setApiKey(localStorage.getItem('gemini_api_key') || '');
            setAiModel(localStorage.getItem('ai_model') || '');
        }
    }, [open]);

    const handleStartHydration = async () => {
        if (!connectionId || !tableName) return;
        if (!apiKey || !aiModel) {
            toast.error("AI configuration missing. Please set your Gemini API key in Settings.");
            return;
        }
        
        setHydrating(true);
        setStep(3);
        setStatus('AI is analyzing schema & mapping semantic types...');
        setProgress(20);
        
        try {
            const res = await api.hydrateTable(connectionId, tableName, count, apiKey, aiModel);
            
            if (res.success) {
                setProgress(100);
                setStatus(`Successfully hydrated ${res.count} rows!`);
                toast.success(`Hydrated ${res.count} realistic rows into ${tableName}`);
            } else {
                throw new Error("Hydration failed");
            }
        } catch (e: any) {
            setStatus('Hydration failed.');
            const msg = e.response?.data?.detail || e.message;
            toast.error(`Error: ${msg}`);
            setStep(2); // Go back to allow retry
        } finally {
            setHydrating(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl p-0 overflow-hidden gap-0 border-none shadow-2xl">
                <DialogHeader className="p-8 bg-gradient-to-br from-indigo-600 to-violet-700 text-white border-b-0">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-xl ring-1 ring-white/30">
                            <Sparkles size={32} className="animate-pulse" />
                        </div>
                        <div>
                            <DialogTitle className="text-2xl font-black tracking-tight flex items-center gap-2">
                                Smart Hydrator
                                <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-medium uppercase tracking-widest">AI Powered</span>
                            </DialogTitle>
                            <DialogDescription className="text-white/80 text-sm font-medium">
                                Inject realistic, semantic data into <span className="text-white font-bold underline decoration-white/30">{tableName}</span> for stress testing.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="p-8 min-h-[350px] bg-background">
                    {step === 1 && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-5 rounded-2xl border bg-indigo-50/30 border-indigo-100 flex flex-col gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                                        <Users size={20} />
                                    </div>
                                    <div className="text-sm font-bold text-indigo-900">Semantic Accuracy</div>
                                    <div className="text-xs text-indigo-700/70 leading-relaxed">AI maps column names to real-world entities like Emails, SSNs, and Addresses.</div>
                                </div>
                                <div className="p-5 rounded-2xl border bg-violet-50/30 border-violet-100 flex flex-col gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center">
                                        <ShieldCheck size={20} />
                                    </div>
                                    <div className="text-sm font-bold text-violet-900">Referential Integrity</div>
                                    <div className="text-xs text-violet-700/70 leading-relaxed">Automatically detects Foreign Keys and samples existing IDs to maintain relationships.</div>
                                </div>
                            </div>
                            
                            <div className="space-y-4">
                                <div className="flex items-center justify-between px-1">
                                    <h3 className="text-sm font-bold flex items-center gap-2">
                                        <BarChart3 size={16} className="text-primary" />
                                        Dataset Size
                                    </h3>
                                    <span className="text-lg font-black text-primary">{count.toLocaleString()} <span className="text-xs text-muted-foreground font-medium">rows</span></span>
                                </div>
                                <div className="px-1 py-4">
                                    <Slider 
                                        value={[count]} 
                                        onValueChange={v => setCount(v[0])}
                                        max={10000}
                                        min={10}
                                        step={10}
                                        className="py-4"
                                    />
                                    <div className="flex justify-between text-[10px] text-muted-foreground font-medium uppercase tracking-tighter mt-1">
                                        <span>Light (10)</span>
                                        <span>Medium (5,000)</span>
                                        <span>Heavy (10,000)</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                             <div className="p-6 rounded-2xl bg-amber-50 border border-amber-100 flex gap-4">
                                <div className="w-12 h-12 rounded-full bg-amber-100 flex-shrink-0 flex items-center justify-center text-amber-600">
                                    <AlertTriangle size={24} />
                                </div>
                                <div className="space-y-1">
                                    <div className="text-sm font-bold text-amber-900">Confirm Data Injection</div>
                                    <div className="text-xs text-amber-700 leading-relaxed">
                                        You are about to insert <strong>{count.toLocaleString()}</strong> rows into <strong>{tableName}</strong>. 
                                        This operation cannot be undone. Ensure you have a backup if this is a production-like environment.
                                    </div>
                                </div>
                            </div>
                            <div className="p-6 rounded-2xl border border-dashed bg-muted/30 space-y-3">
                                <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Hydration Strategy</div>
                                <div className="flex items-center gap-3 text-sm">
                                    <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(var(--indigo-500),0.5)]" />
                                    <span>AI semantic mapping: <strong>Enabled</strong></span>
                                </div>
                                <div className="flex items-center gap-3 text-sm">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(var(--emerald-500),0.5)]" />
                                    <span>Foreign Key respect: <strong>Active</strong></span>
                                </div>
                                <div className="flex items-center gap-3 text-sm">
                                    <div className="w-2 h-2 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(var(--violet-500),0.5)]" />
                                    <span>Batch processing size: <strong>1,000</strong></span>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-10 py-10 flex flex-col items-center animate-in zoom-in-95 duration-500">
                            <div className="relative w-32 h-32 flex items-center justify-center">
                                <div className={cn(
                                    "absolute inset-0 border-4 border-indigo-100 rounded-full",
                                    hydrating && "border-t-indigo-600 animate-spin border-4"
                                )} />
                                <div className="absolute inset-2 border border-violet-100 rounded-full animate-pulse" />
                                {progress < 100 ? (
                                    <Sparkles size={48} className="text-indigo-600 animate-bounce duration-1000" />
                                ) : (
                                    <CheckCircle2 size={56} className="text-emerald-500 shadow-emerald-500/20 shadow-2xl rounded-full" />
                                )}
                            </div>
                            <div className="w-full max-w-sm space-y-4">
                                <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-indigo-900">
                                    <span className="animate-pulse">{status}</span>
                                    <span>{progress}%</span>
                                </div>
                                <div className="h-3 w-full bg-muted rounded-full overflow-hidden shadow-inner p-0.5">
                                    <div 
                                        className="h-full bg-gradient-to-r from-indigo-500 to-violet-600 rounded-full transition-all duration-700 ease-out shadow-[0_0_15px_rgba(79,70,229,0.4)]" 
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                                <div className="text-[10px] text-center text-muted-foreground italic">
                                    This might take a few seconds depending on the volume...
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="p-6 bg-muted/30 border-t flex items-center">
                    <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-muted-foreground">Cancel</Button>
                    <div className="flex-1" />
                    <div className="flex gap-3">
                        {step === 2 && <Button variant="outline" size="sm" onClick={() => setStep(1)} className="rounded-xl px-6">Back</Button>}
                        {step === 1 && (
                            <Button 
                                size="sm" 
                                className="bg-indigo-600 hover:bg-indigo-700 rounded-xl px-8 shadow-lg shadow-indigo-500/20 gap-2" 
                                onClick={() => setStep(2)}
                            >
                                Next <ChevronRight size={14}/>
                            </Button>
                        )}
                        {step === 2 && (
                            <Button 
                                size="sm" 
                                className="bg-indigo-600 hover:bg-indigo-700 rounded-xl px-10 shadow-lg shadow-indigo-500/30 gap-2 font-bold" 
                                onClick={handleStartHydration}
                            >
                                <Zap size={16} /> Hydrate Now
                            </Button>
                        )}
                        {step === 3 && !hydrating && (
                            <Button 
                                size="sm" 
                                className="bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-lg shadow-emerald-500/20 px-12" 
                                onClick={() => onOpenChange(false)}
                            >
                                Done
                            </Button>
                        )}
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
