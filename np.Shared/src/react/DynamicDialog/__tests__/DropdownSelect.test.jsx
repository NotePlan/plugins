/* global describe, test, jest, expect, beforeEach, afterEach */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import DropdownSelect from '../DropdownSelect';

test('renders DropdownSelect with options', () => {
  const options = [
    { label: 'Option 1', value: 'option1' },
    { label: 'Option 2', value: 'option2' },
  ];

  const handleChange = jest.fn();

  render(
    <DropdownSelect
      label="Test Dropdown"
      options={options}
      value={options[0]}
      onChange={handleChange}
    />
  );

  // Check if the dropdown is rendered with the initial value
  expect(screen.getByDisplayValue('Option 1')).toBeInTheDocument();

  // Simulate opening the dropdown
  fireEvent.click(screen.getByText('Test Dropdown'));

  // Check if options are rendered
  expect(screen.getByText('Option 1')).toBeInTheDocument();
  expect(screen.getByText('Option 2')).toBeInTheDocument();

  // Simulate selecting an option
  fireEvent.click(screen.getByText('Option 2'));
  expect(handleChange).toHaveBeenCalledWith({ label: 'Option 2', value: 'option2' });
});