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

1. **Create Your Handler Class**: Create a new file in `np.Templating/lib/support/modules/prompts/` for your handler.

2. **Implement Core Functionality**: Your handler should implement the necessary methods for your prompt type.

3. **Register Your Prompt Type**: Use the `registerPromptType` function to add your prompt to the registry.

### Example Implementation

```javascript
// MyNewPromptHandler.js
import { registerPromptType } from './PromptRegistry'
import BasePromptHandler from './BasePromptHandler'

export default class MyNewPromptHandler {
  static async process(tag: string, sessionData: any, params: any): Promise<string> {
    // Your prompt processing logic here
    return result
  }
}

// Register the prompt type
registerPromptType({
  name: 'myNewPrompt',
  // pattern is optional - will be auto-generated if not provided
  parseParameters: (tag: string) => BasePromptHandler.getPromptParameters(tag),
  process: MyNewPromptHandler.process.bind(MyNewPromptHandler),
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

## 5. Testing

When testing your prompt handler, consider these scenarios:

1. **Pattern Matching**: Test that your prompt is correctly recognized in templates
2. **Parameter Parsing**: Test that parameters are correctly extracted
3. **Processing**: Test the actual prompt functionality
4. **Error Cases**: Test error handling and edge cases

Example test:
```javascript
describe('MyNewPrompt', () => {
  test('should handle basic prompt correctly', async () => {
    const templateData = "<%- myNewPrompt('var', 'message') %>"
    const result = await processPrompts(templateData, {}, '<%', '%>')
    expect(result.sessionData.var).toBe(expectedValue)
  })
})
```

## 6. Best Practices

1. **Use BasePromptHandler**: Leverage the base handler's parameter parsing when possible
2. **Type Safety**: Use Flow types for better type checking
3. **Error Handling**: Implement proper error handling and logging
4. **Documentation**: Document your prompt's functionality and parameters
5. **Testing**: Write comprehensive tests for your prompt handler

## 7. Integration

After implementing your prompt handler:

1. Import it in `np.Templating/lib/support/modules/prompts/index.js`
2. Add any necessary documentation
3. Add test cases
4. Update the README if adding significant functionality 