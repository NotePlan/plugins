// @flow

//--------------------------------------------------------------
// Main rendering function for Preview
// by Jonathan Clark, last updated 2025-03-14 for v0.4.5
//--------------------------------------------------------------

// import open, { openApp, apps } from 'open'
import pluginJson from '../plugin.json'
import { getPreviewSpecificCSS } from './previewStyles'
import { logDebug, logError, logWarn } from '@helpers/dev'
import { addTrigger } from '@helpers/NPFrontMatter'
import { displayTitle } from '@helpers/general'

import { getNoteContentAsHTML, type HtmlWindowOptions, showHTMLV2 } from '@helpers/HTMLView'
import { showMessageYesNo } from '@helpers/userInput'

//--------------------------------------------------------------

// Constants
const savedFilename = '../../np.Preview/preview.html'

// Set up for MathJax
const initMathJaxScripts = `
<script type="text/javascript" id="MathJax-script" async
  src="tex-chtml.js">
</script>
`

// Set up for Mermaid, using live copy of the Mermaid library (for now)
// is current NP theme dark or light?
const isDarkTheme = Editor.currentTheme.mode === 'dark'

// Note: using CDN version of mermaid.js, because whatever we tried for a packaged local version didn't work for Gantt charts.
function initMermaidScripts(mermaidTheme?: string): string {
  const mermaidThemeToUse = mermaidTheme ? mermaidTheme : isDarkTheme ? 'dark' : 'default'
  return `
<script type="module">
import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
// import merm from "./mermaid@10.1.0.min.mjs";
// var mermaid = merm.default;
mermaid.initialize({ startOnLoad: true, theme: '${mermaidThemeToUse}' });
</script>
`
}

/**
 * Preview current Editor note to HTML window, covering:
 * - Mermaid diagrams
 * - MathJax fragments or lines
 * - other standard Markdown conversion (supplied by 'showdown' library)
 * - some non-standard Markdown conversion (e.g. tables) (also supplied by 'showdown' library)
 * @author @jgclark
 * @param {string?} mermaidTheme name (optional)
 */
export async function previewNote(mermaidTheme?: string = 'green'): Promise<void> {
  try {
    const { note, content } = Editor
    if (!note || !content) {
      throw new Error('No note or content found in Editor. Stopping.')
    }
    let lines = content.split('\n')
    lines = lines.filter((l) => l !== 'triggers: onEditorWillSave => np.Preview.updatePreview')
    // Update mermaid fenced code blocks to suitable <divs>
    // Note: did try to use getCodeBlocksOfType() helper but found it wasn't architected helpfully for this use case
    let includesMermaid = false
    let inMermaidCodeblock = false
    for (let i = 0; i < lines.length; i++) {
      if (inMermaidCodeblock && lines[i].trim() === '```') {
        lines[i] = '</pre>'
        inMermaidCodeblock = false
      }
      if (!inMermaidCodeblock && lines[i].trim().match(/```\s*mermaid/)) {
        lines[i] = "<pre class='mermaid'>"
        inMermaidCodeblock = true
        includesMermaid = true
      }
    }

    let body = (await getNoteContentAsHTML(lines.join('\n'), note)) ?? ''

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
      windowTitle: `${displayTitle(Editor)} Preview`,
      headerTags: headerTags,
      generalCSSIn: '', // get general CSS set automatically
      bodyOptions: '',
      specificCSS: getPreviewSpecificCSS(),
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
  } catch (error) {
    logError(pluginJson, `preview: ${error.message}`)
  }
}

/**
 * Open preview in browser, mostly useful to get it to print
 * TODO: needs help to get this approach to work.
 */
export async function openPreviewNoteInBrowser(): Promise<void> {
  try {
    // Call preview note function with 'default' theme (best for printing)
    await previewNote('default')
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
  } catch (error) {
    logError(pluginJson, `${error.name}: ${error.message}`)
  }
}
