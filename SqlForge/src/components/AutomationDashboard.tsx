import { useState, useEffect } from 'react';
import { api, type ScheduledTask, type TaskHistory, type ConnectionConfig } from '../api';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { ScrollArea } from './ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Play, Trash2, Clock, Database, RefreshCw, Plus, Activity } from 'lucide-react';

const formatDateTime = (date: Date | string, pattern: 'PPP p' | 'MMM d, HH:mm:ss' = 'MMM d, HH:mm:ss') => {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return 'Never';
    
    if (pattern === 'PPP p') {
        return new Intl.DateTimeFormat('en-US', {
            dateStyle: 'long',
            timeStyle: 'short'
        }).format(d);
    }
    
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).format(d);
};

interface AutomationDashboardProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function AutomationDashboard({ open, onOpenChange }: AutomationDashboardProps) {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [history, setHistory] = useState<TaskHistory[]>([]);
  const [connections, setConnections] = useState<ConnectionConfig[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<ScheduledTask | null>(null);

  // New Task State
  const [newTask, setNewTask] = useState<Partial<ScheduledTask>>({
    name: '',
    task_type: 'backup',
    enabled: true,
    schedule_config: { type: 'cron', expression: '0 0 * * *' }, // Daily midnight default
    task_config: {}
  });

  useEffect(() => {
    if (open) {
        loadData();
    }
  }, [open]);

  const loadData = async () => {
    try {
      const [tasksData, historyData, connsData] = await Promise.all([
        api.getScheduledTasks(),
        api.getTaskHistory(),
        api.getConnections()
      ]);
      setTasks(tasksData);
      setHistory(historyData);
      setConnections(connsData);
    } catch (err) {
      console.error("Failed to load automation data", err);
    }
  };

  const handleCreateTask = async () => {
    if (!newTask.name || !newTask.task_type) return;

    let finalTask = { ...newTask };
    if (finalTask.task_type === 'batch' && typeof finalTask.task_config === 'string') {
        try {
            finalTask.task_config = { steps: JSON.parse(finalTask.task_config) };
        } catch (e) {
            alert("Invalid JSON in batch configuration.");
            return;
        }
    }

    try {
      await api.saveScheduledTask(finalTask as ScheduledTask);
      setIsCreateOpen(false);
      loadData();
      setNewTask({
        name: '',
        task_type: 'backup',
        enabled: true,
        schedule_config: { type: 'cron', expression: '0 0 * * *' },
        task_config: {}
      });
    } catch (err) {
      console.error("Failed to create task", err);
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!confirm("Are you sure you want to delete this task?")) return;
    try {
      await api.deleteScheduledTask(id);
      loadData();
      if (selectedTask?.id === id) setSelectedTask(null);
    } catch (err) {
      console.error("Failed to delete task", err);
    }
  };

  const handleRunTask = async (id: string) => {
    try {
      await api.runTaskManually(id);
      // Wait a bit then refresh history
      setTimeout(loadData, 2000);
    } catch (err) {
      console.error("Failed to run task", err);
    }
  };

  const renderTaskConfig = () => {
    switch (newTask.task_type) {
      case 'backup':
        return (
          <div className="space-y-2">
            <Label>Target Connection</Label>
            <select 
              className="w-full p-2 border rounded bg-background text-foreground"
              value={newTask.task_config?.connection_id || ''}
              onChange={e => setNewTask({
                ...newTask, 
                task_config: { ...newTask.task_config, connection_id: e.target.value }
              })}
            >
              <option value="">Select Connection</option>
              {connections.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
              ))}
            </select>
          </div>
        );
      case 'query':
        return (
            <div className="space-y-2">
              <Label>Connection</Label>
              <select 
                className="w-full p-2 border rounded bg-background text-foreground"
                value={newTask.task_config?.connection_id || ''}
                onChange={e => setNewTask({
                  ...newTask, 
                  task_config: { ...newTask.task_config, connection_id: e.target.value }
                })}
              >
                <option value="">Select Connection</option>
                {connections.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <Label>SQL Query</Label>
              <textarea 
                className="w-full p-2 border rounded bg-background text-foreground min-h-[100px]"
                value={newTask.task_config?.sql || ''}
                onChange={e => setNewTask({
                  ...newTask, 
                  task_config: { ...newTask.task_config, sql: e.target.value }
                })}
                placeholder="INSERT INTO logs ..."
              />
            </div>
          );
      case 'sync':
        return (
            <div className="space-y-2">
                <Label>Source Connection</Label>
                <select 
                  className="w-full p-2 border rounded bg-background text-foreground"
                  value={newTask.task_config?.source_connection_id || ''}
                  onChange={e => setNewTask({
                    ...newTask, 
                    task_config: { ...newTask.task_config, source_connection_id: e.target.value }
                  })}
                >
                  <option value="">Select Source</option>
                  {connections.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>

                <Label>Target Connection</Label>
                <select 
                  className="w-full p-2 border rounded bg-background text-foreground"
                  value={newTask.task_config?.target_connection_id || ''}
                  onChange={e => setNewTask({
                    ...newTask, 
                    task_config: { ...newTask.task_config, target_connection_id: e.target.value }
                  })}
                >
                  <option value="">Select Target</option>
                  {connections.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                
                <div className="flex items-center space-x-2">
                    <input 
                        type="checkbox" 
                        id="dryRun"
                        checked={newTask.task_config?.dry_run || false}
                        onChange={e => setNewTask({
                            ...newTask, 
                            task_config: { ...newTask.task_config, dry_run: e.target.checked }
                        })}
                    />
                    <Label htmlFor="dryRun">Dry Run (Check only)</Label>
                </div>
            </div>
        );
      case 'batch':
        return (
            <div className="space-y-2">
                <Label>Batch Steps (JSON)</Label>
                <textarea 
                    className="w-full p-2 border rounded bg-background text-foreground min-h-[150px] font-mono text-xs"
                    defaultValue={JSON.stringify(newTask.task_config?.steps || [
                        { type: "query", config: { connection_id: "...", sql: "..." } },
                        { type: "backup", config: { connection_id: "..." } }
                    ], null, 2)}
                    onChange={e => setNewTask({ ...newTask, task_config: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Define a list of steps to execute sequentially.</p>
            </div>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl h-[85vh] p-0 overflow-hidden flex flex-col gap-0">
            <DialogHeader className="p-6 bg-muted/30 border-b shrink-0">
                <div className="flex justify-between items-center">
                    <div>
                        <DialogTitle className="text-2xl font-bold tracking-tight">Automation & Scheduling</DialogTitle>
                        <DialogDescription>Manage scheduled backups, syncs, and query jobs.</DialogDescription>
                    </div>
                    
                    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                        <DialogTrigger asChild>
                            <Button><Plus className="mr-2 h-4 w-4" /> Create Task</Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px]">
                            <DialogHeader>
                                <DialogTitle>Create Scheduled Task</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>Task Name</Label>
                                    <Input 
                                        value={newTask.name} 
                                        onChange={e => setNewTask({...newTask, name: e.target.value})} 
                                        placeholder="Daily Backup"
                                    />
                                </div>
                            
                                <div className="space-y-2">
                                    <Label>Type</Label>
                                    <select 
                                        className="w-full p-2 border rounded bg-background text-foreground"
                                        value={newTask.task_type} 
                                        onChange={e => setNewTask({...newTask, task_type: e.target.value as any})}
                                    >
                                        <option value="backup">Backup Database</option>
                                        <option value="sync">Schema Sync</option>
                                        <option value="query">Run SQL Query</option>
                                        <option value="batch">Batch Job (Sequence)</option>
                                    </select>
                                </div>

                                {renderTaskConfig()}

                                <div className="space-y-2">
                                    <Label>Schedule (Cron Expression)</Label>
                                    <Input 
                                        value={newTask.schedule_config?.expression || ''} 
                                        onChange={e => setNewTask({
                                            ...newTask, 
                                            schedule_config: { type: 'cron', expression: e.target.value }
                                        })}
                                        placeholder="0 0 * * * (Daily at midnight)"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Format: Min Hour Day Month DayOfWeek. e.g. "0 2 * * 0" (Sun 2AM).
                                    </p>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button onClick={handleCreateTask}>Save Task</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </DialogHeader>

            <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-3">
                {/* Task List */}
                <div className="border-r bg-muted/5 flex flex-col h-full overflow-hidden">
                    <div className="p-4 border-b bg-muted/10">
                        <h3 className="font-semibold flex items-center gap-2"><Clock size={16} /> Scheduled Tasks</h3>
                    </div>
                    <ScrollArea className="flex-1">
                        <div className="p-4 space-y-3">
                            {tasks.map(task => (
                            <div 
                                key={task.id} 
                                className={`p-3 border rounded-lg cursor-pointer hover:bg-accent transition-colors ${selectedTask?.id === task.id ? 'bg-accent border-primary' : 'bg-background'}`}
                                onClick={() => setSelectedTask(task)}
                            >
                                <div className="flex justify-between items-start">
                                <div>
                                    <h4 className="font-semibold text-sm">{task.name}</h4>
                                    <div className="flex items-center text-xs text-muted-foreground mt-1 gap-1">
                                        <code className="bg-muted px-1 rounded">{task.schedule_config.expression || 'Interval'}</code>
                                    </div>
                                    <div className="flex items-center text-xs text-muted-foreground mt-1">
                                        {task.task_type === 'backup' && <Database className="w-3 h-3 mr-1" />}
                                        {task.task_type === 'sync' && <RefreshCw className="w-3 h-3 mr-1" />}
                                        {task.task_type === 'query' && <Activity className="w-3 h-3 mr-1" />}
                                        <span className="uppercase text-[10px] font-bold">{task.task_type}</span>
                                    </div>
                                </div>
                                <div className="flex space-x-1">
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); handleRunTask(task.id!); }}>
                                        <Play className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id!); }}>
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                                </div>
                            </div>
                            ))}
                            {tasks.length === 0 && (
                                <div className="text-center text-muted-foreground py-8 text-sm">
                                    No scheduled tasks found.
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </div>

                {/* Details & History */}
                <div className="col-span-2 flex flex-col h-full overflow-hidden bg-background">
                    <Tabs defaultValue="history" className="h-full flex flex-col">
                        <div className="px-6 py-2 border-b flex justify-between items-center bg-muted/5">
                            <div>
                                <h3 className="font-semibold">{selectedTask ? selectedTask.name : "System History"}</h3>
                                <p className="text-xs text-muted-foreground">
                                    {selectedTask 
                                        ? `Last run: ${selectedTask.last_run ? formatDateTime(selectedTask.last_run, 'PPP p') : 'Never'}`
                                        : "Showing execution logs for all tasks"}
                                </p>
                            </div>
                            <TabsList>
                                <TabsTrigger value="history">History</TabsTrigger>
                                <TabsTrigger value="config" disabled={!selectedTask}>Configuration</TabsTrigger>
                            </TabsList>
                        </div>
                        
                        <TabsContent value="history" className="flex-1 m-0 overflow-hidden">
                            <ScrollArea className="h-full w-full">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/50 sticky top-0 z-10 text-xs uppercase font-bold text-muted-foreground">
                                        <tr>
                                            <th className="p-3 text-left">Time</th>
                                            <th className="p-3 text-left">Task</th>
                                            <th className="p-3 text-left">Status</th>
                                            <th className="p-3 text-left">Duration</th>
                                            <th className="p-3 text-left">Result</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {history
                                            .filter(h => !selectedTask || h.task_id === selectedTask.id)
                                            .map(h => (
                                            <tr key={h.id} className="hover:bg-muted/30">
                                                <td className="p-3 whitespace-nowrap">{formatDateTime(h.timestamp)}</td>
                                                <td className="p-3 text-muted-foreground font-mono text-xs">
                                                    {tasks.find(t => t.id === h.task_id)?.name || h.task_id.substring(0,8)}
                                                </td>
                                                <td className="p-3">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                                                        h.status === 'success' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-destructive/10 text-destructive'
                                                    }`}>
                                                        {h.status}
                                                    </span>
                                                </td>
                                                <td className="p-3 font-mono text-xs">{h.duration_ms.toFixed(0)}ms</td>
                                                <td className="p-3 max-w-[300px] truncate text-muted-foreground font-mono text-xs" title={JSON.stringify(h.result, null, 2)}>
                                                    {JSON.stringify(h.result)}
                                                </td>
                                            </tr>
                                        ))}
                                        {history.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="p-12 text-center text-muted-foreground">
                                                    No history available.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </ScrollArea>
                        </TabsContent>
                        
                        <TabsContent value="config" className="flex-1 m-0 p-6 overflow-auto">
                            {selectedTask && (
                                <div className="space-y-6 max-w-2xl">
                                    <div className="space-y-2">
                                        <h3 className="text-sm font-bold uppercase text-muted-foreground">Schedule Configuration</h3>
                                        <div className="bg-muted p-4 rounded-lg font-mono text-sm border">
                                            {JSON.stringify(selectedTask.schedule_config, null, 2)}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-sm font-bold uppercase text-muted-foreground">Task Configuration</h3>
                                        <div className="bg-muted p-4 rounded-lg font-mono text-sm border overflow-auto">
                                            {JSON.stringify(selectedTask.task_config, null, 2)}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
            
            <DialogFooter className="p-4 bg-muted/30 border-t shrink-0">
                <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Close</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
  );
}
