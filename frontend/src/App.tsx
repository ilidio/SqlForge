import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { QueryTab, type QueryTabHandle } from './components/QueryTab';
import { ObjectBrowserTab } from './components/ObjectBrowserTab';
import { ConnectionModal } from './components/ConnectionModal';
import { MenuBar } from './components/MenuBar';
import { CommandPalette } from './components/CommandPalette';
import SettingsDialog from './components/SettingsDialog';
import HelpDialog from './components/HelpDialog';
import SyncWizard from './components/SyncWizard';
import BackupWizard from './components/BackupWizard';
import MonitorDashboard from './components/MonitorDashboard';
import { api, type ConnectionConfig } from './api';
import { useTheme } from './lib/ThemeContext';
import { X, Database, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Tab {
  id: string;
  title: string;
  type: 'query' | 'table' | 'browser';
  connectionId: string;
  content?: string; // For query: sql; For table: tableName
}

function App() {
  const { theme, setTheme } = useTheme();
  const activeQueryTabRef = React.useRef<QueryTabHandle>(null);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [connections, setConnections] = useState<ConnectionConfig[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isSyncOpen, setIsSyncOpen] = useState(false);
  const [syncMode, setSyncMode] = useState<'structure' | 'data' | 'transfer'>('structure');
  const [isBackupOpen, setIsBackupOpen] = useState(false);
  const [backupMode, setBackupMode] = useState<'backup' | 'restore'>('backup');
  const [isMonitorOpen, setIsMonitorOpen] = useState(false);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [helpTab, setHelpTab] = useState('shortcuts');
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [editingConnection, setEditingConnection] = useState<ConnectionConfig | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    setLoadingConnections(true);
    api.getConnections().then(conns => {
        setConnections(conns);
        setLoadingConnections(false);
    });
  }, [refreshTrigger]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
      if (e.key === 'F11') {
          e.preventDefault();
          if (!document.fullscreenElement) {
              document.documentElement.requestFullscreen();
          } else if (document.exitFullscreen) {
              document.exitFullscreen();
          }
      }
      if (e.key === 'F8') {
          e.preventDefault();
          setIsSidebarVisible(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleOpenQuery = (connId: string, sql: string = 'SELECT * FROM ') => {
    const newTab: Tab = {
      id: Math.random().toString(36).substring(7),
      title: 'Query',
      type: 'query',
      connectionId: connId,
      content: sql
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(newTab.id);
  };

  const handleOpenBrowser = async (connId: string) => {
    // Check if browser for this connection is already open
    const existing = tabs.find(t => t.type === 'browser' && t.connectionId === connId);
    if (existing) {
        setActiveTabId(existing.id);
        return;
    }

    try {
        const conns = await api.getConnections();
        const conn = conns.find(c => c.id === connId);
        const newTab: Tab = {
            id: Math.random().toString(36).substring(7),
            title: conn?.name || 'Object Browser',
            type: 'browser',
            connectionId: connId
        };
        setTabs([...tabs, newTab]);
        setActiveTabId(newTab.id);
    } catch {
        alert("Error opening Object Browser");
    }
  };

  const handleSelectTable = (connId: string, tableName: string) => {
    const maxRows = localStorage.getItem('max_rows') || '100';
    const newTab: Tab = {
      id: Math.random().toString(36).substring(7),
      title: tableName,
      type: 'query',
      connectionId: connId,
      content: `SELECT * FROM ${tableName} LIMIT ${maxRows}`
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(newTab.id);
  };

  const closeTab = (id: string, e?: React.MouseEvent | { stopPropagation: () => void }) => {
    e?.stopPropagation();
    const newTabs = tabs.filter(t => t.id !== id);
    setTabs(newTabs);
    if (activeTabId === id && newTabs.length > 0) {
      setActiveTabId(newTabs[newTabs.length - 1].id);
    } else if (newTabs.length === 0) {
      setActiveTabId(null);
    }
  };

  const activeTab = tabs.find(t => t.id === activeTabId);

  return (
    <div className="flex flex-col h-screen w-screen bg-background text-foreground overflow-hidden font-sans">
      <MenuBar 
        hasActiveTab={tabs.length > 0}
        hasSelectedConnection={!!selectedConnectionId}
        hasConnections={connections.length > 0}
        onAction={async (action) => {
          if (action === 'new_query' && (activeTab || selectedConnectionId)) {
              handleOpenQuery(activeTab?.connectionId || selectedConnectionId!);
          }
          if (action === 'new_connection') {
              setEditingConnection(null);
              setIsModalOpen(true);
          }
          if (action === 'open_settings') setIsSettingsOpen(true);
          if (action === 'open_docs') { setHelpTab('docs'); setIsHelpOpen(true); }
          if (action === 'open_shortcuts') { setHelpTab('shortcuts'); setIsHelpOpen(true); }
          if (action === 'open_about') { setHelpTab('about'); setIsHelpOpen(true); }
          
          if (action === 'close_tab' && activeTabId) {
              closeTab(activeTabId);
          }

          if (action === 'test_connection' && (selectedConnectionId || activeTab?.connectionId)) {
              const connId = activeTab?.connectionId || selectedConnectionId;
              try {
                  const conns = await api.getConnections();
                  const conn = conns.find(c => c.id === connId);
                  if (conn) {
                      const res = await api.testConnection(conn);
                      alert(`${conn.name}: ${res.message}`);
                  }
              } catch {
                  alert("Error testing connection");
              }
          }
          if (action === 'edit_connection' && (selectedConnectionId || activeTab?.connectionId)) {
              const connId = activeTab?.connectionId || selectedConnectionId;
              try {
                  const conns = await api.getConnections();
                  const conn = conns.find(c => c.id === connId);
                  if (conn) {
                      setEditingConnection(conn);
                      setIsModalOpen(true);
                  }
              } catch {
                  alert("Error loading connection data");
              }
          }
          if (action === 'duplicate_connection' && (selectedConnectionId || activeTab?.connectionId)) {
              const connId = activeTab?.connectionId || selectedConnectionId;
              try {
                  const conns = await api.getConnections();
                  const conn = conns.find(c => c.id === connId);
                  if (conn) {
                      const cloned = { ...conn, id: undefined, name: `${conn.name} (Copy)` };
                      setEditingConnection(cloned);
                      setIsModalOpen(true);
                  }
              } catch {
                  alert("Error duplicating connection");
              }
          }
          if (action === 'delete_connection' && (selectedConnectionId || activeTab?.connectionId)) {
              const connId = activeTab?.connectionId || selectedConnectionId;
              if (window.confirm("Are you sure you want to delete this connection?")) {
                  try {
                      await api.deleteConnection(connId!);
                      setRefreshTrigger(prev => prev + 1);
                      if (activeTab?.connectionId === connId) {
                          // Optionally close tabs associated with this connection
                          setTabs(tabs.filter(t => t.connectionId !== connId));
                      }
                  } catch {
                      alert("Error deleting connection");
                  }
              }
          }
          if (['connect', 'reconnect', 'refresh_metadata'].includes(action) && (selectedConnectionId || activeTab?.connectionId)) {
              setRefreshTrigger(prev => prev + 1);
          }

          if (action === 'toggle_sidebar') setIsSidebarVisible(prev => !prev);
          if (action === 'open_browser' && (selectedConnectionId || activeTab?.connectionId)) {
              handleOpenBrowser(activeTab?.connectionId || selectedConnectionId!);
          }
          if (action === 'toggle_theme') setTheme(theme === 'dark' ? 'light' : 'dark');
          if (action === 'toggle_fullscreen') {
              if (!document.fullscreenElement) {
                  document.documentElement.requestFullscreen();
              } else if (document.exitFullscreen) {
                  document.exitFullscreen();
              }
          }

          if (action === 'format_sql') activeQueryTabRef.current?.formatSql();
          if (action === 'undo') document.execCommand('undo');
          if (action === 'redo') document.execCommand('redo');

          if (action === 'ai_copilot') {
              if (activeTab) {
                  activeQueryTabRef.current?.toggleAi(true);
              } else {
                  setIsSettingsOpen(true); // Direct to AI settings if no tab
              }
          }

          if (action === 'data_transfer') { setSyncMode('transfer'); setIsSyncOpen(true); }
          if (action === 'data_sync') { setSyncMode('data'); setIsSyncOpen(true); }
          if (action === 'struct_sync') { setSyncMode('structure'); setIsSyncOpen(true); }

          if (action === 'backup') { setBackupMode('backup'); setIsBackupOpen(true); }
          if (action === 'restore') { setBackupMode('restore'); setIsBackupOpen(true); }
          if (action === 'monitor') setIsMonitorOpen(true);
      }} />
      <div className="flex-1 flex overflow-hidden">
        {isSidebarVisible && (
          <Sidebar 
            key={refreshTrigger}
            connections={connections}
            loading={loadingConnections}
            selectedConnectionId={selectedConnectionId}
            onSelectTable={handleSelectTable} 
            onOpenQuery={handleOpenQuery}
            onOpenBrowser={handleOpenBrowser}
            onNewConnection={() => setIsModalOpen(true)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onSelectConnection={setSelectedConnectionId}
            onRefresh={() => setRefreshTrigger(prev => prev + 1)}
          />
        )}
        
        <div className="flex-1 flex flex-col min-w-0 bg-background">
          {/* Tab Bar */}
          <div className="flex items-center bg-muted/30 border-b border-border h-10 px-1 overflow-x-auto no-scrollbar gap-1">
            {tabs.map(tab => (
              <div 
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1 text-xs rounded-sm cursor-pointer min-w-[100px] max-w-[180px] transition-all group border border-transparent",
                  activeTabId === tab.id 
                    ? "bg-background text-foreground shadow-sm border-border" 
                    : "text-muted-foreground hover:bg-muted/50"
                )}
              >
                <Database size={12} className={cn(activeTabId === tab.id ? "text-primary" : "text-muted-foreground")} />
                <span className="truncate flex-1 font-medium">{tab.title}</span>
                <button 
                  onClick={(e) => closeTab(tab.id, e)} 
                  className="opacity-0 group-hover:opacity-100 hover:bg-muted p-0.5 rounded transition-all"
                >
                  <X size={10}/>
                </button>
              </div>
            ))}
            {tabs.length > 0 && (
                <button className="h-6 w-6 ml-1 text-muted-foreground hover:bg-muted rounded flex items-center justify-center" onClick={() => {
                    if (activeTab) handleOpenQuery(activeTab.connectionId);
                }}>
                    <Plus size={14} />
                </button>
            )}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden relative">
            {activeTab ? (
              <>
                {activeTab.type === 'query' && (
                  <QueryTab 
                    key={activeTab.id}
                    ref={activeQueryTabRef}
                    connectionId={activeTab.connectionId} 
                    initialSql={activeTab.content} 
                  />
                )}
                {activeTab.type === 'browser' && (
                  <ObjectBrowserTab 
                    key={activeTab.id}
                    connectionId={activeTab.connectionId}
                    onOpenTable={(tableName) => handleSelectTable(activeTab.connectionId, tableName)}
                    onOpenQuery={() => handleOpenQuery(activeTab.connectionId)}
                  />
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground animate-in fade-in duration-500">
                <div className="w-24 h-24 bg-primary/5 rounded-3xl flex items-center justify-center mb-6 shadow-inner border border-primary/10">
                    <Database size={48} className="text-primary/20" />
                </div>
                <div className="text-5xl font-black mb-2 opacity-20 tracking-tighter text-foreground uppercase">SqlForge</div>
                <p className="text-sm font-medium opacity-60">Select a connection or create a new one to get started.</p>
                <div className="mt-10 flex gap-3">
                    <button 
                        className="px-6 py-2.5 bg-primary text-primary-foreground font-bold rounded-lg shadow-lg shadow-primary/20 hover:brightness-110 transition-all flex items-center gap-2" 
                        onClick={() => setIsModalOpen(true)}
                    >
                        <Plus size={18} /> New Connection
                    </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConnectionModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={() => setRefreshTrigger(prev => prev + 1)}
        editingConnection={editingConnection}
      />

      <SettingsDialog 
        open={isSettingsOpen} 
        onOpenChange={setIsSettingsOpen} 
      />

      <CommandPalette 
        open={isCommandPaletteOpen} 
        onOpenChange={setIsCommandPaletteOpen}
        onAction={(action) => {
            if (action === 'new_query' && activeTab) handleOpenQuery(activeTab.connectionId);
            if (action === 'new_connection') setIsModalOpen(true);
            if (action === 'open_settings') setIsSettingsOpen(true);
            if (action === 'refresh') setRefreshTrigger(prev => prev + 1);
        }}
      />

      <HelpDialog 
        open={isHelpOpen} 
        onOpenChange={setIsHelpOpen} 
        initialTab={helpTab}
      />

      <SyncWizard 
        open={isSyncOpen} 
        onOpenChange={setIsSyncOpen} 
        mode={syncMode}
      />

      <BackupWizard 
        open={isBackupOpen} 
        onOpenChange={setIsBackupOpen} 
        mode={backupMode}
      />

      <MonitorDashboard 
        open={isMonitorOpen} 
        onOpenChange={setIsMonitorOpen} 
      />
    </div>
  );
}

export default App;