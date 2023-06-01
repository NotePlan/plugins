// @flow

//--------------------------------------------------------------
// Main rendering function for Preview
// by Jonathan Clark, last updated 27.5.2023 for v0.3.0
//--------------------------------------------------------------

import pluginJson from '../plugin.json'
import showdown from 'showdown' // for Markdown -> HTML from https://github.com/showdownjs/showdown
import { getCodeBlocksOfType } from '@helpers/codeBlocks'
import { clo, JSP, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { type HtmlWindowOptions, showHTMLV2 } from '@helpers/HTMLView'

//--------------------------------------------------------------

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
const initMermaidScripts = `
<script type="module">
import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs";
// import merm from "./mermaid@10.1.0.min.mjs";
// var mermaid = merm.default;
mermaid.initialize({ startOnLoad: true, theme: '${isDarkTheme ? 'dark' : 'default'}' });
</script>
`

const extraCSS = `
.stickyButton { position: sticky; float: right; top: 6px; right: 8px; }
Button a { text-decoration: none; font-size: 0.9rem; }
`

/**
 * Preview current Editor note to HTML window, covering:
 * - Mermaid diagrams
 * - MathJax fragments or lines
 * - other standard Markdown conversion (supplied by 'showdown' library)
 * - some advanced Markdown conversion (e.g. tables) (also supplied by 'showdown' library)
 * @author @jgclark
 */
export function previewNote(): void {
  try {
    let includesMermaid = false
    const { note, content } = Editor
    let lines = content?.split('\n') ?? []

    // Update mermaid fenced code blocks to suitable <divs>
    // Note: did try to use getCodeBlocksOfType() helper but found it wasn't architected helpfully for this use case
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
    // Add sticky button at top right offering to print
    body = `	<div class="stickyButton"><button type="printButton"><a href="preview.html" onclick="window.open(this.href).print(); return false;">Print me</a></button></div>\n` + body

    // TODO: triggers for refresh

    body += (includesMermaid ? initMermaidScripts : '')
    const windowOpts: HtmlWindowOptions = {
      windowTitle: `${displayTitle(Editor)} Preview`,
      headerTags: '',
      generalCSSIn: '', // get general CSS set automatically
      specificCSS: extraCSS,
      makeModal: false, // = not modal window
      preBodyScript: initMathJaxScripts, // add Mermaid (if needed) and MathJax libraries
      postBodyScript: '', // none
      savedFilename: '../../np.Preview/preview.html',
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

export function openPreviewNoteInBrowser(): void {
}
