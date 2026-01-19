import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { Table, FileText, Zap, Cpu, Terminal, Box, Search, LayoutGrid, List } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  connectionId: string;
  onOpenTable: (tableName: string) => void;
  onOpenQuery: () => void;
}

export const ObjectBrowserTab: React.FC<Props> = ({ connectionId, onOpenTable, onOpenQuery }) => {
  const [items, setItems] = useState<{name: string, type: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    setLoading(true);
    api.getTables(connectionId).then(data => {
      setItems(data);
      setLoading(false);
    });
  }, [connectionId]);

  const filtered = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));

  const getIcon = (type: string) => {
    const size = viewMode === 'grid' ? 32 : 16;
    if (type === 'view') return <FileText size={size} className="text-amber-500" />;
    if (type === 'trigger') return <Zap size={size} className="text-orange-500" />;
    if (type === 'function') return <Cpu size={size} className="text-purple-500" />;
    if (type === 'procedure') return <Terminal size={size} className="text-sky-500" />;
    if (type === 'collection') return <Box size={size} className="text-emerald-500" />;
    return <Table size={size} className="text-blue-500" />;
  };

  return (
    <div className="flex flex-col h-full bg-background animate-in fade-in duration-300">
      {/* Toolbar */}
      <div className="p-4 border-b bg-muted/20 flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative w-64">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder="Filter objects..." 
              className="pl-8 h-8 text-xs bg-background"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex bg-background border rounded-md p-0.5">
            <Button 
              variant="ghost" 
              size="icon-sm" 
              className={cn("h-7 w-7", viewMode === 'grid' && "bg-muted shadow-sm")}
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid size={14} />
            </Button>
            <Button 
              variant="ghost" 
              size="icon-sm" 
              className={cn("h-7 w-7", viewMode === 'list' && "bg-muted shadow-sm")}
              onClick={() => setViewMode('list')}
            >
              <List size={14} />
            </Button>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onOpenQuery}>New Query</Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-medium">Fetching objects...</span>
          </div>
        ) : (
          <div className={cn(
            viewMode === 'grid' 
              ? "grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4" 
              : "flex flex-col border rounded-lg divide-y bg-background"
          )}>
            {filtered.map((item, i) => (
              <div 
                key={i}
                onClick={() => item.type === 'table' && onOpenTable(item.name)}
                onDoubleClick={() => item.type === 'table' && onOpenTable(item.name)}
                className={cn(
                  "group cursor-pointer transition-all",
                  viewMode === 'grid' 
                    ? "flex flex-col items-center justify-center p-4 rounded-xl border bg-background hover:border-primary hover:shadow-md"
                    : "flex items-center gap-3 px-4 py-2 hover:bg-primary/5"
                )}
              >
                <div className={cn(
                  "rounded-lg flex items-center justify-center transition-colors",
                  viewMode === 'grid' ? "w-16 h-16 bg-muted/30 mb-3 group-hover:bg-primary/10" : ""
                )}>
                  {getIcon(item.type)}
                </div>
                <div className={cn(
                  "flex-1 overflow-hidden",
                  viewMode === 'grid' ? "text-center" : ""
                )}>
                  <div className="text-xs font-bold truncate text-foreground">{item.name}</div>
                  <div className="text-[10px] text-muted-foreground uppercase font-medium">{item.type}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
