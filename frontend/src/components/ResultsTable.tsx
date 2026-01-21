import React, { useState, useEffect, useImperativeHandle, forwardRef, useRef } from 'react';
import { AlertCircle, CheckCircle, Database, Layers, Save, RotateCcw, Trash2 } from 'lucide-react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { api } from '../api';

interface Props {
  connectionId?: string;
  tableName?: string;
  dbType?: string;
  data: {
    columns: string[];
    rows: Record<string, unknown>[];
    error: string | null;
  } | null;
  onRefresh?: () => void;
  onSelectKey?: (key: string) => void;
}

export interface ResultsTableHandle {
    focus: () => void;
}

export const ResultsTable = forwardRef<ResultsTableHandle, Props>(({ connectionId, tableName, dbType, data, onRefresh, onSelectKey }, ref) => {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [editingCell, setEditingCell] = useState<{rowIndex: number, column: string} | null>(null);
  const [changes, setChanges] = useState<Record<string, unknown>>({}); 
  const [deletedRows, setDeletedRows] = useState<Set<number>>(new Set());
  const [editValue, setEditValue] = useState<string>('');
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    setChanges({});
    setDeletedRows(new Set());
    setEditingCell(null);
  }, [data]);

  useImperativeHandle(ref, () => ({
    focus: () => {
        // Focus the scroll area container
        const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
        if (viewport instanceof HTMLElement) {
            viewport.tabIndex = -1;
            viewport.focus();
        }
    }
  }));

  const handleApplyChanges = async () => {
    if (!connectionId || !tableName || !data) return;
    setApplying(true);
    
    try {
        const operations: any[] = [];
        Array.from(deletedRows).forEach(rowIndex => {
            const originalRow = data.rows[rowIndex];
            operations.push({ type: 'delete', table: tableName, where: originalRow });
        });

        const rowIndices = new Set(Object.keys(changes).map(k => k.split('-')[0]));
        for (const idxStr of Array.from(rowIndices)) {
            const rowIndex = parseInt(idxStr);
            if (deletedRows.has(rowIndex)) continue;
            
            const originalRow = data.rows[rowIndex];
            const updates: Record<string, any> = {};
            Object.keys(changes).forEach(key => {
                const [r, col] = key.split('-');
                if (parseInt(r) === rowIndex) {
                    updates[col] = changes[key];
                }
            });

            if (Object.keys(updates).length > 0) {
                operations.push({ type: 'update', table: tableName, data: updates, where: originalRow });
            }
        }

        if (operations.length > 0) {
            const res = await api.runBatchQueries(connectionId, operations);
            const errors = res.results.filter(r => !r.success);
            if (errors.length > 0) {
                toast.error(`Failed to apply changes: ${errors[0].error}`);
            } else {
                toast.success("Changes applied successfully!");
                setChanges({});
                setDeletedRows(new Set());
                onRefresh?.();
            }
        }
    } catch (e: any) {
        toast.error(`Error: ${e.message}`);
    } finally {
        setApplying(false);
    }
  };

  const toggleDeleteRow = (idx: number) => {
      setDeletedRows(prev => {
          const next = new Set(prev);
          if (next.has(idx)) next.delete(idx);
          else next.add(idx);
          return next;
      });
  };

  const startEditing = (rowIndex: number, column: string, value: unknown) => {
    setEditingCell({ rowIndex, column });
    setEditValue(String(value ?? ''));
  };

  const saveEdit = () => {
    if (editingCell) {
        const key = `${editingCell.rowIndex}-${editingCell.column}`;
        setChanges(prev => ({ ...prev, [key]: editValue }));
        setEditingCell(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveEdit();
    if (e.key === 'Escape') setEditingCell(null);
  };

  const hasChanges = Object.keys(changes).length > 0 || deletedRows.size > 0;
  const isReadOnly = !tableName;

  if (!data) {
    return (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-muted/10">
            <Database size={48} className="mb-4 opacity-10" />
            <p className="text-sm font-medium">Ready to execute query</p>
            <p className="text-xs opacity-60 mt-1">Results will appear here</p>
        </div>
    );
  }

  if (data.error) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-destructive/5">
            <AlertCircle size={32} className="mb-4 text-destructive opacity-80" />
            <h3 className="text-lg font-bold mb-2 text-destructive">Query Error</h3>
            <div className="bg-background p-4 rounded-lg border border-destructive/20 font-mono text-sm max-w-2xl w-full overflow-auto shadow-sm text-left">
                <code className="text-destructive/90 whitespace-pre-wrap">{data.error}</code>
            </div>
        </div>
      );
  }

  if (data.rows.length === 0 && data.columns.length === 0) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-emerald-500/5">
            <CheckCircle size={32} className="mb-4 text-emerald-500 opacity-80" />
            <p className="text-lg font-bold text-emerald-600">Command Executed</p>
            <span className="text-sm text-muted-foreground mt-2">The query completed successfully, but returned no rows.</span>
        </div>
      );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      {hasChanges && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-between animate-in fade-in slide-in-from-top-1">
              <div className="flex items-center gap-2 text-xs font-medium text-amber-600">
                  <RotateCcw size={14} />
                  {Object.keys(changes).length + deletedRows.size} pending changes
              </div>
              <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => { setChanges({}); setDeletedRows(new Set()); }} disabled={applying}>Discard</Button>
                  <Button variant="default" size="sm" className="h-7 text-[10px] bg-amber-600 hover:bg-amber-700 gap-1.5" onClick={handleApplyChanges} loading={applying}><Save size={12} /> Apply Changes</Button>
              </div>
          </div>
      )}

      <ScrollArea className="flex-1" ref={scrollAreaRef}>
        <table className="w-full text-left border-collapse text-xs whitespace-nowrap font-mono">
          <thead className="sticky top-0 bg-muted/80 backdrop-blur-md shadow-sm z-10">
            <tr className="border-b border-border">
              <th className="p-2.5 w-10 text-center text-muted-foreground select-none font-medium border-r border-border/50">#</th>
              {data.columns.map(col => (
                <th key={col} className="p-2.5 font-bold text-foreground select-none border-r border-border/50 bg-muted/30">
                  <div className="flex items-center gap-2"><Layers size={10} className="text-primary/70" />{col}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {data.rows.map((row, i) => {
              const isDeleted = deletedRows.has(i);
              return (
                <tr key={i} className={cn("hover:bg-primary/5 group transition-colors even:bg-muted/10", isDeleted && "bg-destructive/10 hover:bg-destructive/20 line-through opacity-60")}>
                  <td className="p-2 border-r border-border/50 text-center text-muted-foreground/60 font-medium group-hover:text-primary relative">
                      {!isReadOnly && (
                          <button 
                            className={cn("absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-background/80", isDeleted ? "text-primary" : "text-destructive")}
                            onClick={(e) => { e.stopPropagation(); toggleDeleteRow(i); }}
                            title={isDeleted ? "Restore Row" : "Delete Row"}
                          >
                              {isDeleted ? <RotateCcw size={12} /> : <Trash2 size={12} />}
                          </button>
                      )}
                      <span className={cn(isDeleted && "opacity-0")}>{i+1}</span>
                  </td>
                  {data.columns.map(col => {
                    const cellKey = `${i}-${col}`;
                    const isEditing = editingCell?.rowIndex === i && editingCell?.column === col;
                    const isChanged = changes[cellKey] !== undefined;
                    const displayValue = isChanged ? changes[cellKey] : row[col];
                    const isNull = displayValue === null;

                    return (
                      <td 
                        key={col} 
                        className={cn("p-0 border-r border-border/50 text-foreground/90 transition-colors relative min-w-[80px]", isChanged && "bg-amber-500/10", isDeleted && "pointer-events-none")}
                        onDoubleClick={() => !isDeleted && startEditing(i, col, displayValue)}
                      >
                          {isEditing ? (
                              <input 
                                autoFocus
                                className="absolute inset-0 w-full h-full bg-background border-2 border-primary outline-none px-2 z-20"
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                onBlur={saveEdit}
                                onKeyDown={handleKeyDown}
                              />
                          ) : (
                              <div className={cn(
                                "px-2 py-2 truncate",
                                dbType === 'redis' && col === 'key' && "text-primary font-bold cursor-pointer hover:underline"
                              )}
                              onClick={() => {
                                if (dbType === 'redis' && col === 'key' && onSelectKey) {
                                    onSelectKey(String(displayValue));
                                }
                              }}
                              >
                                {isNull ? <span className="text-muted-foreground/40 italic font-sans text-[10px]">NULL</span> : String(displayValue)}
                              </div>
                          )}
                          {isChanged && !isEditing && (<div className="absolute top-0 right-0 w-1.5 h-1.5 bg-amber-500 rounded-bl-sm" title={`Original: ${String(row[col])}`} />)}
                      </td>
                    );
                })}
              </tr>
              );
            })}
          </tbody>
        </table>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      <div className="bg-muted/50 border-t border-border text-muted-foreground text-[10px] px-3 py-1.5 flex justify-between items-center font-medium">
          <div className="flex items-center gap-3">
              <span>{data.rows.length} rows retrieved</span>
              <span className="opacity-30">|</span>
              <span>{data.columns.length} columns</span>
          </div>
          <div className="flex items-center gap-1 opacity-60"><CheckCircle size={10} className="text-emerald-500" />Query successful</div>
      </div>
    </div>
  );
});

ResultsTable.displayName = 'ResultsTable';
