import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { CommandPalette } from '../CommandPalette'

describe('CommandPalette', () => {
  it('renders correctly when open', () => {
    render(<CommandPalette open={true} onOpenChange={() => {}} onAction={() => {}} />)
    expect(screen.getByPlaceholderText('Type a command or search...')).toBeInTheDocument()
    expect(screen.getByText('New Query')).toBeInTheDocument()
  })

  it('filters commands based on search', () => {
    render(<CommandPalette open={true} onOpenChange={() => {}} onAction={() => {}} />)
    const input = screen.getByPlaceholderText('Type a command or search...')
    
    fireEvent.change(input, { target: { value: 'Settings' } })
    
    expect(screen.getByText('Open Settings')).toBeInTheDocument()
    expect(screen.queryByText('New Connection')).not.toBeInTheDocument()
  })

  it('triggers action on click', () => {
    const onAction = vi.fn()
    render(<CommandPalette open={true} onOpenChange={() => {}} onAction={onAction} />)
    
    const newQueryItem = screen.getByText('New Query')
    fireEvent.click(newQueryItem)
    
    expect(onAction).toHaveBeenCalledWith('new_query')
  })
})
