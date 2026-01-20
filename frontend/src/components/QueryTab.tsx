import { useState, useEffect, useImperativeHandle, forwardRef, useRef } from 'react';
import { api } from '../api';
import { toast } from 'sonner';
import { ResultsTable } from './ResultsTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'sql-formatter';
import { cn } from '@/lib/utils';
import { Play, Sparkles, Key, X, Download, Terminal, ChevronDown, FileJson, FileCode, FileSpreadsheet } from 'lucide-react';

interface Props {
  connectionId: string;
  initialSql?: string;
}

export interface QueryTabHandle {
  formatSql: () => void;
  executeQuery: () => void;
  toggleAi: (open?: boolean) => void;
  undo: () => void;
  redo: () => void;
}

export const QueryTab = forwardRef<QueryTabHandle, Props>(({ connectionId, initialSql = '' }, ref) => {
  const [sql, setSql] = useState(initialSql);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [result, setResult] = useState<{columns: string[], rows: Record<string, unknown>[], error: string | null} | null>(null);
  const [loading, setLoading] = useState(false);
  
  // AI State
  const [showAi, setShowAi] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [aiModel, setAiModel] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    const savedKey = localStorage.getItem('gemini_api_key');
    const savedModel = localStorage.getItem('ai_model');
    if (savedKey) setApiKey(savedKey);
    if (savedModel) setAiModel(savedModel);
  }, []);

  const saveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('gemini_api_key', key);
  };

  const saveAiModel = (model: string) => {
    setAiModel(model);
    localStorage.setItem('ai_model', model);
  };

  const runQuery = async () => {
    setLoading(true);
    try {
      const res = await api.runQuery(connectionId, sql);
      setResult(res);
    } catch (e: unknown) {
      setResult({ columns: [], rows: [], error: e instanceof Error ? e.message : String(e) });
    } finally {
      setLoading(false);
    }
  };

  const formatSql = () => {
    try {
      const formatted = format(sql, { language: 'sql', keywordCase: 'upper' });
      setSql(formatted);
    } catch (e) {
      console.error("Format error", e);
    }
  };

  const toggleAi = (open?: boolean) => {
    setShowAi(open ?? !showAi);
  };

  const undo = () => {
    if (textareaRef.current) {
        textareaRef.current.focus();
        document.execCommand('undo');
    }
  };

  const redo = () => {
    if (textareaRef.current) {
        textareaRef.current.focus();
        document.execCommand('redo');
    }
  };

  useImperativeHandle(ref, () => ({
    formatSql,
    executeQuery: runQuery,
    toggleAi,
    undo,
    redo
  }));

  const generateSQL = async () => {
    if (!apiKey || !aiModel) {
      toast.warning("Please configure both Gemini API Key and AI Model in Settings first.");
      return;
    }
    setAiLoading(true);
    try {
      const res = await api.generateSQL(connectionId, aiPrompt, apiKey, aiModel);
      setSql(res.sql);
      
      const autoExecute = localStorage.getItem('auto_execute') === 'true';
      if (autoExecute) {
          setTimeout(() => runQuery(), 100);
      }
    } catch (e: unknown) {
      const message = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || (e as Error).message || String(e);
      toast.error("AI Error: " + message);
    } finally {
      setAiLoading(false);
    }
  };

  const exportCSV = () => {
    if (!result || !result.rows || result.rows.length === 0) return;
    
    const headers = result.columns.join(',');
    const rows = result.rows.map((row: Record<string, unknown>) => 
        result.columns.map((col: string) => {
            const val = row[col];
            if (val === null || val === undefined) return '';
            const strVal = String(val);
            if (strVal.includes(',') || strVal.includes('"') || strVal.includes('\n')) {
                return `"${strVal.replace(/"/g, '""')}"`;
            }
            return strVal;
        }).join(',')
    ).join('\n');
    
    const csvContent = `${headers}\n${rows}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportJSON = () => {
    if (!result || !result.rows) return;
    const blob = new Blob([JSON.stringify(result.rows, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'export.json');
    link.click();
  };

  const exportSQL = () => {
    if (!result || !result.rows || result.rows.length === 0) return;
    const tableName = 'exported_data';
    const sqlInserts = result.rows.map(row => {
        const cols = Object.keys(row).join(', ');
        const vals = Object.values(row).map(v => typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : v === null ? 'NULL' : v).join(', ');
        return `INSERT INTO ${tableName} (${cols}) VALUES (${vals});`;
    }).join('\n');
    
    const blob = new Blob([sqlInserts], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'export.sql');
    link.click();
  };

  const getInferredTable = (query: string) => {
    const q = query.trim().toUpperCase();
    // Heuristic: If it's a complex query, don't allow editing
    if (q.includes(' JOIN ') || 
        q.includes(' GROUP BY ') || 
        q.includes(' UNION ') || 
        q.includes(' DISTINCT ') || 
        q.includes(' INTERSECT ') || 
        q.includes(' EXCEPT ')) {
      return undefined;
    }
    
    // Check if there are multiple tables in FROM
    const fromMatch = query.match(/FROM\s+([a-zA-Z0-9_,\s]+)/i);
    if (fromMatch) {
        const tablesStr = fromMatch[1];
        if (tablesStr.includes(',')) return undefined; // Multiple tables
        return tablesStr.trim().split(/\s+/)[0];
    }
    return undefined;
  };

  const inferredTable = getInferredTable(sql);

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="h-1/2 flex flex-col border-b border-border relative">
        
        {/* AI Toolbar */}
        {showAi && (
          <div className="bg-primary/5 p-3 border-b border-primary/10 flex flex-col gap-3 animate-in slide-in-from-top-2 duration-200">
            <div className="flex gap-2">
              <Input 
                placeholder="Describe what you want to find (e.g., 'Total revenue by month for 2024')"
                className="flex-1 bg-background border-primary/20 focus-visible:ring-primary/30"
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && generateSQL()}
              />
              <Button 
                onClick={generateSQL}
                disabled={aiLoading}
                className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
              >
                {aiLoading ? <span className="animate-spin text-xs">⏳</span> : <Sparkles size={14} />}
                Generate SQL
              </Button>
               <Button variant="ghost" size="icon" onClick={() => setShowAi(false)} className="text-muted-foreground">
                <X size={16} />
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                <Key size={12} />
                Gemini API Key:
              </div>
              <Input 
                type="password"
                placeholder="••••••••••••••••••••"
                className="h-6 text-[10px] w-48 bg-transparent border-dashed border-muted-foreground/30 focus-visible:border-primary/50"
                value={apiKey}
                onChange={e => saveApiKey(e.target.value)}
              />
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium ml-2">
                <Terminal size={12} />
                Model:
              </div>
              <Input 
                placeholder="e.g. gemini-1.5-flash"
                className="h-6 text-[10px] w-36 bg-transparent border-dashed border-muted-foreground/30 focus-visible:border-primary/50"
                value={aiModel}
                onChange={e => saveAiModel(e.target.value)}
              />
              <div className="text-[10px] text-muted-foreground/60 italic ml-2">Your settings are stored locally.</div>
            </div>
          </div>
        )}

        {/* Main Toolbar */}
        <div className="bg-muted/30 p-1.5 flex justify-between items-center border-b border-border h-11">
          <div className="flex items-center gap-4 px-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground/70">
                <Terminal size={14} className="text-primary" />
                SQL Editor
            </div>
            {!showAi && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setShowAi(true)}
                className={cn(
                    "h-7 text-xs gap-1.5",
                    (!apiKey || !aiModel) ? "text-amber-500 hover:text-amber-600 hover:bg-amber-500/10" : "text-primary hover:text-primary hover:bg-primary/10"
                )}
              >
                <Sparkles size={12} /> 
                AI Copilot
                {(!apiKey || !aiModel) && <div className="w-1.5 h-1.5 bg-amber-500 rounded-full" title="AI not configured" />}
              </Button>
            )}
          </div>
          <div className="flex gap-2 mr-1">
             {result && result.rows && result.rows.length > 0 && (
                 <Popover>
                    <PopoverTrigger asChild>
                        <Button 
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs gap-1.5"
                        >
                            <Download size={13} /> Export <ChevronDown size={12} className="opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-40 p-1 flex flex-col gap-0.5" align="end">
                        <Button variant="ghost" size="sm" className="justify-start font-normal text-xs h-8 gap-2" onClick={exportCSV}>
                            <FileSpreadsheet size={14} className="text-emerald-500" /> CSV
                        </Button>
                        <Button variant="ghost" size="sm" className="justify-start font-normal text-xs h-8 gap-2" onClick={exportJSON}>
                            <FileJson size={14} className="text-amber-500" /> JSON
                        </Button>
                        <Button variant="ghost" size="sm" className="justify-start font-normal text-xs h-8 gap-2" onClick={exportSQL}>
                            <FileCode size={14} className="text-blue-500" /> SQL Inserts
                        </Button>
                    </PopoverContent>
                 </Popover>
             )}
             <Button 
                size="sm"
                onClick={runQuery}
                loading={loading}
                className="h-8 text-xs font-bold gap-1.5 px-4 shadow-sm"
             >
                <Play size={13} />
                Execute
             </Button>
          </div>
        </div>
        
        <div className="flex-1 relative bg-background/50">
            <textarea
                ref={textareaRef}
                className="absolute inset-0 w-full h-full bg-transparent text-foreground p-4 font-mono text-sm resize-none outline-none leading-relaxed selection:bg-primary/20"
                value={sql}
                onChange={e => setSql(e.target.value)}
                spellCheck={false}
                placeholder="-- Write your SQL query here..."
            />
        </div>
      </div>
      
      <div className="h-1/2 flex flex-col overflow-hidden bg-background">
         <ResultsTable 
            data={result} 
            connectionId={connectionId} 
            tableName={inferredTable}
            onRefresh={runQuery}
         />
      </div>
    </div>
  );
});

QueryTab.displayName = 'QueryTab';
