// @flow
// ----------------------------------------------------------------------------
// Move embedded images and file attachments with /move paragraph and /move block.
// NotePlan stores them beside the note as `{noteBasename}_attachments/{file}`
// and writes a relative link `![image]({noteBasename}_attachments/{file})`
// (percent-encoded, no folder path above the note). The file has to be copied
// into the destination note's attachment folder or the image breaks there.
// ----------------------------------------------------------------------------

import { logDebug, logInfo, logWarn } from '@helpers/dev'
import { getFolderFromFilename } from '@helpers/folders'

const RE_MEDIA_LINK = /!\[(image|file)\]\(([^)]+)\)/g
const RE_HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i

export type CopiedEmbeddedMedia = {|
  rawTarget: string,
  decodedPath: string,
  sourceTrashPath: string,
  canTrash: boolean,
|}

export type EmbeddedMediaMove = {|
  rewrite: (text: string) => string,
  copied: Array<CopiedEmbeddedMedia>,
|}

interface MediaLine {
  +rawContent?: ?string,
  +content?: ?string,
}

interface MediaNote {
  +filename: string,
  +type: string,
  +content?: ?string,
  +paragraphs?: $ReadOnlyArray<MediaLine>,
}

/**
 * Note basename NotePlan uses for the sibling `{name}_attachments` folder.
 * @param {string} filename
 * @returns {string}
 */
export function noteBaseName(filename: string): string {
  const base = filename.split('/').pop() || filename
  return base.replace(/\.[^/.]+$/, '')
}

/**
 * Path relative to the plugin data folder for a file stored next to a note.
 * `decodedRelative` is the attachment path as it lives on disk (spaces, not %20).
 * @param {string} noteType `Notes` or `Calendar`
 * @param {string} noteFilename
 * @param {string} decodedRelative
 * @returns {string}
 */
export function pluginDataPathForNote(noteType: string, noteFilename: string, decodedRelative: string): string {
  const root = noteType === 'Calendar' ? 'Calendar' : 'Notes'
  const folder = getFolderFromFilename(noteFilename)
  const parts = ['..', '..', '..', root]
  if (folder && folder !== '/' && folder !== '(error)') parts.push(folder)
  parts.push(decodedRelative)
  return parts.join('/')
}

/**
 * Local `![image](...)` / `![file](...)` targets in a line. Skips http(s) and other URLs.
 * @param {string} text
 * @returns {Array<{| kind: string, rawTarget: string, decodedPath: string |}>}
 */
export function findLocalMediaTargets(text: string): Array<{| kind: string, rawTarget: string, decodedPath: string |}> {
  const found = []
  if (!text) return found
  RE_MEDIA_LINK.lastIndex = 0
  let match = RE_MEDIA_LINK.exec(text)
  while (match) {
    const kind = match[1]
    const parsed = parseMediaInner(match[2])
    if (parsed) found.push({ kind, rawTarget: parsed.rawTarget, decodedPath: parsed.decodedPath })
    match = RE_MEDIA_LINK.exec(text)
  }
  return found
}

/**
 * Pull the local file path out of the parentheses of an image or file link.
 * Returns null for URLs and for paths that would leave the note's folder.
 * @param {string} inner text inside the parentheses
 * @returns {?{| rawTarget: string, decodedPath: string |}}
 */
function parseMediaInner(inner: string): ?{| rawTarget: string, decodedPath: string |} {
  const trimmed = inner.trim()
  let pathPart = trimmed
  if (pathPart.startsWith('<')) {
    const end = pathPart.indexOf('>')
    if (end < 1) return null
    pathPart = pathPart.slice(1, end)
  } else {
    pathPart = pathPart.split(/\s+/)[0]
  }
  if (!pathPart || RE_HAS_SCHEME.test(pathPart)) return null
  let decoded = pathPart
  try {
    decoded = decodeURI(pathPart)
  } catch (e) {
    logDebug('NPEmbeddedMedia', `Could not decode attachment path '${pathPart}': ${String(e)}`)
    decoded = pathPart
  }
  if (!decoded || decoded.startsWith('/') || decoded.split('/').includes('..')) return null
  return { rawTarget: pathPart, decodedPath: decoded }
}

/**
 * Percent-encode each path segment the way NotePlan writes attachment links.
 * @param {string} decodedPath
 * @returns {string}
 */
export function encodeAttachmentPath(decodedPath: string): string {
  return decodedPath.split('/').map((part) => encodeURI(part)).join('/')
}

/**
 * Pick `{destNote}_attachments/{file}`, adding ` 2`, ` 3`, ... when that name is taken.
 * @param {string} destFilename
 * @param {string} decodedSourcePath
 * @param {Array<string>} taken decoded dest paths already chosen in this move
 * @param {(path: string) => boolean} destExists
 * @returns {string}
 */
export function chooseDestAttachmentPath(
  destFilename: string,
  decodedSourcePath: string,
  taken: Array<string>,
  destExists: (path: string) => boolean,
): string {
  const baseName = decodedSourcePath.split('/').pop() || decodedSourcePath
  const folder = `${noteBaseName(destFilename)}_attachments`
  let n = 2
  let candidate = `${folder}/${baseName}`
  while (taken.includes(candidate) || destExists(candidate)) {
    candidate = `${folder}/${numberedFileName(baseName, n)}`
    n += 1
    if (n > 50) break
  }
  taken.push(candidate)
  return candidate
}

/**
 * Insert a NotePlan-style numeric suffix before the extension, as in `photo 2.png`.
 * @param {string} baseName
 * @param {number} n
 * @returns {string}
 */
function numberedFileName(baseName: string, n: number): string {
  const dot = baseName.lastIndexOf('.')
  if (dot > 0) return `${baseName.slice(0, dot)} ${n}${baseName.slice(dot)}`
  return `${baseName} ${n}`
}

/**
 * Replace local `![image](...)` and `![file](...)` targets with the destination attachment paths.
 * Longer targets are replaced first so one filename cannot be a partial match of another.
 * @param {string} text
 * @param {Array<{| rawTarget: string, encodedDest: string |}>} replacements
 * @returns {string}
 */
export function rewriteMediaLinks(text: string, replacements: Array<{| rawTarget: string, encodedDest: string |}>): string {
  const ordered = replacements.slice().sort((a, b) => b.rawTarget.length - a.rawTarget.length)
  let out = text
  for (const pair of ordered) {
    if (!pair.rawTarget || pair.rawTarget === pair.encodedDest) continue
    out = out.split(`![image](${pair.rawTarget})`).join(`![image](${pair.encodedDest})`)
    out = out.split(`![file](${pair.rawTarget})`).join(`![file](${pair.encodedDest})`)
    out = out.split(`![image](<${pair.rawTarget}>)`).join(`![image](${pair.encodedDest})`)
    out = out.split(`![file](<${pair.rawTarget}>)`).join(`![file](${pair.encodedDest})`)
  }
  return out
}

/**
 * Copy each local embedded image/file referenced by `paras` into the destination
 * note's `_attachments` folder. Does not change the source paragraphs.
 * @param {TNote} sourceNote
 * @param {TNote} destNote
 * @param {Array<TParagraph>} paras
 * @returns {?EmbeddedMediaMove} rewrite for the inserted text, or null when there is nothing to do
 */
export function prepareEmbeddedMediaMove(sourceNote: MediaNote, destNote: MediaNote, paras: $ReadOnlyArray<MediaLine>): ?EmbeddedMediaMove {
  const replacements: Array<{| rawTarget: string, encodedDest: string |}> = []
  const copied: Array<CopiedEmbeddedMedia> = []
  const seenTargets: { [string]: boolean } = {}
  const takenDest: Array<string> = []

  for (const para of paras) {
    const line = para.rawContent || para.content || ''
    for (const target of findLocalMediaTargets(line)) {
      if (seenTargets[target.rawTarget]) continue
      seenTargets[target.rawTarget] = true
      const placed = copyOneEmbeddedFile(sourceNote, destNote, target.rawTarget, target.decodedPath, takenDest)
      if (!placed) continue
      replacements.push({ rawTarget: target.rawTarget, encodedDest: placed.encodedDest })
      if (placed.copied) copied.push(placed.copied)
    }
  }

  if (replacements.length === 0) return null
  return {
    rewrite: (text: string) => rewriteMediaLinks(text, replacements),
    copied,
  }
}

/**
 * Copy one embedded file into the destination note's attachment folder.
 * Skips the copy when the file is already in that folder, and returns null when the source file cannot be read.
 * @param {MediaNote} sourceNote
 * @param {MediaNote} destNote
 * @param {string} rawTarget
 * @param {string} decodedPath
 * @param {Array<string>} takenDest
 * @returns {?{| encodedDest: string, copied: ?CopiedEmbeddedMedia |}}
 */
function copyOneEmbeddedFile(
  sourceNote: MediaNote,
  destNote: MediaNote,
  rawTarget: string,
  decodedPath: string,
  takenDest: Array<string>,
): ?{| encodedDest: string, copied: ?CopiedEmbeddedMedia |} {
  const sourceRelative = resolveSourceRelative(sourceNote, decodedPath)
  if (!sourceRelative) {
    logWarn('NPEmbeddedMedia', `Embedded file not found next to '${sourceNote.filename}': ${decodedPath}`)
    return null
  }
  const sourcePluginPath = pluginDataPathForNote(sourceNote.type, sourceNote.filename, sourceRelative)
  const destRelative = chooseDestAttachmentPath(destNote.filename, sourceRelative, takenDest, (rel) =>
    DataStore.fileExists(pluginDataPathForNote(destNote.type, destNote.filename, rel)),
  )
  const destPluginPath = pluginDataPathForNote(destNote.type, destNote.filename, destRelative)
  if (sourcePluginPath === destPluginPath) {
    logDebug('NPEmbeddedMedia', `Embedded file already in destination folder: ${destRelative}`)
    return { encodedDest: encodeAttachmentPath(destRelative), copied: null }
  }
  const data = DataStore.loadData(sourcePluginPath, false)
  if (data == null || data === '') {
    logWarn('NPEmbeddedMedia', `Could not read embedded file '${sourcePluginPath}'`)
    return null
  }
  const saved = DataStore.saveData(data, destPluginPath, false)
  if (!saved) {
    logWarn('NPEmbeddedMedia', `Could not write embedded file '${destPluginPath}'`)
    return null
  }
  logInfo('NPEmbeddedMedia', `Copied embedded file '${sourceRelative}' -> '${destNote.filename}' as '${destRelative}'`)
  const ownedBySource = sourceNote.type !== 'Calendar' && sourceRelative.startsWith(`${noteBaseName(sourceNote.filename)}_attachments/`)
  const folder = getFolderFromFilename(sourceNote.filename)
  const sourceTrashPath = !folder || folder === '/' || folder === '(error)' ? sourceRelative : `${folder}/${sourceRelative}`
  return {
    encodedDest: encodeAttachmentPath(destRelative),
    copied: {
      rawTarget,
      decodedPath,
      sourceTrashPath,
      canTrash: ownedBySource,
    },
  }
}

/**
 * Where the file actually is, relative to the source note's directory.
 * Tries the link path, then `{note}_attachments/{filename}` for a bare filename.
 * @param {MediaNote} sourceNote
 * @param {string} decodedPath
 * @returns {?string}
 */
function resolveSourceRelative(sourceNote: MediaNote, decodedPath: string): ?string {
  if (DataStore.fileExists(pluginDataPathForNote(sourceNote.type, sourceNote.filename, decodedPath))) return decodedPath
  if (!decodedPath.includes('/')) {
    const inFolder = `${noteBaseName(sourceNote.filename)}_attachments/${decodedPath}`
    if (DataStore.fileExists(pluginDataPathForNote(sourceNote.type, sourceNote.filename, inFolder))) return inFolder
  }
  return null
}

/**
 * After the source paragraphs have been removed, trash attachment files that lived in the source note's own `_attachments` folder and are no longer linked.
 * Calendar attachment files cannot be removed with the plugin API, so those are left in place.
 * @param {TNote} sourceNote
 * @param {Array<CopiedEmbeddedMedia>} copied
 */
export function removeSourceEmbeddedMediaIfUnused(sourceNote: MediaNote, copied: Array<CopiedEmbeddedMedia>): void {
  const remaining = remainingNoteText(sourceNote)
  for (const item of copied) {
    if (!item.canTrash) {
      if (sourceNote.type === 'Calendar') {
        logInfo('NPEmbeddedMedia', `Left calendar attachment in place (plugin API cannot remove Calendar files): ${item.decodedPath}`)
      }
      continue
    }
    if (noteStillMentionsItem(remaining, item)) {
      logDebug('NPEmbeddedMedia', `Keeping source attachment still referenced in '${sourceNote.filename}': ${item.decodedPath}`)
      continue
    }
    const trashed = DataStore.trashNote(item.sourceTrashPath)
    if (trashed) {
      logInfo('NPEmbeddedMedia', `Moved unused source attachment to trash: ${item.sourceTrashPath}`)
    } else {
      logWarn('NPEmbeddedMedia', `Could not trash unused source attachment: ${item.sourceTrashPath}`)
    }
  }
}

/**
 * Combine the note body and its paragraph text so a later check can see links that are still present.
 * @param {MediaNote} note
 * @returns {string}
 */
function remainingNoteText(note: MediaNote): string {
  const fromParas = (note.paragraphs || []).map((p) => `${p.rawContent || ''}\n${p.content || ''}`).join('\n')
  return `${note.content || ''}\n${fromParas}`
}

/**
 * Return true when the note text still contains this attachment link, so the source file must be kept.
 * @param {string} remaining
 * @param {CopiedEmbeddedMedia} item
 * @returns {boolean}
 */
function noteStillMentionsItem(remaining: string, item: CopiedEmbeddedMedia): boolean {
  return remaining.includes(`(${item.rawTarget})`) || remaining.includes(`(${item.decodedPath})`) || remaining.includes(`(<${item.rawTarget}>)`)
}
