// @flow

//--------------------------------------------------------------
// Main rendering function for Preview
// by Jonathan Clark, last updated 19.5.2023 for v0.2
//--------------------------------------------------------------

import pluginJson from '../plugin.json'
import showdown from 'showdown' // for Markdown -> HTML from https://github.com/showdownjs/showdown
import { getCodeBlocksOfType } from '@helpers/codeBlocks'
import { clo, JSP, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { type HtmlWindowOptions, showHTMLV2 } from '@helpers/HTMLView'

//--------------------------------------------------------------

const initMermaidScripts = `
<script src="mermaid.min.js"></script>
<script>
mermaid.initialize({ startOnLoad: true });
</script>
`

const initMathJaxScripts = `
<script src="polyfill.min.js"></script>
<script type="text/javascript" id="MathJax-script" async
  src="tex-chtml.js">
</script>
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
    const { note, content } = Editor
    const lines = content?.split('\n') ?? []

    // Update mermaid fenced code blocks to suitable <divs>
    // Note: did try to use getCodeBlocksOfType() helper but found it wasn't architected helpfully for this use case
    let inMermaidCodeblock = false
    for (let i = 0; i < lines.length; i++) {
      if (inMermaidCodeblock && lines[i].trim() === "```") {
        lines[i] = "</div>"
        inMermaidCodeblock = false
      }
      if (!inMermaidCodeblock && lines[i].trim().match(/```\s*mermaid/)) {
        lines[i] = "<div class='mermaid'>"
        inMermaidCodeblock = true
      }
    }

    // Make this proper Markdown -> HTML via showdown library
    // Set some options to turn on various more advanced HTML:
    const converterOptions = {
      emoji: true,
      footnotes: true,
      ghCodeBlocks: true,
      strikethrough: true,
      tables: true,
      tasklists: true,
    }
    const converter = new showdown.Converter(converterOptions)
    const body = converter.makeHtml(lines.join(`\n`))
    const windowOpts: HtmlWindowOptions = {
      windowTitle: 'Mermaid preview',
      headerTags: '',
      generalCSSIn: '', // get general CSS set automatically
      specificCSS: '', // set in separate CSS file instead
      makeModal: false, // = not modal window
      preBodyScript: initMermaidScripts + initMathJaxScripts, // no extra pre-JS
      postBodyScript: '', // none
      savedFilename: 'preview.html',
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
