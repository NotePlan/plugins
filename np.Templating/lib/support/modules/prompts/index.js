// @flow
/**
 * @fileoverview Export all prompt handlers and the registry.
 */

import { processPrompts, processPromptTag } from './PromptRegistry'
import './StandardPromptHandler'
import './PromptKeyHandler'
import './PromptDateHandler'
import './PromptDateIntervalHandler'
import './PromptTagHandler'
import './PromptMentionHandler'

export { processPrompts, processPromptTag }

// This file serves as a centralized import point for all prompt handlers.
// By importing this file, all prompt handlers will be registered with the registry.
