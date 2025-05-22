# NPTemplating Prompt Registry System

This directory contains the implementation of the NPTemplating prompt registry system, which provides a flexible way to add new types of interactive prompts to templates.

## Overview

The prompt registry allows:

1. Creating new prompt types without modifying the core NPTemplating class
2. Registering prompt handlers that can be discovered dynamically 
3. Automatic method generation on the NPTemplating class for all registered prompt types

## Core Components

- **PromptRegistry.js**: Maintains the registry of prompt types and provides utility functions for working with prompts
- **PromptManager.js**: Provides a centralized interface for accessing and using prompts
- **BasePromptHandler.js**: Contains common functionality used by all prompt handlers
- **Individual prompt handlers**: Implement specific prompt types (e.g., PromptDateHandler, PromptKeyHandler)

## Using Prompts in Templates

Prompts can be used in templates in several ways:

```
<%- promptDate("Choose a date") %>
<%- promptList(["Option 1", "Option 2", "Option 3"], "Choose an option") %>
<% const category = await promptKey("category", "Select a category") %>
```

## Adding a New Prompt Type

To add a new prompt type:

1. Create a new file in this directory, e.g., `MyCustomPromptHandler.js`
2. Implement the required handler methods:
   - `parseParameters(tag)`: Extracts parameters from the prompt tag
   - `process(tag, sessionData, params)`: Processes the prompt and returns a value
3. Register the prompt type with the registry

### Example: Creating a Custom Prompt Type

Here's a simplified example of creating a custom prompt type:

```javascript
// MyCustomPromptHandler.js
import pluginJson from '../../../../plugin.json'
import { registerPromptType } from './PromptRegistry'
import { logDebug, logError } from '@helpers/dev'
import BasePromptHandler from './BasePromptHandler'

class MyCustomPromptHandler {
  static parseParameters(tag) {
    // Extract parameters from the tag
    return BasePromptHandler.getPromptParameters(tag, true)
  }
  
  static async process(tag, sessionData, params) {
    // Implement your custom prompt logic
    const { message = 'Enter a value', defaultValue = '' } = params
    
    // Use NotePlan's UI to interact with the user
    const result = await CommandBar.showInput(message, defaultValue)
    return result || defaultValue
  }
}

// Register the prompt type
registerPromptType({
  name: 'myCustomPrompt',
  parseParameters: MyCustomPromptHandler.parseParameters,
  process: MyCustomPromptHandler.process
})

export default MyCustomPromptHandler
```

## Accessing Prompts in Code

The NPTemplating class provides several ways to access prompts:

1. **Dynamic methods**: Each registered prompt type gets its own method automatically added to NPTemplating
   ```javascript
   const result = await NPTemplating.promptDate("Choose a date")
   ```

2. **Generic prompt method**: Use a single method to access any prompt type
   ```javascript
   const result = await NPTemplating.promptByType("promptList", "Choose an option", ["A", "B", "C"])
   ```

3. **Get registered prompt types**: Get a list of all available prompt types
   ```javascript
   const types = NPTemplating.getRegisteredPromptTypes()
   ```

## Benefits of the Registry Pattern

- **Extensibility**: Add new prompt types without modifying core code
- **Consistency**: All prompts follow the same pattern for parameters and processing
- **Discoverability**: Prompt types can be discovered and used dynamically
- **Maintainability**: Each prompt type is isolated in its own module

## Best Practices

1. Keep prompt handlers focused on a single responsibility
2. Use BasePromptHandler for common parameter parsing logic
3. Handle errors gracefully and provide sensible defaults
4. Provide clear documentation on parameter formats
5. Follow the same naming conventions for new prompt types 