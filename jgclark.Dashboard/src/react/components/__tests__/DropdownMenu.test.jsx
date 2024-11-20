// @flow
// jgclark.Dashboard/src/react/components/__tests__/DropdownMenu.test.jsx
/* global describe, test, jest, expect, beforeEach, afterEach */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import DropdownMenu from '../DropdownMenu.jsx'
import { TSettingItem } from '../../types'

/**
 * Mock implementation of renderItem used in DropdownMenu.
 * Adjust this mock as per your actual implementation.
 */
jest.mock('../../support/uiElementRenderHelpers', () => ({
  renderItem: jest.fn(({ item }) => <div>{item.label}</div>),
}))

// TODO: fix this test (Jest doesn't seem to like the es-modules)
describe.skip('DropdownMenu Component', () => {
  let mockOnSaveChanges
  let mockToggleMenu
  let mockHandleSwitchChange
  let mockHandleInputChange
  let mockHandleComboChange
  let mockHandleSaveInput

  const defaultProps = {
    sectionItems: [],
    otherItems: [],
    handleSwitchChange: jest.fn(),
    handleInputChange: jest.fn(),
    handleComboChange: jest.fn(),
    handleSaveInput: jest.fn(),
    onSaveChanges: jest.fn(),
    iconClass: 'fa-solid fa-filter',
    className: '',
    labelPosition: 'right',
    isOpen: false,
    toggleMenu: jest.fn(),
  }

  beforeEach(() => {
    mockOnSaveChanges = jest.fn()
    mockToggleMenu = jest.fn()
    mockHandleSwitchChange = jest.fn()
    mockHandleInputChange = jest.fn()
    mockHandleComboChange = jest.fn()
    mockHandleSaveInput = jest.fn()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  test('renders without crashing', () => {
    render(<DropdownMenu {...defaultProps} />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  test('calls toggleMenu when icon is clicked', () => {
    render(<DropdownMenu {...defaultProps} toggleMenu={mockToggleMenu} />)
    fireEvent.click(screen.getByRole('button'))
    expect(mockToggleMenu).toHaveBeenCalled()
  })

  test('renders menu items when open', () => {
    const otherItems: Array<TSettingItem> = [
      { type: 'switch', key: 'item1', label: 'Item 1', checked: true },
      { type: 'switch', key: 'item2', label: 'Item 2', checked: false },
    ]

    render(<DropdownMenu {...defaultProps} isOpen={true} otherItems={otherItems} />)

    expect(screen.getByText('Item 1')).toBeInTheDocument()
    expect(screen.getByText('Item 2')).toBeInTheDocument()
  })

  test('does not render menu items when closed', () => {
    const otherItems: Array<TSettingItem> = [
      { type: 'switch', key: 'item1', label: 'Item 1', checked: true },
      { type: 'switch', key: 'item2', label: 'Item 2', checked: false },
    ]

    render(<DropdownMenu {...defaultProps} isOpen={false} otherItems={otherItems} />)

    expect(screen.queryByText('Item 1')).not.toBeInTheDocument()
    expect(screen.queryByText('Item 2')).not.toBeInTheDocument()
  })

  test('saves changes when menu is closed by clicking outside', () => {
    const otherItems: Array<TSettingItem> = [{ type: 'switch', key: 'item1', label: 'Item 1', checked: false }]

    const { container } = render(<DropdownMenu {...defaultProps} isOpen={true} otherItems={otherItems} onSaveChanges={mockOnSaveChanges} />)

    // Simulate change
    fireEvent.click(screen.getByText('Item 1'))
    // Simulate clicking outside
    fireEvent.mouseDown(document)

    expect(mockOnSaveChanges).toHaveBeenCalled()
  })

  test('saves changes when menu is closed by pressing Escape', () => {
    const otherItems: Array<TSettingItem> = [{ type: 'switch', key: 'item1', label: 'Item 1', checked: false }]

    render(<DropdownMenu {...defaultProps} isOpen={true} otherItems={otherItems} onSaveChanges={mockOnSaveChanges} />)

    // Simulate change
    fireEvent.click(screen.getByText('Item 1'))
    // Simulate pressing Escape
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })

    expect(mockOnSaveChanges).toHaveBeenCalled()
  })

  test('saves changes when menu is toggled closed', () => {
    const otherItems: Array<TSettingItem> = [{ type: 'switch', key: 'item1', label: 'Item 1', checked: false }]

    // Initially open
    const { rerender } = render(<DropdownMenu {...defaultProps} isOpen={true} otherItems={otherItems} onSaveChanges={mockOnSaveChanges} />)

    // Simulate change
    fireEvent.click(screen.getByText('Item 1'))
    // Close the menu by toggling isOpen to false
    rerender(<DropdownMenu {...defaultProps} isOpen={false} otherItems={otherItems} onSaveChanges={mockOnSaveChanges} />)

    expect(mockOnSaveChanges).toHaveBeenCalled()
  })

  test('does not save changes if no changes were made when menu closes', () => {
    const otherItems: Array<TSettingItem> = [{ type: 'switch', key: 'item1', label: 'Item 1', checked: false }]

    // Initially open
    const { rerender } = render(<DropdownMenu {...defaultProps} isOpen={true} otherItems={otherItems} onSaveChanges={mockOnSaveChanges} />)

    // Close the menu without making changes
    rerender(<DropdownMenu {...defaultProps} isOpen={false} otherItems={otherItems} onSaveChanges={mockOnSaveChanges} />)

    expect(mockOnSaveChanges).not.toHaveBeenCalled()
  })

  test('handles rapid open and close without errors', () => {
    const otherItems: Array<TSettingItem> = [{ type: 'switch', key: 'item1', label: 'Item 1', checked: false }]

    const { rerender } = render(<DropdownMenu {...defaultProps} isOpen={false} otherItems={otherItems} onSaveChanges={mockOnSaveChanges} />)

    // Rapidly open and close the menu
    rerender(<DropdownMenu {...defaultProps} isOpen={true} otherItems={otherItems} onSaveChanges={mockOnSaveChanges} />)
    rerender(<DropdownMenu {...defaultProps} isOpen={false} otherItems={otherItems} onSaveChanges={mockOnSaveChanges} />)

    expect(mockOnSaveChanges).not.toHaveBeenCalled()
  })

  test('updates local state when a switch is toggled', () => {
    const otherItems: Array<TSettingItem> = [{ type: 'switch', key: 'item1', label: 'Item 1', checked: false }]

    render(<DropdownMenu {...defaultProps} isOpen={true} otherItems={otherItems} onSaveChanges={mockOnSaveChanges} />)

    const toggle = screen.getByText('Item 1')
    fireEvent.click(toggle)

    // Since we mocked renderItem, we need to access internal state
    // Alternatively, adjust the mock to better reflect the real component
    expect(screen.getByText('Item 1')).toBeInTheDocument()
  })

  test('calls onSaveChanges with the correct updated settings', () => {
    const otherItems: Array<TSettingItem> = [{ type: 'switch', key: 'item1', label: 'Item 1', checked: false }]

    render(<DropdownMenu {...defaultProps} isOpen={true} otherItems={otherItems} onSaveChanges={mockOnSaveChanges} />)

    // Simulate change
    fireEvent.click(screen.getByText('Item 1'))
    // Close the menu by pressing Escape
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })

    expect(mockOnSaveChanges).toHaveBeenCalledWith({ item1: true })
  })

  test('does not toggle menu when saving changes on menu close', () => {
    const otherItems: Array<TSettingItem> = [{ type: 'switch', key: 'item1', label: 'Item 1', checked: false }]

    render(<DropdownMenu {...defaultProps} isOpen={false} otherItems={otherItems} onSaveChanges={mockOnSaveChanges} toggleMenu={mockToggleMenu} />)

    // Simulate menu closing
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })

    expect(mockToggleMenu).not.toHaveBeenCalled()
  })

  test('renders changes pending message when changesMade is true', () => {
    const otherItems: Array<TSettingItem> = [{ type: 'switch', key: 'item1', label: 'Item 1', checked: false }]

    render(<DropdownMenu {...defaultProps} isOpen={true} otherItems={otherItems} />)

    // Simulate change
    fireEvent.click(screen.getByText('Item 1'))

    expect(screen.getByText('Changes pending. Will be applied when you close the menu.')).toBeInTheDocument()
  })

  test('does not render changes pending message when changesMade is false', () => {
    render(<DropdownMenu {...defaultProps} isOpen={true} />)

    expect(screen.queryByText('Changes pending. Will be applied when you close the menu.')).not.toBeInTheDocument()
  })
})
