import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { api, SessionSummary } from '../api';
import { Sparkles, Calendar, Coffee, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

interface BriefingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BriefingDialog({ open, onOpenChange }: BriefingDialogProps) {
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadBriefing();
    }
  }, [open]);

  const loadBriefing = async () => {
    setLoading(true);
    try {
      // Use API key from local storage if available for better summaries
      const apiKey = localStorage.getItem('ai_api_key') || undefined;
      const data = await api.getDailyBriefing(apiKey);
      setSummary(data);
    } catch (e) {
      console.error("Failed to load briefing", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden border-2 border-primary/20 shadow-2xl">
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 border-b shrink-0">
          <div className="flex items-start gap-4">
            <div className="bg-background p-3 rounded-full shadow-sm border border-primary/20">
              <Coffee className="text-primary w-8 h-8" strokeWidth={1.5} />
            </div>
            <div className="space-y-1">
              <DialogTitle className="text-2xl font-light tracking-tight">Daily Briefing</DialogTitle>
              <DialogDescription className="text-base font-medium text-foreground/80">
                {summary?.date ? format(new Date(summary.date), 'EEEE, MMMM do, yyyy') : 'Loading...'}
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
              <Sparkles className="animate-spin text-primary w-8 h-8 opacity-50" />
              <p className="text-sm text-muted-foreground animate-pulse">Analyzing your recent database activity...</p>
            </div>
          ) : summary ? (
            <div className="flex flex-col">
              {/* AI Summary Section */}
              <div className="p-6 bg-muted/10 space-y-4">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <p className="text-lg leading-relaxed font-light text-foreground/90">
                    {summary.summary}
                  </p>
                </div>
              </div>

              {/* Timeline Section */}
              <div className="px-6 pb-6 pt-2">
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 mt-4 flex items-center gap-2">
                  <Calendar size={12} /> Activity Timeline
                </h3>
                
                <div className="relative border-l border-border/50 ml-3 space-y-6">
                  {summary.timelines.length === 0 ? (
                    <div className="pl-6 py-2 text-sm text-muted-foreground italic">
                      No significant activity recorded yet.
                    </div>
                  ) : (
                    summary.timelines.map((item) => (
                      <div key={item.id} className="relative pl-6 group">
                        <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-muted-foreground/30 ring-4 ring-background group-hover:bg-primary transition-colors" />
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-mono text-muted-foreground">
                            {format(new Date(item.dateTime), 'h:mm a')}
                          </span>
                          <p className="text-sm text-foreground/80 group-hover:text-foreground transition-colors">
                            {item.content}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              Failed to load briefing.
            </div>
          )}
        </div>

        <DialogFooter className="p-4 bg-muted/30 border-t shrink-0">
            <div className="w-full flex justify-between items-center">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Sparkles size={10} /> Powered by Chronos AI
                </span>
                <Button onClick={() => onOpenChange(false)}>Dismiss</Button>
            </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
