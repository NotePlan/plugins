// @flow
// jgclark.Dashboard/src/react/components/Header/__tests__/PerspectiveSelector.test.jsx
/* global describe, test, jest, expect, beforeEach, afterEach */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom' // Correct import for jest-dom 
import PerspectiveSelector from '../PerspectiveSelector' // Ensure this path is correct
import { useAppContext } from '../../AppContext.jsx'

// Mock the useAppContext hook
jest.mock('../../AppContext.jsx', () => ({
  useAppContext: jest.fn(),
}))

describe('PerspectiveSelector Component', () => {
  const mockDispatchDashboardSettings = jest.fn()
  const mockDispatchPerspectiveSettings = jest.fn()
  const mockSendActionToPlugin = jest.fn()

  beforeEach(() => {
    useAppContext.mockReturnValue({
      dashboardSettings: { activePerspectiveName: 'Default', lastChange: '2024-10-17' },
      dispatchDashboardSettings: mockDispatchDashboardSettings,
      dispatchPerspectiveSettings: mockDispatchPerspectiveSettings,
      sendActionToPlugin: mockSendActionToPlugin,
      perspectiveSettings: [
        { name: 'Default', isModified: false },
        { name: 'Custom', isModified: true },
      ],
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  test('renders loading state initially', () => {
    render(<PerspectiveSelector />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  test('renders perspective options when loaded', async () => {
    render(<PerspectiveSelector />)
    expect(screen.getByText('Default')).toBeInTheDocument()
    expect(screen.getByText('Custom*')).toBeInTheDocument()
  })

  test('handles perspective change', () => {
    render(<PerspectiveSelector />)
    const select = screen.getByLabelText('Persp')
    fireEvent.change(select, { target: { value: 'Custom' } })
    expect(mockDispatchDashboardSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        type: expect.any(String),
        payload: expect.objectContaining({ activePerspectiveName: 'Custom' }),
      }),
    )
  })

  test('handles "Add New Perspective" action', () => {
    render(<PerspectiveSelector />)
    const select = screen.getByLabelText('Persp')
    fireEvent.change(select, { target: { value: 'Add New Perspective' } })
    expect(mockSendActionToPlugin).toHaveBeenCalledWith(
      'addNewPerspective',
      expect.objectContaining({ actionType: 'addNewPerspective' }),
      'Add New Perspective selected from dropdown',
    )
  })

  test('handles "Save Perspective" action', () => {
    render(<PerspectiveSelector />)
    const select = screen.getByLabelText('Persp')
    fireEvent.change(select, { target: { value: 'Save Perspective' } })
    expect(mockDispatchPerspectiveSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        type: expect.any(String),
        payload: expect.any(Array),
      }),
    )
  })
})
