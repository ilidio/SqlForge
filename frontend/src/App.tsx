import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { QueryTab, type QueryTabHandle } from './components/QueryTab';
import { ObjectBrowserTab } from './components/ObjectBrowserTab';
import { ResultsTable, type ResultsTableHandle } from './components/ResultsTable';
import { ConnectionModal } from './components/ConnectionModal';
import { Logo } from './components/ui/Logo';
import { MenuBar } from './components/MenuBar';
import { CommandPalette } from './components/CommandPalette';
import SettingsDialog from './components/SettingsDialog';
import HelpDialog from './components/HelpDialog';
import SyncWizard from './components/SyncWizard';
import BackupWizard from './components/BackupWizard';
import MonitorDashboard from './components/MonitorDashboard';
import { ConfirmDialog } from './components/ui/ConfirmDialog';
import { api, type ConnectionConfig } from './api';
import { useTheme } from './lib/ThemeContext';
import { Toaster, toast } from 'sonner';
import { X, Database, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Tab {
  id: string;
  title: string;
  type: 'query' | 'table' | 'browser';
  connectionId: string;
  content?: string; // For query: sql; For table: tableName
  data?: {columns: string[], rows: Record<string, unknown>[], error: string | null};
}

function App() {
  const { theme, setTheme } = useTheme();
  const activeQueryTabRef = React.useRef<QueryTabHandle>(null);
  const activeTableTabRef = React.useRef<ResultsTableHandle>(null);
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
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [connectionToDelete, setConnectionToDelete] = useState<string | null>(null);

  useEffect(() => {
    setLoadingConnections(true);
    api.getConnections().then(conns => {
        setConnections(conns);
        setLoadingConnections(false);
    });
  }, [refreshTrigger]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Command Palette (⌘K)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
      
      // New Query (⌘Q) - Requires an active connection
      if ((e.metaKey || e.ctrlKey) && e.key === 'q') {
          e.preventDefault();
          if (selectedConnectionId) {
              handleOpenQuery(selectedConnectionId);
          } else if (connections.length > 0) {
              handleOpenQuery(connections[0].id!);
          }
      }

      // New Connection (⌘N)
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
          e.preventDefault();
          setIsModalOpen(true);
      }

      // Settings (⌘,)
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
          e.preventDefault();
          setIsSettingsOpen(true);
      }

      // Undo (⌘Z)
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
          if (activeTabId && tabs.find(t => t.id === activeTabId)?.type === 'query') {
              // native usually works, but we can force it
              activeQueryTabRef.current?.undo();
          }
      }

      // Redo (⌘Y or ⌘⇧Z)
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
          if (activeTabId && tabs.find(t => t.id === activeTabId)?.type === 'query') {
              activeQueryTabRef.current?.redo();
          }
      }

      // Execute Query (F5 or ⌘Enter)
      if (e.key === 'F5' || ((e.metaKey || e.ctrlKey) && e.key === 'Enter')) {
          if (activeTabId && tabs.find(t => t.id === activeTabId)?.type === 'query') {
              e.preventDefault();
              activeQueryTabRef.current?.executeQuery();
          }
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
  }, [selectedConnectionId, connections, activeTabId, tabs]);

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
          toast.error("Error opening Object Browser");
      }
  };

  const handleSelectTable = async (connId: string, tableName: string) => {
    const maxRows = localStorage.getItem('max_rows') || '100';
    const sql = `SELECT * FROM ${tableName} LIMIT ${maxRows}`;
    
    // Optimistically create the tab
    const tabId = Math.random().toString(36).substring(7);
    const newTab: Tab = {
      id: tabId,
      title: tableName,
      type: 'table',
      connectionId: connId,
      content: tableName,
      data: { columns: [], rows: [], error: null }
    };
    
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(tabId);

    try {
        const res = await api.runQuery(connId, sql);
        setTabs(prev => prev.map(t => t.id === tabId ? { ...t, data: res } : t));
    } catch (e: any) {
        setTabs(prev => prev.map(t => t.id === tabId ? { ...t, data: { columns: [], rows: [], error: e.message } } : t));
    }
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

  const handleDeleteConfirm = async () => {
      if (!connectionToDelete) return;
      try {
          await api.deleteConnection(connectionToDelete);
          setRefreshTrigger(prev => prev + 1);
          setTabs(tabs.filter(t => t.connectionId !== connectionToDelete));
          if (selectedConnectionId === connectionToDelete) setSelectedConnectionId(null);
          toast.success("Connection deleted successfully");
      } catch {
          toast.error("Error deleting connection");
      } finally {
          setConnectionToDelete(null);
      }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-background text-foreground overflow-hidden font-sans">
      <MenuBar 
        hasActiveTab={!!activeTabId}
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
          
          if (action === 'test_connection' && (selectedConnectionId || activeTab?.connectionId)) {
              const connId = activeTab?.connectionId || selectedConnectionId;
              try {
                  const conns = await api.getConnections();
                  const conn = conns.find(c => c.id === connId);
                  if (conn) {
                      const res = await api.testConnection(conn);
                      toast.info(`${conn.name}: ${res.message}`);
                  }
              } catch {
                  toast.error("Error testing connection");
              }
          }
          if ((action === 'edit_connection' || action === 'connection_properties') && (selectedConnectionId || activeTab?.connectionId)) {
              const connId = activeTab?.connectionId || selectedConnectionId;
              try {
                  const conns = await api.getConnections();
                  const conn = conns.find(c => c.id === connId);
                  if (conn) {
                      setEditingConnection(conn);
                      setIsModalOpen(true);
                  }
              } catch {
                  toast.error("Error loading connection data");
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
                  toast.error("Error duplicating connection");
              }
          }
          if (action === 'delete_connection' && (selectedConnectionId || activeTab?.connectionId)) {
              const connId = activeTab?.connectionId || selectedConnectionId;
              setConnectionToDelete(connId || null);
              setIsConfirmDeleteOpen(true);
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
          if (action === 'undo') activeQueryTabRef.current?.undo();
          if (action === 'redo') activeQueryTabRef.current?.redo();
          if (action === 'focus_editor') activeQueryTabRef.current?.focus();
          if (action === 'focus_results') {
              if (activeTab?.type === 'query') activeQueryTabRef.current?.focusResults();
              else if (activeTab?.type === 'table') activeTableTabRef.current?.focus();
          }

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
                {activeTab.type === 'table' && (
                  <ResultsTable 
                    ref={activeTableTabRef}
                    key={activeTab.id}
                    data={activeTab.data || {columns: [], rows: [], error: null}} 
                    connectionId={activeTab.connectionId}
                    tableName={activeTab.content}
                    onRefresh={async () => {
                        const maxRows = localStorage.getItem('max_rows') || '100';
                        const res = await api.runQuery(activeTab.connectionId, `SELECT * FROM ${activeTab.content} LIMIT ${maxRows}`);
                        setTabs(prev => prev.map(t => t.id === activeTab.id ? { ...t, data: res } : t));
                    }}
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
                <Logo size={120} className="mb-8" />
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

      <ConfirmDialog 
        open={isConfirmDeleteOpen}
        onOpenChange={setIsConfirmDeleteOpen}
        title="Delete Connection"
        description="Are you sure you want to delete this connection? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
      />

      <Toaster theme={theme as 'light' | 'dark'} richColors />
    </div>
  );
}

export default App;