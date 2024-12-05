// @flow

import pluginJson from '../plugin.json'
import { chooseOption, showMessage, showMessageYesNo, getInputTrimmed, chooseNote } from '../../helpers/userInput'
import { log, logError, logDebug, timer, clo, JSP } from '@helpers/dev'
import NPTemplating from 'NPTemplating'
import { getAttributes } from '@helpers/NPFrontMatter'
import { createRunPluginCallbackUrl } from '@helpers/general'

// getNoteTitled, location, writeUnderHeading, replaceNoteContents
const baseMetadata = {
  type: 'self-runner',
  getNoteTitled: null,
  writeUnderHeading: null,
  replaceNoteContents: null,
  location: null,
  NOTE: 'Any variables in template tags in the body of the note can be passed in as arguments in arg2 of the URL (separated by semicolons, which is encoded as %3B). So var1=foo;var2=bar would be passed in as arg2=var1%3Dfoo%3Bvar2%3Dbar',
  exampleURL: '__XXX__',
}

/**
 * Create the new template
 * @returns
 */
async function createNewTemplate(): Promise<string> {
  const title = await getInputTrimmed(`Enter the title for the new template (something unique and short is best)`, 'Create Template', 'Template Title')
  if (title && typeof title === 'string') {
    // const template = await NPTemplating.createTemplate(title)
    const test = DataStore.projectNoteByTitle(title)
    if (test?.length) {
      await showMessage(`A template with this title already exists. It is critical that the title is unique. Please choose a different title.`, 'OK', 'Duplicate Title')
      return ''
    }
    const bodyContent = '<% var1 %> - <% var2 %>'

    /*
    - a note title (should be a unique title -- you will get the first note if there are more than one)
- <current>
- <choose> - user will be asked to select one
- <today>
- <thisweek>
- <nextweek>
*/
    let opts = [
      {
        label: 'A Specific Project Note (I will choose it now)',
        value: 'chooseNow',
      },
      {
        label: 'A Project Note (I will choose when link is clicked)',
        value: '<choose>',
      },
      {
        label: "Today's Note (the daily note of the day the link is clicked)",
        value: '<today>',
      },
      {
        label: "This Week's Note (the weekly note of the week the link is clicked)",
        value: '<thisweek>',
      },
      {
        label: "Next Week's Note (the weekly note of the week after link clicked)",
        value: '<nextweek>',
      },
      {
        label: 'Current Note (Whatever note is in the Editor when the link is clicked)',
        value: '<current>',
      },
    ]
    let getNoteTitled = await chooseOption(`What note do you want the template to act on?`, opts)
    if (getNoteTitled === 'chooseNow') {
      const selectedNote = await chooseNote()
      if (selectedNote) {
        getNoteTitled = selectedNote.title
      }
    }
    const metadata = baseMetadata
    if (getNoteTitled) {
      metadata['getNoteTitled'] = getNoteTitled
    } else {
      return
    }
    //FIXME: set getNoteTitled field here!
    metadata['replaceNoteContents'] =
      (await showMessageYesNo(`Do you want to replace the entire contents of the current note with the template?`, ['yes', 'no'], 'Replace Note Contents')) === 'yes'
    if (!metadata['replaceNoteContents']) {
      const shouldWriteUnderHeading =
        (await showMessageYesNo(`Do you want to write the template under a heading in the current note?`, ['yes', 'no'], 'Write Under Heading')) === 'yes'
      if (shouldWriteUnderHeading) {
        metadata['writeUnderHeading'] = await getInputTrimmed(`Enter the heading text to write under`, 'Heading to Write Under')
      }
      const word = metadata['writeUnderHeading'] ? `section` : `note`
      opts = [
        { label: `Insert at top of ${word} text`, value: 'prepend' },
        { label: `Append to end of ${word} text`, value: 'append' },
        { label: `Replace entire ${word} text`, value: 'replace' },
      ]
      if (!metadata['writeUnderHeading']) {
        opts.pop() //no replace if there's not a heading
      }
      metadata['location'] = await chooseOption(`How do you want to insert the template text?`, opts)
    }
    Object.keys(metadata).forEach((key) => {
      if (!metadata[key]) delete metadata[key]
    })
    clo(metadata, `createNewTemplate metadata`)
    await NPTemplating.createTemplate(title, metadata, bodyContent)
    await Editor.openNoteByTitle(title)
  }
  return title ? String(title) : ''
}

/**
 * Get the template title to use for the templateRunner link (either currently in Editor or from the list of templates)
 * @returns {string} templateTitle
 */
async function getSelfRunningTemplate(): Promise<string> {
  let filename, templateTitle
  if (Editor?.filename?.includes('@Templates')) {
    const useThis = await showMessageYesNo(`Use the currently open template?\n(${Editor?.title || ''})`, ['yes', 'no'], 'Use Open Template')
    if (useThis === 'yes') {
      filename = Editor.filename
      templateTitle = Editor.note?.title
    }
  }
  if (!filename) {
    const create = await showMessageYesNo(`What template do you want to use?`, ['New Template', 'Choose Template'], 'Template to Use')
    if (create === 'New Template') {
      templateTitle = await createNewTemplate()
    } else {
      const selectedTemplate = await NPTemplating.chooseTemplate()
      if (selectedTemplate) {
        const template = await DataStore.noteByFilename(selectedTemplate, 'Notes')
        templateTitle = template?.title || null
      }
    }
  }
  return templateTitle || ''
}

async function getTemplateArgs(): Promise<> {
  const attrs = getAttributes(Editor.content)
  if (attrs.length) {
    //FIXME: I am here. do something with the attributes
  }
}

/**
 * Create an xcallback URL to invoke a template from a link inside NotePlan or a Shortcut/browser
 * (plugin entry point for /np:gx)
 */
export async function getXcallbackForTemplate(): Promise<string | false> {
  try {
    const templateTitle = await getSelfRunningTemplate()
    logDebug(pluginJson, `getXcallbackForTemplate title:${templateTitle || ''}`)
    if (templateTitle) {
      //FIXME: I am here. do something with the arguments
      let args = await getTemplateArgs()
      const openIt = await showMessageYesNo(`Open the resulting document in the Editor when link is clicked?`, ['yes', 'no'], 'Open in Editor')
      args = [templateTitle, String(openIt === 'yes')]
      const message = `Enter any variables and values you want to pass to the template in key=value pairs:\n\n myTemplateVar=value;otherVar=value2\n\n (where "myTemplateVar" and "otherVar" are the name of variables you use in your template. Multiple variables are separated by semicolons)`
      const result = await getInputTrimmed(message, 'OK', `Template Variables to Pass to "${templateTitle}"`, `var1=VALUE1;var2=VALUE2`)
      if (typeof result === 'string' && result.length) {
        args = args.concat(String(result))
      }
      const url = createRunPluginCallbackUrl(`np.Templating`, `templateRunner`, args)
      const note = DataStore.projectNoteByTitle(templateTitle)
      if (note?.length) note[0].content = note[0].content?.replace('exampleURL: __XXX__', `exampleURL: ${url}`)
      //FIXME: I am here. this works, but the URL gets pasted above metadata
      return url
    } else {
      await showMessage(`Template could not be located`)
      return false
    }
  } catch (e) {
    log(pluginJson, `Error in getXcallbackForTemplate: ${e}`)
  }
  return false
}
