# Prompt Testing Summary

This document provides an overview of the comprehensive testing suite for the prompt system in the NPTemplating module. These tests help ensure that all prompt types function correctly, handle edge cases properly, and maintain compatibility with the templating engine.

## Test Files Overview

### 1. `promptDateInterval.test.js`

Tests for the `promptDateInterval` prompt type, which allows users to select a date range.

**Coverage:**
- Parameter parsing from template tags
- Processing prompts with session data
- Handling quoted parameters with commas
- Multiple prompt calls in a single template
- Error handling

### 2. `promptDate.test.js`

Tests for the `promptDate` prompt type, which allows users to select a date.

**Coverage:**
- Basic parameter parsing
- Date formatting options
- Quoted parameters with commas and special characters
- Multiple prompt calls in a template
- Session data reuse
- Variable name normalization (spaces, question marks)
- Error handling

### 3. `standardPrompt.test.js`

Tests for the standard `prompt` function, which is the most commonly used prompt type.

**Coverage:**
- Parameter parsing with different parameter types
- Default values
- Array options
- Quoted parameters (single and double quotes)
- Multiple prompt calls
- Session data reuse
- Variable name normalization
- User cancellation
- Error handling
- Special characters

### 4. `promptIntegration.test.js`

Tests for integration between different prompt types.

**Coverage:**
- Multiple prompt types in a single template
- Session data sharing between prompt types
- Complex templates with all prompt types
- Template transformation verification

### 5. `promptEdgeCases.test.js`

Tests focusing specifically on edge cases and potential problem areas.

**Coverage:**
- Escaped quotes handling
- Very long variable names
- Empty variable names and prompt messages
- Unicode characters
- Nested array parameters
- JSON parameters
- Null and undefined return values
- Consecutive template tags
- Multiple tags on a single line
- Comments alongside prompt tags
- Variable redefinition
- Escape sequences
- Parameters that look like code

### 6. `promptAwaitIssue.test.js`

Tests specifically targeting the handling of `await` in prompt tags.

**Coverage:**
- Templates with `await` before prompt commands (e.g., `<%- await promptDateInterval('varName') %>`)
- Correct variable name extraction when `await` is present
- Proper template transformation without `await_` artifacts
- Multiple prompt types with `await` in a single template

## Handling of `await` in Prompt Tags

Templates may include `await` before prompt commands, which is a valid EJS syntax for async operations. For example:

```
<%- await promptDateInterval('intervalVariable') %>
```

The prompt system must handle this correctly by:

1. **Removing `await` during parameter extraction**: The `BasePromptHandler.getPromptParameters` method removes `await` when extracting the variable name and other parameters.

2. **Preserving clean variable names**: Variable names should not include `await_` prefixes or retain quotes from the original template.

3. **Transforming templates properly**: The resulting template should use the clean variable name without `await`, e.g., `<%- intervalVariable %>` instead of `<%- await_'intervalVariable' %>`.

A common issue that can occur is improper handling of `await`, which can lead to invalid JavaScript syntax in the processed template. Our tests explicitly verify that this doesn't happen.

## Testing Strategy

Our testing strategy focuses on several key areas:

### 1. Individual Prompt Type Testing

Each prompt type (standard, key, date, date interval) has its own test file that verifies:
- Correct parameter extraction from template tags
- Proper prompt execution
- Correct handling of user input
- Session data management
- Template transformation

### 2. Integration Testing

The `promptIntegration.test.js` file tests how different prompt types work together in a single template, ensuring they:
- Process in the correct order
- Share session data correctly
- Transform the template properly

### 3. Edge Case Testing

The `promptEdgeCases.test.js` file specifically targets potential problem areas, including:
- Special characters
- Unusual input formats
- Boundary conditions
- Error conditions

### 4. Mocking Strategy

All tests use carefully crafted mocks for:
- `CommandBar` methods (textPrompt, showOptions)
- `@helpers/userInput` functions (datePicker, askDateInterval)
- `DataStore` for frontmatter operations

This allows us to test the prompt system without requiring actual user input during test execution.

## Key Validation Points

Across all tests, we validate several critical aspects:

1. **Variable Name Handling**:
   - Spaces are converted to underscores
   - Question marks are removed
   - Unicode characters are preserved

2. **Template Transformation**:
   - Original prompt tags are replaced with variable references
   - Variable names are consistent
   - No artifacts like `await_` are present

3. **Parameter Parsing**:
   - Quoted parameters (both single and double quotes)
   - Commas inside quoted strings
   - Array parameters
   - JSON objects
   - Special characters

4. **Session Data Management**:
   - Values are stored with correct variable names
   - Existing values are reused
   - Multiple calls with the same variable name update properly

5. **Error Handling**:
   - User cancellation
   - Errors during prompt execution
   - Null/undefined return values

## How to Run the Tests

To run all prompt-related tests:

```bash
npx jest np.Templating/__tests__/prompt
```

To run a specific test file:

```bash
npx jest np.Templating/__tests__/promptDate.test.js
```

## Maintaining and Extending Tests

When adding new prompt types or modifying existing ones:

1. Add tests for the new prompt type following the pattern in existing test files
2. Add integration tests that include the new prompt type
3. Add edge case tests specific to the new prompt type
4. Ensure all existing tests continue to pass

This comprehensive test suite helps ensure that the prompt system remains robust and reliable as the codebase evolves. 