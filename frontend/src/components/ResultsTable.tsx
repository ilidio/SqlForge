import React from 'react';
import { AlertCircle, CheckCircle, Database, Layers, SearchX } from 'lucide-react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

interface Props {
  data: {
    columns: string[];
    rows: Record<string, unknown>[];
    error: string | null;
  } | null;
}

export const ResultsTable: React.FC<Props> = ({ data }) => {
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
                <code className="text-destructive/90 whitespace-pre-wrap">
                    {data.error}
                </code>
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

  if (data.rows.length === 0) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-muted/5">
            <SearchX size={32} className="mb-4 text-muted-foreground opacity-40" />
            <p className="text-lg font-bold text-foreground/70">No Results</p>
            <span className="text-sm text-muted-foreground mt-2">The query returned an empty result set.</span>
        </div>
      );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      <ScrollArea className="flex-1">
        <table className="w-full text-left border-collapse text-xs whitespace-nowrap font-mono">
          <thead className="sticky top-0 bg-muted/80 backdrop-blur-md shadow-sm z-10">
            <tr className="border-b border-border">
              <th className="p-2.5 w-10 text-center text-muted-foreground select-none font-medium border-r border-border/50">#</th>
              {data.columns.map(col => (
                <th key={col} className="p-2.5 font-bold text-foreground select-none border-r border-border/50 bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Layers size={10} className="text-primary/70" />
                    {col}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {data.rows.map((row, i) => (
              <tr key={i} className="hover:bg-primary/5 group transition-colors even:bg-muted/10">
                <td className="p-2 border-r border-border/50 text-center text-muted-foreground/60 group-hover:text-primary font-medium">{i+1}</td>
                {data.columns.map(col => {
                    const val = row[col];
                    const isNull = val === null;
                    return (
                      <td key={col} className="p-2 border-r border-border/50 text-foreground/90 selection:bg-primary/30">
                          {isNull ? <span className="text-muted-foreground/40 italic font-sans text-[10px]">NULL</span> : String(val)}
                      </td>
                    );
                })}
              </tr>
            ))}
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
          <div className="flex items-center gap-1 opacity-60">
              <CheckCircle size={10} className="text-emerald-500" />
              Query successful
          </div>
      </div>
    </div>
  );
};