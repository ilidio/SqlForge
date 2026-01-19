import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { api, type ConnectionConfig } from '../api';
import { Database, Download, Upload, CheckCircle2, ShieldCheck, FileArchive, Settings2, HardDrive } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BackupWizardProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mode: 'backup' | 'restore';
}

export default function BackupWizard({ open, onOpenChange, mode }: BackupWizardProps) {
    const [step, setStep] = useState(1);
    const [connections, setConnections] = useState<ConnectionConfig[]>([]);
    const [selectedConnId, setSelectedConnId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState('');

    useEffect(() => {
        if (open) {
            api.getConnections().then(setConnections);
            setStep(1);
            setProgress(0);
            setStatus('');
        }
    }, [open]);

    const handleExecute = async () => {
        setLoading(true);
        setStep(3);
        
        const isBackup = mode === 'backup';
        setStatus(isBackup ? 'Preparing data stream...' : 'Validating archive...');
        
        // Simulated execution progress
        const intervals = [
            { p: 20, m: isBackup ? 'Extracting schema definitions...' : 'Parsing SQL headers...' },
            { p: 50, m: isBackup ? 'Dumping table records...' : 'Executing restoration script...' },
            { p: 80, m: isBackup ? 'Compressing archive...' : 'Rebuilding indexes...' },
            { p: 100, m: isBackup ? 'Backup completed successfully.' : 'Restore completed successfully.' }
        ];

        let i = 0;
        const timer = setInterval(() => {
            if (i < intervals.length) {
                setProgress(intervals[i].p);
                setStatus(intervals[i].m);
                i++;
            } else {
                clearInterval(timer);
                setLoading(false);
            }
        }, 1000);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl p-0 overflow-hidden gap-0">
                <DialogHeader className="p-6 bg-muted/30 border-b">
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center",
                            mode === 'backup' ? "bg-blue-500/10 text-blue-500" : "bg-purple-500/10 text-purple-500"
                        )}>
                            {mode === 'backup' ? <Download size={20} /> : <Upload size={20} />}
                        </div>
                        <div>
                            <DialogTitle className="text-lg">{mode === 'backup' ? 'Create Backup' : 'Restore Database'}</DialogTitle>
                            <DialogDescription>
                                {mode === 'backup' 
                                    ? 'Export your database schema and data to a secure archive.' 
                                    : 'Restore a database from a previously created SQL or compressed dump.'}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="p-8">
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
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 rounded-xl border bg-muted/10 space-y-3">
                                    <div className="flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
                                        <Settings2 size={14} /> Options
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-xs p-2 rounded bg-background border">
                                            <span>Include Schema</span>
                                            <div className="w-8 h-4 bg-primary rounded-full relative"><div className="absolute right-0.5 top-0.5 w-3 h-3 bg-white rounded-full"/></div>
                                        </div>
                                        <div className="flex items-center justify-between text-xs p-2 rounded bg-background border">
                                            <span>Include Data</span>
                                            <div className="w-8 h-4 bg-primary rounded-full relative"><div className="absolute right-0.5 top-0.5 w-3 h-3 bg-white rounded-full"/></div>
                                        </div>
                                        <div className="flex items-center justify-between text-xs p-2 rounded bg-background border">
                                            <span>Compress (GZIP)</span>
                                            <div className="w-8 h-4 bg-muted rounded-full relative"><div className="absolute left-0.5 top-0.5 w-3 h-3 bg-white rounded-full"/></div>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4 rounded-xl border bg-muted/10 space-y-3">
                                    <div className="flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
                                        <HardDrive size={14} /> Destination
                                    </div>
                                    <div className="space-y-3">
                                        <div className="text-[10px] p-2 bg-background border rounded font-mono break-all">
                                            /Users/sqlforge/backups/{connections.find(c=>c.id === selectedConnId)?.name.toLowerCase().replace(' ', '_')}_{new Date().toISOString().split('T')[0]}.sql
                                        </div>
                                        <Button variant="outline" size="sm" className="w-full text-[10px] h-7">Change Location</Button>
                                    </div>
                                </div>
                            </div>
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
                        {step === 1 && <Button size="sm" disabled={!selectedConnId} onClick={() => setStep(2)}>Next Configuration</Button>}
                        {step === 2 && <Button size="sm" onClick={handleExecute}>{mode === 'backup' ? 'Start Backup' : 'Start Restore'}</Button>}
                        {step === 3 && !loading && <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => onOpenChange(false)}>Finish</Button>}
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
