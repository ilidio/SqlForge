import { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { api } from '../api';
import { ResultsTable } from './ResultsTable';
import { Play, Sparkles, Key, X, Download, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format } from 'sql-formatter';

interface Props {
  connectionId: string;
  initialSql?: string;
}

export interface QueryTabHandle {
  formatSql: () => void;
  runQuery: () => void;
  toggleAi: (open?: boolean) => void;
}

export const QueryTab = forwardRef<QueryTabHandle, Props>(({ connectionId, initialSql = '' }, ref) => {
  const [sql, setSql] = useState(initialSql);
  const [result, setResult] = useState<{columns: string[], rows: Record<string, unknown>[], error: string | null} | null>(null);
  const [loading, setLoading] = useState(false);
  
  // AI State
  const [showAi, setShowAi] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) setApiKey(savedKey);
  }, []);

  const saveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('gemini_api_key', key);
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

  useImperativeHandle(ref, () => ({
    formatSql,
    runQuery,
    toggleAi
  }));

  const generateSQL = async () => {
    if (!apiKey) {
      alert("Please enter a Gemini API Key first.");
      return;
    }
    setAiLoading(true);
    try {
      const res = await api.generateSQL(connectionId, aiPrompt, apiKey);
      setSql(res.sql);
      
      const autoExecute = localStorage.getItem('auto_execute') === 'true';
      if (autoExecute) {
          setTimeout(() => runQuery(), 100);
      }
    } catch (e: unknown) {
      const message = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || (e as Error).message || String(e);
      alert("AI Error: " + message);
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
                className="h-6 text-[10px] w-64 bg-transparent border-dashed border-muted-foreground/30 focus-visible:border-primary/50"
                value={apiKey}
                onChange={e => saveApiKey(e.target.value)}
              />
              <div className="text-[10px] text-muted-foreground/60 italic">Your key is stored locally in your browser.</div>
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
                className="h-7 text-xs text-primary hover:text-primary hover:bg-primary/10 gap-1.5"
              >
                <Sparkles size={12} /> AI Copilot
              </Button>
            )}
          </div>
          <div className="flex gap-2 mr-1">
             {result && result.rows && result.rows.length > 0 && (
                 <Button 
                    variant="outline"
                    size="sm"
                    onClick={exportCSV}
                    className="h-8 text-xs gap-1.5"
                 >
                    <Download size={13} /> Export CSV
                 </Button>
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
                className="absolute inset-0 w-full h-full bg-transparent text-foreground p-4 font-mono text-sm resize-none outline-none leading-relaxed selection:bg-primary/20"
                value={sql}
                onChange={e => setSql(e.target.value)}
                spellCheck={false}
                placeholder="-- Write your SQL query here..."
            />
        </div>
      </div>
      
      <div className="h-1/2 flex flex-col overflow-hidden bg-background">
         <ResultsTable data={result} />
      </div>
    </div>
  );
});

QueryTab.displayName = 'QueryTab';
