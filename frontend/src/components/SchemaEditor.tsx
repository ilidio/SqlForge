import { useState, useEffect, useCallback } from 'react';
import { api, type ColumnInfo } from '../api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, Edit2, Save, X, RefreshCw, Key } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

interface SchemaEditorProps {
    connectionId: string;
    tableName: string;
}

export function SchemaEditor({ connectionId, tableName }: SchemaEditorProps) {
    const [loading, setLoading] = useState(true);
    const [columns, setColumns] = useState<ColumnInfo[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isAddOpen, setIsAddOpen] = useState(false);
    
    // Add Column State
    const [newColName, setNewColName] = useState('');
    const [newColType, setNewColType] = useState('TEXT');
    const [newColNullable, setNewColNullable] = useState(true);
    const [newColDefault, setNewColDefault] = useState('');
    const [adding, setAdding] = useState(false);

    // Rename / Edit State
    const [editingCol, setEditingCol] = useState<string | null>(null);
    const [editColData, setEditColData] = useState<ColumnInfo | null>(null);

    // Drop State
    const [colToDelete, setColToDelete] = useState<string | null>(null);

    const fetchSchema = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // Note: Optimally we would have a specific endpoint for one table, 
            // but we reuse schema details for now.
            const schemas = await api.getSchemaDetails(connectionId);
            const tableSchema = schemas.find(s => s.name === tableName);
            if (tableSchema) {
                setColumns(tableSchema.columns);
            } else {
                setError(`Table ${tableName} not found.`);
            }
        } catch (e: any) {
            setError(e.message || 'Failed to load schema');
        } finally {
            setLoading(false);
        }
    }, [connectionId, tableName]);

    useEffect(() => {
        fetchSchema();
    }, [fetchSchema]);

    const handleAddColumn = async () => {
        if (!newColName) return;
        setAdding(true);
        try {
            await api.alterTable(connectionId, {
                connection_id: connectionId,
                table_name: tableName,
                action: 'add_column',
                column_def: {
                    name: newColName,
                    type: newColType,
                    nullable: newColNullable,
                    primary_key: false, // Generally adding PK later is complex
                    default: newColDefault || undefined
                }
            });
            toast.success("Column added successfully");
            setIsAddOpen(false);
            setNewColName('');
            setNewColType('TEXT');
            setNewColDefault('');
            fetchSchema();
        } catch (e: any) {
            toast.error(`Error adding column: ${e.response?.data?.detail || e.message}`);
        } finally {
            setAdding(false);
        }
    };

    const handleSaveColumn = async (oldName: string) => {
        if (!editColData) return;
        
        try {
            if (editColData.name !== oldName) {
                // First rename if name changed
                await api.alterTable(connectionId, {
                    connection_id: connectionId,
                    table_name: tableName,
                    action: 'rename_column',
                    column_name: oldName,
                    new_column_name: editColData.name
                });
            }
            
            // Then alter type/nullable
            await api.alterTable(connectionId, {
                connection_id: connectionId,
                table_name: tableName,
                action: 'alter_column',
                column_name: editColData.name,
                column_def: {
                    name: editColData.name,
                    type: editColData.type,
                    nullable: editColData.nullable,
                    primary_key: editColData.primary_key
                }
            });
            
            toast.success("Column updated successfully");
            setEditingCol(null);
            setEditColData(null);
            fetchSchema();
        } catch (e: any) {
            toast.error(`Error updating column: ${e.response?.data?.detail || e.message}`);
        }
    };

    const handleDropColumn = async () => {
        if (!colToDelete) return;
        try {
            await api.alterTable(connectionId, {
                connection_id: connectionId,
                table_name: tableName,
                action: 'drop_column',
                column_name: colToDelete
            });
            toast.success("Column dropped successfully");
            setColToDelete(null);
            fetchSchema();
        } catch (e: any) {
            toast.error(`Error dropping column: ${e.response?.data?.detail || e.message}`);
        }
    };

    if (loading && columns.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                Loading Schema...
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4">
                <div className="text-red-500">Error: {error}</div>
                <Button variant="outline" onClick={fetchSchema}>Retry</Button>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-background">
            <div className="p-4 border-b flex items-center justify-between bg-muted/30">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        <Edit2 size={18} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold tracking-tight">Schema Editor: {tableName}</h2>
                        <p className="text-xs text-muted-foreground">Modify columns and types</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={fetchSchema} title="Refresh Schema">
                        <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                    </Button>
                    <Button size="sm" onClick={() => setIsAddOpen(true)} className="gap-2">
                        <Plus size={14} /> Add Column
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-6">
                <div className="border rounded-lg overflow-hidden bg-card text-card-foreground shadow-sm">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-muted text-muted-foreground uppercase text-xs font-bold">
                            <tr>
                                <th className="px-4 py-3">Key</th>
                                <th className="px-4 py-3">Column Name</th>
                                <th className="px-4 py-3">Type</th>
                                <th className="px-4 py-3 text-center">Nullable</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {columns.map((col) => (
                                <tr key={col.name} className="hover:bg-muted/50 transition-colors">
                                    <td className="px-4 py-3 w-10">
                                        {col.primary_key && <Key size={14} className="text-yellow-500" />}
                                    </td>
                                    <td className="px-4 py-3 font-medium">
                                        {editingCol === col.name && editColData ? (
                                            <Input 
                                                value={editColData.name} 
                                                onChange={e => setEditColData({...editColData, name: e.target.value})} 
                                                className="h-8 w-48"
                                                autoFocus
                                            />
                                        ) : (
                                            col.name
                                        )}
                                    </td>
                                    <td className="px-4 py-3 font-mono text-muted-foreground">
                                        {editingCol === col.name && editColData ? (
                                            <select 
                                                className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                value={editColData.type}
                                                onChange={e => setEditColData({...editColData, type: e.target.value})}
                                            >
                                                <option value="TEXT">TEXT</option>
                                                <option value="INTEGER">INTEGER</option>
                                                <option value="REAL">REAL</option>
                                                <option value="BOOLEAN">BOOLEAN</option>
                                                <option value="BLOB">BLOB</option>
                                                <option value="DATE">DATE</option>
                                                <option value="DATETIME">DATETIME</option>
                                                <option value="VARCHAR(255)">VARCHAR(255)</option>
                                                <option value="JSON">JSON</option>
                                            </select>
                                        ) : (
                                            col.type
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        {editingCol === col.name && editColData ? (
                                            <Checkbox 
                                                checked={editColData.nullable} 
                                                onCheckedChange={(c) => setEditColData({...editColData, nullable: !!c})} 
                                                disabled={col.primary_key}
                                            />
                                        ) : (
                                            <span className={cn("text-xs", col.nullable ? "text-emerald-500" : "text-amber-500")}>
                                                {col.nullable ? "YES" : "NO"}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex justify-end gap-1">
                                            {editingCol === col.name ? (
                                                <>
                                                    <Button size="icon-sm" className="h-8 w-8 bg-green-500 hover:bg-green-600" onClick={() => handleSaveColumn(col.name)}>
                                                        <Save size={14} />
                                                    </Button>
                                                    <Button size="icon-sm" variant="ghost" className="h-8 w-8" onClick={() => setEditingCol(null)}>
                                                        <X size={14} />
                                                    </Button>
                                                </>
                                            ) : (
                                                <>
                                                    <Button variant="ghost" size="icon-sm" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => {
                                                        setEditColData({ ...col });
                                                        setEditingCol(col.name);
                                                    }}>
                                                        <Edit2 size={14} />
                                                    </Button>
                                                    <Button variant="ghost" size="icon-sm" className="h-8 w-8 text-destructive/70 hover:text-destructive hover:bg-destructive/10" onClick={() => setColToDelete(col.name)}>
                                                        <Trash2 size={14} />
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Column Dialog */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add New Column</DialogTitle>
                        <DialogDescription>Add a column to {tableName}.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <label className="text-right text-xs font-bold">Name</label>
                            <Input value={newColName} onChange={e => setNewColName(e.target.value)} className="col-span-3" placeholder="e.g. email_address" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <label className="text-right text-xs font-bold">Type</label>
                            {/* Simple select for common types, can be expanded */}
                            <select 
                                className="col-span-3 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={newColType}
                                onChange={e => setNewColType(e.target.value)}
                            >
                                <option value="TEXT">TEXT / VARCHAR</option>
                                <option value="INTEGER">INTEGER / INT</option>
                                <option value="REAL">REAL / FLOAT</option>
                                <option value="BOOLEAN">BOOLEAN</option>
                                <option value="BLOB">BLOB</option>
                                <option value="DATE">DATE</option>
                                <option value="DATETIME">DATETIME</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <label className="text-right text-xs font-bold">Default</label>
                            <Input value={newColDefault} onChange={e => setNewColDefault(e.target.value)} className="col-span-3" placeholder="Optional" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <div className="col-start-2 col-span-3 flex items-center space-x-2">
                                <Checkbox id="nullable" checked={newColNullable} onCheckedChange={(c) => setNewColNullable(!!c)} />
                                <label htmlFor="nullable" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                    Allow Null Values
                                </label>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                        <Button onClick={handleAddColumn} disabled={!newColName || adding}>
                            {adding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Add Column
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Confirm Delete */}
            <ConfirmDialog 
                open={!!colToDelete}
                onOpenChange={(o) => !o && setColToDelete(null)}
                title="Drop Column"
                description={`Are you sure you want to drop column '${colToDelete}'? This may result in data loss.`}
                confirmText="Drop Column"
                variant="destructive"
                onConfirm={handleDropColumn}
            />
        </div>
    );
}
