import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import { vi, expect, test, beforeEach } from 'vitest';
import { ConnectionModal } from '../ConnectionModal';
import SettingsDialog from '../SettingsDialog';
import HelpDialog from '../HelpDialog';
import { ThemeProvider } from '../../lib/ThemeContext';
import { api } from '../../api';

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
    saveConnection: vi.fn().mockResolvedValue({ success: true }),
    testConnection: vi.fn().mockResolvedValue({ success: true, message: 'Connected' }),
    discoverConnections: vi.fn().mockResolvedValue([]),
  }
}));

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }
}));

beforeEach(() => {
  vi.clearAllMocks();
});

test('ConnectionModal handles basic input and save', async () => {
  const onClose = vi.fn();
  const onSave = vi.fn();
  
  render(
    <ThemeProvider defaultTheme="dark" storageKey="test-theme">
      <ConnectionModal isOpen={true} onClose={onClose} onSave={onSave} />
    </ThemeProvider>
  );

  expect(screen.getByText(/New Connection/i)).toBeInTheDocument();

  // Find by label instead of placeholder if possible, or just more generic placeholder
  const nameInput = screen.getByPlaceholderText(/Production DB/i);
  fireEvent.change(nameInput, { target: { value: 'My Test DB' } });
  
  // Click Save
  const saveButton = screen.getByText(/Save Connection/i);
  fireEvent.click(saveButton);

  await waitFor(() => {
      expect(api.saveConnection).toHaveBeenCalled();
      expect(onSave).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
  });
});

test('SettingsDialog renders correctly', async () => {
    const onOpenChange = vi.fn();
    render(
        <ThemeProvider defaultTheme="dark" storageKey="test-theme">
            <SettingsDialog open={true} onOpenChange={onOpenChange} />
        </ThemeProvider>
    );

    expect(screen.getByText(/Application Settings/i)).toBeInTheDocument();
    
    // Initial tab is AI Assistants
    expect(screen.getByText(/Preferred AI Assistant/i)).toBeInTheDocument();
    expect(screen.getByText(/Google Gemini API Key/i)).toBeInTheDocument();
});

test('HelpDialog shows shortcuts', async () => {
    const onOpenChange = vi.fn();
    render(
        <ThemeProvider defaultTheme="dark" storageKey="test-theme">
            <HelpDialog open={true} onOpenChange={onOpenChange} initialTab="shortcuts" />
        </ThemeProvider>
    );

    expect(screen.getByText(/Keyboard Shortcuts/i)).toBeInTheDocument();
    expect(screen.getByText(/Execute Query/i)).toBeInTheDocument();
});
