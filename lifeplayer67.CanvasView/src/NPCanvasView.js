// @flow
// -----------------------------------------------------------------------------
// Command implementations for the Canvas View plugin.
// -----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { renderCanvasHTML, type TCanvasData } from './canvasRenderer'
import { showHTMLV2 } from '@helpers/HTMLView'
import { logDebug, logError, clo } from '@helpers/dev'
import { showMessage } from '@helpers/userInput'

const PLUGIN_ID = pluginJson['plugin.id']
const WINDOW_CUSTOM_ID = `${PLUGIN_ID}.main`

type TSettings = {
  canvasFolder: string,
}

function getSettings(): TSettings {
  const settings = DataStore.settings ?? {}
  return { canvasFolder: (settings.canvasFolder ?? '').trim() }
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
  return JSON.parse(raw)
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
    if (path === '') {
      const answer = await CommandBar.textPrompt(
        'Canvas View',
        settings.canvasFolder !== '' ? `Path to .canvas file (relative to Notes/${settings.canvasFolder})` : 'Path to .canvas file (relative to your Notes folder)',
        '',
      )
      if (answer === false || answer == null || String(answer).trim() === '') return
      path = String(answer)
    }
    const fullPath = resolveCanvasPath(path, settings.canvasFolder)
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

    // Resolve file-node contents so the window can render and edit them inline
    const fileContents: { [string]: Object } = {}
    for (const node of canvas.nodes ?? []) {
      if (node.type !== 'file') continue
      const noteTitle = String(node.file ?? '').split('/').pop().replace(/\.[^.]+$/, '')
      const matches = DataStore.projectNoteByTitle(noteTitle) ?? []
      fileContents[node.id] = matches.length > 0 ? { found: true, title: noteTitle, content: matches[0].content ?? '' } : { found: false, title: noteTitle }
    }

    const title = fullPath.split('/').pop().replace(/\.canvas$/i, '')
    const body = COMMS_BRIDGE_HTML + renderCanvasHTML(canvas, `${title} — ${nodeCount} nodes, ${edgeCount} edges`, fullPath, fileContents)

    await showHTMLV2(body, {
      windowTitle: `Canvas: ${title}`,
      customId: WINDOW_CUSTOM_ID,
      savedFilename: '../../lifeplayer67.CanvasView/canvas-view.html',
      width: 1100,
      height: 750,
      shouldFocus: true,
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
