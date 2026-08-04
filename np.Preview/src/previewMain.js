// @flow

//--------------------------------------------------------------
// Main rendering function for Preview
// by Jonathan Clark, last updated 2026-08-04 for v0.5.0
//--------------------------------------------------------------


// import open, { openApp, apps } from 'open'
import pluginJson from '../plugin.json'
import { logDebug, logError, logWarn } from '@helpers/dev'
import { addTrigger } from '@helpers/NPFrontMatter'
import { displayTitle } from '@helpers/general'
import { getNoteFromFilename, getNoteFromIdentifier } from '@helpers/NPnote'

import {
  getNoteContentAsHTML,
  type HtmlWindowOptions,
  showHTMLV2
} from '@helpers/HTMLView'
import { showMessageYesNo } from '@helpers/userInput'

/**
 * Resolved note + markdown content for preview.
 * Prefer Editor content when the target file is open (includes unsaved edits).
 */
type PreviewNoteAndContent = {
  note: TNote,
  content: string,
}

/**
 * Resolve which note and content to preview.
 * - Empty/null noteSpec => Editor.note + Editor.content
 * - TNote => that note
 * - string => filename (teamspace-aware) then identifier (title / relative date / calendar)
 * If Editor is open on the same filename, use Editor.content for unsaved text.
 * @param {string | TNote | null | void} noteSpec
 * @returns {PreviewNoteAndContent}
 * @throws {Error} if no note or content can be resolved
 */
function resolveNoteAndContent(noteSpec?: string | TNote | null): PreviewNoteAndContent {
  let note: ?TNote = null

  if (noteSpec == null || noteSpec === '') {
    note = Editor.note
    if (!note) {
      throw new Error('No note or content found in Editor. Stopping.')
    }
  } else if (typeof noteSpec === 'object' && noteSpec.filename) {
    note = noteSpec
  } else if (typeof noteSpec === 'string') {
    note = getNoteFromFilename(noteSpec) ?? getNoteFromIdentifier(noteSpec)
    if (!note) {
      throw new Error(`Cannot find note for '${noteSpec}'. Stopping.`)
    }
  } else {
    throw new Error('Invalid note specifier for preview. Stopping.')
  }

  // Prefer open Editor buffer when it is the same file (unsaved edits)
  if (Editor.note?.filename === note.filename && Editor.content != null) {
    return { note: Editor.note, content: Editor.content }
  }

  const content = note.content
  if (content == null) {
    throw new Error(`No content found for note '${displayTitle(note)}'. Stopping.`)
  }
  return { note, content }
}

//--------------------------------------------------------------

// Constants
const savedFilename = '../../np.Preview/preview.html'

// Local offline Mermaid UMD snapshot (refresh by copying mermaid/dist/mermaid.min.js after bumping dep)
const MERMAID_OFFLINE_FILENAME = 'mermaid@11.16.1.min.js'

// Set up for MathJax
const initMathJaxScripts = `
<script type="text/javascript" id="MathJax-script" async
  src="tex-chtml.js">
</script>
`

// is current NP theme dark or light?
const isDarkTheme = (Editor.currentTheme.mode === 'dark')

/**
 * Build Mermaid boot script for the preview HTML window.
 * Tries CDN latest Mermaid 11.x first; falls back to shipped UMD for offline use.
 * @param {string?} mermaidTheme - optional Mermaid theme name
 * @returns {string} HTML script tag module
 */
function initMermaidScripts(mermaidTheme?: string): string {
  const mermaidThemeToUse = mermaidTheme
    ? mermaidTheme : isDarkTheme
      ? 'dark' : 'default'
  // Online: floating major from jsDelivr. Offline: official UMD snapshot in requiredFiles.
  return `
<script type="module">
const theme = '${mermaidThemeToUse}';
const CDN = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
const LOCAL = './${MERMAID_OFFLINE_FILENAME}';

async function loadLocalUmd() {
  await new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = LOCAL
    s.onload = resolve
    s.onerror = reject
    document.head.appendChild(s)
  })
  return window.mermaid
}

async function getMermaid() {
  try {
    return (await import(CDN)).default
  } catch (_e) {
    return await loadLocalUmd()
  }
}

const mermaid = await getMermaid()
mermaid.initialize({ startOnLoad: false, theme })
await mermaid.run()
</script>
`
}

const extraCSS = `
.stickyButton { position: sticky; float: right; top: 6px; right: 8px; }
Button a { text-decoration: none; font-size: 0.9rem; }
.frontmatter { border-radius: 8px;
  border: 1px solid var(--tint-color);
  padding: 0rem 0.4rem;
  background-color: var(--bg-alt-color);
  }
table {
  border-collapse: collapse;
  border: 1px solid grey;
}
th, td {
  border: 1px solid grey;
  text-align: left;
  vertical-align: top;
  padding: 0.2rem 0.4rem;
  font-weight: normal;
}
table thead th,
table thead td,
table tfoot th,
table tfoot td {
  font-weight: bold;
}
@media print {
  .nonPrinting {
    display: none;
  }
}
`

/**
 * Preview a note to HTML window, covering:
 * - Mermaid diagrams
 * - MathJax fragments or lines
 * - other standard Markdown conversion (supplied by 'showdown' library)
 * - some non-standard Markdown conversion (e.g. tables) (also supplied by 'showdown' library)
 * Command Bar with no args previews the open Editor note.
 * From x-callback / other plugins, pass a filename, title, relative date, or TNote as arg0.
 * @author @jgclark
 * @param {string | TNote | null | void} noteSpec - optional filename/identifier or TNote; omit for Editor
 * @param {string?} mermaidTheme - optional Mermaid theme override (otherwise default/dark from NP theme)
 */
export async function previewNote(noteSpec?: string | TNote | null, mermaidTheme?: string): Promise<void> {
  try {
    const { note, content } = resolveNoteAndContent(noteSpec)
    logDebug(pluginJson, `previewNote: '${displayTitle(note)}' (${note.filename})`)
    let lines = content.split('\n')
    lines = lines.filter(l => l !== 'triggers: onEditorWillSave => np.Preview.updatePreview')
    // Update mermaid fenced code blocks to suitable <divs>
    // Note: did try to use getCodeBlocksOfType() helper but found it wasn't architected helpfully for this use case
    let includesMermaid = false
    let inMermaidCodeblock = false
    for (let i = 0; i < lines.length; i++) {
      if (inMermaidCodeblock && lines[i].trim() === "```") {
        lines[i] = "</pre>"
        inMermaidCodeblock = false
      }
      if (!inMermaidCodeblock && lines[i].trim().match(/```\s*mermaid/)) {
        lines[i] = "<pre class='mermaid'>"
        inMermaidCodeblock = true
        includesMermaid = true
      }
    }

    let body = await getNoteContentAsHTML(lines.join('\n'), note) ?? ''

    // Add mermaid script if needed
    if (includesMermaid) {
      body = initMermaidScripts(mermaidTheme) + body
    }
    // Add sticky button at top right offering to print
    // (But printing doesn't work on i(Pad)OS ...)
    if (NotePlan.environment.platform === 'macOS') {
      body = `<div class="stickyButton"><button class="nonPrinting" type="printButton"><a href="preview.html" onclick="window.open(this.href).print(); return false;">Print (opens in system browser)</a></button></div>\n${body}` // Note: seems to need the .print() even though it doesn't activate in the browser.
    }

    const headerTags = `<meta name="generator" content="np.Preview plugin by @jgclark v${pluginJson['plugin.version'] ?? '?'}">
<meta name="date" content="${new Date().toISOString()}">`

    const windowOpts: HtmlWindowOptions = {
      windowTitle: `${displayTitle(note)} Preview`,
      headerTags: headerTags,
      generalCSSIn: '', // get general CSS set automatically
      bodyOptions: '',
      specificCSS: extraCSS,
      makeModal: false, // = not modal window
      preBodyScript: initMathJaxScripts, // for MathJax libraries
      postBodyScript: '', // none
      savedFilename: savedFilename,
      reuseUsersWindowRect: true, // do try to use user's position for this window, otherwise use following defaults ...
      customId: 'preview',
      shouldFocus: false, // shouuld not focus, if Window already exists
      // not setting defaults for x, y, width, height
    }
    showHTMLV2(body, windowOpts)
    // logDebug('preview', `written results to HTML`)
  }
  catch (error) {
    logError(pluginJson, `preview: ${error.message}`)
  }
}

/**
 * Open preview in browser, mostly useful to get it to print
 * TODO: needs help to get this approach to work.
 */
export async function openPreviewNoteInBrowser(): Promise<void> {
  try {
    // Editor note with 'default' Mermaid theme (best for printing)
    await previewNote(undefined, 'default')
    logDebug(pluginJson, `openPreviewNoteInBrowser: preview created; now will try to open in browser`)
    // FIXME: the following doesn't work -- something to do with imports and builtins
    // await open(savedFilename)
  } catch (error) {
    logError(pluginJson, `openPreviewNoteInBrowser: ${error.message}`)
  }
}

export async function addTriggerAndStartPreview(): Promise<void> {
  try {
    // Check to stop it running on iOS
    if (NotePlan.environment.platform !== 'macOS') {
      logDebug(pluginJson, `Designed only to run on macOS. Stopping.`)
      return
    }
    // Add trigger to frontmatter
    const res = addTrigger(Editor, 'onEditorWillSave', 'np.Preview', 'updatePreview')
    if (res) {
      logDebug(pluginJson, 'Preview trigger added.')
    } else {
      logWarn(pluginJson, 'Preview trigger could not be added for some reason.')
      const res2 = await showMessageYesNo(`Warning: Couldn't add trigger for previewing note. Do you wish to continue with preview?`, ['Yes', 'No'], 'Preview warning', false)
      if (res2 === 'No') {
        return // = stop
      }
    }

    // Start the preview
    await previewNote()
  }
  catch (error) {
    logError(pluginJson, `${error.name}: ${error.message}`)
  }
}
