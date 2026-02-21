import { Sparkles, MessageSquare, Zap, Wand2, RefreshCw, AlertTriangle, ChevronDown } from 'lucide-react';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { cn } from '@/lib/utils';

export type AiTask = 'refactor' | 'explain' | 'optimize' | 'format' | 'fix' | 'convert';

interface AiActionsMenuProps {
  onAction: (task: AiTask) => void;
  loading: boolean;
  disabled?: boolean;
}

const actions: { id: AiTask, label: string, icon: any, color: string, description: string }[] = [
  { id: 'explain', label: 'Explain Query', icon: MessageSquare, color: 'text-blue-500', description: 'Describe logic and intent' },
  { id: 'refactor', label: 'Refactor SQL', icon: Wand2, color: 'text-indigo-500', description: 'Clean code & SARGability' },
  { id: 'optimize', label: 'Optimize Performance', icon: Zap, color: 'text-amber-500', description: 'Faster execution strategy' },
  { id: 'format', label: 'Format & Beautify', icon: RefreshCw, color: 'text-emerald-500', description: 'Style and indentation' },
  { id: 'fix', label: 'Find & Fix Errors', icon: AlertTriangle, color: 'text-rose-500', description: 'Syntax and logical fixes' },
  { id: 'convert', label: 'Convert for Dialect', icon: Sparkles, color: 'text-purple-500', description: 'Cross-DB compatibility' },
];

export function AiActionsMenu({ onAction, loading, disabled }: AiActionsMenuProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          disabled={disabled || loading}
          className={cn(
            "h-8 text-xs gap-1.5 border-primary/20 hover:border-primary/40",
            loading && "animate-pulse"
          )}
        >
          {loading ? (
            <RefreshCw size={13} className="animate-spin" />
          ) : (
            <Sparkles size={13} className="text-primary" />
          )}
          AI Actions
          <ChevronDown size={12} className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-1" align="start">
        <div className="p-2 pb-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
          AI Toolbox
        </div>
        {actions.map((action) => (
          <Button
            key={action.id}
            variant="ghost"
            size="sm"
            className="w-full justify-start h-auto py-2 px-3 gap-3"
            onClick={() => onAction(action.id)}
          >
            <div className={cn("p-1.5 rounded-md bg-muted", action.color)}>
              <action.icon size={16} />
            </div>
            <div className="flex flex-col items-start overflow-hidden">
              <span className="text-xs font-semibold">{action.label}</span>
              <span className="text-[10px] text-muted-foreground truncate w-full text-left">
                {action.description}
              </span>
            </div>
          </Button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
