import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, type ConnectionConfig } from '../api';
import { Database, Download, Upload, CheckCircle2, ShieldCheck, FileArchive, Settings2, HardDrive, FileCode, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface BackupWizardProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mode: 'backup' | 'restore' | 'execute';
}

export default function BackupWizard({ open, onOpenChange, mode }: BackupWizardProps) {
    const [step, setStep] = useState(1);
    const [connections, setConnections] = useState<ConnectionConfig[]>([]);
    const [selectedConnId, setSelectedConnId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [isIncremental, setIsIncremental] = useState(false);
    const [isNative, setIsNative] = useState(true);
    const [filePath, setFilePath] = useState('');
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState('');

    useEffect(() => {
        if (open) {
            api.getConnections().then(setConnections);
            setStep(1);
            setProgress(0);
            setStatus('');
            setFilePath('');
        }
    }, [open]);

    const handleExecute = async () => {
        if (!selectedConnId) return;
        setLoading(true);
        setStep(3);
        
        try {
            let res;
            if (mode === 'backup') {
                setStatus('Initiating native dump...');
                setProgress(20);
                res = await api.runBackup(selectedConnId, isIncremental, isNative);
            } else if (mode === 'restore') {
                setStatus('Replaying backup data...');
                setProgress(40);
                res = await api.runRestore(selectedConnId, filePath);
            } else {
                setStatus('Executing script contents...');
                setProgress(50);
                res = await api.executeScript(selectedConnId, filePath);
            }

            if (res.status === 'error') throw new Error(res.message);

            setProgress(100);
            setStatus('Operation completed successfully.');
            toast.success("Done!");
        } catch (e: any) {
            setStatus('Operation failed.');
            toast.error(`Error: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    const getTitle = () => {
        if (mode === 'backup') return 'Create Backup';
        if (mode === 'restore') return 'Restore Database';
        return 'Execute Script';
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl p-0 overflow-hidden gap-0">
                <DialogHeader className="p-6 bg-muted/30 border-b">
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center",
                            mode === 'backup' ? "bg-blue-500/10 text-blue-500" : mode === 'restore' ? "bg-purple-500/10 text-purple-500" : "bg-amber-500/10 text-amber-500"
                        )}>
                            {mode === 'backup' ? <Download size={20} /> : mode === 'restore' ? <Upload size={20} /> : <Terminal size={20} />}
                        </div>
                        <div>
                            <DialogTitle className="text-lg">{getTitle()}</DialogTitle>
                            <DialogDescription>
                                {mode === 'backup' ? 'Export schema and data to archive.' : mode === 'restore' ? 'Restore database from backup file.' : 'Execute SQL or Redis command script.'}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="p-8 min-h-[300px]">
                    {step === 1 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                            <div className="flex items-center gap-2 mb-2">
                                <Database size={16} className="text-primary" />
                                <h3 className="text-sm font-bold uppercase tracking-tight">Select Target Connection</h3>
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                                {connections.map(c => (
                                    <button 
                                        key={c.id}
                                        onClick={() => setSelectedConnId(c.id!)}
                                        className={cn(
                                            "flex items-center justify-between p-3 rounded-lg border transition-all text-left",
                                            selectedConnId === c.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:border-primary/50"
                                        )}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded bg-muted flex items-center justify-center text-muted-foreground font-mono text-[10px]">
                                                {c.type.substring(0, 3).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="text-xs font-bold">{c.name}</div>
                                                <div className="text-[10px] text-muted-foreground">{c.database || c.filepath}</div>
                                            </div>
                                        </div>
                                        {selectedConnId === c.id && <CheckCircle2 size={16} className="text-primary" />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                            {mode === 'backup' ? (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 rounded-xl border bg-muted/10 space-y-3">
                                        <div className="flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
                                            <Settings2 size={14} /> Backup Options
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between text-xs p-2 rounded bg-background border">
                                                <span>Native (CLI) Engine</span>
                                                <div 
                                                    className={cn("w-8 h-4 rounded-full relative cursor-pointer transition-colors", isNative ? "bg-primary" : "bg-muted")}
                                                    onClick={() => setIsNative(!isNative)}
                                                >
                                                    <div className={cn("absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all", isNative ? "right-0.5" : "left-0.5")}/>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between text-xs p-2 rounded bg-background border">
                                                <span>Incremental</span>
                                                <div 
                                                    className={cn("w-8 h-4 rounded-full relative cursor-pointer transition-colors", isIncremental ? "bg-primary" : "bg-muted")}
                                                    onClick={() => setIsIncremental(!isIncremental)}
                                                >
                                                    <div className={cn("absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all", isIncremental ? "right-0.5" : "left-0.5")}/>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-4 rounded-xl border bg-muted/10 space-y-3">
                                        <div className="flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
                                            <HardDrive size={14} /> Destination
                                        </div>
                                        <div className="text-[10px] p-2 bg-background border rounded font-mono break-all">
                                            /backups/{connections.find(c=>c.id === selectedConnId)?.name.toLowerCase().replace(' ', '_')}_{new Date().toISOString().split('T')[0]}.sql
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
                                        <FileCode size={14} /> {mode === 'restore' ? 'Select Backup File' : 'Select Script File'}
                                    </div>
                                    <Input 
                                        placeholder="/path/to/your/file.sql" 
                                        value={filePath} 
                                        onChange={e => setFilePath(e.target.value)}
                                        className="font-mono text-xs"
                                    />
                                    <p className="text-[10px] text-muted-foreground italic">
                                        {mode === 'restore' ? 'Must be a valid .sql or native dump file.' : 'Enter the absolute path to the .sql or .redis command file.'}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-8 py-6 flex flex-col items-center animate-in zoom-in-95">
                            <div className="relative w-24 h-24 flex items-center justify-center">
                                <div className={cn(
                                    "absolute inset-0 border-4 border-muted rounded-full",
                                    loading && "border-t-primary animate-spin"
                                )} />
                                {progress < 100 ? (
                                    <FileArchive size={32} className="text-muted-foreground animate-pulse" />
                                ) : (
                                    <ShieldCheck size={40} className="text-emerald-500" />
                                )}
                            </div>
                            <div className="w-full max-w-sm space-y-3">
                                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                    <span>{status}</span>
                                    <span>{progress}%</span>
                                </div>
                                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-primary transition-all duration-500 ease-out" 
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="p-6 bg-muted/30 border-t flex justify-between sm:justify-between items-center">
                    <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <div className="flex gap-2">
                        {step > 1 && step < 3 && <Button variant="outline" size="sm" onClick={() => setStep(s => s - 1)}>Back</Button>}
                        {step === 1 && <Button size="sm" disabled={!selectedConnId} onClick={() => setStep(2)}>Next</Button>}
                        {step === 2 && <Button size="sm" onClick={handleExecute} disabled={mode !== 'backup' && !filePath}>
                            {mode === 'backup' ? 'Start Backup' : mode === 'restore' ? 'Start Restore' : 'Run Script'}
                        </Button>}
                        {step === 3 && !loading && <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => onOpenChange(false)}>Finish</Button>}
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
