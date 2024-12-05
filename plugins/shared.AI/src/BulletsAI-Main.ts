// @flow
import pluginJson from '../plugin.json'
import { chooseFolder, showMessage } from '../../helpers/userInput'
import { type JSONClickData } from './support/AIFlowTypes'
import { makeRequest } from './support/networking'
import { generateSubjectSummaryPrompt, generateKeyTermsPrompt, generateExplorationPrompt } from './support/prompts'
import { formatSubtitle, formatBulletSummary, formatTableOfContents } from './support/formatters'
import { capitalizeFirstLetter, scrollToEntry } from './support/helpers'
import { initializeData, loadDataFile, saveDataFile, updateClickedLinksJsonData } from './support/externalFileInteractions'
import { logDebug, logError, logWarn, JSP } from '@np/helpers/dev'
import { escapeRegex, createPrettyOpenNoteLink } from '@np/helpers/general'

type CompletionsRequest = { model: string, prompt?: string, max_tokens?: number, user?: string, suffix?: string, temperature?: string, top_p?: string, n?: number }
const completionsComponent = `completions`

/**
 * Prompt for new research tunnel
 *
 */

export async function createResearchDigSite(promptIn?: string | null = null) {
  try {
    const { researchDirectory } = DataStore.settings
    const options = [
      {
        label: 'Default',
        value: 'Default',
      },
      {
        label: 'Custom',
        value: 'Custom',
      },
    ]
    let subject = ''
    subject = promptIn ?? (await CommandBar.showInput(Editor.selectedText ? `${capitalizeFirstLetter(Editor.selectedText)}` : 'Type in your subject..', 'Start Research'))
    if (subject === '' && Editor.selectedText?.length) {
      subject = capitalizeFirstLetter(Editor.selectedText)
      // const useSelectedFolder = await chooseOption('g', options)
      await createOuterLink()
    }
    // logDebug(pluginJson, `createResearchDigSite subject="${subject}" dir="${researchDirectory}" defaultExtension="${DataStore.defaultFileExtension}"`)
    const filename = `${researchDirectory}/${subject}.${DataStore.defaultFileExtension || '.txt'}`
    logDebug(pluginJson, `createResearchDigSite filename="${filename}" Now trying to open note by filename`)
    await Editor.openNoteByFilename(filename, false, 0, 0, false, true, `# ${subject} Research\n`)
    // logDebug(pluginJson, `createResearchDigSite opened Editor note by filename title is now:"${String(Editor.title)}" Editor.filename="${String(Editor.filename)}"`)
    if (Editor.title === `${subject} Research`) {
      await bulletsAI(subject)
    } else {
      // logDebug(pluginJson, `createResearchDigSite Wanted Editor.title to be "${subject} Research" but Editor.title is "${Editor.title || ''}"`)
    }
  } catch (error) {
    logError(pluginJson, `Error completing the createResearchDigSite request.\nError: ${error}`)
  }
}

export async function createOuterLink() {
  const settings = DataStore.settings
  const linkTitle = Editor.selectedText
  const link = `${settings['researchDirectory']}%2F${encodeURI(linkTitle)}.${DataStore.defaultFileExtension || '.txt'}`
  const outerLink = createPrettyOpenNoteLink(linkTitle, link, true, capitalizeFirstLetter(linkTitle))
  Editor.replaceSelectionWithText(outerLink)
}

export async function createRemix() {
  return await CommandBar.showInput('Type in your remix request', 'Start Remix')
}

/**
 * Generative Research Tree
 * @param {string} promptIn - Prompt to generate from
 * @param {string} prevSubjectIn - Previous prompt to use for context
 * @param {string} initialSubject - Rooting context string
 * @param {string} userIn - A unique identifier representing your end-user, which can help OpenAI to monitor and detect abuse.
 * @returns
 */
export async function bulletsAI(
  promptIn: string,
  prevSubjectIn: string | null = '',
  initialSubject: string | null = '',
  isCustomRemix: boolean = false,
  fullHistory?: string = '',
  useFullHistory?: boolean = false,
  fullHistoryText?: string = '',
  userIn: string = '',
) {
  try {
    const { defaultModel } = DataStore.settings

    const start = new Date()
    const chosenModel = defaultModel != 'Choose Model' ? defaultModel : 'text-davinci-003'
    const paragraphs = Editor.paragraphs
    let promptMain = ''
    let promptList = ''
    const state = await checkInitialState(promptIn, prevSubjectIn, initialSubject, isCustomRemix)
    // logDebug(pluginJson, `bulletsAI state=${state}`)
    switch (state) {
      case 'initialQuery':
        initializeData(promptIn)
        promptMain = await generateSubjectSummaryPrompt(promptIn)
        promptList = await generateKeyTermsPrompt(promptIn)
        break

      case 'followedLink':
        // logDebug(pluginJson, `\n----\n-----bulletsAI-----\nFollowed Link\nLink: ${promptIn}\nPrevious Subject: ${prevSubjectIn}\n----\n\n${typeof useFullHistory}`)
        initializeData()
        updateClickedLinksJsonData(promptIn)
        promptMain = await generateSubjectSummaryPrompt(useFullHistory == 'true' ? fullHistoryText : promptIn, useFullHistory == 'true' ? '' : prevSubjectIn)
        promptList = await generateKeyTermsPrompt(promptIn, prevSubjectIn)
        break

      case 'remix':
        // promptIn = await createRemix()

        initializeData()
        promptMain = await generateExplorationPrompt(promptIn, prevSubjectIn)
        promptList = await generateKeyTermsPrompt(promptIn, prevSubjectIn)
        break
    }
    const { newFullHistoryText, formattedSubtitle } = formatSubtitle(promptIn, prevSubjectIn ? prevSubjectIn : '', fullHistory, useFullHistory, fullHistoryText)
    if (useFullHistory == 'true') {
      promptMain = await generateSubjectSummaryPrompt(newFullHistoryText)
    }
    const { reqBody, reqListBody } = await generateReqBodies(useFullHistory == true ? newFullHistoryText : promptMain, promptList, chosenModel)
    const { request, listRequest } = await generateRequests(reqBody, reqListBody, chosenModel)
    const summary = await parseResponse(request, listRequest, promptIn, '', formattedSubtitle, newFullHistoryText)

    updateBulletLinks()
    Editor.appendParagraph(summary, 'text')
    formatTableOfContents()
    scrollToEntry(promptIn, false)
  } catch (error) {
    logError(pluginJson, error)
  }
}

/**
 * Looks at inputs to determine the type of generation request
 * @param {string} promptIn -
 * @param {string} prevSubjectIn -
 * @param {string} initialSubject -
 * @param {bool} isCustomRemix -
 * Currently under construction.
 */
function checkInitialState(_promptIn: string, prevSubjectIn: string | null, _initialSubject: string | null, isCustomRemix: boolean) {
  if (isCustomRemix === true) {
    return 'remix'
  } else if (prevSubjectIn && isCustomRemix !== true) {
    return 'followedLink'
  } else {
    return 'initialQuery'
  }
}

function updateBulletLinks(keyTerm?: string = '') {
  const loadedJSON = loadDataFile()
  let prettyKeyTerm = ''

  const bulletsToUpdate = Editor.paragraphs.forEach((f) => {
    if (f.type == 'list') {
      for (const c of loadedJSON['clickedLinks']) {
        const encodedLink = encodeURI(c)

        if (f.content.includes(`arg0=${encodedLink}`)) {
          // logDebug(pluginJson, `\n\n---- MATCHES C ----\n\n ${c}\n\n`)
          prettyKeyTerm = createPrettyOpenNoteLink(c, Editor.filename, true, c)
          // logDebug(pluginJson, `\n\n---- Pretty Key Term ----\n\n ${prettyKeyTerm}\n\n`)
          f.type = 'text'
          f.content = `**${prettyKeyTerm}**`
          Editor.updateParagraph(f)
        }
      }
    }
  })
}

async function parseResponse(request: Object | null, listRequest: Object | null, subject: string, remixText?: string = '', subtitle: string, fullHistoryText: string) {
  let summary = ''
  if (request) {
    const responseText = request.choices[0].text.trim()
    const keyTermsList = listRequest.choices[0].text.split(',')
    const totalTokensUsed = request.usage.total_tokens + listRequest.usage.total_tokens
    const keyTerms = []
    logDebug(pluginJson, `\n\n\nTotal Tokens Used=${totalTokensUsed}\n\n\n`)
    const jsonData = loadDataFile()
    // clo(jsonData, 'parseResponse jsonData BEFORE')
    for (const keyTerm of jsonData['unclickedLinks']) {
      keyTerms.push(keyTerm.trim())
    }
    for (const keyTerm of keyTermsList) {
      if (!keyTerms.includes(keyTerm)) {
        keyTerms.push(keyTerm.trim())
      }
    }
    jsonData['totalTokensUsed'] += totalTokensUsed
    jsonData['unclickedLinks'] = keyTerms
    // clo(jsonData, 'parseResponse jsonData AFTER')
    saveDataFile(jsonData)
    // clo(subtitle, 'subtitle')

    const totalTokens = request.usage.total_tokens + listRequest.usage.total_tokens
    summary = await formatBulletSummary(subject, responseText, keyTermsList, remixText, subtitle, fullHistoryText)
    // clo(summary, 'summary after now writing')
    return summary
  }
}

async function generateReqBodies(promptMain, promptList, chosenModel) {
  const { max_tokens } = DataStore.settings

  const reqBody: CompletionsRequest = { prompt: promptMain, model: chosenModel, max_tokens: max_tokens }
  // clo(reqBody, 'reqBody\n\n\n\n\n\n\n\----------')
  const reqListBody: CompletionsRequest = { prompt: promptList, model: chosenModel, max_tokens: max_tokens }
  return { reqBody, reqListBody }
}

async function generateRequests(reqBody: CompletionsRequest, reqListBody: CompletionsRequest) {
  const request = await makeRequest(completionsComponent, 'POST', reqBody)
  const listRequest = await makeRequest(completionsComponent, 'POST', reqListBody)
  return { request, listRequest }
}

/**
 * Remix the summary request with additional details
 * https://beta.openai.com/docs/api-reference/completions/create
 * @param {string} subject - The initial subject value.
 */
export async function remixQuery(subject: string) {
  const additionalDetails = await CommandBar.showInput('Rewrite this query with addional detail.', 'Remix')
  await bulletsAI(subject, additionalDetails)
}

export async function explore(prevSubjectIn: string) {
  const selectedText = Editor.selectedText
  const selectedSubtitle = await CommandBar.showInput(
    `${selectedText ? `${capitalizeFirstLetter(selectedText)} (in the context of ${prevSubjectIn})` : 'Type in your prompt.'} `,
    'OK',
  )

  if (selectedSubtitle?.length) {
    await bulletsAI(selectedSubtitle, prevSubjectIn)
  } else if (!selectedSubtitle?.length && selectedText) {
    await bulletsAI(selectedText, prevSubjectIn)
  } else {
    await showMessage('No prompt entered. Please try again.')
  }
}

export async function researchFromSelection() {
  try {
    const selectedText = Editor.selectedText
    if (selectedText) {
      const matchedContent = Editor.paragraphs.find((p) => p.type === 'text' && p.content.includes(selectedText))
      logDebug(pluginJson, `researchFromSelection: ${selectedText} in heading: ${matchedContent?.heading || ''}`)
      await bulletsAI(selectedText, matchedContent?.heading)
    } else {
      logWarn(pluginJson, 'researchFromSelection: No text was selected. Please try again.')
      await showMessage('Research Selected Text: No text was selected. Please try again with a selection or run a different command.')
    }
  } catch (error) {
    logError(pluginJson, error)
  }
}

export async function moveNoteToResearchCollection() {
  try {
    const { researchDirectory } = DataStore.settings
    const currentNote = Editor.note
    const oldFilenameEnc = encodeURIComponent(currentNote?.filename || '')
    logDebug(
      pluginJson,
      `moveNoteToResearchCollection oldFilenameEnc=${oldFilenameEnc} Editor.title=${Editor?.title || ''} Editor.filename=${Editor.filename} Editor.note.title=${
        Editor?.note?.title || ''
      }`,
    )
    const researchFolders = DataStore.folders.filter((p) => p.includes(`${researchDirectory}/`))
    // logDebug(pluginJson, researchFolders)
    const newPath = await chooseFolder('Move to which directory?', false, true, researchDirectory)

    if (!researchFolders.includes(newPath)) {
      logDebug(pluginJson, 'Directory does not yet exist.')
      await updateResearchCollectionTableOfContents(newPath, currentNote.title, currentNote, newPath, false)
    } else {
      await updateResearchCollectionTableOfContents(newPath, currentNote.title, currentNote, newPath)
    }
    if (currentNote) {
      // const newFilename = await currentNote.rename(newLocation) // after this move, the note is not active anymore
      const newFilename = DataStore.moveNote(currentNote.filename, newPath)
      // const updated = DataStore.updateCache(currentNote)
      if (newFilename) {
        await Editor.openNoteByFilename(newFilename)
        const newFilenameEnc = encodeURIComponent(newFilename)
        logDebug(pluginJson, `moveNoteToResearchCollection newFilenameEnc=${newFilenameEnc}`)
        // const newNote = await DataStore.noteByFilename(newFilename, 'Notes')
        const newNotecontent = Editor?.content
        if (newNotecontent) {
          Editor.content = newNotecontent?.replace(new RegExp(escapeRegex(oldFilenameEnc), 'mg'), newFilenameEnc)
          logDebug(pluginJson, `moveNoteToResearchCollection replaced:\n${oldFilenameEnc}\n${newFilenameEnc}`)
        }
      }
    } else {
      logError(pluginJson, 'currentNote was false, cannot finish the move.')
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

export async function updateResearchCollectionTableOfContents(newPath: string, originalNoteTitle: string, noteToAdd: TNote, selectedDirectory: string, exists: boolean = true) {
  const noteTableOfContents = noteToAdd.paragraphs.filter((p) => p.heading.includes('Table of Contents'))
  const formattedOriginalNoteTitle = originalNoteTitle.replace(' Research', '')
  const subtitleLinks = noteToAdd.paragraphs.filter((p) => p.type == 'heading' && p.content.includes('[') && !p.content.includes('Table of Contents'))
  const tocFileName = `${newPath}/Table of Contents.${DataStore.defaultFileExtension || '.txt'}`
  await Editor.openNoteByFilename(tocFileName, false, 0, 0, false, true)
  if (!Editor.content.includes('Table of Contents')) {
    Editor.insertTextAtCharacterIndex(`- Table of Contents`, 2)
  }
  Editor.appendParagraph(`### ${originalNoteTitle}`, 'heading')
  for (const para of noteTableOfContents) {
    if (!para.content.includes('---') && para.content != '') {
      const newLink = await updatePrettyLink(para.content, formattedOriginalNoteTitle, newPath)
      para.content = newLink
      noteToAdd.updateParagraph(para)
      Editor.appendParagraph(newLink, 'list')
    }
  }
}

export async function updatePrettyLink(link: string, originalNoteTitle: string, newPath: string) {
  // logDebug(pluginJson, link)
  const heading = link.split(']')[0].slice(1)
  const newLink = `${newPath}/${originalNoteTitle}.${DataStore.defaultFileExtension || '.txt'}`
  logDebug(pluginJson, heading)
  return createPrettyOpenNoteLink(heading, newLink, true, capitalizeFirstLetter(heading))
}
