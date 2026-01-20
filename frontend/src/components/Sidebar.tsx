import React, { useState, useEffect } from 'react';
import { api, type ConnectionConfig } from '../api';
import { Database, Table, Plus, RefreshCw, History, Clock, ChevronRight, ChevronDown, Layers, FileText, Key, Box, Search, Settings, Zap, Cpu, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from './ui/Logo';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { type LucideIcon, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/ThemeContext';

interface Props {
  onSelectTable: (connId: string, tableName: string) => void;
  onOpenQuery: (connId: string, sql?: string) => void;
  onOpenBrowser: (connId: string) => void;
  onNewConnection: () => void;
  onOpenSettings: () => void;
  onSelectConnection?: (connId: string) => void;
  onRefresh?: () => void;
  connections: ConnectionConfig[];
  loading?: boolean;
  selectedConnectionId?: string | null;
}

const DB_ICONS: Record<string, { icon: LucideIcon, color: string }> = {
    sqlite: { icon: Database, color: 'text-blue-500' },
    postgresql: { icon: Database, color: 'text-indigo-500' },
    mysql: { icon: Database, color: 'text-orange-500' },
    mssql: { icon: Database, color: 'text-red-500' },
    oracle: { icon: Database, color: 'text-rose-600' },
    redis: { icon: Layers, color: 'text-rose-500' },
    mongodb: { icon: Box, color: 'text-emerald-500' },
};

export const Sidebar: React.FC<Props> = ({ onSelectTable, onOpenQuery, onOpenBrowser, onNewConnection, onOpenSettings, onSelectConnection, onRefresh, connections, loading, selectedConnectionId }) => {
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('connections');
  const [history, setHistory] = useState<{id: string, connection_id: string, sql: string, status: string, timestamp: string, duration_ms: number}[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [tables, setTables] = useState<Record<string, {name: string, type: string}[]>>({});
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set());
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [connectionErrors, setConnectionErrors] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState('');

  const loadHistory = async () => {
    // Keep local loading for history
    try {
        const data = await api.getHistory();
        setHistory(data);
    } catch (e) {
        console.error(e);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') loadHistory();
  }, [activeTab]);

  const toggleConnection = async (conn: ConnectionConfig) => {
    if (!conn.id) return;
    onSelectConnection?.(conn.id);
    const isExpanded = expanded[conn.id];
    setExpanded(prev => ({ ...prev, [conn.id!]: !isExpanded }));

    // If we are expanding and don't have tables (or had an error), try to fetch
    if (!isExpanded && (!tables[conn.id] || connectionErrors[conn.id])) {
        setLoadingIds(prev => new Set(prev).add(conn.id!));
        try {
            setConnectionErrors(prev => {
                const next = { ...prev };
                delete next[conn.id!];
                return next;
            });
            const t = await api.getTables(conn.id);
            setTables(prev => ({ ...prev, [conn.id!]: t }));
            setConnectedIds(prev => new Set(prev).add(conn.id!));
        } catch (e: any) {
            console.error(e);
            setConnectionErrors(prev => ({ ...prev, [conn.id!]: e.response?.data?.detail || e.message }));
            setConnectedIds(prev => {
                const next = new Set(prev);
                next.delete(conn.id!);
                return next;
            });
            // Keep it expanded so error is visible
            setExpanded(prev => ({ ...prev, [conn.id!]: true }));
        } finally {
            setLoadingIds(prev => {
                const next = new Set(prev);
                next.delete(conn.id!);
                return next;
            });
        }
    }
  };

  const getIconForTable = (type: string) => {
      if (type === 'view') return <FileText size={13} className="text-amber-500/80" />;
      if (type === 'collection') return <Box size={13} className="text-emerald-500/80" />;
      if (type === 'kv') return <Key size={13} className="text-rose-400/80" />;
      if (type === 'trigger') return <Zap size={13} className="text-orange-400/80" />;
      if (type === 'function') return <Cpu size={13} className="text-purple-400/80" />;
      if (type === 'procedure') return <Terminal size={13} className="text-sky-400/80" />;
      return <Table size={13} className="text-blue-500/80" />;
  };

  const filteredConnections = connections.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col h-full select-none text-sm shadow-sm z-20">
      {/* Search & Header */}
      <div className="p-3">
        <div className="relative group">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-foreground transition-colors" />
            <Input 
                className="pl-8 h-8 text-xs bg-sidebar-accent/50 border-sidebar-border focus-visible:ring-sidebar-ring"
                placeholder="Search connections..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
            />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <div className="px-3 pb-2">
            <TabsList className="w-full h-8 bg-sidebar-accent/50 p-1">
                <TabsTrigger value="connections" className="flex-1 text-[11px] h-6 py-0 gap-1.5 data-[state=active]:bg-sidebar data-[state=active]:shadow-sm">
                    <Database size={12} /> Explorer
                </TabsTrigger>
                <TabsTrigger value="history" className="flex-1 text-[11px] h-6 py-0 gap-1.5 data-[state=active]:bg-sidebar data-[state=active]:shadow-sm">
                    <History size={12} /> History
                </TabsTrigger>
            </TabsList>
        </div>

        <TabsContent value="connections" className="flex-1 mt-0 outline-none overflow-hidden">
            <div className="flex justify-between items-center mb-2 px-3">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Connections</span>
                <div className="flex gap-0.5">
                    <Button variant="ghost" size="icon-sm" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={onRefresh} loading={loading && activeTab === 'connections'}>
                        {!loading && <RefreshCw size={12} />}
                    </Button>
                    <Button variant="ghost" size="icon-sm" className="h-6 w-6 text-primary hover:text-primary hover:bg-primary/10" onClick={onNewConnection}><Plus size={12} /></Button>
                </div>
            </div>

            <ScrollArea className="flex-1 h-[calc(100vh-140px)] px-2">
                <div className="space-y-0.5">
                    {filteredConnections.map(conn => {
                        const IconInfo = DB_ICONS[conn.type] || DB_ICONS.sqlite;
                        const Icon = IconInfo.icon;
                        const isExpanded = expanded[conn.id!];
                        const isSelected = selectedConnectionId === conn.id;

                        return (
                            <div key={conn.id} className="group/conn px-1">
                                <div 
                                    className={cn(
                                        "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-all border border-transparent",
                                        isSelected 
                                            ? "bg-primary/10 text-primary border-l-2 border-primary rounded-l-none" 
                                            : isExpanded 
                                                ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                                                : "hover:bg-sidebar-accent/50 text-sidebar-foreground/70 hover:text-sidebar-foreground"
                                    )}
                                    onClick={() => toggleConnection(conn)}
                                    onDoubleClick={() => onOpenBrowser?.(conn.id!)}
                                >
                                    <div className="w-4 flex justify-center">
                                        {isExpanded ? <ChevronDown size={12} className={cn(isSelected ? "text-primary" : "text-muted-foreground")} /> : <ChevronRight size={12} className={cn(isSelected ? "text-primary/50" : "text-muted-foreground/50")} />}
                                    </div>
                                    <div className="relative">
                                        <Icon size={14} className={cn(isSelected ? "text-primary" : IconInfo.color, "shrink-0")} />
                                        {connectedIds.has(conn.id!) && (
                                            <div className={cn(
                                                "absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full border shadow-sm",
                                                isSelected ? "bg-primary border-background" : "bg-emerald-500 border-sidebar"
                                            )} />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0 flex flex-col">
                                        <span className={cn(
                                            "truncate text-xs leading-none",
                                            isSelected ? "font-bold" : "font-medium"
                                        )}>{conn.name}</span>
                                        {conn.type === 'sqlite' && conn.filepath && (
                                            <span className="truncate text-[9px] text-muted-foreground/60 font-mono mt-0.5" title={conn.filepath}>
                                                {conn.filepath.split('/').pop()}
                                            </span>
                                        )}
                                    </div>
                                    <Button 
                                        variant="ghost" 
                                        size="icon-sm" 
                                        className={cn(
                                            "h-5 w-5 opacity-0 group-hover/conn:opacity-100",
                                            isSelected ? "hover:bg-primary/10 text-primary" : "hover:bg-sidebar-accent"
                                        )}
                                        onClick={(e) => { e.stopPropagation(); onOpenQuery(conn.id!); }}
                                    >
                                        <Plus size={10} />
                                    </Button>
                                </div>
                                
                                {isExpanded && (
                                    <div className="ml-4 pl-2 border-l border-sidebar-border mt-0.5 space-y-2">
                                        {loadingIds.has(conn.id!) ? (
                                            <div className="text-xs text-muted-foreground/60 py-1 pl-2 flex items-center gap-2 animate-pulse">
                                                <RefreshCw size={10} className="animate-spin"/> Connecting...
                                            </div>
                                        ) : connectionErrors[conn.id!] ? (
                                            <div className="text-[10px] text-destructive bg-destructive/10 p-2 rounded mr-2 flex flex-col gap-1">
                                                <div className="font-bold flex items-center gap-1">
                                                    <X size={10} /> Connection Failed
                                                </div>
                                                <div className="opacity-80 break-words" title={connectionErrors[conn.id!]}>
                                                    {connectionErrors[conn.id!]}
                                                </div>
                                                <Button 
                                                    variant="link" 
                                                    size="sm" 
                                                    className="h-auto p-0 text-[10px] justify-start text-destructive hover:text-destructive underline"
                                                    onClick={(e) => { e.stopPropagation(); toggleConnection(conn); }}
                                                >
                                                    Retry
                                                </Button>
                                            </div>
                                        ) : tables[conn.id!] ? (
                                            ['table', 'view', 'function', 'trigger', 'procedure', 'collection', 'kv'].map(type => {
                                                const typeItems = tables[conn.id!].filter(t => t.type === type);
                                                if (typeItems.length === 0) return null;
                                                
                                                const typeLabel = type.charAt(0).toUpperCase() + type.slice(1) + 's';
                                                const groupKey = `${conn.id}-${type}`;
                                                const isGroupExpanded = expanded[groupKey] ?? true;

                                                return (
                                                    <div key={type}>
                                                        <div 
                                                            className="flex items-center gap-1.5 px-1 py-1 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tighter cursor-pointer hover:text-foreground transition-colors"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setExpanded(prev => ({ ...prev, [groupKey]: !isGroupExpanded }));
                                                            }}
                                                        >
                                                            {isGroupExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                                                            {typeLabel}
                                                        </div>
                                                        
                                                        {isGroupExpanded && (
                                                            <div className="mt-1 space-y-0.5">
                                                                {typeItems.map(t => (
                                                                    <div 
                                                                        key={t.name} 
                                                                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-sidebar-accent/50 rounded-md cursor-pointer text-muted-foreground hover:text-foreground text-xs transition-all group/table"
                                                                        onClick={() => onSelectTable(conn.id!, t.name)}
                                                                        onDoubleClick={() => onSelectTable(conn.id!, t.name)}
                                                                    >
                                                                        <div className="shrink-0">{getIconForTable(t.type)}</div>
                                                                        <span className="truncate flex-1">{t.name}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div className="text-xs text-muted-foreground/60 py-1 pl-2 flex items-center gap-2">
                                                <RefreshCw size={10} className="animate-spin"/> Loading...
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {!loading && connections.length === 0 && (
                        <div className="flex flex-col items-center justify-center p-6 text-center border border-dashed border-sidebar-border rounded-lg bg-sidebar-accent/20 mx-1 mt-4">
                            <Database size={24} className="text-muted-foreground/30 mb-2" />
                            <p className="text-xs text-muted-foreground mb-3">No connections</p>
                            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onNewConnection}>Add Connection</Button>
                        </div>
                    )}
                </div>
            </ScrollArea>
        </TabsContent>

        <TabsContent value="history" className="flex-1 mt-0 outline-none overflow-hidden">
             <div className="flex justify-between items-center mb-2 px-3">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Recent Activity</span>
                <Button variant="ghost" size="icon-sm" className="h-6 w-6 text-muted-foreground" onClick={loadHistory}><RefreshCw size={12} /></Button>
            </div>
            <ScrollArea className="flex-1 h-[calc(100vh-140px)] px-3">
                <div className="space-y-2 pb-4">
                    {history.map(h => (
                        <div 
                            key={h.id} 
                            className="p-3 bg-sidebar-accent/30 hover:bg-sidebar-accent/60 rounded-lg border border-sidebar-border cursor-pointer transition-all group shadow-xs"
                            onClick={() => onOpenQuery(h.connection_id, h.sql)}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <span className={cn(
                                    "text-[9px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider", 
                                    h.status === 'success' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-destructive/10 text-destructive border border-destructive/20'
                                )}>
                                    {h.status}
                                </span>
                                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                    <Clock size={10}/> {new Date(h.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </span>
                            </div>
                            <div className="text-xs text-foreground/80 font-mono truncate bg-background/50 p-1.5 rounded border border-sidebar-border/50">{h.sql}</div>
                            <div className="text-[10px] text-muted-foreground mt-2 flex justify-between items-center">
                                <span>{h.duration_ms.toFixed(0)}ms</span>
                                <span className="text-primary opacity-0 group-hover:opacity-100 text-[9px] flex items-center gap-1 transition-opacity">Run Again <ChevronRight size={8}/></span>
                            </div>
                        </div>
                    ))}
                    {history.length === 0 && !loading && (
                        <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground/50 italic">
                             <History size={24} className="mb-2 opacity-20" />
                             <p className="text-xs">No history yet</p>
                        </div>
                    )}
                </div>
            </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Footer */}
      <div className="p-2 border-t border-sidebar-border bg-sidebar text-[10px] text-muted-foreground/60 flex justify-between items-center">
          <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon-sm" 
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                  {theme === 'dark' ? <Sun size={12} /> : <Moon size={12} />}
              </Button>
              <div className="flex items-center gap-1.5 opacity-80">
                  <Logo size={14} variant="icon" />
                  <span className="font-bold tracking-tight">SqlForge</span>
              </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon-sm" 
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={onOpenSettings}
          >
              <Settings size={12} />
          </Button>
      </div>
    </div>
  );
};