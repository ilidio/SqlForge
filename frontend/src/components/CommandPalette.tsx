import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Search, Terminal, Settings, Sparkles, Plus, Zap, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Command {
    id: string;
    label: string;
    description: string;
    icon: React.ReactNode;
    shortcut?: string;
    action: () => void;
}

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onAction: (action: string) => void;
}

export const CommandPalette: React.FC<Props> = ({ open, onOpenChange, onAction }) => {
    const [search, setSearch] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);

    const commands: Command[] = [
        { id: 'new-query', label: 'New Query', description: 'Open a new SQL editor tab', icon: <Terminal size={16}/>, shortcut: '⌘Q', action: () => onAction('new_query') },
        { id: 'new-conn', label: 'New Connection', description: 'Set up a new database connection', icon: <Plus size={16}/>, shortcut: '⌘N', action: () => onAction('new_connection') },
        { id: 'settings', label: 'Open Settings', description: 'Configure application preferences', icon: <Settings size={16}/>, shortcut: '⌘,', action: () => onAction('open_settings') },
        { id: 'ai-chat', label: 'Ask AI Copilot', description: 'Generate SQL using natural language', icon: <Sparkles size={16} className="text-purple-500"/>, action: () => onAction('ai_copilot') },
        { id: 'refresh', label: 'Refresh Metadata', description: 'Reload tables and schemas from database', icon: <Zap size={16} className="text-amber-500"/>, action: () => onAction('refresh') },
        { id: 'docs', label: 'Documentation', description: 'Open SqlForge documentation', icon: <FileText size={16}/>, action: () => onAction('docs') },
        { id: 'toggle-sidebar', label: 'Toggle Sidebar', description: 'Show or hide the Object Browser', icon: <Zap size={16}/>, shortcut: 'F8', action: () => onAction('toggle_sidebar') },
        { id: 'toggle-theme', label: 'Toggle Theme', description: 'Switch between light and dark mode', icon: <Zap size={16}/>, action: () => onAction('toggle_theme') },
    ];

    const filtered = commands.filter(c => 
        c.label.toLowerCase().includes(search.toLowerCase()) || 
        c.description.toLowerCase().includes(search.toLowerCase())
    );

    // Reset index when filtered list changes, but using a effect that doesn't trigger on every render if possible
    useEffect(() => {
        if (selectedIndex >= filtered.length && filtered.length > 0) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setSelectedIndex(0);
        }
    }, [filtered.length, selectedIndex]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(i => (i + 1) % filtered.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(i => (i - 1 + filtered.length) % filtered.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (filtered[selectedIndex]) {
                filtered[selectedIndex].action();
                onOpenChange(false);
            }
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="p-0 max-w-xl top-[20%] translate-y-0 border-none bg-transparent shadow-none gap-0">
                <DialogTitle className="sr-only">Command Palette</DialogTitle>
                <DialogDescription className="sr-only">Search and execute commands</DialogDescription>
                <div className="bg-popover border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col">
                    <div className="flex items-center px-4 py-3 border-b border-border bg-muted/30">
                        <Search size={18} className="text-muted-foreground mr-3" />
                        <input 
                            autoFocus
                            className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground"
                            placeholder="Type a command or search..."
                            value={search}
                            onChange={e => {
                                setSearch(e.target.value);
                                setSelectedIndex(0);
                            }}
                            onKeyDown={handleKeyDown}
                        />
                        <div className="px-1.5 py-0.5 rounded border border-border bg-background text-[10px] text-muted-foreground font-mono">
                            ESC
                        </div>
                    </div>
                    
                    <div className="max-h-[300px] overflow-y-auto p-2">
                        {filtered.length > 0 ? (
                            filtered.map((cmd, i) => (
                                <div 
                                    key={cmd.id}
                                    className={cn(
                                        "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all",
                                        selectedIndex === i ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                                    )}
                                    onClick={() => {
                                        cmd.action();
                                        onOpenChange(false);
                                    }}
                                    onMouseEnter={() => setSelectedIndex(i)}
                                >
                                    <div className={cn(
                                        "w-8 h-8 rounded-md flex items-center justify-center border",
                                        selectedIndex === i ? "bg-primary-foreground/10 border-primary-foreground/20" : "bg-background border-border"
                                    )}>
                                        {cmd.icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium leading-none mb-1">{cmd.label}</div>
                                        <div className={cn(
                                            "text-[10px] truncate",
                                            selectedIndex === i ? "text-primary-foreground/70" : "text-muted-foreground"
                                        )}>{cmd.description}</div>
                                    </div>
                                    {cmd.shortcut && (
                                        <div className={cn(
                                            "text-[10px] font-mono px-1.5 py-0.5 rounded",
                                            selectedIndex === i ? "bg-primary-foreground/10 text-primary-foreground" : "bg-muted text-muted-foreground"
                                        )}>
                                            {cmd.shortcut}
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="py-12 text-center text-muted-foreground">
                                <Search size={32} className="mx-auto mb-3 opacity-20" />
                                <p className="text-sm">No results for "{search}"</p>
                            </div>
                        )}
                    </div>
                    
                    <div className="px-4 py-2 border-t border-border bg-muted/30 text-[10px] text-muted-foreground flex gap-4">
                        <div className="flex items-center gap-1.5">
                            <span className="px-1 py-0.5 rounded border border-border bg-background">↑↓</span> to navigate
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="px-1 py-0.5 rounded border border-border bg-background">ENTER</span> to select
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};