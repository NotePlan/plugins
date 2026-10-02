// @flow
//-----------------------------------------------------------------------------
// Union of every saved perspective's folder and teamspace scope.
// Dashboard owns this file. Projects reads it when deciding whether to rebuild
// allProjectsList.json. Last updated 2026-10-02.
//-----------------------------------------------------------------------------

import type { TPerspectiveDef } from './types'
import { stringListOrArrayToArray } from '@helpers/dataManipulation'
import { logDebug, logInfo, logWarn } from '@helpers/dev'
import { getFolderFromFilename, getFolderListMinusExclusions, getFoldersMatching } from '@helpers/folders'

/** Cross-plugin path, same style as Reviews `allProjectsList.json`. */
export const PERSPECTIVE_SCOPE_UNION_FILENAME = '../jgclark.Dashboard/perspectiveScopeUnion.json'

export const PERSPECTIVE_SCOPE_UNION_VERSION = 1

/**
 * Special folders Reviews always excludes from project lists.
 * Keep in step with `ALWAYS_EXCLUDED_PROJECT_FOLDERS` in Reviews.
 */
const ALWAYS_EXCLUDED_PROJECT_FOLDERS: Array<string> = ['@Archive', '@Templates', '@Trash']

export type TPerspectiveScope = {
  name: string,
  folders: Array<string>,
  teamspaces: Array<string>,
  changedAt: number,
}

export type TPerspectiveScopeUnion = {
  version: number,
  fingerprint: string,
  scopes: Array<TPerspectiveScope>,
}

/**
 * Merge user excludes with the folders Reviews always drops.
 * @param {Array<string>} foldersToIgnore
 * @returns {Array<string>}
 */
function effectiveFoldersToIgnore(foldersToIgnore: Array<string> = []): Array<string> {
  const merged: Array<string> = [...ALWAYS_EXCLUDED_PROJECT_FOLDERS]
  for (const folder of foldersToIgnore) {
    if (!folder) continue
    if (!merged.some((existing) => existing.toLowerCase() === folder.toLowerCase())) {
      merged.push(folder)
    }
  }
  return merged
}

/**
 * Sorted copy of string values, used for stable compares and fingerprints.
 * @param {Array<string>} values
 * @returns {Array<string>}
 */
function sortedCopy(values: Array<string>): Array<string> {
  return [...values].sort()
}

/**
 * True when two string lists have the same members, ignoring order.
 * @param {Array<string>} a
 * @param {Array<string>} b
 * @returns {boolean}
 */
export function sameStringList(a: Array<string>, b: Array<string>): boolean {
  const left = sortedCopy(a)
  const right = sortedCopy(b)
  if (left.length !== right.length) return false
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return false
  }
  return true
}

/**
 * Coerce a folder setting into the string or string-array form `stringListOrArrayToArray` accepts.
 * @param {mixed} value
 * @returns {string | Array<string>}
 */
function asFolderSetting(value: mixed): string | Array<string> {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map((item) => String(item))
  return ''
}

/**
 * Resolve one perspective's include/exclude patterns to folder paths.
 * Same rules as Reviews `getFilteredFolderList`: `excludeSpecialFolders` false,
 * plus always-excluded @Archive, @Templates, and @Trash.
 * @param {mixed} includedRaw
 * @param {mixed} excludedRaw
 * @returns {Array<string>}
 */
export function resolvePerspectiveFolders(includedRaw: mixed, excludedRaw: mixed): Array<string> {
  const includes = stringListOrArrayToArray(asFolderSetting(includedRaw), ',')
  const ignores = effectiveFoldersToIgnore(stringListOrArrayToArray(asFolderSetting(excludedRaw), ','))
  const resolved = includes.length > 0
    ? getFoldersMatching(includes, false, ignores)
    : getFolderListMinusExclusions(ignores, false, false)
  return sortedCopy(resolved)
}

/**
 * Teamspace IDs for one perspective. Default is private space only.
 * @param {TPerspectiveDef} def
 * @returns {Array<string>}
 */
export function teamspacesForPerspectiveDef(def: TPerspectiveDef): Array<string> {
  const raw = def?.dashboardSettings?.includedTeamspaces
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((id) => String(id))
  }
  return ['private']
}

/**
 * Resolve folder paths for one saved perspective definition.
 * @param {TPerspectiveDef} def
 * @returns {Array<string>}
 */
export function resolveFoldersForPerspectiveDef(def: TPerspectiveDef): Array<string> {
  const settings = def?.dashboardSettings ?? {}
  return resolvePerspectiveFolders(settings.includedFolders ?? '', settings.excludedFolders ?? '')
}

/**
 * Stable fingerprint of scope membership. Does not include `changedAt` or which scope is active.
 * @param {Array<TPerspectiveScope>} scopes
 * @returns {string}
 */
export function fingerprintOfScopes(scopes: Array<TPerspectiveScope>): string {
  const ordered = [...scopes].sort((a, b) => String(a.name).localeCompare(String(b.name)))
  return ordered
    .map((scope) => {
      const folders = sortedCopy(scope.folders ?? []).join('\u0001')
      const teamspaces = sortedCopy(scope.teamspaces ?? []).join('\u0001')
      return `${scope.name}\u0002${folders}\u0002${teamspaces}`
    })
    .join('\u0003')
}

/**
 * Normalized folder/teamspace definition key for one perspective (not resolved paths).
 * @param {TPerspectiveDef} def
 * @returns {string}
 */
function definitionKey(def: TPerspectiveDef): string {
  const settings = def?.dashboardSettings ?? {}
  const includes = sortedCopy(stringListOrArrayToArray(settings.includedFolders ?? '', ',')).join('\u0001')
  const excludes = sortedCopy(stringListOrArrayToArray(settings.excludedFolders ?? '', ',')).join('\u0001')
  const teamspaces = sortedCopy(teamspacesForPerspectiveDef(def)).join('\u0001')
  return `${def?.name ?? ''}\u0002${includes}\u0002${excludes}\u0002${teamspaces}`
}

/**
 * True when saved perspective names or their folder/teamspace settings differ.
 * Ignores which perspective is active.
 * @param {Array<TPerspectiveDef>} previousDefs
 * @param {Array<TPerspectiveDef>} nextDefs
 * @returns {boolean}
 */
export function perspectiveFolderTeamspaceDefsChanged(
  previousDefs: Array<TPerspectiveDef>,
  nextDefs: Array<TPerspectiveDef>,
): boolean {
  const previousKeys = previousDefs.map(definitionKey).sort()
  const nextKeys = nextDefs.map(definitionKey).sort()
  if (previousKeys.length !== nextKeys.length) return true
  for (let i = 0; i < previousKeys.length; i += 1) {
    if (previousKeys[i] !== nextKeys[i]) return true
  }
  return false
}

/**
 * Build the union document from perspective defs, keeping `changedAt` when that scope's
 * resolved folders and teamspaces are unchanged.
 * @param {Array<TPerspectiveDef>} defs
 * @param {?TPerspectiveScopeUnion} previous
 * @param {number} now
 * @returns {TPerspectiveScopeUnion}
 */
export function buildPerspectiveScopeUnion(
  defs: Array<TPerspectiveDef>,
  previous: ?TPerspectiveScopeUnion,
  now: number,
): TPerspectiveScopeUnion {
  const previousScopes = previous?.scopes ?? []
  const scopes: Array<TPerspectiveScope> = defs.map((def) => {
    const name = def?.name ?? ''
    const folders = resolveFoldersForPerspectiveDef(def)
    const teamspaces = teamspacesForPerspectiveDef(def)
    const prior = previousScopes.find((scope) => scope.name === name)
    let changedAt = now
    if (
      prior != null
      && sameStringList(prior.folders ?? [], folders)
      && sameStringList(prior.teamspaces ?? [], teamspaces)
      && typeof prior.changedAt === 'number'
    ) {
      changedAt = prior.changedAt
    }
    return {
      name,
      folders,
      teamspaces,
      changedAt,
    }
  })
  return {
    version: PERSPECTIVE_SCOPE_UNION_VERSION,
    fingerprint: fingerprintOfScopes(scopes),
    scopes,
  }
}

/**
 * Replace one scope's resolved folders. Other scopes are left as they are.
 * Teamspaces on an existing scope are not re-read.
 * @param {TPerspectiveScopeUnion} union
 * @param {string} perspectiveName
 * @param {Array<string>} folders
 * @param {Array<string>} teamspacesIfNew - used only when that scope is not in the file yet
 * @param {number} now
 * @returns {{ union: TPerspectiveScopeUnion, changed: boolean }}
 */
export function withDestinationScopeFolders(
  union: TPerspectiveScopeUnion,
  perspectiveName: string,
  folders: Array<string>,
  teamspacesIfNew: Array<string>,
  now: number,
): { union: TPerspectiveScopeUnion, changed: boolean } {
  const existing = union.scopes.find((scope) => scope.name === perspectiveName)
  if (existing && sameStringList(existing.folders ?? [], folders)) {
    return { union, changed: false }
  }
  const nextScopes: Array<TPerspectiveScope> = existing
    ? union.scopes.map((scope) => (
      scope.name === perspectiveName
        ? { ...scope, folders: sortedCopy(folders), changedAt: now }
        : scope
    ))
    : union.scopes.concat([{
      name: perspectiveName,
      folders: sortedCopy(folders),
      teamspaces: teamspacesIfNew,
      changedAt: now,
    }])
  return {
    changed: true,
    union: {
      version: PERSPECTIVE_SCOPE_UNION_VERSION,
      fingerprint: fingerprintOfScopes(nextScopes),
      scopes: nextScopes,
    },
  }
}

/**
 * Parse file contents. Returns null when the payload is not a scope union.
 * @param {mixed} content
 * @returns {?TPerspectiveScopeUnion}
 */
export function parsePerspectiveScopeUnion(content: mixed): ?TPerspectiveScopeUnion {
  try {
    const parsed = typeof content === 'string' ? JSON.parse(content) : content
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    if (!Array.isArray(parsed.scopes)) return null
    const scopes: Array<TPerspectiveScope> = []
    for (const raw of parsed.scopes) {
      if (raw == null || typeof raw !== 'object') continue
      scopes.push({
        name: typeof raw.name === 'string' ? raw.name : '',
        folders: Array.isArray(raw.folders) ? raw.folders.map((folder) => String(folder)) : [],
        teamspaces: Array.isArray(raw.teamspaces) ? raw.teamspaces.map((id) => String(id)) : ['private'],
        changedAt: typeof raw.changedAt === 'number' ? raw.changedAt : 0,
      })
    }
    const fingerprint = typeof parsed.fingerprint === 'string' && parsed.fingerprint !== ''
      ? parsed.fingerprint
      : fingerprintOfScopes(scopes)
    return {
      version: typeof parsed.version === 'number' ? parsed.version : PERSPECTIVE_SCOPE_UNION_VERSION,
      fingerprint,
      scopes,
    }
  } catch (error) {
    logWarn('parsePerspectiveScopeUnion', error.message)
    return null
  }
}

/**
 * Read the union file. Null when it is missing or not a scope union.
 * @returns {?TPerspectiveScopeUnion}
 */
export function readPerspectiveScopeUnion(): ?TPerspectiveScopeUnion {
  try {
    if (!DataStore.fileExists(PERSPECTIVE_SCOPE_UNION_FILENAME)) return null
    const content = DataStore.loadData(PERSPECTIVE_SCOPE_UNION_FILENAME, true)
    return parsePerspectiveScopeUnion(content)
  } catch (error) {
    logWarn('readPerspectiveScopeUnion', error.message)
    return null
  }
}

/**
 * Write the union file.
 * @param {TPerspectiveScopeUnion} union
 * @returns {boolean}
 */
export function writePerspectiveScopeUnion(union: TPerspectiveScopeUnion): boolean {
  try {
    const res = DataStore.saveData(JSON.stringify(union), PERSPECTIVE_SCOPE_UNION_FILENAME, true)
    logInfo('writePerspectiveScopeUnion', `Wrote ${String(union.scopes.length)} scopes, write result ${String(res)}`)
    return Boolean(res)
  } catch (error) {
    logWarn('writePerspectiveScopeUnion', error.message)
    return false
  }
}

/** Set by the last full rewrite from `saveDashboardPluginSettings`. */
let lastSaveFingerprintChanged = false

/**
 * Whether the last full rewrite changed the union fingerprint.
 * @returns {boolean}
 */
export function perspectiveScopeUnionChangedOnLastSave(): boolean {
  return lastSaveFingerprintChanged
}

/**
 * Rebuild every scope from the current folder tree and write the file.
 * @param {Array<TPerspectiveDef>} defs
 * @param {number} [now]
 * @returns {{ fingerprintChanged: boolean }}
 */
export function writePerspectiveScopeUnionFromDefs(
  defs: Array<TPerspectiveDef>,
  now: number = Date.now(),
): { fingerprintChanged: boolean } {
  const previous = readPerspectiveScopeUnion()
  const next = buildPerspectiveScopeUnion(defs, previous, now)
  const fingerprintChanged = previous == null || previous.fingerprint !== next.fingerprint
  writePerspectiveScopeUnion(next)
  lastSaveFingerprintChanged = fingerprintChanged
  logDebug('writePerspectiveScopeUnionFromDefs', `fingerprintChanged=${String(fingerprintChanged)} scopes=${String(next.scopes.length)}`)
  return { fingerprintChanged }
}

/**
 * Full rewrite when the file is missing or folder/teamspace definitions changed.
 * A perspective switch that only changes which scope is active does not call this.
 * @param {Array<TPerspectiveDef>} previousDefs
 * @param {Array<TPerspectiveDef>} nextDefs
 * @returns {boolean} true when the fingerprint changed
 */
export function syncPerspectiveScopeUnionFromDefs(
  previousDefs: Array<TPerspectiveDef>,
  nextDefs: Array<TPerspectiveDef>,
): boolean {
  const missing = readPerspectiveScopeUnion() == null
  if (!missing && !perspectiveFolderTeamspaceDefsChanged(previousDefs, nextDefs)) {
    lastSaveFingerprintChanged = false
    return false
  }
  return writePerspectiveScopeUnionFromDefs(nextDefs).fingerprintChanged
}

/**
 * On switch, re-resolve only the destination perspective. Write that scope when its folder list changed.
 * @param {string} perspectiveName
 * @param {Array<TPerspectiveDef>} defs
 * @param {number} [now]
 * @returns {{ changed: boolean }}
 */
export function refreshDestinationScopeFolders(
  perspectiveName: string,
  defs: Array<TPerspectiveDef>,
  now: number = Date.now(),
): { changed: boolean } {
  const def = defs.find((item) => item && item.name === perspectiveName)
  if (!def) {
    logWarn('refreshDestinationScopeFolders', `No perspective named '${perspectiveName}'`)
    return { changed: false }
  }
  const existing = readPerspectiveScopeUnion()
  if (existing == null) {
    writePerspectiveScopeUnionFromDefs(defs, now)
    return { changed: true }
  }
  const folders = resolveFoldersForPerspectiveDef(def)
  const updated = withDestinationScopeFolders(existing, perspectiveName, folders, teamspacesForPerspectiveDef(def), now)
  if (!updated.changed) {
    logDebug('refreshDestinationScopeFolders', `Scope '${perspectiveName}' folder list unchanged`)
    return { changed: false }
  }
  writePerspectiveScopeUnion(updated.union)
  logInfo('refreshDestinationScopeFolders', `Updated scope '${perspectiveName}' (${String(folders.length)} folders)`)
  return { changed: true }
}

/**
 * Scope names whose `changedAt` is newer than the last value Projects applied, or that are new.
 * @param {Array<TPerspectiveScope>} scopes
 * @param {{ [string]: number }} lastChangedAtByName
 * @returns {Array<string>}
 */
export function changedScopeNames(
  scopes: Array<TPerspectiveScope>,
  lastChangedAtByName: { [string]: number },
): Array<string> {
  const names: Array<string> = []
  for (const scope of scopes) {
    const stored = lastChangedAtByName[scope.name]
    if (typeof stored !== 'number' || scope.changedAt > stored) {
      names.push(scope.name)
    }
  }
  return names
}

/**
 * Folders on changed scopes that are not already listed on an unchanged scope.
 * @param {Array<TPerspectiveScope>} scopes
 * @param {{ [string]: number }} lastChangedAtByName
 * @returns {Array<string>}
 */
export function foldersToScanForChangedScopes(
  scopes: Array<TPerspectiveScope>,
  lastChangedAtByName: { [string]: number },
): Array<string> {
  const changed = new Set(changedScopeNames(scopes, lastChangedAtByName))
  const covered = new Set<string>()
  for (const scope of scopes) {
    if (changed.has(scope.name)) continue
    for (const folder of scope.folders ?? []) {
      covered.add(folder)
    }
  }
  const needed = new Set<string>()
  for (const scope of scopes) {
    if (!changed.has(scope.name)) continue
    for (const folder of scope.folders ?? []) {
      if (!covered.has(folder)) needed.add(folder)
    }
  }
  return sortedCopy(Array.from(needed))
}

/**
 * True when this note's teamspace is allowed by the scope.
 * @param {?boolean} isTeamspaceNote
 * @param {?string} teamspaceID
 * @param {Array<string>} includedTeamspaces
 * @returns {boolean}
 */
function teamspaceAllowed(isTeamspaceNote: ?boolean, teamspaceID: ?string, includedTeamspaces: Array<string>): boolean {
  if (isTeamspaceNote && teamspaceID) {
    return includedTeamspaces.includes(teamspaceID)
  }
  return includedTeamspaces.includes('private')
}

/**
 * True when at least one scope allows this note's folder and its teamspace.
 * @param {?string} filename
 * @param {?boolean} isTeamspaceNote
 * @param {?string} teamspaceID
 * @param {Array<TPerspectiveScope>} scopes
 * @returns {boolean}
 */
export function noteMatchesAnyScope(
  filename: ?string,
  isTeamspaceNote: ?boolean,
  teamspaceID: ?string,
  scopes: Array<TPerspectiveScope>,
): boolean {
  const name = filename ?? ''
  if (name === '') return false
  const folder = getFolderFromFilename(name)
  for (const scope of scopes) {
    if (!(scope.folders ?? []).includes(folder)) continue
    if (teamspaceAllowed(isTeamspaceNote, teamspaceID, scope.teamspaces ?? ['private'])) return true
  }
  return false
}

/**
 * True when a changed scope that contains this folder also allows the note's teamspace.
 * @param {?string} filename
 * @param {?boolean} isTeamspaceNote
 * @param {?string} teamspaceID
 * @param {Array<TPerspectiveScope>} scopes
 * @param {Array<string>} changedNames
 * @returns {boolean}
 */
export function noteMatchesChangedScope(
  filename: ?string,
  isTeamspaceNote: ?boolean,
  teamspaceID: ?string,
  scopes: Array<TPerspectiveScope>,
  changedNames: Array<string>,
): boolean {
  const name = filename ?? ''
  if (name === '') return false
  const folder = getFolderFromFilename(name)
  const changed = new Set(changedNames)
  for (const scope of scopes) {
    if (!changed.has(scope.name)) continue
    if (!(scope.folders ?? []).includes(folder)) continue
    if (teamspaceAllowed(isTeamspaceNote, teamspaceID, scope.teamspaces ?? ['private'])) return true
  }
  return false
}
