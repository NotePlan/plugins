// @flow
/* global describe, test, expect, jest */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import SearchableChooser, { type ChooserConfig } from '../SearchableChooser.jsx'

jest.mock('@helpers/react/reactDev.js', () => ({
  logDebug: jest.fn(),
  logError: jest.fn(),
  logInfo: jest.fn(),
  logWarn: jest.fn(),
}))

const makeConfig = (onSelect: (item: any) => void = jest.fn()): ChooserConfig => ({
  items: [
    { id: 'a', title: 'Alpha' },
    { id: 'b', title: 'Beta' },
  ],
  filterFn: (item: { title: string }, term: string) => item.title.toLowerCase().includes(term.toLowerCase()),
  getDisplayValue: (item: { title: string }) => item.title,
  getOptionText: (item: { title: string }) => item.title,
  getOptionTitle: (item: { title: string }) => item.title,
  truncateDisplay: (text: string) => text,
  onSelect,
  emptyMessageNoItems: 'No items',
  emptyMessageNoMatch: 'No match',
  classNamePrefix: 'test-chooser',
  fieldType: 'test-chooser',
})

describe('SearchableChooser open/close', () => {
  test('focusing the input does not open the dropdown', () => {
    render(
      <div>
        <div data-testid="dialog-chrome">Dialog chrome above the list</div>
        <SearchableChooser label="Space" value="" config={makeConfig()} />
      </div>,
    )

    fireEvent.focus(screen.getByRole('textbox'))
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument()
  })

  test('clicking blank dialog chrome does not open the dropdown', () => {
    render(
      <div>
        <div data-testid="dialog-chrome">Dialog chrome above the list</div>
        <SearchableChooser label="Space" value="" config={makeConfig()} />
      </div>,
    )

    fireEvent.mouseDown(screen.getByTestId('dialog-chrome'))
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument()
  })

  test('clicking the closed input opens the dropdown', () => {
    render(<SearchableChooser label="Note" value="" config={makeConfig()} />)

    fireEvent.mouseDown(screen.getByRole('textbox'))
    expect(screen.getByText('Alpha')).toBeInTheDocument()
  })

  test('clicking the label opens the dropdown', () => {
    render(<SearchableChooser label="Note" value="" config={makeConfig()} />)

    fireEvent.mouseDown(screen.getByText('Note'))
    expect(screen.getByText('Alpha')).toBeInTheDocument()
  })

  test('clicking outside an open dropdown closes it and does not reopen', () => {
    render(
      <div>
        <div data-testid="dialog-chrome">Dialog chrome above the list</div>
        <SearchableChooser label="Space" value="" config={makeConfig()} />
      </div>,
    )

    const input = screen.getByRole('textbox')
    fireEvent.mouseDown(input)
    expect(screen.getByText('Alpha')).toBeInTheDocument()

    fireEvent.mouseDown(screen.getByTestId('dialog-chrome'))

    expect(screen.queryByText('Alpha')).not.toBeInTheDocument()
    expect(screen.queryByText('Beta')).not.toBeInTheDocument()

    fireEvent.mouseDown(input)
    expect(screen.getByText('Alpha')).toBeInTheDocument()
  })
})
