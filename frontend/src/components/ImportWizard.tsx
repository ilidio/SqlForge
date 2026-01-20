import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, FileSpreadsheet, FileJson, CheckCircle2, ChevronRight, Settings2, FileText, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '../api';
import { toast } from 'sonner';

interface ImportWizardProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    connectionId: string | null;
    tableName: string | null;
}

export default function ImportWizard({ open, onOpenChange, connectionId, tableName }: ImportWizardProps) {
    const [step, setStep] = useState(1);
    const [format, setFormat] = useState<'csv' | 'json'>('csv');
    const [mode, setMode] = useState<'append' | 'truncate'>('append');
    const [file, setFile] = useState<File | null>(null);
    const [importing, setImporting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (open) {
            setStep(1);
            setProgress(0);
            setStatus('');
            setFile(null);
        }
    }, [open]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            if (selectedFile.name.endsWith('.json')) {
                setFormat('json');
            } else {
                setFormat('csv');
            }
        }
    };

    const handleImport = async () => {
        if (!connectionId || !tableName || !file) return;
        
        setImporting(true);
        setStep(3);
        setStatus('Uploading file...');
        setProgress(30);

        try {
            await api.importData(connectionId, tableName, file, mode, format);
            setProgress(100);
            setStatus('Import completed successfully!');
            toast.success(`Imported data into ${tableName}`);
        } catch (e: any) {
            setStatus('Import failed.');
            toast.error(`Import Error: ${e.response?.data?.detail || e.message}`);
        } finally {
            setImporting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl p-0 overflow-hidden gap-0">
                <DialogHeader className="p-6 bg-muted/30 border-b">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                            <Upload size={24} />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-bold tracking-tight">Import Wizard</DialogTitle>
                            <DialogDescription className="text-xs">
                                Importing into <span className="font-bold text-foreground underline decoration-primary/30 decoration-2">{tableName}</span>
                                <span className="ml-2 text-muted-foreground opacity-50">#{connectionId}</span>
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="p-8 min-h-[300px]">
                    {step === 1 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                             <div 
                                className="border-2 border-dashed border-muted-foreground/25 rounded-xl p-10 flex flex-col items-center justify-center gap-4 hover:bg-muted/5 transition-colors cursor-pointer"
                                onClick={() => fileInputRef.current?.click()}
                             >
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    className="hidden" 
                                    accept=".csv,.json"
                                    onChange={handleFileChange}
                                    data-testid="file-input"
                                />
                                {file ? (
                                    <>
                                        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                                            <FileText size={32} />
                                        </div>
                                        <div className="text-center">
                                            <div className="font-bold text-lg">{file.name}</div>
                                            <div className="text-sm text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</div>
                                        </div>
                                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); setFile(null); }}>
                                            <X size={14} className="mr-1"/> Remove File
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center text-muted-foreground">
                                            <Upload size={32} />
                                        </div>
                                        <div className="text-center">
                                            <div className="font-bold text-lg">Click to select file</div>
                                            <div className="text-sm text-muted-foreground">Supports CSV and JSON</div>
                                        </div>
                                    </>
                                )}
                             </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                            <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                                <Settings2 size={16} />
                                <h3 className="text-xs font-bold uppercase tracking-widest">Import Configuration</h3>
                            </div>
                            
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div 
                                        className={cn(
                                            "p-4 rounded-xl border cursor-pointer transition-all",
                                            format === 'csv' ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/10"
                                        )}
                                        onClick={() => setFormat('csv')}
                                    >
                                        <div className="flex items-center gap-2 mb-2">
                                            <FileSpreadsheet size={18} className="text-emerald-500" />
                                            <span className="font-bold text-sm">CSV Format</span>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground">Comma-separated values. First row must be headers.</p>
                                    </div>
                                    <div 
                                        className={cn(
                                            "p-4 rounded-xl border cursor-pointer transition-all",
                                            format === 'json' ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/10"
                                        )}
                                        onClick={() => setFormat('json')}
                                    >
                                        <div className="flex items-center gap-2 mb-2">
                                            <FileJson size={18} className="text-amber-500" />
                                            <span className="font-bold text-sm">JSON Format</span>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground">Array of objects with keys matching columns.</p>
                                    </div>
                                </div>

                                <div className="p-4 rounded-xl border bg-muted/5 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <div className="text-sm font-bold">Import Mode</div>
                                            <div className="text-xs text-muted-foreground">How should new data be added?</div>
                                        </div>
                                        <div className="flex bg-background rounded-lg border p-1">
                                            <button 
                                                className={cn("px-3 py-1 text-xs rounded-md transition-all font-medium", mode === 'append' && "bg-primary text-primary-foreground shadow-sm")}
                                                onClick={() => setMode('append')}
                                            >
                                                Append
                                            </button>
                                            <button 
                                                className={cn("px-3 py-1 text-xs rounded-md transition-all font-medium", mode === 'truncate' && "bg-destructive text-destructive-foreground shadow-sm")}
                                                onClick={() => setMode('truncate')}
                                            >
                                                Truncate
                                            </button>
                                        </div>
                                    </div>
                                    {mode === 'truncate' && (
                                        <div className="text-[10px] text-destructive flex items-center gap-1.5 font-bold bg-destructive/10 p-2 rounded">
                                            <X size={10} /> Warning: This will delete all existing data in the table!
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-8 py-10 flex flex-col items-center animate-in zoom-in-95">
                            <div className="relative w-24 h-24 flex items-center justify-center">
                                <div className={cn(
                                    "absolute inset-0 border-4 border-muted rounded-full",
                                    importing && "border-t-primary animate-spin"
                                )} />
                                {progress === 100 ? (
                                    <CheckCircle2 size={40} className="text-emerald-500" />
                                ) : (
                                    <Upload size={32} className="text-muted-foreground animate-pulse" />
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
                        {step === 1 && <Button disabled={!file} size="sm" className="gap-2" onClick={() => setStep(2)}>Next: Configure <ChevronRight size={14}/></Button>}
                        {step === 2 && <Button size="sm" className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20" onClick={handleImport}>Start Import</Button>}
                        {step === 3 && !importing && <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 px-8" onClick={() => onOpenChange(false)}>Close</Button>}
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
