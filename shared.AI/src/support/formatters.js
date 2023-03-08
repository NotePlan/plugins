// @flow

import { log, logDebug, logError, logWarn, clo, JSP, timer } from '@helpers/dev'
import { createPrettyRunPluginLink, createPrettyOpenNoteLink } from '@helpers/general'
import { capitalizeFirstLetter } from './helpers'
import { removeContentUnderHeading } from '@helpers/NPParagraph'
import { getDataFileName } from './externalFileInteractions'

const pluginJson = `shared.AI/helpers`

/**
 * Formats the subtitle for the output prompt.
 * @param {string} subject - The core search query instantiated by the user.
 * @param {string?} prevSubject - The previous search query instantiated by the user.
 * @param {string} fullHistory - The entire search query from the first to the current search request. Includes all links.
 * @param {boolean} useFullHistory - Indicates whether or not the subtitle should use part or all of the history.
 * @param {string} fullHistoryText - The entire search query from the first to the current search request. Pure text only.
 */
export function formatSubtitle(subject: string, prevSubject?: string = '', fullHistory: string, useFullHistory: boolean, fullHistoryText: string) {
  let fullHistoryTextOut = ''
  let backLink = ''
  let subtitle = ''
  let newFullHistoryLink = ''
  if (prevSubject) {
    if (useFullHistory == true || useFullHistory == 'true') {
      if (fullHistory.includes(prevSubject)) {
        const prettyPrev = createPrettyOpenNoteLink(prevSubject, Editor.filename, true, prevSubject)
        newFullHistoryLink = fullHistory.replace(prevSubject, prettyPrev)
      }
      backLink = createPrettyOpenNoteLink(prevSubject, Editor.filename, true, prevSubject)
      fullHistoryTextOut = `${capitalizeFirstLetter(subject)} in the context of ${fullHistoryText}`
      subtitle = `${capitalizeFirstLetter(subject)} in the context of ${newFullHistoryLink ? newFullHistoryLink : fullHistory}`
    } else {
      fullHistoryTextOut = `${capitalizeFirstLetter(subject)} in the context of ${prevSubject}`
      backLink = createPrettyOpenNoteLink(prevSubject, Editor.filename, true, prevSubject)
      subtitle = `${capitalizeFirstLetter(subject)} in the context of ${backLink}`
    }
  } else {
    fullHistoryTextOut = capitalizeFirstLetter(subject)
    subtitle = capitalizeFirstLetter(subject)
  }

  let outputFullHistoryText = fullHistoryTextOut,
    outputSubtitle = subtitle
  return {
    newFullHistoryText: outputFullHistoryText,
    formattedSubtitle: outputSubtitle,
  }
}

/**
 * Formats the key terms part of the summary response
 * @param {[string]} keyTerms - List of key terms
 * @param {string} subject - The core search query instantiated by the user.
 * @param {string?} remixText - The new text input by the user to be used contextually with the subject.
 * @param {string} subtitle - The readable text that indicates the core elements of the search.
 * @param {string} fullHistoryText - The entire search query from the first to the current search request. Pure text only.
 */
export async function formatKeyTermsForSummary(keyTerms: [string], subject: string, remixText?: string = '', subtitle: string = '', fullHistoryText: string) {
  // logDebug(pluginJson, `\n\nformatBulletSummary\nSubject: ${subject}\nResponse: ${summary}\nLink: ${link})}`)
  let keyString = '#### Go Deeper?\n'
  const jsonData = DataStore.loadJSON(getDataFileName())
  let prettyKeyTerm = ''

  for (const keyTerm of keyTerms) {
    if (jsonData['clickedLinks'].includes(keyTerm)) {
    } else {
      prettyKeyTerm = createPrettyRunPluginLink(`${capitalizeFirstLetter(keyTerm.trim())}`, 'shared.AI', 'Bullets AI', [
        capitalizeFirstLetter(keyTerm.trim()),
        `${subject}`,
        jsonData['initialSubject'],
        false,
        subtitle,
        false,
        fullHistoryText,
      ])

      const prettyPlus = createPrettyRunPluginLink(`╠`, 'shared.AI', 'Bullets AI', [
        keyTerm.trim(),
        remixText ? remixText : subject,
        jsonData['initialSubject'],
        false,
        subtitle,
        true,
        fullHistoryText,
      ])
      keyString += `\t- ${prettyPlus}${prettyKeyTerm}\n`
    }
  }
  return keyString
}

/**
 * Formats the bullet summary response
 * @param {string} subject - the subject being researched
 * @param {string} summary - the summary text
 * @param {string} keyTerms - the list of key terms related to the subject
 * @param {string} remixText - the custom request to be used alongside the subject
 * @param {string} subtitle - the subtitle text the adds context to the pure subject search
 * @param {string} fullHistoryText - the entirety of the previous search chain in context
 */
export async function formatBulletSummary(subject: string, summary: string, keyTerms: string, remixText?: string = '', subtitle: string, fullHistoryText: string) {
  // logDebug(pluginJson, `\n\nformatBulletSummary\nSubject: ${subject}\nResponse: ${summary}\nLink: ${link})}`)

  // let title = subject.replace('- ', '')
  let title = subject.trim()
  const jsonData = DataStore.loadJSON(getDataFileName())
  const keyTermsOutput = await formatKeyTermsForSummary(keyTerms, subject, remixText, subtitle ? subtitle : '', fullHistoryText)
  const removeParagraphText = createPrettyRunPluginLink('**✖**', 'shared.AI', 'Scroll to Entry', [subject, String(true)])
  const exploreText = createPrettyRunPluginLink('Explore', 'shared.AI', 'Explore - OpenAI', [subject])

  const remixPrompt = createPrettyRunPluginLink(`Remix`, 'shared.AI', 'Bullets AI', ['', subject, jsonData['initialSubject'], true])
  // let output = `## ${title}${(subject != subtitle) ? `\n#### ${subtitle}` : ''}\n#### ${remixPrompt}\n${summary}\n${keyTermsOutput}`
  let output = `## ${capitalizeFirstLetter(title)}${subject != subtitle ? `\n#### ${subtitle}` : ''}\n${exploreText}\t${removeParagraphText}\n${summary}\n${keyTermsOutput}`
  return output
}

/**
 * Formats the Go Further link
 * @param {string} text - the text to be used in the Go Further link
 * Currently under construction.
 */
export async function formatFurtherLink(text: string) {
  const fileName = Editor.filename

  const furtherLink = createPrettyOpenNoteLink(text, fileName, true, text)
  return furtherLink
}

/**
 * Formats the incoming model object to display its information in a more readable format.
 * https://beta.openai.com/docs/api-reference/completions/create
 * @param {Object} info - The info needed to provide the function with something to parse and format.
 */
export function formatModelInformation(info: Object) {
  const modelInfo = `Good At: ${info.goodAt}\n\nCost: ${info.cost}.`
  console.log(modelInfo)
  return modelInfo
}

/**
 * Formats the table of contents.
 * https://beta.openai.com/docs/api-reference/completions/create
 */
export function formatTableOfContents() {
  const tocLink = createPrettyRunPluginLink('Table of Contents', 'shared.AI', 'Scroll to Entry', ['Table of Contents', 'false', 'toggle'])
  if (!Editor.paragraphs.find((p) => p.content === tocLink)) {
    Editor.prependParagraph(`## ${tocLink}`, 'text')
  } else {
    removeContentUnderHeading(Editor, tocLink, true, true) // keep the heading but delete the content
  }
  const headings = Editor.paragraphs.filter((p) => p.type === 'title' && p.headingLevel === 2 && p.content !== tocLink)
  const unlistedHeadings = headings.filter((p) => p.heading !== tocLink)

  for (const subject of unlistedHeadings) {
    const formattedSubject = createPrettyOpenNoteLink(subject.content, Editor.filename, true, subject.content)

    Editor.addParagraphBelowHeadingTitle(formattedSubject, 'list', tocLink, true, true)
  }
  Editor.addParagraphBelowHeadingTitle('---\n', 'text', tocLink, true, true)
}
