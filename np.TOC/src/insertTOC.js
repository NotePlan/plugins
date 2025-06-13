// @flow

// -----------------------------------------------------------------------------
// Functions to support TOC creation & update
// David Wertheimer (original version), adapted for plugin by @jgclark
// Last updated 2025-06-13 for v1.0.0 by @jgclark
// -----------------------------------------------------------------------------

import { clo, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { getSettings, processHeading, extractLinkText } from './support/helpers'

/**
 * Inserts or updates a Table of Contents at the top of the current note.
 *
 * @param {string} writeUnderHeading - The heading to write the TOC under.
 * @param {boolean|string} includeH1BlankLineUnder - If true, include a blank H1 under the TOC header.
 * @param {boolean|string} padTextWithSpaces - If true, pad the text with spaces.
 * @param {boolean|string} horizontal - If true, use horizontal mode.
 * @param {string} bullet - The bullet to use.
 * @param {boolean|string} CAPS - If true, convert the text to uppercase.
 * @param {boolean|string} highlight - If true, wrap the text in ==.
 * @param {boolean|string} indented - If true, indent the text.
 * @returns {void}
 */
export async function insertTOC(): Promise<void> {
  try {
    // Check we have an Editor, and that it has paragraphs
    if (!Editor) {
      throw new Error("Editor not open. Stopping.")
    }
    if (!Editor.paragraphs) {
      throw new Error("Note has no paragraphs")
    }
    // Get the paragraphs from the Editor
    const paragraphs = Editor.paragraphs
    const noteTitle = Editor.title ?? '?'
    logDebug(`insertTOC`, `insertTOC() starting for Editor note '${noteTitle}' with ${paragraphs.length} paragraphs`)

    const config = await getSettings()
    const { writeUnderHeading, includeH1BlankLineUnder, padTextWithSpaces, horizontal, bullet, CAPS, highlight, indented } = config
    clo(config)

    //  Ensure we have a TOC header; if not, add it.
    const head = paragraphs.find(p => p.content === writeUnderHeading)
    if (!head) {
      Editor.prependParagraph(`### ${writeUnderHeading}`, "text")
      logDebug(`insertTOC`, `added TOC header ${writeUnderHeading}`)
      return
    }

    // Capture the pre-existing TOC lines (if any) that follow the TOC header.
    // We capture every paragraph's content until we hit a title with headingLevel equal to or less than the writeUnderHeading's level.
    const headerIndex = paragraphs.findIndex(p => p.content === writeUnderHeading)
    const existingTOCLines = []
    if (headerIndex >= 0) {
      const tocHeaderLevel = paragraphs[headerIndex].headingLevel || Infinity
      for (let i = headerIndex + 1; i < paragraphs.length; i++) {
        const para = paragraphs[i]
        if (para.type === 'title' && para.headingLevel <= tocHeaderLevel) {
          break
        }
        existingTOCLines.push(para.content)
      }
    }

    // Check for an existing blank H1 after the TOC header (only if includeH1BlankLineUnder is true).
    let blankH1Exists = false
    if (includeH1BlankLineUnder === true || includeH1BlankLineUnder === 'true') {
      if (headerIndex >= 0) {
        for (let i = headerIndex + 1; i < paragraphs.length; i++) {
          let para = paragraphs[i]
          if (para.type === 'title') {
            if (para.content.trim() === "" && para.headingLevel === 1) {
              blankH1Exists = true
            }
            break
          }
        }
      }
    }

    // Custom filtering: Include all paragraphs of type 'title' that are non-empty and not the TOC header.
    // Skip the very first encountered title if its headingLevel is 1.
    let firstTitleFound = false
    const headings = paragraphs.filter(p => {
      if (p.type !== 'title' || p.content.trim() === "") return false
      if (p.content === writeUnderHeading) return false
      if (!firstTitleFound) {
        firstTitleFound = true
        if (p.headingLevel === 1) return false
      }
      return true
    })

    const pad = padTextWithSpaces === "true" || padTextWithSpaces === true ? " " : ""
    const tocItems = []
    const horizontalMode = (horizontal === true || horizontal === 'true')
    // Retrieve bullet from frontmatter (defaulting to "-" if not set).
    const defaultBullet = (typeof bullet !== 'undefined' ? bullet : "-")

    headings.forEach((h) => {
      // Process the heading text (CAPS & highlight, plus escaping)
      const processedText = processHeading(h.content, CAPS, highlight)
      // Build the markdown link using the original heading text (for the anchor)
      // First split into text and URL parts
      const match = h.content.match(/\[(.*?)\]\((.*?)\)/)
      if (match) {
        const [_, text, url] = match
        // Encode the text portion (including spaces)
        const encodedText = text.replace(/ /g, '%20')
        // Replace the URL with U+FFFC (Object Replacement Character)
        const encodedContent = `%5B${encodedText}%5D%28%EF%BF%BC%29`
        const encLink = `noteplan://x-callback-url/openNote?noteTitle=${encodeURIComponent(noteTitle)}%23${encodedContent}`
        const markdownLink = `[${pad}${processedText}${pad}](${encLink})`

        if (horizontalMode) {
          // In horizontal mode, simply add the markdown link.
          tocItems.push(markdownLink)
        } else {
          // For non-horizontal mode, compute indentation.
          let tabs = ""
          if (indented === true || indented === 'true') {
            // Reduce indent by one level: for headingLevel n, indent with (n - 2) tabs (min 0).
            let numTabs = h.headingLevel - 2
            if (numTabs < 0) numTabs = 0
            for (let i = 0; i < numTabs; i++) {
              tabs += "\t"
            }
          }
          // Build the bullet: indentation (if any) plus the bullet text plus a trailing space.
          const indentedBullet = `${tabs + defaultBullet} `
          tocItems.push(indentedBullet + markdownLink)
        }
      } else {
        // If no markdown link found, handle as regular text
        const encodedContent = h.content.replace(/ /g, '%20')
        const encLink = `noteplan://x-callback-url/openNote?noteTitle=${encodeURIComponent(noteTitle)}%23${encodedContent}`
        const markdownLink = `[${pad}${processedText}${pad}](${encLink})`

        if (horizontalMode) {
          tocItems.push(markdownLink)
        } else {
          let tabs = ""
          if (indented === true || indented === 'true') {
            let numTabs = h.headingLevel - 2
            if (numTabs < 0) numTabs = 0
            for (let i = 0; i < numTabs; i++) {
              tabs += "\t"
            }
          }
          const indentedBullet = `${tabs + defaultBullet} `
          tocItems.push(indentedBullet + markdownLink)
        }
      }
    })

    // If includeH1BlankLineUnder is true and no blank H1 exists, add a blank H1.
    if ((includeH1BlankLineUnder === true || includeH1BlankLineUnder === 'true') && !blankH1Exists) {
      tocItems.push("# ")
    }

    // Join the items: In horizontal mode, separate with ' | ', otherwise join with newlines.
    let output = horizontalMode ? tocItems.join(' | ') : tocItems.join("\n")

    // Reassemble the pre-existing TOC lines using the same separator.
    const existing = horizontalMode ? existingTOCLines.join(' | ') : existingTOCLines.join("\n")

    // Compare the existing TOC with the new output.
    const isSame = (existing === output)
    if (!isSame) {
      // Log differences line by line.
      const newLines = output.split(horizontalMode ? ' | ' : "\n")
      const existingLines = existing.split(horizontalMode ? ' | ' : "\n")
      logDebug('insertTOC', "\n\n**************\n\ntemplateRunner TOC Differences between existing and new TOC:")
      for (let i = 0; i < Math.max(newLines.length, existingLines.length); i++) {
        if (newLines[i] !== existingLines[i]) {
          logDebug('insertTOC', `Line ${i + 1}:\n\texisting: "${existingLines[i] || ''}"\n\tnew: "${newLines[i] || ''}"`)
        }
      }
      logDebug('insertTOC', "\n\n**************\n\n")
    } else {
      output = ""
      logDebug('insertTOC', "templateRunner TOC Creator: No differences. Doing nothing")
    }
  } catch (error) {
    logError(`insertTOC`, error.message)
  }
}
