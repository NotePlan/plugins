// @flow
/**
 * @fileoverview Prompt type registry only (no processPrompts). Handlers import this file to avoid
 * circular dependency with PromptRegistry.js / promptFormBatch.js (form batching imports handlers).
 */

/**
 * @typedef {Object} PromptType
 * @property {string} name - The unique name of the prompt type.
 * @property {?RegExp} pattern - Optional regex to match tags for this prompt type. If not provided, will be generated from name.
 * @property {(tag: string, sessionData?: any) => any} parseParameters - A function that extracts parameters from the tag.
 * @property {(tag: string, sessionData: any, params: any) => Promise<string | false>} process - A function that processes the prompt and returns its response (false when cancelled).
 */
export type PromptType = {|
  name: string,
  pattern?: RegExp,
  parseParameters: (tag: string, sessionData?: any) => any,
  process: (tag: string, sessionData: any, params: any) => Promise<string | false>,
|}

/** The registry mapping prompt type names to their handlers. */
const promptRegistry: { [string]: PromptType } = {}

/**
 * Cleans a variable name by replacing spaces with underscores and removing invalid characters.
 * @param {string} varName - The variable name to clean.
 * @returns {string} The cleaned variable name.
 */
export function cleanVarName(varName: string): string {
  if (!varName || typeof varName !== 'string') return 'unnamed'

  let cleaned = varName.replace(/["'`]/g, '')

  const promptTypes = getRegisteredPromptNames()
  const promptTypePattern = new RegExp(`^(${promptTypes.join('|')})`, 'i')
  cleaned = cleaned.replace(promptTypePattern, '')

  cleaned = cleaned.replace(/ /gi, '_')
  cleaned = cleaned.replace(/\?/gi, '')
  cleaned = cleaned.replace(/[^\p{L}\p{Nd}_$]/gu, '')

  if (!/^[\p{L}_$]/u.test(cleaned)) {
    cleaned = `var_${cleaned}`
  }

  if (!cleaned) return 'unnamed'

  const reservedWords = [
    'break',
    'case',
    'catch',
    'class',
    'const',
    'continue',
    'debugger',
    'default',
    'delete',
    'do',
    'else',
    'export',
    'extends',
    'finally',
    'for',
    'function',
    'if',
    'import',
    'in',
    'instanceof',
    'new',
    'return',
    'super',
    'switch',
    'this',
    'throw',
    'try',
    'typeof',
    'var',
    'void',
    'while',
    'with',
    'yield',
  ]

  if (reservedWords.includes(cleaned)) {
    cleaned = `var_${cleaned}`
  }

  return cleaned
}

/**
 * Generates a RegExp pattern for a prompt type based on its name
 * @param {string} promptName - The name of the prompt type
 * @returns {RegExp} The pattern to match this prompt type
 */
function generatePromptPattern(promptName: string): RegExp {
  return new RegExp(`\\b${promptName}\\s*\\(`, 'i')
}

/**
 * Registers a new prompt type.
 * @param {PromptType} promptType The prompt type to register.
 */
export function registerPromptType(promptType: PromptType): void {
  if (!promptType.pattern) {
    promptType.pattern = generatePromptPattern(promptType.name)
  }
  promptRegistry[promptType.name] = promptType
}

/**
 * Find a matching prompt type for a given tag content
 * @param {string} tagContent - The content of the tag to match
 * @returns {?{promptType: Object, name: string}} The matching prompt type and its name, or null if none found
 */
export function findMatchingPromptType(tagContent: string): ?{ promptType: Object, name: string } {
  for (const [name, promptType] of Object.entries(promptRegistry)) {
    const pattern = promptType.pattern || generatePromptPattern(promptType.name)

    if (pattern.test(tagContent)) {
      return { promptType, name }
    }
  }

  return null
}

/**
 * Get all registered prompt type names
 * @returns {Array<string>} Array of registered prompt type names
 */
export function getRegisteredPromptNames(): Array<string> {
  const promptNames = Object.keys(promptRegistry)
    .filter((name) => name !== 'prompt')
    .concat('prompt')
  return promptNames
}

/**
 * Checks if a tag is a prompt*() tag
 * @param {string} tag - The tag to check
 * @returns {boolean} True if the tag is a prompt tag, false otherwise
 */
export function isPromptTag(tag: string): boolean {
  if (tag.match(/\w+\.\w+\s*\(/)) {
    return false
  }

  const promptNames = getRegisteredPromptNames()
  const escapedNames = promptNames.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const promptPattern = escapedNames.join('|')
  const promptRegex = new RegExp(`(?:^|\\s|\\()(?:${promptPattern})\\s*\\(`, 'i')
  return promptRegex.test(tag)
}
