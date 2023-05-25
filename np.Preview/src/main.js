// @flow

//--------------------------------------------------------------
// Main rendering function for Preview
// by Jonathan Clark, last updated 23.5.2023 for v0.3.0
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
<script src="polyfill.min.js"></script>
<script type="text/javascript" id="MathJax-script" async
  src="tex-chtml.js">
</script>
`

// Set up for Mermaid, using live copy of the Mermaid library (for now)
// is current NP theme dark or light?
const isDarkTheme = (Editor.currentTheme.mode === 'dark')
// TODO: find a webpack version of mermaid
const initMermaidScripts = `
<script type="module">
// import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs";
import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs";
mermaid.initialize({ startOnLoad: true, theme: '${isDarkTheme ? 'dark' : 'default'}' });
</script>
`

const fakeButtonCSS = `
<style type="text/css">
	.fake-button {
		background-color: #5E5E5E;
		font-size: 1.0rem;
		font-weight: 500;
		text-decoration: none;
		border-color: #5E5E5E;
		border-radius: 4px;
		box-shadow: 0 -1px 1px #6F6F6F;
		padding: 1px 7px 1px 7px;
		margin: 1px 4px;
		white-space: nowrap
	}
</style>
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
    // TODO: make this a better-looking button
    body = `	<p align="right" class="fakebutton"><a href="preview.html" onclick="window.open(this.href).print(); return false;">Print me</a></p>\n` + body

    // Newer way to include Mermaid is to add at end of body

    body += (includesMermaid ? initMermaidScripts : '')
    const windowOpts: HtmlWindowOptions = {
      windowTitle: `${displayTitle(Editor)} Preview`,
      headerTags: '',
      generalCSSIn: '', // get general CSS set automatically
      specificCSS: '', // set in separate CSS file instead
      makeModal: false, // = not modal window
      preBodyScript: fakeButtonCSS + initMathJaxScripts, // add Mermaid (if needed) and MathJax libraries
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
