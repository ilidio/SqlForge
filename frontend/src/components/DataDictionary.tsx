import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { api, type TableSchema } from '../api';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Book, Download, Search, Filter, Database, Key, Table as TableIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface DataDictionaryProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    connectionId: string | null;
}

export default function DataDictionary({ open, onOpenChange, connectionId }: DataDictionaryProps) {
    const [loading, setLoading] = useState(false);
    const [schemas, setSchemas] = useState<TableSchema[]>([]);
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (open && connectionId) {
            fetchSchema();
        }
    }, [open, connectionId]);

    const fetchSchema = async () => {
        if (!connectionId) return;
        setLoading(true);
        try {
            const data = await api.getSchemaDetails(connectionId);
            setSchemas(data);
        } catch (e: any) {
            toast.error("Failed to fetch schema details: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const filteredSchemas = schemas.filter(s => 
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.columns.some(c => c.name.toLowerCase().includes(search.toLowerCase()))
    );

    const exportToMarkdown = () => {
        let md = `# Data Dictionary

Generated on ${new Date().toLocaleString()}

`;
        
        schemas.forEach(s => {
            md += `## Table: ${s.name}

`;
            md += `| Column | Type | Nullable | PK |
`;
            md += `| :--- | :--- | :--- | :--- |
`;
            s.columns.forEach(c => {
                md += `| ${c.name} | ${c.type} | ${c.nullable ? 'Yes' : 'No'} | ${c.primary_key ? '🔑' : ''} |
`;
            });
            md += `
`;
            if (s.foreign_keys.length > 0) {
                md += `**Foreign Keys:**\n`;
                s.foreign_keys.forEach(fk => {
                    md += `- \`${fk.constrained_column}\` -> \`${fk.referred_table}.${fk.referred_column}\` \n`;
                });
                md += `\n`;
            }
            md += `---

`;
        });

        const blob = new Blob([md], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `data_dictionary_${connectionId}.md`;
        link.click();
        toast.success("Data dictionary exported as Markdown");
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-6 bg-muted/30 border-b shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                                <Book size={24} />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-bold tracking-tight">Data Dictionary</DialogTitle>
                                <DialogDescription className="text-xs">
                                    Comprehensive documentation of your database schema.
                                </DialogDescription>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                             <div className="relative w-64">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search tables or columns..."
                                    className="pl-9 h-9 text-xs"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                            <Button variant="outline" size="sm" className="h-9 gap-2" onClick={exportToMarkdown}>
                                <Download size={14} /> Export MD
                            </Button>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col bg-background">
                    {loading ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground">
                            <Loader2 className="w-10 h-10 animate-spin opacity-20" />
                            <p className="text-sm animate-pulse">Scanning schema and metadata...</p>
                        </div>
                    ) : filteredSchemas.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground opacity-50">
                             <Filter size={48} />
                             <p className="text-sm">No tables found matching your search.</p>
                        </div>
                    ) : (
                        <ScrollArea className="flex-1 p-6">
                            <div className="space-y-12">
                                {filteredSchemas.map((table) => (
                                    <div key={table.name} className="space-y-4">
                                        <div className="flex items-center gap-3 border-b pb-2">
                                            <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                                <TableIcon size={18} />
                                            </div>
                                            <h3 className="text-lg font-bold tracking-tight">{table.name}</h3>
                                            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono uppercase text-muted-foreground">TABLE</span>
                                        </div>
                                        
                                        <div className="rounded-lg border overflow-hidden shadow-sm">
                                            <table className="w-full text-left text-xs border-collapse">
                                                <thead className="bg-muted/50 border-b">
                                                    <tr>
                                                        <th className="p-2.5 font-bold">Column</th>
                                                        <th className="p-2.5 font-bold">Type</th>
                                                        <th className="p-2.5 font-bold">Nullable</th>
                                                        <th className="p-2.5 font-bold text-center">Constraints</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y">
                                                    {table.columns.map(col => (
                                                        <tr key={col.name} className="hover:bg-muted/30 transition-colors">
                                                            <td className="p-2.5 font-medium flex items-center gap-2">
                                                                {col.name}
                                                                {col.primary_key && <Key size={10} className="text-amber-500" title="Primary Key" />}
                                                            </td>
                                                            <td className="p-2.5 font-mono text-[10px] text-muted-foreground">{col.type}</td>
                                                            <td className="p-2.5">{col.nullable ? 'YES' : 'NO'}</td>
                                                            <td className="p-2.5">
                                                                <div className="flex justify-center gap-1">
                                                                    {table.foreign_keys.filter(fk => fk.constrained_column === col.name).map((fk, idx) => (
                                                                        <div key={idx} className="bg-blue-500/10 text-blue-600 px-1.5 py-0.5 rounded text-[9px] font-bold border border-blue-200" title={`FK to ${fk.referred_table}.${fk.referred_column}`}>
                                                                            FK
                                                                        </div>
                                                                    ))}
                                                                    {table.indexes.filter(idx => idx.columns.includes(col.name)).map((idx, i) => (
                                                                        <div key={i} className="bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 rounded text-[9px] font-bold border border-emerald-200" title={`Part of index ${idx.name}`}>
                                                                            IDX
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        {table.foreign_keys.length > 0 && (
                                            <div className="grid grid-cols-1 gap-2 pl-2 border-l-2 border-primary/20">
                                                <span className="text-[10px] font-black uppercase text-muted-foreground/50 tracking-widest">Relationships</span>
                                                {table.foreign_keys.map((fk, idx) => (
                                                    <div key={idx} className="flex items-center gap-2 text-xs text-muted-foreground">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                                        <code className="text-foreground font-bold">{fk.constrained_column}</code>
                                                        <span>points to</span>
                                                        <code className="bg-muted px-1.5 py-0.5 rounded text-[10px] border">
                                                            {fk.referred_table}({fk.referred_column})
                                                        </code>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    )}
                </div>

                <div className="p-4 bg-muted/30 border-t flex justify-between items-center text-[10px] text-muted-foreground font-medium shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                            <Database size={12} />
                            Connected to <span className="text-foreground font-bold">{connectionId}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <TableIcon size={12} />
                            <span className="text-foreground font-bold">{schemas.length}</span> total tables
                        </div>
                    </div>
                    <span>SqlForge Dictionary Utility v1.0</span>
                </div>
            </DialogContent>
        </Dialog>
    );
}
