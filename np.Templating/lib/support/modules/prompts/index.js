// @flow
/**
 * @fileoverview Export all prompt handlers and the registry.
 */

import { processPrompts, processPromptTag, getRegisteredPromptNames, isPromptTag } from './PromptRegistry'
import './StandardPromptHandler'
import './PromptKeyHandler'
import './PromptDateHandler'
import './PromptDateIntervalHandler'
import './PromptTagHandler'
import './PromptMentionHandler'

// Import consolidated handlers
import promptHandlers from './handlers'

// Export registry functions for direct use
export { processPrompts, processPromptTag, getRegisteredPromptNames, isPromptTag }

// Export all prompt handler functions
export { promptDate, promptDateInterval, parsePromptKeyParameters, prompt, getPromptParameters } from './handlers'

// Export default object with all handlers
export default promptHandlers

// This file serves as a centralized import point for all prompt handlers.
// By importing this file, all prompt handlers will be registered with the registry.
