import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, FileSpreadsheet, FileJson, FileCode, CheckCircle2, ChevronRight, Settings2, Database, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '../api';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface ExportWizardProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    connectionId: string | null;
    tableName: string | null;
}

export default function ExportWizard({ open, onOpenChange, connectionId, tableName }: ExportWizardProps) {
    const [step, setStep] = useState(1);
    const [format, setFormat] = useState<'csv' | 'json' | 'sql'>('csv');
    const [masked, setMasked] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState('');

    useEffect(() => {
        if (open) {
            setStep(1);
            setProgress(0);
            setStatus('');
            setMasked(false);
        }
    }, [open]);

    const formats = [
        { id: 'csv', name: 'CSV (Comma Separated Values)', icon: FileSpreadsheet, color: 'text-emerald-500' },
        { id: 'json', name: 'JSON (JavaScript Object Notation)', icon: FileJson, color: 'text-amber-500' },
        { id: 'sql', name: 'SQL (INSERT Statements)', icon: FileCode, color: 'text-blue-500' },
    ];

    const handleStartExport = () => {
        if (!connectionId || !tableName) return;
        
        setExporting(true);
        setStep(3);
        setStatus('Preparing stream...');
        setProgress(30);
        
        try {
            const url = api.getExportUrl(connectionId, tableName, format, masked);
            
            // Trigger download by creating a hidden link
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${tableName}.${format}`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            setProgress(100);
            setStatus('Export stream started!');
            toast.success("Export started. Check your browser downloads.");
        } catch (e: any) {
            setStatus('Export failed.');
            toast.error(`Export Error: ${e.message}`);
        } finally {
            setExporting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl p-0 overflow-hidden gap-0">
                <DialogHeader className="p-6 bg-muted/30 border-b">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                            <Download size={24} />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-bold tracking-tight">Export Wizard</DialogTitle>
                            <DialogDescription className="text-xs">
                                Exporting table <span className="font-bold text-foreground underline decoration-primary/30 decoration-2">{tableName}</span>
                                <span className="ml-2 text-muted-foreground opacity-50">#{connectionId}</span>
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="p-8 min-h-[300px]">
                    {step === 1 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                            <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                                <Settings2 size={16} />
                                <h3 className="text-xs font-bold uppercase tracking-widest">Select Export Format</h3>
                            </div>
                            <div className="grid grid-cols-1 gap-3">
                                {formats.map(f => (
                                    <button 
                                        key={f.id}
                                        onClick={() => setFormat(f.id as any)}
                                        className={cn(
                                            "flex items-center justify-between p-4 rounded-xl border transition-all text-left",
                                            format === f.id ? "border-primary bg-primary/5 ring-1 ring-primary shadow-sm" : "hover:border-primary/50 hover:bg-muted/5"
                                        )}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={cn("w-10 h-10 rounded-lg bg-background border flex items-center justify-center shadow-sm", f.color)}>
                                                <f.icon size={20} />
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold">{f.name}</div>
                                                <div className="text-[10px] text-muted-foreground">Best for {f.id === 'csv' ? 'Excel & Data Analysis' : f.id === 'json' ? 'Web APIs & App Integration' : 'Database Migrations'}</div>
                                            </div>
                                        </div>
                                        {format === f.id && <CheckCircle2 size={20} className="text-primary" />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                            <div 
                                className={cn(
                                    "p-6 rounded-xl border transition-all duration-300 mb-6 flex items-center justify-between group",
                                    masked ? "bg-indigo-500/10 border-indigo-500/50 shadow-inner" : "bg-muted/5 border-border hover:border-indigo-500/30"
                                )}
                                onClick={() => setMasked(!masked)}
                                style={{ cursor: 'pointer' }}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={cn(
                                        "w-12 h-12 rounded-xl flex items-center justify-center transition-colors",
                                        masked ? "bg-indigo-500 text-white shadow-lg" : "bg-muted text-muted-foreground group-hover:bg-indigo-100 group-hover:text-indigo-600"
                                    )}>
                                        <ShieldCheck size={24} />
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold flex items-center gap-2">
                                            Data Privacy Mode
                                            {masked && <span className="text-[10px] bg-indigo-500 text-white px-1.5 py-0.5 rounded uppercase">Active</span>}
                                        </div>
                                        <div className="text-[10px] text-muted-foreground max-w-[280px]">
                                            Automatically masks PII (emails, phones, names) using one-way hashing during export. Recommended for production data.
                                        </div>
                                    </div>
                                </div>
                                <Checkbox 
                                    checked={masked} 
                                    onCheckedChange={(c) => setMasked(!!c)}
                                    className="w-5 h-5 border-indigo-500 data-[state=checked]:bg-indigo-500"
                                />
                            </div>

                            <div className="p-6 rounded-xl border bg-muted/5 space-y-6">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <div className="text-xs font-bold">Include Column Headers</div>
                                            <div className="text-[10px] text-muted-foreground">Use the first row for field names.</div>
                                        </div>
                                        <div className="w-8 h-4 bg-primary rounded-full relative cursor-pointer"><div className="absolute right-0.5 top-0.5 w-3 h-3 bg-white rounded-full shadow-sm"/></div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <div className="text-xs font-bold">NULL as empty string</div>
                                            <div className="text-[10px] text-muted-foreground">Convert database NULLs to empty values.</div>
                                        </div>
                                        <div className="w-8 h-4 bg-muted rounded-full relative cursor-pointer"><div className="absolute left-0.5 top-0.5 w-3 h-3 bg-white rounded-full shadow-sm"/></div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <div className="text-xs font-bold">Quote all fields</div>
                                            <div className="text-[10px] text-muted-foreground">Wrap every value in double quotes.</div>
                                        </div>
                                        <div className="w-8 h-4 bg-muted rounded-full relative cursor-pointer"><div className="absolute left-0.5 top-0.5 w-3 h-3 bg-white rounded-full shadow-sm"/></div>
                                    </div>
                                </div>
                                <div className="h-px bg-border" />
                                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                                    <Database size={12} />
                                    <span>Exporting approximately 5,000 rows.</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-8 py-10 flex flex-col items-center animate-in zoom-in-95">
                            <div className="relative w-24 h-24 flex items-center justify-center">
                                <div className={cn(
                                    "absolute inset-0 border-4 border-muted rounded-full",
                                    exporting && "border-t-primary animate-spin"
                                )} />
                                {progress < 100 ? (
                                    <Download size={32} className="text-muted-foreground animate-pulse" />
                                ) : (
                                    <CheckCircle2 size={40} className="text-emerald-500" />
                                )}
                            </div>
                            <div className="w-full max-w-sm space-y-4">
                                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                    <span>{status}</span>
                                    <span>{progress}%</span>
                                </div>
                                <div className="h-2 w-full bg-muted rounded-full overflow-hidden shadow-inner">
                                    <div 
                                        className="h-full bg-primary transition-all duration-500 ease-out shadow-[0_0_8px_rgba(var(--primary),0.5)]" 
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="p-6 bg-muted/30 border-t flex items-center">
                    <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <div className="flex-1" />
                    <div className="flex gap-2">
                        {step === 2 && <Button variant="outline" size="sm" onClick={() => setStep(1)}>Back</Button>}
                        {step === 1 && <Button size="sm" className="gap-2" onClick={() => setStep(2)}>Next: Configure <ChevronRight size={14}/></Button>}
                        {step === 2 && <Button size="sm" className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20" onClick={handleStartExport}>Start Export</Button>}
                        {step === 3 && !exporting && <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 px-8" onClick={() => onOpenChange(false)}>Close</Button>}
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
