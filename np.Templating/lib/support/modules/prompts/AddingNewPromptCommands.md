Example: ```js
// Import the functionality we need
import { processPrompts } from '../path/to/PromptRegistry'
import { getTags } from '../path/to/core'

// Process the template with prompt
const result = await processPrompts(
  templateData,
  userData,
  '<%',
  '%>',
  getTags
)
// result will contain: { sessionData, sessionTemplateData }
```
