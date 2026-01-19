import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import SyncWizard from '../SyncWizard';
import { vi, expect, test, beforeEach } from 'vitest';
import { api } from '../../api';

vi.mock('../../api', () => ({
  api: {
    getConnections: vi.fn().mockResolvedValue([
      { id: '1', name: 'Source DB', type: 'sqlite' },
      { id: '2', name: 'Target DB', type: 'postgresql' }
    ]),
    diffSchemas: vi.fn().mockResolvedValue({ sql: 'CREATE TABLE test (id INT);' }),
    executeSync: vi.fn().mockResolvedValue({ status: 'success', message: 'Sync complete' })
  }
}));

test('SyncWizard flow: Select Source -> Select Target -> Compare', async () => {
  const onOpenChange = vi.fn();
  render(<SyncWizard open={true} onOpenChange={onOpenChange} mode="structure" />);

  // Step 1: Select Source
  await waitFor(() => expect(screen.getByText('Source DB')).toBeInTheDocument());
  fireEvent.click(screen.getByText('Source DB'));
  fireEvent.click(screen.getByText(/Next: Select Target/i));

  // Step 2: Select Target
  await waitFor(() => expect(screen.getByText('Target DB')).toBeInTheDocument());
  fireEvent.click(screen.getByText('Target DB'));
  fireEvent.click(screen.getByText(/Compare Databases/i));

  // Step 3: Analysis
  await waitFor(() => {
    expect(screen.getByText(/Analysis Complete/i)).toBeInTheDocument();
    expect(screen.getByText(/CREATE TABLE test/i)).toBeInTheDocument();
  });
});
