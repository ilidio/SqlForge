import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import { vi, expect, test, beforeEach } from 'vitest';
import { Sidebar } from '../Sidebar';
import { ResultsTable } from '../ResultsTable';
import { api } from '../../api';
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
      { id: '1', name: 'Test SQLite', type: 'sqlite', database: 'test.db', filepath: '/tmp/test.db' }
    ]),
    getTables: vi.fn().mockResolvedValue([
      { name: 'users', type: 'table' },
      { name: 'orders', type: 'table' }
    ]),
    getHistory: vi.fn().mockResolvedValue([]),
    runQuery: vi.fn().mockResolvedValue({ columns: ['id', 'name'], rows: [{id: 1, name: 'Alice'}], error: null }),
    runBatchQueries: vi.fn().mockResolvedValue({ results: [{success: true, error: null}] }),
  }
}));

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  }
}));

beforeEach(() => {
  vi.clearAllMocks();
});

test('Sidebar renders connections and expands to show tables', async () => {
  const onSelectTable = vi.fn();
  const onOpenQuery = vi.fn();
  const onOpenBrowser = vi.fn();
  const onOpenDiagram = vi.fn();
  const onOpenSchema = vi.fn();
  const onNewConnection = vi.fn();
  const onEditConnection = vi.fn();
  const onDeleteConnection = vi.fn();
  const onExportTable = vi.fn();
  const onImportTable = vi.fn();
  const onDropObject = vi.fn();
  const onOpenSettings = vi.fn();

  render(
    <ThemeProvider defaultTheme="dark" storageKey="test-theme">
      <Sidebar 
        connections={[{ id: '1', name: 'Test SQLite', type: 'sqlite', database: 'test.db' }]}
        onSelectTable={onSelectTable}
        onOpenQuery={onOpenQuery}
        onOpenBrowser={onOpenBrowser}
        onOpenDiagram={onOpenDiagram}
        onOpenSchema={onOpenSchema}
        onNewConnection={onNewConnection}
        onEditConnection={onEditConnection}
        onDeleteConnection={onDeleteConnection}
        onExportTable={onExportTable}
        onImportTable={onImportTable}
        onDropObject={onDropObject}
        onOpenSettings={onOpenSettings}
      />
    </ThemeProvider>
  );

  expect(screen.getByText('Test SQLite')).toBeInTheDocument();

  // Click to expand
  fireEvent.click(screen.getByText('Test SQLite'));

  await waitFor(() => {
      expect(api.getTables).toHaveBeenCalledWith('1');
      expect(screen.getByText('users')).toBeInTheDocument();
      expect(screen.getByText('orders')).toBeInTheDocument();
  });

  // Click on a table
  fireEvent.click(screen.getByText('users'));
  expect(onSelectTable).toHaveBeenCalledWith('1', 'users');
});

test('ResultsTable displays data and handles inline editing', async () => {
    const data = {
        columns: ['id', 'name'],
        rows: [
            { id: 1, name: 'Alice' },
            { id: 2, name: 'Bob' }
        ],
        error: null
    };
    const onRefresh = vi.fn();

    render(
        <ResultsTable 
            connectionId="1"
            tableName="users"
            data={data}
            onRefresh={onRefresh}
        />
    );

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();

    // Double click to edit Alice
    fireEvent.doubleClick(screen.getByText('Alice'));
    
    const input = screen.getByDisplayValue('Alice');
    fireEvent.change(input, { target: { value: 'Alicia' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    // Verify change indicator (the small amber triangle/dot)
    // We can check for "pending changes" text
    expect(screen.getByText(/1 pending changes/i)).toBeInTheDocument();

    // Click Apply
    fireEvent.click(screen.getByText(/Apply Changes/i));

    await waitFor(() => {
        expect(api.runBatchQueries).toHaveBeenCalled();
        expect(onRefresh).toHaveBeenCalled();
    });
});
