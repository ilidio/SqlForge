import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MenuBar } from '../MenuBar'

describe('MenuBar', () => {
  it('renders correctly', () => {
    render(<MenuBar />)
    expect(screen.getByText('File')).toBeInTheDocument()
    expect(screen.getByText('Edit')).toBeInTheDocument()
    expect(screen.getByText('SqlForge')).toBeInTheDocument()
  })

  it('opens menu on click', () => {
    render(<MenuBar />)
    const fileMenu = screen.getByText('File')
    fireEvent.click(fileMenu)
    expect(screen.getByText('New Connection...')).toBeInTheDocument()
  })

  it('triggers onAction when a menu item is clicked', () => {
    const onAction = vi.fn()
    render(<MenuBar onAction={onAction} />)
    
    const fileMenu = screen.getByText('File')
    fireEvent.click(fileMenu)
    
    const newConnItem = screen.getByText('New Connection...')
    fireEvent.click(newConnItem)
    
    expect(onAction).toHaveBeenCalledWith('new_connection')
  })
})
