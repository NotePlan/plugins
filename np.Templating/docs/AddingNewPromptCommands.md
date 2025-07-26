# Adding New Prompt Commands

This guide explains how to add new prompt types to the templating system.

## 1. Overview

The prompt system uses a registry pattern that allows new prompt types to be added without modifying the core templating code. Each prompt type is registered with:
- A unique name
- An optional pattern for matching the prompt in templates (auto-generated if not provided)
- Parameter parsing logic
- Processing logic

## 2. Basic Structure

A prompt handler typically consists of:
1. A class containing the core prompt functionality
2. Registration of the prompt type with the registry

## 3. Implementation Steps

### Quickest Way to Create a List-Based Prompt

The easiest way to create a new prompt that displays a list of items (similar to hashtag and mention prompts) is to:

1. **Mirror the Existing Handlers**: Use `HashtagPromptHandler.js` or `MentionPromptHandler.js` as a template
2. **Leverage the Shared Functions**: Use the functions in `sharedPromptFunctions.js` for parameter parsing, filtering, and prompting

This approach allows you to create a new prompt type with minimal code, leveraging the existing infrastructure.

### Step-by-Step Guide

1. **Create Your Handler Class**: Create a new file in `np.Templating/lib/support/modules/prompts/` for your handler.

2. **Import Shared Functions**: Import the shared functions from `sharedPromptFunctions.js`:

   ```javascript
   import { parsePromptParameters, filterItems, promptForItem } from './sharedPromptFunctions'
   ```

3. **Implement Core Methods**: Your handler should have:
   - A parameter parsing method (using `parsePromptParameters`)
   - A filter method (using `filterItems`)
   - A prompt method (using `promptForItem`)
   - A process method to tie everything together

4. **Register Your Prompt Type**: Use the `registerPromptType` function to add your prompt to the registry.

### Example Based on HashtagPromptHandler and MentionPromptHandler

```javascript
// MyListPromptHandler.js
import pluginJson from '../../../../plugin.json'
import { registerPromptType } from './PromptRegistry'
import { parsePromptParameters, filterItems, promptForItem } from './sharedPromptFunctions'
import { log, logError, logDebug } from '@helpers/dev'

export default class MyListPromptHandler {
  /**
   * Parse parameters from a promptList tag.
   * @param {string} tag - The template tag containing the promptList call.
   */
  static parsePromptListParameters(tag: string = '') {
    return parsePromptParameters(tag, 'MyListPromptHandler')
  }

  /**
   * Filter list items based on include and exclude patterns
   */
  static filterListItems(items: Array<string>, includePattern: string = '', excludePattern: string = '') {
    return filterItems(items, includePattern, excludePattern, 'listItem')
  }

  /**
   * Prompt the user to select an item from the list.
   */
  static async promptList(promptMessage: string = 'Select an item', includePattern: string = '', excludePattern: string = '', allowCreate: boolean = false) {
    try {
      // Get items from your data source
      const items = ['item1', 'item2', 'item3'] // Replace with your actual items

      // Use the shared prompt function
      return await promptForItem(promptMessage, items, includePattern, excludePattern, allowCreate, 'listItem', '')
    } catch (error) {
      logError(pluginJson, `Error in promptList: ${error.message}`)
      return ''
    }
  }

  /**
   * Process the promptList tag.
   */
  static async process(tag: string, sessionData: any, params: any) {
    const { promptMessage, varName, includePattern, excludePattern, allowCreate } = params

    try {
      return await MyListPromptHandler.promptList(promptMessage || 'Select an item', includePattern, excludePattern, allowCreate)
    } catch (error) {
      logError(pluginJson, `Error processing promptList: ${error.message}`)
      return ''
    }
  }
}

// Register the promptList type
registerPromptType({
  name: 'promptList',
  parseParameters: (tag: string) => MyListPromptHandler.parsePromptListParameters(tag),
  process: MyListPromptHandler.process.bind(MyListPromptHandler),
})
```

## 4. Pattern Generation

The system automatically generates patterns for prompt types if none is provided:

1. **Default Pattern**: By default, the system generates a pattern that matches your prompt name followed by parentheses:
   - For a prompt named 'myPrompt', generates: `/myPrompt\s*\(/`
   - This matches: `myPrompt()`, `myPrompt ()`, `myPrompt(...)`, etc.

2. **Custom Patterns**: You can provide your own pattern if you need special matching:
   ```javascript
   registerPromptType({
     name: 'customPrompt',
     pattern: /customPrompt\[.*?\]/,  // Custom pattern for different syntax
     // ... other properties
   })
   ```

3. **Pattern Cleanup**: The system uses the registered prompt names to clean template tags:
   - Automatically removes all registered prompt names
   - Handles common template syntax (`<%`, `-%>`, etc.)
   - Preserves parameter content for parsing

## 5. Using the BasePromptHandler

If you're not creating a list-based prompt and need more control over parameter parsing, you can use the `BasePromptHandler` directly:

```javascript
import BasePromptHandler from './BasePromptHandler'

// Use the getPromptParameters method with noVar=true to interpret the first parameter as promptMessage
const params = BasePromptHandler.getPromptParameters(tag, true)
```

The `noVar=true` parameter tells the handler to treat the first parameter as the prompt message rather than a variable name.

## 6. Testing

When testing your prompt handler, consider these scenarios:

1. **Pattern Matching**: Test that your prompt is correctly recognized in templates
2. **Parameter Parsing**: Test that parameters are correctly extracted
3. **Processing**: Test the actual prompt functionality
4. **Error Cases**: Test error handling and edge cases

Example test:
```javascript
describe('MyListPrompt', () => {
  test('should handle basic prompt correctly', async () => {
    const templateData = "<%- promptList('Select an item:') %>"
    const result = await processPrompts(templateData, {})
    expect(result).toBe(expectedValue)
  })
  
  test('should handle parameter variations', async () => {
    const singleParamTag = "<%- promptList('Select an item:') %>"
    const multiParamTag = "<%- promptList('Select an item:', 'include', 'exclude', 'true') %>"
    // Test both cases
  })
})
```

## 7. Best Practices

1. **Use Shared Functions**: For list-based prompts, use the shared functions in `sharedPromptFunctions.js`
2. **Study Existing Handlers**: Look at `HashtagPromptHandler.js` and `MentionPromptHandler.js` as examples
3. **Type Safety**: Use Flow types for better type checking
4. **Error Handling**: Implement proper error handling and logging
5. **Documentation**: Document your prompt's functionality and parameters
6. **Testing**: Write comprehensive tests for your prompt handler

## 8. Integration

After implementing your prompt handler:

1. Import it in `np.Templating/lib/support/modules/prompts/index.js`
2. Add any necessary documentation
3. Add test cases
4. Update the README if adding significant functionality 