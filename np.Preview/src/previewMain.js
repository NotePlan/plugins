// @flow

//--------------------------------------------------------------
// Main rendering function for Preview
// by Jonathan Clark, last updated 11.8.2023 for v0.4.?
//--------------------------------------------------------------

import pluginJson from '../plugin.json'
// import open, { openApp, apps } from 'open'
import showdown from 'showdown' // for Markdown -> HTML from https://github.com/showdownjs/showdown
import { getCodeBlocksOfType } from '@helpers/codeBlocks'
import { clo, JSP, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { addTrigger } from '@helpers/NPFrontMatter'
import { displayTitle } from '@helpers/general'
import {
  getFrontMatterParagraphs,
  hasFrontMatter
} from '@helpers/NPFrontMatter'
import {
  convertHashtagsToHTML,
  convertHighlightsToHTML,
  convertMentionsToHTML,
  convertUnderlinedToHTML,
  type HtmlWindowOptions,
  showHTMLV2
} from '@helpers/HTMLView'
import { formRegExForUsersOpenTasks, RE_SYNC_MARKER } from '@helpers/regex'
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
const isDarkTheme = (Editor.currentTheme.mode === 'dark')

// Note: using CDN version of mermaid.js, because whatever we tried for a packaged local version didn't work for Gantt charts.
function initMermaidScripts(mermaidTheme?: string): string {
  const mermaidThemeToUse = mermaidTheme
    ? mermaidTheme : isDarkTheme
      ? 'dark' : 'default'
  return `
<script type="module">
import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs";
// import merm from "./mermaid@10.1.0.min.mjs";
// var mermaid = merm.default;
mermaid.initialize({ startOnLoad: true, theme: '${mermaidThemeToUse}' });
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
 * @param {string?} mermaidTheme name (optional)
 */
export function previewNote(mermaidTheme?: string): void {
  try {
    const { note, content, title } = Editor
    let lines = content?.split('\n') ?? []
    let hasFrontmatter = hasFrontMatter(content ?? '')
    const RE_OPEN_TASK_FOR_USER = formRegExForUsersOpenTasks(false)

    // Work on a copy of the note's content
    // Change frontmatter for this note (if present)
    // In particular remove trigger line
    if (hasFrontmatter) {
      let titleAsMD = ''
      lines = lines.filter(l => l !== 'triggers: onEditorWillSave => np.Preview.updatePreview')
      // look for 2nd '---' and double it, because of showdown bug
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].match(/^title:\s/)) {
          titleAsMD = lines[i].replace('title:', '#')
          logDebug('previewNote', `removing title line ${String(i)}`)
          lines.splice(i, 1)
        }
        if (lines[i].trim() === '---') {
          lines.splice(i, 0, '') // add a blank before second HR to stop it acting as an ATX header line
          lines.splice(i + 2, 0, titleAsMD) // add the title (as MD)
          break
        }
      }

      // If we now have empty frontmatter (so, just 3 sets of '---'), then remove them all
      if (lines[0] === '---' && lines[1] === '' && lines[2] === '---') {
        lines.splice(0, 3)
        hasFrontmatter = false
      }
    }


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

    // Make some necessary changes before conversion to HTML
    for (let i = 0; i < lines.length; i++) {
      // remove any sync link markers (blockIds)
      lines[i] = lines[i].replace(/\^[A-z0-9]{6}([^A-z0-9]|$)/g, '').trimRight()

      // change open tasks to GFM-flavoured task syntax
      const res = lines[i].match(RE_OPEN_TASK_FOR_USER)
      if (res) {
        lines[i] = lines[i].replace(res[0], '- [ ]')
      }
    }

    // Make this proper Markdown -> HTML via showdown library
    // Set some options to turn on various more advanced HTML conversions (see actual code at https://github.com/showdownjs/showdown/blob/master/src/options.js#L109):
    const converterOptions = {
      emoji: true,
      footnotes: true,
      ghCodeBlocks: true,
      strikethrough: true,
      tables: true,
      tasklists: true,
      metadata: false, // otherwise metadata is swallowed
      requireSpaceBeforeHeadingText: true,
      simpleLineBreaks: true // Makes this GFM style. TODO: make an option?
    }
    const converter = new showdown.Converter(converterOptions)
    let body = converter.makeHtml(lines.join(`\n`))

    // logDebug(pluginJson, 'Converter produces:\n' + body)

    // TODO: Ideally build a frontmatter styler extension (to use above) but for now ...
    // Tweak body output to put frontmatter in a box if it exists
    if (hasFrontmatter) {
      // replace first '<hr />' with start of div
      body = body.replace('<hr />', '<div class="frontmatter">')
      // replace what is now the first '<hr />' with end of div
      body = body.replace('<hr />', '</div>')
    }
    // logDebug(pluginJson, body)

    // Make other changes to the HTML to cater for NotePlan-specific syntax
    lines = body.split('\n')
    let modifiedLines = []
    for (let line of lines) {
      const origLine = line

      // Display hashtags with .hashtag style
      line = convertHashtagsToHTML(line)

      // Display mentions with .attag style
      line = convertMentionsToHTML(line)

      // Display highlights with .highlight style
      line = convertHighlightsToHTML(line)

      // Replace [[notelinks]] with just underlined notelink
      let captures = line.match(/\[\[(.*?)\]\]/)
      if (captures) {
        // clo(captures, 'results from [[notelinks]] match:')
        for (let capturedTitle of captures) {
          line = line.replace('[[' + capturedTitle + ']]', '~' + capturedTitle + '~')
        }
      }
      // Display underlining with .underlined style
      line = convertUnderlinedToHTML(line)

      // Remove any blockIDs
      line = line.replace(RE_SYNC_MARKER, '')

      if (line !== origLine) {
        logDebug('previewNote', `modified {${origLine}} -> {${line}}`)
      }
      modifiedLines.push(line)
    }
    // Add mermaid script if needed
    const finalBody = modifiedLines.join('\n') + (includesMermaid ? initMermaidScripts(mermaidTheme) : '')
    console.log(initMermaidScripts("green"))

    // Add sticky button at top right offering to print
    // (But printing doesn't work on i(Pad)OS ...)
    if (NotePlan.environment.platform === 'macOS') {
      body = `	<div class="stickyButton"><button class="nonPrinting" type="printButton"><a href="preview.html" onclick="window.open(this.href).print(); return false;">Print (opens in system browser)</a></button></div>\n` + body // Note: seems to need the .print() even though it doesn't activate in the browser.
    }
    const headerTags = `<meta name="generator" content="np.Preview plugin by @jgclark v${pluginJson['plugin.version'] ?? '?'}">
<meta name="date" content="${new Date().toISOString()}">`

    const windowOpts: HtmlWindowOptions = {
      windowTitle: `${displayTitle(Editor)} Preview`,
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
    showHTMLV2(finalBody, windowOpts)
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
    // Call preview note function with 'default' theme (best for printing)
    previewNote('default')
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
    previewNote()
  }
  catch (error) {
    logError(pluginJson, `${error.name}: ${error.message}`)
  }
}
