import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Save, Sparkles, Settings as SettingsIcon, Shield, RefreshCw } from 'lucide-react';
import { api } from '../api';
import { toast } from 'sonner';

interface SettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export default function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
    // AI Settings
    const [geminiApiKey, setGeminiApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
    const [aiModel, setAiModel] = useState(() => localStorage.getItem('ai_model') || 'gemini-1.5-flash');
    const [availableModels, setAvailableModels] = useState<{name: string, display_name: string}[]>([]);
    const [fetchingModels, setFetchingModels] = useState(false);
    const [openAiApiKey, setOpenAiApiKey] = useState(() => localStorage.getItem('openai_api_key') || '');
    const [preferredAi, setPreferredAi] = useState(() => localStorage.getItem('preferred_ai') || 'gemini');

    // General Settings
    const [autoExecute, setAutoExecute] = useState(() => localStorage.getItem('auto_execute') === 'true');
    const [maxRows, setMaxRows] = useState(() => parseInt(localStorage.getItem('max_rows') || '100'));

    useEffect(() => {
        if (open) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setGeminiApiKey(localStorage.getItem('gemini_api_key') || '');
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setAiModel(localStorage.getItem('ai_model') || 'gemini-1.5-flash');
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setOpenAiApiKey(localStorage.getItem('openai_api_key') || '');
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setPreferredAi(localStorage.getItem('preferred_ai') || 'gemini');
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setAutoExecute(localStorage.getItem('auto_execute') === 'true');
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setMaxRows(parseInt(localStorage.getItem('max_rows') || '100'));
        }
    }, [open]);

    const fetchModels = async () => {
        if (!geminiApiKey) {
            toast.warning("Please enter an API Key first.");
            return;
        }
        setFetchingModels(true);
        try {
            const models = await api.getAiModels(geminiApiKey);
            setAvailableModels(models);
        } catch {
            toast.error("Failed to fetch models. Check your API key.");
        } finally {
            setFetchingModels(false);
        }
    };

    const handleSaveAI = () => {
        localStorage.setItem('gemini_api_key', geminiApiKey);
        localStorage.setItem('ai_model', aiModel);
        localStorage.setItem('openai_api_key', openAiApiKey);
        localStorage.setItem('preferred_ai', preferredAi);
        toast.success('AI settings saved!');
    };

    const handleSaveGeneral = () => {
        localStorage.setItem('auto_execute', String(autoExecute));
        localStorage.setItem('max_rows', String(maxRows));
        toast.success('General settings saved!');
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl p-0 overflow-hidden gap-0">
                <DialogHeader className="p-6 bg-muted/30 border-b">
                    <DialogTitle className="flex items-center gap-2">
                        <SettingsIcon size={18} className="text-primary" />
                        Application Settings
                    </DialogTitle>
                    <DialogDescription>Configure your workspace, AI assistants, and preferences.</DialogDescription>
                </DialogHeader>
                
                <Tabs defaultValue="ai" className="w-full flex flex-col h-[400px]">
                    <div className="px-6 py-2 bg-muted/10 border-b">
                        <TabsList className="bg-transparent h-10 p-0 gap-6">
                            <TabsTrigger value="ai" data-testid="tab-ai" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 h-10 gap-2">
                                <Sparkles size={14} /> AI Assistants
                            </TabsTrigger>
                            <TabsTrigger value="general" data-testid="tab-general" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 h-10 gap-2">
                                <SettingsIcon size={14} /> General
                            </TabsTrigger>
                            <TabsTrigger value="security" data-testid="tab-security" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 h-10 gap-2">
                                <Shield size={14} /> Security
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <div className="flex-1 overflow-auto p-6">
                        <TabsContent value="ai" className="mt-0 space-y-6">
                            <div className="space-y-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="preferred-ai">Preferred AI Assistant</Label>
                                    <select 
                                        id="preferred-ai"
                                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                        value={preferredAi}
                                        onChange={(e) => setPreferredAi(e.target.value)}
                                    >
                                        <option value="gemini">Google Gemini</option>
                                        <option value="openai">OpenAI ChatGPT</option>
                                    </select>
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="gemini-key">Google Gemini API Key</Label>
                                    <Input 
                                        id="gemini-key"
                                        type="password"
                                        placeholder="Enter your Gemini API Key"
                                        value={geminiApiKey} 
                                        onChange={e => setGeminiApiKey(e.target.value)} 
                                    />
                                    <p className="text-[10px] text-muted-foreground">Used for generating SQL from natural language descriptions.</p>
                                </div>

                                <div className="grid gap-2">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="ai-model">AI Model</Label>
                                        <Button 
                                            variant="ghost" 
                                            size="icon-sm" 
                                            className="h-6 w-6 text-primary"
                                            onClick={fetchModels}
                                            loading={fetchingModels}
                                            title="Refresh models from Google"
                                        >
                                            {!fetchingModels && <RefreshCw size={12} />}
                                        </Button>
                                    </div>
                                    {availableModels.length > 0 ? (
                                        <select 
                                            id="ai-model"
                                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                            value={aiModel}
                                            onChange={(e) => setAiModel(e.target.value)}
                                        >
                                            {availableModels.map(m => (
                                                <option key={m.name} value={m.name}>{m.display_name}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <Input 
                                            id="ai-model"
                                            placeholder="e.g. gemini-1.5-flash"
                                            value={aiModel} 
                                            onChange={e => setAiModel(e.target.value)} 
                                        />
                                    )}
                                    <p className="text-[10px] text-muted-foreground">Specify the model to use (e.g., gemini-1.5-pro, gemini-1.5-flash).</p>
                                </div>

                                <div className="grid gap-2 opacity-50">
                                    <Label htmlFor="openai-key">OpenAI API Key (Coming Soon)</Label>
                                    <Input 
                                        id="openai-key"
                                        type="password"
                                        disabled
                                        placeholder="Enter your OpenAI API Key"
                                        value={openAiApiKey} 
                                        onChange={e => setOpenAiApiKey(e.target.value)} 
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end pt-4">
                                <Button onClick={handleSaveAI} className="gap-2">
                                    <Save size={14} /> Save AI Settings
                                </Button>
                            </div>
                        </TabsContent>

                        <TabsContent value="general" className="mt-0 space-y-6">
                            <div className="space-y-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="max-rows">Default Max Rows</Label>
                                    <Input 
                                        id="max-rows"
                                        type="number"
                                        value={maxRows} 
                                        onChange={e => setMaxRows(parseInt(e.target.value))} 
                                    />
                                    <p className="text-[10px] text-muted-foreground">The maximum number of rows to retrieve by default when opening a table.</p>
                                </div>

                                <div className="flex items-center gap-2">
                                    <input 
                                        type="checkbox" 
                                        id="auto-execute"
                                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                        checked={autoExecute}
                                        onChange={e => setAutoExecute(e.target.checked)}
                                    />
                                    <Label htmlFor="auto-execute">Auto-execute AI-generated queries</Label>
                                </div>
                            </div>
                            <div className="flex justify-end pt-4">
                                <Button onClick={handleSaveGeneral} className="gap-2">
                                    <Save size={14} /> Save Preferences
                                </Button>
                            </div>
                        </TabsContent>

                        <TabsContent value="security" className="mt-0 space-y-4">
                             <div className="flex flex-col items-center justify-center py-8 text-center">
                                <Shield size={48} className="text-muted-foreground/20 mb-4" />
                                <h3 className="text-sm font-semibold">Security Settings</h3>
                                <p className="text-xs text-muted-foreground mt-1 max-w-[280px]">
                                    Configure encrypted storage for connection passwords and secure API key management.
                                </p>
                                <Button variant="outline" size="sm" className="mt-4" disabled>Configure Vault</Button>
                             </div>
                        </TabsContent>
                    </div>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
