import { render, screen } from '@testing-library/react';
import { Logo } from '../ui/Logo';
import { expect, test } from 'vitest';

test('renders full logo with text', () => {
  render(<Logo variant="full" />);
  expect(screen.getByText(/Sql/i)).toBeInTheDocument();
  expect(screen.getByText(/Forge/i)).toBeInTheDocument();
  expect(screen.getByText(/AI-Powered Workbench/i)).toBeInTheDocument();
});

test('renders icon only variant', () => {
  render(<Logo variant="icon" />);
  expect(screen.queryByText(/Sql/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/AI-Powered Workbench/i)).not.toBeInTheDocument();
});
