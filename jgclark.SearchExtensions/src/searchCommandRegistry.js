// @flow
//-----------------------------------------------------------------------------
// Single source of truth for Search Extensions plugin command names and
// x-callback / re-run argument order.
// NotePlan resolves x-callbacks by plugin.json command name, not jsFunction.
// Jonathan Clark
// Last updated 2026-08-09 for v3.0.0, @jgclark
//-----------------------------------------------------------------------------

export type TRefreshArgParts = {
  terms: string,
  noteTypes: string,
  paraTypes: string,
  destination: string,
  fromDateStr?: string,
  toDateStr?: string,
}

/**
 * Layout of x-callback args matching each command's JS entry signature.
 * - standard: terms, noteTypes, paraTypes, dest
 * - period: terms, paraTypes, noteTypes, dest, from, to
 */
export type TArgLayout = 'standard' | 'period'

export type TSearchCommandDef = {
  /** plugin.json command name (and preferred x-callback command= value) */
  commandName: string,
  /** Internal originator keys (jsFunction-like) historically used in originatorCommand */
  originatorKeys: Array<string>,
  argLayout: TArgLayout,
  /** Human-readable arg help strings in call order (for plugin.json / docs) */
  argHelp: Array<string>,
}

const DEST_HELP =
  "(optional) destination: 'current', 'newnote' (alias searchSpecificNote), 'quick', 'log', or 'refresh'"

/**
 * Registry of search save/re-run commands.
 * When adding a command: add a row here, export a wrapper, and wire the entry in searchTriggers HANDLERS.
 */
export const SEARCH_COMMAND_DEFS: Array<TSearchCommandDef> = [
  {
    commandName: 'quickSearch',
    originatorKeys: ['quickSearch'],
    argLayout: 'standard',
    argHelp: [
      'search term(s)',
      "note types: 'notes', 'calendar', or 'both'",
      'paragraph types (comma-separated, optional)',
      DEST_HELP,
    ],
  },
  {
    commandName: 'search',
    originatorKeys: ['search', 'searchOverAll'],
    argLayout: 'standard',
    argHelp: [
      'search term(s)',
      "note types (ignored; always both for this command)",
      'paragraph types (comma-separated, optional)',
      DEST_HELP,
    ],
  },
  {
    commandName: 'searchOverCalendar',
    originatorKeys: ['searchOverCalendar'],
    argLayout: 'standard',
    argHelp: [
      'search term(s)',
      'note types (ignored; always calendar)',
      'paragraph types (comma-separated, optional)',
      DEST_HELP,
    ],
  },
  {
    commandName: 'searchOverNotes',
    originatorKeys: ['searchOverNotes'],
    argLayout: 'standard',
    argHelp: [
      'search term(s)',
      'note types (ignored; always notes)',
      'paragraph types (comma-separated, optional)',
      DEST_HELP,
    ],
  },
  {
    commandName: 'searchOpenTasks',
    originatorKeys: ['searchOpenTasks'],
    argLayout: 'standard',
    argHelp: [
      'search term(s)',
      "note types: 'notes', 'calendar', or 'both'",
      'paragraph types (ignored; always open tasks/checklists)',
      DEST_HELP,
    ],
  },
  {
    commandName: 'searchInPeriod',
    originatorKeys: ['searchInPeriod', 'searchPeriod'],
    argLayout: 'period',
    argHelp: [
      'search term(s)',
      'paragraph types (comma-separated, optional)',
      'note types (ignored; always calendar)',
      DEST_HELP,
      'start date (YYYYMMDD or YYYY-MM-DD); optional',
      'end date (YYYYMMDD or YYYY-MM-DD); optional',
    ],
  },
]

// Map originator / legacy names -> plugin command name
const ORIGINATOR_TO_COMMAND_NAME: { [string]: string } = {}
// Map command name -> def
const COMMAND_BY_NAME: { [string]: TSearchCommandDef } = {}

for (const def of SEARCH_COMMAND_DEFS) {
  COMMAND_BY_NAME[def.commandName] = def
  for (const key of def.originatorKeys) {
    ORIGINATOR_TO_COMMAND_NAME[key] = def.commandName
  }
}

/**
 * Map an originatorCommand (often a JS function name) to the plugin command name used in x-callbacks.
 * @param {string} originatorCommand
 * @returns {string} plugin.json command name
 */
export function getSearchCommandName(originatorCommand: string): string {
  if (!originatorCommand) return ''
  return ORIGINATOR_TO_COMMAND_NAME[originatorCommand] ?? originatorCommand
}

/**
 * Build x-callback arg list for re-running a saved search, matching each command's JS parameter order.
 * @param {string} originatorCommand - originator or command name
 * @param {string} termsToMatchStr
 * @param {string} noteTypesAsStr
 * @param {string} paraTypesAsStr
 * @param {string} destination - usually 'refresh'
 * @param {string=} fromDateStr
 * @param {string=} toDateStr
 * @returns {Array<string>}
 */
export function buildRefreshCallbackArgs(
  originatorCommand: string,
  termsToMatchStr: string,
  noteTypesAsStr: string,
  paraTypesAsStr: string,
  destination: string = 'refresh',
  fromDateStr: string = '',
  toDateStr: string = '',
): Array<string> {
  const commandName = getSearchCommandName(originatorCommand)
  const def = COMMAND_BY_NAME[commandName]
  if (def && def.argLayout === 'period') {
    return [termsToMatchStr, paraTypesAsStr, noteTypesAsStr, destination, fromDateStr, toDateStr]
  }
  // standard (and unknown fallback)
  return [termsToMatchStr, noteTypesAsStr, paraTypesAsStr, destination]
}

/**
 * Return arg help strings for a plugin command name (for docs / validating plugin.json).
 * @param {string} commandName
 * @returns {Array<string>}
 */
export function getCommandArgHelp(commandName: string): Array<string> {
  return COMMAND_BY_NAME[commandName]?.argHelp ?? []
}

/**
 * Whether this command is known for re-run dispatch.
 * @param {string} commandOrOriginator
 * @returns {boolean}
 */
export function isKnownSearchCommand(commandOrOriginator: string): boolean {
  const name = getSearchCommandName(commandOrOriginator)
  return Boolean(COMMAND_BY_NAME[name])
}
