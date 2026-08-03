import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, type ConnectionConfig } from '../api';
import { toast } from 'sonner';
import { Play, Plus, Trash2, Zap, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FederatedQueryDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

interface SourceRow {
    alias: string;
    connectionId: string;
    sql: string;
}

const makeDefaultSources = (): SourceRow[] => [
    { alias: 'src_a', connectionId: '', sql: '' },
    { alias: 'src_b', connectionId: '', sql: '' },
];

export default function FederatedQueryDialog({ open, onOpenChange }: FederatedQueryDialogProps) {
    const [connections, setConnections] = useState<ConnectionConfig[]>([]);
    const [sources, setSources] = useState<SourceRow[]>(makeDefaultSources());
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ columns: string[], rows: Record<string, unknown>[], error: string | null, truncated: boolean, source_summaries: { alias: string, rows: number }[] } | null>(null);

    useEffect(() => {
        if (open) {
            api.getConnections().then(setConnections);
            setResult(null);
        }
    }, [open]);

    const updateSource = (index: number, patch: Partial<SourceRow>) => {
        setSources(prev => prev.map((s, i) => i === index ? { ...s, ...patch } : s));
    };

    const addSource = () => {
        setSources(prev => [...prev, { alias: `src_${String.fromCharCode(97 + prev.length)}`, connectionId: '', sql: '' }]);
    };

    const removeSource = (index: number) => {
        setSources(prev => prev.filter((_, i) => i !== index));
    };

    const runFederatedQuery = async () => {
        const missing = sources.find(s => !s.alias.trim() || !s.connectionId || !s.sql.trim());
        if (missing) {
            toast.warning('Every source needs an alias, a connection and a SQL statement.');
            return;
        }
        if (!query.trim()) {
            toast.warning('Write a query that references your source aliases (e.g. SELECT * FROM src_a JOIN src_b ...).');
            return;
        }
        setLoading(true);
        setResult(null);
        try {
            const res = await api.runFederatedQuery(
                sources.map(s => ({ alias: s.alias.trim(), connection_id: s.connectionId, sql: s.sql })),
                query,
            );
            setResult(res);
            if (res.error) {
                toast.error(res.error);
            } else if (res.truncated) {
                toast.warning('Result truncated - showing the first rows only.');
            }
        } catch (e: unknown) {
            const message = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || (e instanceof Error ? e.message : String(e));
            setResult({ columns: [], rows: [], error: message, truncated: false, source_summaries: [] });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[820px] max-h-[85vh] overflow-hidden flex flex-col p-0 gap-0">
                <DialogHeader className="p-6 bg-muted/30 border-b">
                    <DialogTitle className="flex items-center gap-2">
                        <Zap size={18} className="text-primary" />
                        Federated Query
                    </DialogTitle>
                    <DialogDescription>
                        Pull data from multiple connections - even different engines - and JOIN or UNION them in one statement.
                        Each source is fetched via its own connection, then loaded into a local, in-memory engine (DuckDB) under the alias you give it.
                    </DialogDescription>
                </DialogHeader>

                <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label>Sources</Label>
                            <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1.5" onClick={addSource}>
                                <Plus size={12} /> Add Source
                            </Button>
                        </div>

                        {sources.map((source, i) => (
                            <div key={i} className="p-3 rounded-md border border-border bg-muted/10 space-y-2">
                                <div className="grid grid-cols-12 gap-2 items-center">
                                    <div className="col-span-3">
                                        <Input
                                            value={source.alias}
                                            onChange={e => updateSource(i, { alias: e.target.value })}
                                            placeholder="alias"
                                            className="h-8 text-xs font-mono"
                                        />
                                    </div>
                                    <div className="col-span-8">
                                        <select
                                            value={source.connectionId}
                                            onChange={e => updateSource(i, { connectionId: e.target.value })}
                                            className="w-full h-8 text-xs rounded-md border border-input bg-background px-2"
                                        >
                                            <option value="">Select connection...</option>
                                            {connections.map(c => (
                                                <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="col-span-1 flex justify-end">
                                        <Button
                                            variant="ghost"
                                            size="icon-sm"
                                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                            onClick={() => removeSource(i)}
                                            disabled={sources.length <= 1}
                                            title="Remove source"
                                        >
                                            <Trash2 size={13} />
                                        </Button>
                                    </div>
                                </div>
                                <textarea
                                    value={source.sql}
                                    onChange={e => updateSource(i, { sql: e.target.value })}
                                    placeholder={`SELECT * FROM some_table  -- pulled from ${source.alias || 'this source'}'s own connection`}
                                    rows={2}
                                    className="w-full text-xs font-mono rounded-md border border-input bg-background p-2 resize-y"
                                />
                            </div>
                        ))}
                    </div>

                    <div className="space-y-2">
                        <Label>Federated Query</Label>
                        <textarea
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder={`SELECT ${sources[0]?.alias || 'a'}.*, ${sources[1]?.alias || 'b'}.*\nFROM ${sources[0]?.alias || 'a'}\nJOIN ${sources[1]?.alias || 'b'} ON ${sources[0]?.alias || 'a'}.id = ${sources[1]?.alias || 'b'}.a_id`}
                            rows={4}
                            className="w-full text-xs font-mono rounded-md border border-input bg-background p-2 resize-y"
                        />
                        <p className="text-[10px] text-muted-foreground">
                            Standard SQL (DuckDB dialect). Reference each source by its alias as if it were a table.
                        </p>
                    </div>

                    {result && (
                        <div className="space-y-2">
                            {result.error ? (
                                <div className="p-3 rounded-md text-xs font-medium border bg-destructive/5 text-destructive border-destructive/20 flex items-start gap-2">
                                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                                    <span>{result.error}</span>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                                        <span>{result.rows.length} rows{result.truncated ? ' (truncated)' : ''}</span>
                                        {result.source_summaries.map(s => (
                                            <span key={s.alias} className="opacity-70">{s.alias}: {s.rows} rows pulled</span>
                                        ))}
                                    </div>
                                    <div className="max-h-64 overflow-auto rounded-md border border-border">
                                        <table className="w-full text-[11px]">
                                            <thead className="bg-muted/40 sticky top-0">
                                                <tr>
                                                    {result.columns.map(col => (
                                                        <th key={col} className="text-left px-2 py-1.5 font-bold text-muted-foreground border-b border-border">{col}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {result.rows.map((row, i) => (
                                                    <tr key={i} className={cn(i % 2 === 1 && "bg-muted/10")}>
                                                        {result.columns.map(col => (
                                                            <td key={col} className="px-2 py-1 font-mono border-b border-border/50 truncate max-w-[220px]">
                                                                {row[col] === null || row[col] === undefined ? <span className="opacity-40">NULL</span> : String(row[col])}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter className="p-6 bg-muted/30 border-t">
                    <Button onClick={runFederatedQuery} loading={loading} className="gap-2">
                        <Play size={14} /> Run Federated Query
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
