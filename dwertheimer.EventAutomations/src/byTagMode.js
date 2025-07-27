// @flow

// import pluginJson from '../plugin.json'
import { sortListBy } from '../../helpers/sorting'
import type { AutoTimeBlockingConfig } from './config'
import type { OpenBlock, ParagraphWithDuration, TimeBlocksWithMap } from './timeblocking-flow-types'
import { filterTimeMapToOpenSlots, findTimeBlocks, matchTasksToSlots, namedTagExistsInLine, splitItemsByTags } from './timeblocking-helpers'

import { JSP, clo, log, logError, logWarn, logDebug, clof, deepCopy } from '@helpers/dev'

// All functions have been moved to timeblocking-helpers.js to resolve circular dependency
// This file now only contains imports and can be removed if no longer needed
