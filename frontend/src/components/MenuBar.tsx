import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Logo } from './ui/Logo';
import { 
  Database, Settings, Plus, FolderOpen, Save, Zap, Cpu, HelpCircle, Terminal, Sparkles, Edit2, X
} from 'lucide-react';

interface MenuItem {
    label?: string;
    icon?: React.ReactNode;
    shortcut?: string;
    onClick?: () => void;
    children?: MenuItem[];
    divider?: boolean;
    disabled?: boolean;
}

interface MenuProps {
    onAction?: (action: string) => void;
    hasActiveTab?: boolean;
    activeTabType?: string;
    hasSelectedConnection?: boolean;
    hasConnections?: boolean;
}

export const MenuBar: React.FC<MenuProps> = ({ onAction, hasActiveTab, activeTabType, hasSelectedConnection, hasConnections }) => {
    const [openMenu, setOpenMenu] = useState<string | null>(null);

    const menus: Record<string, MenuItem[]> = {
        File: [
            { label: 'New Connection...', icon: <Plus size={14}/>, shortcut: 'Ctrl+N', onClick: () => onAction?.('new_connection') },
            { divider: true },
            { label: 'New Query', icon: <Terminal size={14}/>, shortcut: 'Ctrl+Q', onClick: () => onAction?.('new_query'), disabled: !hasConnections && !hasActiveTab },
            { label: 'Save Query', icon: <Save size={14}/>, shortcut: 'Ctrl+S', disabled: !hasActiveTab },
            { divider: true },
            { label: 'Settings', icon: <Settings size={14}/>, shortcut: 'Ctrl+,', onClick: () => onAction?.('open_settings') },
        ],
        Edit: [
            { label: 'Undo', shortcut: 'Ctrl+Z', onClick: () => onAction?.('undo'), disabled: !hasActiveTab },
            { label: 'Redo', shortcut: 'Ctrl+Y', onClick: () => onAction?.('redo'), disabled: !hasActiveTab },
            { divider: true },
            { label: 'Format SQL', icon: <Zap size={14}/>, shortcut: 'Ctrl+Shift+F', onClick: () => onAction?.('format_sql'), disabled: !hasActiveTab },
        ],
        View: [
            { label: 'Object Browser', shortcut: 'F8', onClick: () => onAction?.('open_browser'), disabled: !hasConnections },
            { label: 'Toggle Sidebar', onClick: () => onAction?.('toggle_sidebar') },
            { label: 'Query Editor', shortcut: 'F9', onClick: () => onAction?.('focus_editor'), disabled: activeTabType !== 'query' },
            { label: 'Result Grid', shortcut: 'F10', onClick: () => onAction?.('focus_results'), disabled: !['query', 'table'].includes(activeTabType || '') },
            { divider: true },
            { label: 'Full Screen', shortcut: 'F11', onClick: () => onAction?.('toggle_fullscreen') },
            { label: 'Toggle Dark Mode', onClick: () => onAction?.('toggle_theme') },
        ],
        Connection: [
            { label: 'Connect', icon: <Zap size={14} className="text-emerald-500"/>, onClick: () => onAction?.('connect'), disabled: !hasConnections && !hasActiveTab },
            { label: 'Disconnect', icon: <X size={14} className="text-destructive"/>, onClick: () => onAction?.('disconnect'), disabled: !hasSelectedConnection && !hasActiveTab },
            { label: 'Reconnect', onClick: () => onAction?.('reconnect'), disabled: !hasSelectedConnection && !hasActiveTab },
            { label: 'Test Connection', onClick: () => onAction?.('test_connection'), disabled: !hasConnections && !hasActiveTab },
            { divider: true },
            { label: 'Edit Connection...', icon: <Edit2 size={14}/>, onClick: () => onAction?.('edit_connection'), disabled: !hasSelectedConnection && !hasActiveTab },
            { label: 'Duplicate Connection', onClick: () => onAction?.('duplicate_connection'), disabled: !hasSelectedConnection && !hasActiveTab },
            { label: 'Delete Connection', icon: <X size={14} className="text-destructive"/>, onClick: () => onAction?.('delete_connection'), disabled: !hasSelectedConnection && !hasActiveTab },
            { divider: true },
            { label: 'Refresh Metadata', icon: <Zap size={14} className="text-amber-500"/>, onClick: () => onAction?.('refresh_metadata'), disabled: !hasSelectedConnection && !hasActiveTab },
            { label: 'Properties', icon: <Settings size={14}/>, onClick: () => onAction?.('connection_properties'), disabled: !hasSelectedConnection && !hasActiveTab },
        ],
        Tools: [
            { label: 'Data Transfer...', icon: <Database size={14}/>, onClick: () => onAction?.('data_transfer'), disabled: !hasConnections },
            { label: 'Data Synchronization...', onClick: () => onAction?.('data_sync'), disabled: !hasConnections },
            { label: 'Structure Synchronization...', onClick: () => onAction?.('struct_sync'), disabled: !hasConnections },
            { divider: true },
            { label: 'Backup...', icon: <Save size={14}/>, onClick: () => onAction?.('backup'), disabled: !hasConnections },
            { label: 'Restore...', onClick: () => onAction?.('restore'), disabled: !hasConnections },
            { divider: true },
            { label: 'AI Assistant', icon: <Sparkles size={14} className="text-purple-500"/>, onClick: () => onAction?.('ai_copilot'), disabled: !hasActiveTab },
            { label: 'Server Monitor', icon: <Cpu size={14}/>, onClick: () => onAction?.('monitor'), disabled: !hasConnections },
        ],
        Help: [
            { label: 'Documentation', icon: <HelpCircle size={14}/>, onClick: () => onAction?.('open_docs') },
            { label: 'Keyboard Shortcuts', onClick: () => onAction?.('open_shortcuts') },
            { divider: true },
            { label: 'About SqlForge', onClick: () => onAction?.('open_about') },
        ]
    };

    useEffect(() => {
        const handleClickOutside = () => setOpenMenu(null);
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, []);

    return (
        <div className="h-8 bg-muted/50 border-b border-border flex items-center px-2 select-none z-50">
            <div className="flex items-center gap-1">
                <div className="flex items-center gap-1.5 px-2 mr-4">
                    <Logo size={18} variant="icon" />
                    <span className="text-[11px] font-bold tracking-tighter uppercase">SqlForge</span>
                </div>
                
                {Object.keys(menus).map((menuName) => (
                    <div key={menuName} className="relative">
                        <div 
                            className={cn(
                                "px-3 py-1 rounded-sm text-[11px] font-medium cursor-default transition-colors",
                                openMenu === menuName ? "bg-accent text-accent-foreground" : "hover:bg-accent/50 text-foreground/80"
                            )}
                            onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenu(openMenu === menuName ? null : menuName);
                            }}
                            onMouseEnter={() => openMenu && setOpenMenu(menuName)}
                        >
                            {menuName}
                        </div>

                        {openMenu === menuName && (
                            <div className="absolute top-full left-0 mt-0.5 w-56 bg-popover border border-border shadow-lg rounded-md overflow-hidden py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                                {menus[menuName].map((item, idx) => (
                                    item.divider ? (
                                        <div key={idx} className="h-px bg-border my-1 mx-1" />
                                    ) : (
                                        <div 
                                            key={idx}
                                            className={cn(
                                                "flex items-center justify-between px-3 py-1.5 cursor-default group transition-colors",
                                                item.disabled ? "opacity-40 pointer-events-none" : "hover:bg-primary/10"
                                            )}
                                            onClick={() => {
                                                if (!item.disabled) {
                                                    item.onClick?.();
                                                    setOpenMenu(null);
                                                }
                                            }}
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className="w-4 flex justify-center text-muted-foreground group-hover:text-primary transition-colors">
                                                    {item.icon}
                                                </div>
                                                <span className="text-xs">{item.label}</span>
                                            </div>
                                            {item.shortcut && (
                                                <span className="text-[10px] text-muted-foreground/60 font-mono">{item.shortcut}</span>
                                            )}
                                        </div>
                                    )
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};
