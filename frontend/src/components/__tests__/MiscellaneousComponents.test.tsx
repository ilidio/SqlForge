import { render, waitFor, screen } from '@testing-library/react';
import { vi, expect, test, beforeEach } from 'vitest';
import BackupWizard from '../BackupWizard';
import MonitorDashboard from '../MonitorDashboard';
import { ObjectBrowserTab } from '../ObjectBrowserTab';
import { ERDiagramTab } from '../ERDiagramTab';
import { ThemeProvider } from '../../lib/ThemeContext';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value.toString(); }),
    clear: vi.fn(() => { store = {}; }),
    removeItem: vi.fn((key: string) => { delete store[key]; })
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock API
vi.mock('../../api', () => ({
  api: {
    getConnections: vi.fn().mockResolvedValue([
      { id: '1', name: 'Test DB', type: 'sqlite' }
    ]),
    getTables: vi.fn().mockResolvedValue([
      { name: 'users', type: 'table' }
    ]),
    getSchemaDetails: vi.fn().mockResolvedValue([
      { name: 'users', columns: [], foreign_keys: [] }
    ]),
  }
}));

// Mock ReactFlow
vi.mock('reactflow', () => ({
  default: ({ children }: any) => <div data-testid="react-flow">{children}</div>,
  Background: () => <div data-testid="rf-background" />,
  Controls: () => <div data-testid="rf-controls" />,
  useNodesState: (initial: any) => [initial, vi.fn(), vi.fn()],
  useEdgesState: (initial: any) => [initial, vi.fn(), vi.fn()],
  MarkerType: { ArrowClosed: 'arrowclosed' },
  Position: { Left: 'left', Right: 'right' },
  Handle: () => <div />,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

test('BackupWizard renders correctly', async () => {
  const onOpenChange = vi.fn();
  render(
    <ThemeProvider defaultTheme="dark" storageKey="test-theme">
      <BackupWizard open={true} onOpenChange={onOpenChange} mode="backup" />
    </ThemeProvider>
  );

  expect(screen.getByText(/Create Backup/i)).toBeInTheDocument();
  expect(screen.getByText(/Select Target Connection/i)).toBeInTheDocument();
});

test('MonitorDashboard renders correctly', async () => {
    const onOpenChange = vi.fn();
    render(
        <ThemeProvider defaultTheme="dark" storageKey="test-theme">
            <MonitorDashboard open={true} onOpenChange={onOpenChange} />
        </ThemeProvider>
    );

    expect(screen.getByText(/Server Monitor/i)).toBeInTheDocument();
    expect(screen.getByText(/Real-time performance diagnostics/i)).toBeInTheDocument();
});

test('ObjectBrowserTab renders and shows tables', async () => {
    const onOpenTable = vi.fn();
    const onOpenQuery = vi.fn();
    
    render(
        <ThemeProvider defaultTheme="dark" storageKey="test-theme">
            <ObjectBrowserTab 
                connectionId="1" 
                onOpenTable={onOpenTable} 
                onOpenQuery={onOpenQuery} 
            />
        </ThemeProvider>
    );

    await waitFor(() => {
        expect(screen.getByText('users')).toBeInTheDocument();
    });
});

test('ERDiagramTab renders react-flow', async () => {
    render(
        <ThemeProvider defaultTheme="dark" storageKey="test-theme">
            <ERDiagramTab connectionId="1" />
        </ThemeProvider>
    );

    await waitFor(() => {
        expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    });
});
