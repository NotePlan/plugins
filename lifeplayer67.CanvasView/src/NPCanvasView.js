// @flow
// -----------------------------------------------------------------------------
// Command implementations for the Canvas View plugin.
// -----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { renderCanvasHTML, type TCanvasData } from './canvasRenderer'
import { showHTMLV2, sendToHTMLWindow } from '@helpers/HTMLView'
import { logDebug, logError, clo } from '@helpers/dev'
import { showMessage } from '@helpers/userInput'

const PLUGIN_ID = pluginJson['plugin.id']

/** One window/sidebar entry per canvas, so two canvases never fight over one pane */
function windowIdFor(fullPath: string): string {
  return `${PLUGIN_ID}.${fullPath.split('/').pop() ?? 'main'}`
}

type TSettings = {
  canvasFolder: string,
  openInSplitView: boolean,
}

function getSettings(): TSettings {
  const settings = DataStore.settings ?? {}
  return {
    canvasFolder: (settings.canvasFolder ?? '').trim(),
    openInSplitView: settings.openInSplitView !== false,
  }
}

const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|svg)$/i
const IMAGE_MIME: { [string]: string } = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' }

/** Try to load an image referenced by a file node as a data URI (base64, ≤ ~2.5 MB) */
function loadImageDataURI(filePath: string): ?string {
  const candidates = [`../../../Notes/${filePath}`]
  if (filePath.startsWith('Notes/')) candidates.push(`../../../${filePath}`)
  for (const p of candidates) {
    const b64 = DataStore.loadData(p, false)
    if (b64 != null && b64 !== '' && b64.length < 3_500_000) {
      const ext = (filePath.split('.').pop() ?? '').toLowerCase()
      return `data:${IMAGE_MIME[ext] ?? 'image/png'};base64,${b64}`
    }
  }
  return null
}

/**
 * Resolve the user-supplied path to something DataStore.loadData can read.
 * loadData always reads relative to [NotePlan]/Plugins/data/<plugin-id>/ (absolute
 * paths are treated as relative!), but '../' escapes are allowed — the same trick
 * helpers/HTMLView.js uses to reach the Notes folder ('../../../Notes/...').
 * So: relative input -> the NotePlan Notes folder (+ optional canvasFolder subfolder),
 * absolute input -> climb to the filesystem root with enough '../' segments.
 */
function resolveCanvasPath(input: string, canvasFolder: string): string {
  const trimmed = input.trim()
  const withExt = /\.canvas$/i.test(trimmed) ? trimmed : `${trimmed}.canvas`
  if (withExt.startsWith('/')) return `${'../'.repeat(12)}${withExt.slice(1)}`
  const folder = canvasFolder.replace(/^\/+|\/+$/g, '')
  return folder === '' ? `../../../Notes/${withExt}` : `../../../Notes/${folder}/${withExt}`
}

function loadCanvas(fullPath: string): ?TCanvasData {
  const raw = DataStore.loadData(fullPath, true)
  if (raw == null || raw === '') return null
  try {
    return JSON.parse(raw)
  } catch (parseError) {
    // Seen in the wild: stray '…' (U+2026) after '[' / '{' and unicode whitespace
    // between tokens (source unclear — possibly a sync/text-layer round-trip).
    // Strip garbage that sits OUTSIDE strings and retry before giving up.
    const cleaned = raw.replace(/([[{,]\s*)…\s*/g, '$1').replace(/[\u2028\u2029\u00A0\u200B\uFEFF]/g, ' ')
    const parsed = JSON.parse(cleaned) // still broken → throws to the caller's message
    logError(pluginJson, `loadCanvas: auto-repaired invalid JSON in '${fullPath}' (was: ${parseError.message})`)
    DataStore.saveData(cleaned, fullPath, true)
    return parsed
  }
}

// HTML pieces for the two-way comms bridge (np.Shared must be installed).
// onMessageFromPlugin must be defined before pluginToHTMLCommsBridge.js loads.
const COMMS_BRIDGE_HTML = `
<script>
const receivingPluginID = "${PLUGIN_ID}"
function onMessageFromPlugin(type, data) {
  if (window.__onPluginMessage) window.__onPluginMessage(type, data)
}
</script>
<script type="text/javascript" src="../np.Shared/pluginToHTMLErrorBridge.js"></script>
<script type="text/javascript" src="../np.Shared/pluginToHTMLCommsBridge.js"></script>
`

/**
 * Open a .canvas (JSON Canvas) file in a viewer/editor window.
 * @param {string?} pathArg path to the file; prompted for if not given
 */
export async function openCanvas(pathArg?: string): Promise<void> {
  try {
    const settings = getSettings()
    let path = pathArg ?? ''
    let fullPath = ''
    if (path === '') {
      // NotePlan indexes .canvas files as notes, so we can offer a proper chooser
      const canvasNotes = DataStore.projectNotes.filter((n) => n.filename.toLowerCase().endsWith('.canvas'))
      if (canvasNotes.length > 0) {
        const options = canvasNotes.map((n) => n.filename)
        const res = await CommandBar.showOptions(options, 'Який canvas відкрити?')
        if (res == null) return
        fullPath = `../../../Notes/${options[res.index]}`
      } else {
        const answer = await CommandBar.textPrompt(
          'Canvas View',
          settings.canvasFolder !== '' ? `Path to .canvas file (relative to Notes/${settings.canvasFolder})` : 'Path to .canvas file (relative to your Notes folder)',
          '',
        )
        if (answer === false || answer == null || String(answer).trim() === '') return
        path = String(answer)
      }
    }
    if (fullPath === '') fullPath = resolveCanvasPath(path, settings.canvasFolder)
    logDebug(pluginJson, `openCanvas: loading '${fullPath}'`)

    let canvas: ?TCanvasData
    try {
      canvas = loadCanvas(fullPath)
    } catch (parseError) {
      await showMessage(`'${fullPath}' is not valid JSON Canvas: ${parseError.message}`, 'OK', 'Canvas View')
      return
    }
    if (canvas == null) {
      await showMessage(`Could not read '${fullPath}'. Check the path and the 'Canvas folder' plugin setting.`, 'OK', 'Canvas View')
      return
    }
    const nodeCount = canvas.nodes?.length ?? 0
    const edgeCount = canvas.edges?.length ?? 0
    logDebug(pluginJson, `openCanvas: parsed ${nodeCount} nodes, ${edgeCount} edges`)

    // Resolve file-node contents so the window can render and edit them inline;
    // image files become data URIs so they display right in the card
    const fileContents: { [string]: Object } = {}
    for (const node of canvas.nodes ?? []) {
      if (node.type !== 'file') continue
      const filePath = String(node.file ?? '')
      if (IMAGE_EXT_RE.test(filePath)) {
        const dataURI = loadImageDataURI(filePath)
        fileContents[node.id] = dataURI != null ? { found: true, media: dataURI } : { found: false, title: filePath.split('/').pop() }
        continue
      }
      const noteTitle = filePath.split('/').pop().replace(/\.[^.]+$/, '')
      const matches = DataStore.projectNoteByTitle(noteTitle) ?? []
      fileContents[node.id] = matches.length > 0 ? { found: true, title: noteTitle, content: matches[0].content ?? '' } : { found: false, title: noteTitle }
    }

    // Note index for the autocomplete picker in the window
    const noteIndex = DataStore.projectNotes
      .filter((n) => (n.title ?? '') !== '')
      .map((n) => ({ t: n.title ?? '', f: n.filename }))

    const title = fullPath.split('/').pop().replace(/\.canvas$/i, '')
    const body = COMMS_BRIDGE_HTML + renderCanvasHTML(canvas, `${title} — ${nodeCount} nodes, ${edgeCount} edges`, fullPath, fileContents, noteIndex)

    await showHTMLV2(body, {
      windowTitle: `Canvas: ${title}`,
      customId: windowIdFor(fullPath),
      savedFilename: '../../lifeplayer67.CanvasView/canvas-view.html',
      width: 1100,
      height: 750,
      shouldFocus: true,
      showInMainWindow: settings.openInSplitView,
      splitView: settings.openInSplitView,
      icon: 'diagram-project',
      iconColor: 'orange-500',
      // no generalCSSIn: let showHTMLV2 inject CSS generated from the user's NotePlan
      // theme — it defines --bg-main-color/--fg-main-color/etc., which our CSS consumes
    })
  } catch (error) {
    logError(pluginJson, `openCanvas: ${error.message}`)
    clo(error, 'openCanvas error')
  }
}

/**
 * Receive messages sent from the HTML window via the np.Shared comms bridge.
 * data can arrive as a JSON string when invoked through x-callback (for testing).
 */
export async function onMessageFromHTMLView(actionType: string, data: any): Promise<void> {
  try {
    // Tolerate the one-array calling convention too: onMessageFromHTMLView(['action', {...}])
    if (Array.isArray(actionType)) {
      // $FlowIgnore[incompatible-type]
      ;[actionType, data] = actionType
    }
    const payload = typeof data === 'string' ? JSON.parse(data) : data ?? {}
    logDebug(pluginJson, `onMessageFromHTMLView: '${actionType}'`)
    switch (actionType) {
      case 'saveCanvas': {
        const jsonStr = String(payload.json)
        JSON.parse(jsonStr) // validate before touching the file — never write a broken canvas
        const ok = DataStore.saveData(jsonStr, payload.path, true)
        if (!ok) logError(pluginJson, `saveCanvas: saveData failed for '${payload.path}'`)
        break
      }
      case 'saveNote': {
        const noteTitle = String(payload.title ?? '')
        const content = String(payload.content)
        const matches = DataStore.projectNoteByTitle(noteTitle) ?? []
        if (matches.length > 0) {
          matches[0].content = content
          logDebug(pluginJson, `saveNote: updated '${noteTitle}' (${content.length} chars)`)
        } else {
          // First write into a card whose note doesn't exist yet: create it
          const withTitle = content.startsWith('# ') ? content : `# ${noteTitle}\n${content}`
          const filename = DataStore.newNoteWithContent(withTitle, '')
          logDebug(pluginJson, `saveNote: created '${filename}' for title '${noteTitle}'`)
        }
        break
      }
      case 'getNoteContent': {
        // The picker attached a card to a different note: send its content back
        const noteTitle = String(payload.title ?? '')
        const matches = DataStore.projectNoteByTitle(noteTitle) ?? []
        await sendToHTMLWindow(windowIdFor(String(payload.path ?? '')), 'NOTE_CONTENT', {
          id: payload.id,
          found: matches.length > 0,
          title: noteTitle,
          content: matches.length > 0 ? matches[0].content ?? '' : '',
        })
        break
      }
      case 'openNote': {
        const title = String(payload.title ?? '')
        const note = await Editor.openNoteByTitle(title)
        if (note == null) {
          await showMessage(`No note titled '${title}' found in NotePlan. Import it first, then the link will work.`, 'OK', 'Canvas View')
        }
        break
      }
      default:
        logError(pluginJson, `onMessageFromHTMLView: unknown actionType '${actionType}'`)
    }
  } catch (error) {
    logError(pluginJson, `onMessageFromHTMLView: ${error.message}`)
  }
}
