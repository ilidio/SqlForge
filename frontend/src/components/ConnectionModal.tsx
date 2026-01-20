import React, { useState, useEffect } from 'react';
import { type ConnectionConfig, api } from '../api';
import { Save, Activity, Database, Server, Globe, Shield, FileCode, Plus, Sparkles, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  editingConnection?: ConnectionConfig | null;
}

export const ConnectionModal: React.FC<Props> = ({ isOpen, onClose, onSave, editingConnection }) => {
  const [config, setConfig] = useState<ConnectionConfig>({
    name: 'New Connection',
    type: 'sqlite',
    database: '',
    filepath: '',
    host: 'localhost',
    port: 5432,
    username: 'postgres',
    password: ''
  });

  const [discovering, setDiscovering] = useState(false);
  const [discoveredList, setDiscoveredList] = useState<Partial<ConnectionConfig>[]>([]);

  const handleDiscover = async () => {
    setDiscovering(true);
    setMsg('Scanning local ports...');
    try {
        const found = await api.discoverConnections();
        setDiscoveredList(found);
        if (found.length === 0) {
            setMsg('No active databases found on localhost.');
        } else {
            setMsg(`Found ${found.length} active database(s).`);
        }
    } catch {
        setMsg('Error during discovery.');
    } finally {
        setDiscovering(false);
    }
  };

  useEffect(() => {
    if (editingConnection) {
        setConfig(editingConnection);
    } else {
        setConfig({
            name: 'New Connection',
            type: 'sqlite',
            database: '',
            filepath: '',
            host: 'localhost',
            port: 5432,
            username: 'postgres',
            password: ''
        });
    }
  }, [editingConnection, isOpen]);
  const [msg, setMsg] = useState('');
  const [testing, setTesting] = useState(false);

  const handleSave = async () => {
    try {
      await api.saveConnection(config);
      onSave();
      onClose();
    } catch {
      setMsg('Error saving connection');
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setMsg('Testing connection...');
    try {
      const res = await api.testConnection(config);
      setMsg(res.message);
    } catch {
      setMsg('Connection failed');
    } finally {
      setTesting(false);
    }
  };

  const dbTypes = [
    { id: 'sqlite', name: 'SQLite', icon: Database },
    { id: 'postgresql', name: 'PostgreSQL', icon: Server },
    { id: 'mysql', name: 'MySQL', icon: Server },
    { id: 'mssql', name: 'SQL Server', icon: Server },
    { id: 'oracle', name: 'Oracle', icon: Server },
    { id: 'redis', name: 'Redis', icon: Globe },
    { id: 'mongodb', name: 'MongoDB', icon: Globe },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden gap-0">
        <DialogHeader className="p-6 bg-muted/30 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Plus size={18} className="text-primary" />
            {editingConnection ? 'Edit Connection' : 'New Connection'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {!editingConnection && (
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/10 space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Sparkles size={16} className="text-primary" />
                        <span className="text-xs font-bold uppercase tracking-wider">Auto-Discover</span>
                    </div>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-7 text-[10px] gap-1.5"
                        onClick={handleDiscover}
                        loading={discovering}
                    >
                        {!discovering && <Search size={12} />}
                        Scan Localhost
                    </Button>
                </div>
                
                {discoveredList.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                        {discoveredList.map((found, i) => (
                            <button
                                key={i}
                                onClick={() => {
                                    setConfig(prev => ({
                                        ...prev,
                                        type: found.type as ConnectionConfig['type'],
                                        host: found.host,
                                        port: found.port,
                                        name: found.name || prev.name
                                    }));
                                }}
                                className="flex items-center gap-2 px-2 py-1.5 rounded bg-background border border-border hover:border-primary/50 text-[10px] text-left transition-all"
                            >
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="font-bold truncate" title={found.name}>{found.name}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
          )}

          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="conn-name">Connection Name</Label>
              <Input 
                id="conn-name"
                placeholder="My Production DB"
                value={config.name} 
                onChange={e => setConfig({...config, name: e.target.value})}
              />
            </div>

            <div className="grid gap-2">
              <Label>Database Type</Label>
              <div className="grid grid-cols-4 gap-2">
                {dbTypes.map((db) => (
                  <button
                    key={db.id}
                    onClick={() => {
                        let port = config.port;
                        if (db.id === 'postgresql') port = 5432;
                        else if (db.id === 'mysql') port = 3306;
                        else if (db.id === 'mssql') port = 1433;
                        else if (db.id === 'oracle') port = 1521;
                        else if (db.id === 'redis') port = 6379;
                        else if (db.id === 'mongodb') port = 27017;
                        setConfig({...config, type: db.id as ConnectionConfig['type'], port});
                    }}
                    className={cn(
                      "flex flex-col items-center justify-center p-2 rounded-md border text-[10px] font-medium transition-all gap-1.5",
                      config.type === db.id 
                        ? "bg-primary/5 border-primary text-primary" 
                        : "bg-background border-border text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground"
                    )}
                  >
                    <db.icon size={16} />
                    {db.name}
                  </button>
                ))}
              </div>
            </div>

            {config.type === 'sqlite' ? (
              <div className="grid gap-2">
                <Label htmlFor="filepath" className="flex items-center gap-2">
                    <FileCode size={14} className="text-muted-foreground"/> Database File Path
                </Label>
                <Input 
                  id="filepath"
                  value={config.filepath} 
                  onChange={e => {
                      const path = e.target.value;
                      const fileName = path.split('/').pop() || '';
                      setConfig(prev => ({
                          ...prev, 
                          filepath: path,
                          name: (prev.name === 'New Connection' || prev.name === '') ? fileName || 'New Connection' : prev.name
                      }));
                  }}
                  placeholder="/Users/name/projects/data.db"
                />
              </div>
            ) : (
              <div className="grid grid-cols-6 gap-4">
                <div className="col-span-4 grid gap-2">
                  <Label htmlFor="host" className="flex items-center gap-2">
                      <Globe size={14} className="text-muted-foreground"/> Host
                  </Label>
                  <Input id="host" value={config.host} onChange={e => setConfig({...config, host: e.target.value})} />
                </div>
                <div className="col-span-2 grid gap-2">
                  <Label htmlFor="port">Port</Label>
                  <Input id="port" type="number" value={config.port} onChange={e => setConfig({...config, port: parseInt(e.target.value)})} />
                </div>
                <div className="col-span-3 grid gap-2">
                  <Label htmlFor="database" className="flex items-center gap-2">
                      <Database size={14} className="text-muted-foreground"/> Database Name
                  </Label>
                  <Input id="database" value={config.database} onChange={e => setConfig({...config, database: e.target.value})} />
                </div>
                <div className="col-span-3 grid gap-2">
                  <Label htmlFor="username" className="flex items-center gap-2">
                      <Shield size={14} className="text-muted-foreground"/> Username
                  </Label>
                  <Input id="username" value={config.username} onChange={e => setConfig({...config, username: e.target.value})} />
                </div>
                <div className="col-span-6 grid gap-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" value={config.password} onChange={e => setConfig({...config, password: e.target.value})} />
                </div>
              </div>
            )}
          </div>

          {msg && (
            <div className={cn(
                "p-3 rounded-md text-xs font-medium border",
                msg.toLowerCase().includes('failed') || msg.toLowerCase().includes('error')
                    ? "bg-destructive/5 text-destructive border-destructive/20"
                    : "bg-emerald-500/5 text-emerald-600 border-emerald-500/20"
            )}>
              {msg}
            </div>
          )}
        </div>

        <DialogFooter className="p-6 bg-muted/30 border-t flex gap-2">
          <Button variant="outline" onClick={handleTest} loading={testing} className="gap-2">
            {!testing && <Activity size={14} />}
            Test
          </Button>
          <Button onClick={handleSave} className="gap-2">
            <Save size={14} /> Save Connection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};