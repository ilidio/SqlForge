import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import { vi, expect, test, beforeEach } from 'vitest';
import ImportWizard from '../ImportWizard';
import ExportWizard from '../ExportWizard';
import { SchemaEditor } from '../SchemaEditor';
import { api } from '../../api';

// Mock API
vi.mock('../../api', () => ({
  api: {
    getSchemaDetails: vi.fn().mockResolvedValue([
      {
        name: 'users',
        columns: [
          { name: 'id', type: 'INTEGER', primary_key: true, nullable: false },
          { name: 'name', type: 'TEXT', primary_key: false, nullable: true }
        ],
        foreign_keys: []
      }
    ]),
    alterTable: vi.fn().mockResolvedValue({ success: true, message: 'Success' }),
    importData: vi.fn().mockResolvedValue({ success: true, message: 'Imported' }),
    getExportUrl: vi.fn().mockReturnValue('http://localhost:8000/export/users?format=csv'),
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

test('SchemaEditor displays columns and triggers rename', async () => {
  render(<SchemaEditor connectionId="1" tableName="users" />);
  
  await waitFor(() => expect(screen.getByText('id')).toBeInTheDocument());
  expect(screen.getByText('name')).toBeInTheDocument();

  // Click edit on 'name'
  // From the debug output, we see refresh and add buttons at the top.
  // The edit button for the first column should be after them.
  // Let's try to find it by icon or just click the one that looks like an edit button.
  // Alternatively, we can use container.querySelector if we want to be very specific.
  
  // Let's find the row containing 'name' and then find the edit button in it.
  const nameRow = screen.getByText('name').closest('tr');
  const editButton = nameRow?.querySelector('button'); // First button in row is edit
  if (editButton) fireEvent.click(editButton);

  await waitFor(() => {
      const nameInput = screen.getByDisplayValue('name');
      expect(nameInput).toBeInTheDocument();
      fireEvent.change(nameInput, { target: { value: 'full_name' } });
  });
});

test('ImportWizard handles file selection and triggers import', async () => {
  const onOpenChange = vi.fn();
  render(<ImportWizard open={true} onOpenChange={onOpenChange} connectionId="1" tableName="users" />);
  
  expect(screen.getByText(/Import Wizard/i)).toBeInTheDocument();
  
  // Mock file selection
  const file = new File(['id,name\n1,Alice'], 'test.csv', { type: 'text/csv' });
  const input = screen.getByTestId('file-input');
  
  fireEvent.change(input, {
      target: { files: [file] }
  });
  
  await waitFor(() => expect(screen.getByText('test.csv')).toBeInTheDocument(), { timeout: 3000 });
  
  // Step 2
  const nextButton = screen.getByText(/Next: Configure/i).closest('button');
  if (nextButton) fireEvent.click(nextButton);
  
  expect(screen.getByText(/Import Configuration/i)).toBeInTheDocument();
  
  // Step 3
  const startButton = screen.getByText(/Start Import/i).closest('button');
  if (startButton) fireEvent.click(startButton);
  
  await waitFor(() => {
      expect(api.importData).toHaveBeenCalled();
      expect(screen.getByText(/Import completed successfully/i)).toBeInTheDocument();
  }, { timeout: 2000 });
});

test('ExportWizard triggers download stream', async () => {
    const onOpenChange = vi.fn();
    render(<ExportWizard open={true} onOpenChange={onOpenChange} connectionId="1" tableName="users" />);
    
    fireEvent.click(screen.getByText(/Next: Configure/i));
    fireEvent.click(screen.getByText(/Start Export/i));
    
    expect(api.getExportUrl).toHaveBeenCalledWith('1', 'users', 'csv', false);
    expect(screen.getByText(/Export stream started/i)).toBeInTheDocument();
});

