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
import ExportWizard from './components/ExportWizard';
import MonitorDashboard from './components/MonitorDashboard';
...
  const [isBackupOpen, setIsBackupOpen] = useState(false);
  const [backupMode, setBackupMode] = useState<'backup' | 'restore'>('backup');
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [exportTarget, setExportTarget] = useState<{connId: string, tableName: string} | null>(null);
  const [isMonitorOpen, setIsMonitorOpen] = useState(false);
...
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
            onEditConnection={(conn) => { setEditingConnection(conn); setIsModalOpen(true); }}
            onDeleteConnection={(id) => { setConnectionToDelete(id); setIsConfirmDeleteOpen(true); }}
            onExportTable={(connId, tableName) => { setExportTarget({connId, tableName}); setIsExportOpen(true); }}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onSelectConnection={setSelectedConnectionId}
            onRefresh={() => setRefreshTrigger(prev => prev + 1)}
          />
        )}
...
      <MonitorDashboard 
        open={isMonitorOpen} 
        onOpenChange={setIsMonitorOpen} 
      />

      <ExportWizard 
        open={isExportOpen}
        onOpenChange={setIsExportOpen}
        connectionId={exportTarget?.connId || null}
        tableName={exportTarget?.tableName || null}
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