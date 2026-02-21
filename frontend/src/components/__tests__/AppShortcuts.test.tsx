import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import App from '../../App';
import { vi, expect, test, beforeEach } from 'vitest';
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

vi.mock('../../api', () => ({
  api: {
    getConnections: vi.fn().mockResolvedValue([]),
    getHistory: vi.fn().mockResolvedValue([]),
  }
}));

// Mock Toaster/Sonner to avoid rendering issues in tests
vi.mock('sonner', () => ({
  Toaster: () => null,
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }
}));

beforeEach(() => {
  vi.clearAllMocks();
});

test('⌘K toggles Command Palette', async () => {
  const { queryByPlaceholderText } = render(
    <ThemeProvider defaultTheme="dark" storageKey="test-theme">
      <App />
    </ThemeProvider>
  );
  
  fireEvent.keyDown(window, { key: 'k', metaKey: true });
  
  await waitFor(() => {
    expect(queryByPlaceholderText(/Type a command or search/i)).toBeInTheDocument();
  });

  fireEvent.keyDown(window, { key: 'k', metaKey: true });
  
  await waitFor(() => {
    expect(queryByPlaceholderText(/Type a command or search/i)).not.toBeInTheDocument();
  });
});

test('⌘N opens New Connection modal', async () => {
  render(
    <ThemeProvider defaultTheme="dark" storageKey="test-theme">
      <App />
    </ThemeProvider>
  );
  
  fireEvent.keyDown(window, { key: 'n', metaKey: true });
  
  await waitFor(() => {
    expect(screen.getByRole('heading', { name: /New Connection/i })).toBeInTheDocument();
  });
});
