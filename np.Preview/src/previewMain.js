// @flow

//--------------------------------------------------------------
// Main rendering function for Preview
// by Jonathan Clark, last updated 24.6.2023 for v0.3.0
//--------------------------------------------------------------

import pluginJson from '../plugin.json'
// import open, { openApp, apps } from 'open'
import showdown from 'showdown' // for Markdown -> HTML from https://github.com/showdownjs/showdown
import { getCodeBlocksOfType } from '@helpers/codeBlocks'
import { clo, JSP, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { getFrontMatterParagraphs, hasFrontMatter } from '@helpers/NPFrontMatter'
import { type HtmlWindowOptions, showHTMLV2 } from '@helpers/HTMLView'

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
const isDarkTheme = (Editor.currentTheme.mode === 'dark')
// Note: using CDN version of mermaid.js, because whatever we tried for a packaged local version didn't work for Gantt charts.
// TODO: add a setting to specify other Mermaid colour schemes
function initMermaidScripts(theme?: string): string {
  const themeToUse = theme || isDarkTheme ? 'dark' : 'default'
  return `
<script type="module">
import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs";
// import merm from "./mermaid@10.1.0.min.mjs";
// var mermaid = merm.default;
mermaid.initialize({ startOnLoad: true, theme: '${themeToUse}' });
</script>
`
}

const extraCSS = `
.stickyButton { position: sticky; float: right; top: 6px; right: 8px; }
Button a { text-decoration: none; font-size: 0.9rem; }
.frontmatter { border-radius: 12px;
  border: 1px solid var(--tint-color);
  padding: 0rem 0.5rem;
  background-color: var(--bg-alt-color);
  }
@media print {
  .nonPrinting {
    display: none;
  }
}
`

/**
 * Preview current Editor note to HTML window, covering:
 * - Mermaid diagrams
 * - MathJax fragments or lines
 * - other standard Markdown conversion (supplied by 'showdown' library)
 * - some non-standard Markdown conversion (e.g. tables) (also supplied by 'showdown' library)
 * @author @jgclark
 */
export function previewNote(mermaidTheme?: string): void {
  try {
    const { note, content, title } = Editor
    let lines = content?.split('\n') ?? []
    const hasFrontmatter = hasFrontMatter(content ?? '')

    // Update frontmatter for this note (if present)
    // In particular remove trigger line
    if (hasFrontmatter) {
      lines = lines.filter(l => l !== 'triggers: onEditorWillSave => np.Preview.updatePreview')
      // look for 2nd '---' and double it, because of showdown bug
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].startsWith('title:')) {
          lines[i] = lines[i].replace('title: ', '# ')
        }
        if (lines[i].trim() === '---') {
          lines[i] = "---\n---" // add a second HR
          break
        }
      }
    }

    logDebug(pluginJson, lines.join('\n'))
    logDebug(pluginJson, '')

    // TODO: Ideally build a frontmatter styler extension
    // But for now ...
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

    // Make this proper Markdown -> HTML via showdown library
    // Set some options to turn on various more advanced HTML conversions:
    const converterOptions = {
      emoji: true,
      footnotes: true,
      ghCodeBlocks: true,
      strikethrough: true,
      tables: true,
      tasklists: true,
    }
    const converter = new showdown.Converter(converterOptions)
    let body = converter.makeHtml(lines.join(`\n`))

    // For now tweak body output to put frontmatter in a box if it exists
    if (hasFrontmatter) {
      // replace first '<hr />' with start of div
      body = body.replace('<hr />', '<div class="frontmatter">')
      // replace what is now the first '<hr />' with end of div
      body = body.replace('<hr />', '</div>')
    }
    // logDebug(pluginJson, body)

    // Add sticky button at top right offering to print
    // TEST: without window.open(this.href)...
    body = `	<div class="stickyButton"><button class="nonPrinting" type="printButton"><a href="preview.html" onclick="window.open(this.href).print(); return false;">Print me</a></button></div>\n` + body

    body += (includesMermaid ? initMermaidScripts(mermaidTheme) : '')
    const windowOpts: HtmlWindowOptions = {
      windowTitle: `${displayTitle(Editor)} Preview`,
      headerTags: '',
      generalCSSIn: '', // get general CSS set automatically
      bodyOptions: '',
      specificCSS: extraCSS,
      makeModal: false, // = not modal window
      preBodyScript: initMathJaxScripts, // for MathJax libraries
      postBodyScript: '', // none
      savedFilename: savedFilename,
      reuseUsersWindowRect: true, // do try to use user's position for this window, otherwise use following defaults ...
      customId: 'preview',
      shouldFocus: true, // shouuld not focus, if Window already exists
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
 * TODO: needs help to get this approach to work.
 */
export async function openPreviewNoteInBrowser(): Promise<void> {
  try {
    // Call preview note function with 'default' theme (best for printing)
    previewNote('default')
    logDebug(pluginJson, `openPreviewNoteInBrowser: preview created; now will try to open in browser`)
    // FIXME: the following doesn't work -- something to do with imports and builtins
    // await open(savedFilename)
  } catch (error) {
    logError(pluginJson, `openPreviewNoteInBrowser: ${error.message}`)
  }
}
