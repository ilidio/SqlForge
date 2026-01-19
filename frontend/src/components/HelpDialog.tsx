import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HelpCircle, Keyboard, Info, Book, ExternalLink, Github } from 'lucide-react';

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
        { key: 'F5 or ⌘ + Enter', desc: 'Execute Query' },
        { key: 'F8', desc: 'Focus Object Browser' },
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

                        <TabsContent value="docs" className="mt-0 space-y-4">
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold">Getting Started</h3>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    SqlForge is designed to be a lightweight but powerful database management tool. 
                                    Connect to your databases via the Sidebar or the <strong>File</strong> menu.
                                </p>
                                <div className="p-4 rounded-lg bg-primary/5 border border-primary/10">
                                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-primary mb-2">Pro Tip</h4>
                                    <p className="text-xs">Use the Command Palette (⌘K) to quickly jump between features without using your mouse.</p>
                                </div>
                                <Button variant="outline" size="sm" className="w-full gap-2">
                                    <ExternalLink size={14} /> Open Full Documentation
                                </Button>
                            </div>
                        </TabsContent>

                        <TabsContent value="about" className="mt-0 flex flex-col items-center justify-center py-8 text-center">
                            <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 shadow-inner">
                                <HelpCircle size={40} className="text-primary" />
                            </div>
                            <h2 className="text-xl font-bold tracking-tight">SqlForge</h2>
                            <p className="text-sm text-muted-foreground mt-1">Version 1.0.0 (Stable)</p>
                            <p className="text-xs text-muted-foreground mt-6 max-w-sm">
                                A modern, open-source database client inspired by the classics, 
                                built for speed and AI-native productivity.
                            </p>
                            <div className="flex gap-4 mt-8">
                                <Button variant="ghost" size="sm" className="gap-2">
                                    <Github size={14} /> GitHub
                                </Button>
                                <Button variant="ghost" size="sm" className="gap-2">
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
