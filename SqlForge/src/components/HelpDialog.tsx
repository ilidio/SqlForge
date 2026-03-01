import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HelpCircle, Keyboard, Info, Book, ExternalLink, Github, Database, Sparkles, RefreshCw, Activity, Wand2, FileCode, ShieldCheck } from 'lucide-react';
import { Logo } from './ui/Logo';

interface HelpDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialTab?: string;
}

export default function HelpDialog({ open, onOpenChange, initialTab = 'shortcuts' }: HelpDialogProps) {
    const shortcuts = [
        { key: '⌘ + K', desc: 'Open Command Palette' },
        { key: '⌘ + Q', desc: 'New Query Tab' },
        { key: '⌘ + N', desc: 'New Connection' },
        { key: '⌘ + ,', desc: 'Open Settings' },
        { key: '⌘ + Enter', desc: 'Execute Query' },
        { key: 'F8', desc: 'Toggle Sidebar' },
        { key: 'F9', desc: 'Focus Query Editor' },
        { key: 'F10', desc: 'Focus Result Grid' },
        { key: 'F11', desc: 'Toggle Full Screen' },
        { key: 'ESC', desc: 'Close Modals / Cancel' },
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl p-0 overflow-hidden gap-0">
                <DialogHeader className="p-6 bg-muted/30 border-b">
                    <DialogTitle className="flex items-center gap-2">
                        <HelpCircle size={18} className="text-primary" />
                        Help & Documentation
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        SqlForge help, keyboard shortcuts and application information.
                    </DialogDescription>
                </DialogHeader>
                
                <Tabs defaultValue={initialTab} className="w-full flex flex-col h-[450px]">
                    <div className="px-6 py-2 bg-muted/10 border-b">
                        <TabsList className="bg-transparent h-10 p-0 gap-6">
                            <TabsTrigger value="shortcuts" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 h-10 gap-2">
                                <Keyboard size={14} /> Shortcuts
                            </TabsTrigger>
                            <TabsTrigger value="docs" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 h-10 gap-2">
                                <Book size={14} /> Documentation
                            </TabsTrigger>
                            <TabsTrigger value="about" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 h-10 gap-2">
                                <Info size={14} /> About
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <div className="flex-1 overflow-auto p-6">
                        <TabsContent value="shortcuts" className="mt-0 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                {shortcuts.map((s, i) => (
                                    <div key={i} className="flex justify-between items-center p-2 rounded-lg border bg-muted/20">
                                        <span className="text-xs font-medium text-foreground/80">{s.desc}</span>
                                        <kbd className="px-2 py-1 bg-background border rounded text-[10px] font-mono shadow-sm">{s.key}</kbd>
                                    </div>
                                ))}
                            </div>
                        </TabsContent>

                        <TabsContent value="docs" className="mt-0 space-y-6">
                            <div className="space-y-6 pb-4">
                                <section>
                                    <h3 className="text-sm font-bold flex items-center gap-2 mb-2">
                                        <Database size={14} className="text-primary" /> Multi-Database & Secure Connect
                                    </h3>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        SqlForge supports **PostgreSQL, MySQL, SQLite, SQL Server, Oracle, MongoDB, and Redis**. 
                                        Now featuring **SSH Tunneling** for securely connecting to production databases behind firewalls or bastion hosts.
                                    </p>
                                </section>

                                <section>
                                    <h3 className="text-sm font-bold flex items-center gap-2 mb-2">
                                        <Wand2 size={14} className="text-indigo-500" /> Visual Query Builder
                                    </h3>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        Build complex queries without writing code. Drag and drop tables, visually connect them to create **JOINs**, 
                                        and select columns to instantly generate valid SQL. Great for data analysts and fast prototyping.
                                    </p>
                                </section>

                                <section>
                                    <h3 className="text-sm font-bold flex items-center gap-2 mb-2">
                                        <FileCode size={14} className="text-amber-500" /> Enhanced SQL Editor
                                    </h3>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        The new editor offers a professional coding experience with **Syntax Highlighting**, **IntelliSense Autocomplete** 
                                        (schema-aware), and **Auto-Formatting**. It supports advanced features like minimap navigation and line numbers.
                                    </p>
                                </section>

                                <section>
                                    <h3 className="text-sm font-bold flex items-center gap-2 mb-2">
                                        <Sparkles size={14} className="text-purple-500" /> AI SQL Assistant & Refactorer
                                    </h3>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        Powered by **Google Gemini**, convert natural language into SQL and optimize existing code. 
                                        The **Refactorer** detects non-SARGable predicates and N+1 patterns, suggesting index-friendly rewrites on the fly.
                                    </p>
                                </section>

                                <section>
                                    <h3 className="text-sm font-bold flex items-center gap-2 mb-2">
                                        <ShieldCheck size={14} className="text-indigo-500" /> Data Privacy Masking (Safe Export)
                                    </h3>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        Export production data securely. **Privacy Mode** automatically detects PII (emails, phones, addresses) 
                                        and masks them using one-way hashing during the export stream for CSV and JSON formats.
                                    </p>
                                </section>

                                <section>
                                    <h3 className="text-sm font-bold flex items-center gap-2 mb-2">
                                        <RefreshCw size={14} className="text-emerald-500" /> Schema Sync & Data Hydrator
                                    </h3>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        Sync schemas across database types and generate massive test datasets. The **Smart Hydrator** 
                                        uses AI to inject realistic semantic data while strictly respecting **Foreign Key** relationships.
                                    </p>
                                </section>

                                <section>
                                    <h3 className="text-sm font-bold flex items-center gap-2 mb-2">
                                        <Activity size={14} className="text-red-500" /> Diagnostics & Health Score
                                    </h3>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        Monitor real-time performance and run **Health Audits**. Detect **Index Bloat**, 
                                        **Connection Exhaustion**, and **Long-Running Transactions** with a single click in the Monitoring Dashboard.
                                    </p>
                                </section>

                                <section>
                                    <h3 className="text-sm font-bold flex items-center gap-2 mb-2">
                                        <Keyboard size={14} className="text-zinc-500" /> Command Palette & Navigation
                                    </h3>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        SqlForge is built for a keyboard-first workflow. Use these shortcuts to jump between contexts:
                                    </p>
                                    <ul className="mt-2 space-y-2 list-none">
                                        <li className="text-[11px] flex items-baseline gap-2">
                                            <kbd className="px-1 bg-muted rounded text-[10px] min-w-8 text-center">⌘ K</kbd>
                                            <span><strong>Command Palette</strong>: Search tables, run commands, and switch connections.</span>
                                        </li>
                                        <li className="text-[11px] flex items-baseline gap-2">
                                            <kbd className="px-1 bg-muted rounded text-[10px] min-w-8 text-center">F9</kbd>
                                            <span><strong>Focus Query Editor</strong>: Instantly jump back to your SQL input to refine your query.</span>
                                        </li>
                                        <li className="text-[11px] flex items-baseline gap-2">
                                            <kbd className="px-1 bg-muted rounded text-[10px] min-w-8 text-center">F10</kbd>
                                            <span><strong>Focus Result Grid</strong>: Shift focus to the data table to navigate rows using arrow keys.</span>
                                        </li>
                                    </ul>
                                </section>

                                <div className="p-4 rounded-lg bg-primary/5 border border-primary/10">
                                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-primary mb-2">Advanced Tip</h4>
                                    <p className="text-xs">Right-click on any table in the Object Browser to quickly generate SELECT statements or open the Data Transfer wizard.</p>
                                </div>

                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="w-full gap-2"
                                    onClick={() => window.open('https://github.com/ilidio/SqlForge', '_blank')}
                                >
                                    <ExternalLink size={14} /> View Online Documentation
                                </Button>
                            </div>
                        </TabsContent>

                        <TabsContent value="about" className="mt-0 flex flex-col items-center justify-center py-8 text-center">
                            <Logo size={80} className="mb-6" />
                            <p className="text-sm text-muted-foreground mt-1">Version 1.0.0 (Stable)</p>
                            <p className="text-xs text-muted-foreground mt-6 max-w-sm">
                                A modern, open-source database client inspired by the classics, 
                                built for speed and AI-native productivity.
                            </p>
                            <div className="flex gap-4 mt-8">
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="gap-2"
                                    onClick={() => window.open('https://github.com/ilidio/SqlForge', '_blank')}
                                >
                                    <Github size={14} /> GitHub
                                </Button>
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="gap-2"
                                    onClick={() => window.open('https://github.com/ilidio/SqlForge', '_blank')}
                                >
                                    <ExternalLink size={14} /> Website
                                </Button>
                            </div>
                        </TabsContent>
                    </div>
                </Tabs>
                <DialogFooter className="p-4 bg-muted/30 border-t">
                    <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
