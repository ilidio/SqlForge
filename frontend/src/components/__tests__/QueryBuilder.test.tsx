import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryBuilder } from '../QueryBuilder';
import { api } from '../../api';

// Mock dependencies
vi.mock('../../api', () => ({
  api: {
    getSchemaDetails: vi.fn(),
  },
}));

// Mock React Flow to avoid canvas issues in JSDOM
vi.mock('reactflow', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="react-flow-canvas">{children}</div>,
  Background: () => <div>Background</div>,
  Controls: () => <div>Controls</div>,
  Panel: ({ children }: any) => <div>{children}</div>,
  useNodesState: () => [[], vi.fn(), vi.fn()],
  useEdgesState: () => [[], vi.fn(), vi.fn()],
  Position: { Left: 'left', Right: 'right' },
  Handle: () => <div />,
  MarkerType: { ArrowClosed: 'arrowclosed' },
  addEdge: vi.fn(),
}));

describe('QueryBuilder', () => {
  it('renders loading state initially', () => {
    (api.getSchemaDetails as any).mockReturnValue(new Promise(() => {})); // Never resolves
    render(<QueryBuilder connectionId="test-id" onRunQuery={vi.fn()} />);
    expect(screen.getByText(/Loading Builder/i)).toBeInTheDocument();
  });

  it('renders tables sidebar after loading', async () => {
    (api.getSchemaDetails as any).mockResolvedValue([
      { name: 'users', columns: [{ name: 'id', type: 'INTEGER' }], foreign_keys: [] },
      { name: 'orders', columns: [{ name: 'id', type: 'INTEGER' }], foreign_keys: [] },
    ]);

    render(<QueryBuilder connectionId="test-id" onRunQuery={vi.fn()} />);

    // Wait for loading to finish
    await screen.findByText('users');
    
    expect(screen.getByText('users')).toBeInTheDocument();
    expect(screen.getByText('orders')).toBeInTheDocument();
    expect(screen.getByText('Tables')).toBeInTheDocument();
  });

  it('renders Run Query button', async () => {
    (api.getSchemaDetails as any).mockResolvedValue([]);
    render(<QueryBuilder connectionId="test-id" onRunQuery={vi.fn()} />);
    
    await screen.findByText('Run Query');
    expect(screen.getByText('Run Query')).toBeInTheDocument();
  });
});
