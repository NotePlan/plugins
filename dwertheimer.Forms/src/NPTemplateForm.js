// @flow

import pluginJson from '../plugin.json'
import { getGlobalSharedData, sendToHTMLWindow, sendBannerMessage } from '../../helpers/HTMLView'
import { log, logError, logDebug, timer, clo, JSP, logInfo } from '@helpers/dev'
import { /* getWindowFromId, */ closeWindowFromCustomId } from '@helpers/NPWindows'
import { generateCSSFromTheme } from '@helpers/NPThemeToCSS'
import { showMessage } from '@helpers/userInput'
import NPTemplating from 'NPTemplating'
import { getNoteByFilename } from '@helpers/note'
import { getCodeBlocksOfType } from '@helpers/codeBlocks'
import { parseObjectString, validateObjectString } from '@helpers/stringTransforms'

const WEBVIEW_WINDOW_ID = `${pluginJson['plugin.id']} Form Entry React Window` // will be used as the customId for your window
// you can leave it like this or if you plan to open multiple windows, make it more specific per window
const REACT_WINDOW_TITLE = 'Form View' // change this to what you want window title to display

export type PassedData = {
  startTime?: Date /* used for timing/debugging */,
  title?: string /* React Window Title */,
  width?: number /* React Window Width */,
  height?: number /* React Window Height */,
  pluginData: any /* Your plugin's data to pass on first launch (or edited later) */,
  ENV_MODE?: 'development' | 'production',
  debug: boolean /* set based on ENV_MODE above */,
  logProfilingMessage: boolean /* whether you want to see profiling messages on React redraws (not super interesting) */,
  returnPluginCommand: { id: string, command: string } /* plugin jsFunction that will receive comms back from the React window */,
  componentPath: string /* the path to the rolled up webview bundle. should be ../pluginID/react.c.WebView.bundle.* */,
  passThroughVars?: any /* any data you want to pass through to the React Window */,
}

/**
 * Validate the form fields to make sure they are valid
 * @param {Array<Object>} formFields - the form fields to validate
 * @returns {boolean} - true if the form fields are valid, false otherwise
 */
function validateFormFields(formFields: Array<Object>): boolean {
  let i = 0
  const reservedWords = [
    '__isJSON__',
    'submit',
    'location',
    'writeUnderHeading',
    'openNoteTitle',
    'writeNoteTitle',
    'getNoteTitled',
    'replaceNoteContents',
    'createMissingHeading',
    'receivingTemplateTitle',
    'windowTitle',
    'formTitle',
    'width',
    'height',
    'hideDependentItems',
    'allowEmptySubmit',
    'title',
  ]
  for (const field of formFields) {
    i++
    // check that each field has a type, and if not use showMessage to alert the user
    if (!field.type) {
      showMessage(`Field "${field.label || ''}" (index ${i}) does not have a type. Please set a type for every field.`)
      return false
    }
    // every field that is not a separator must have a key
    if (field.type !== 'separator' && field.type !== 'heading' && !field.key) {
      showMessage(`Field "${field.label || ''}" (index ${i}) does not have a key. Please set a key for every field.`)
      return false
    }
    // check that the key is not a reserved word
    if (reservedWords.includes(field.key)) {
      // Just warn the user in the log, don't fail the form
      logInfo(
        pluginJson,
        `Field "${field.label || ''}" has a key ("${field.key}") that is a reserved word in the forms processor. Generally speaking, you will want to use a key other than "${
          field.key
        }". Continuing for now in case it was intentional.`,
      )
    }
  }
  return true
}

/**
 * Plugin entrypoint for getting the form data and then opening the form window
 * Open a form window with the form fields from the template codeblock named "formFields"
 * @param {string} templateTitle - the title of the template to use
 * @returns {void}
 */
export async function getTemplateFormData(templateTitle?: string): Promise<void> {
  try {
    let selectedTemplate // will be a filename
    if (templateTitle?.trim().length) {
      const options = await NPTemplating.getTemplateList('template-form')
      const chosenOpt = options.find((option) => option.label === templateTitle)
      if (chosenOpt) {
        // variable passed is a note title, but we need the filename
        selectedTemplate = chosenOpt.value
      }
    } else {
      // ask the user for the template
      selectedTemplate = await NPTemplating.chooseTemplate('template-form')
    }
    let formFields: Array<Object> = []
    if (selectedTemplate) {
      const note = await getNoteByFilename(selectedTemplate)
      if (note) {
        const fm = note.frontmatterAttributes
        clo(fm, `getTemplateFormData fm=`)
        const receiver = fm && (fm.receivingTemplateTitle || fm.receivingtemplatetitle) // NP has a bug where it sometimes lowercases the frontmatter keys
        if (!receiver) {
          await showMessage(
            `Template "${
              note.title || ''
            }" does not have a "receivingTemplateTitle" set in frontmatter. Please set the "receivingTemplateTitle" field in your template frontmatter first.`,
          )
          return
        }
        const codeBlocks = getCodeBlocksOfType(note, 'formfields')
        if (codeBlocks.length > 0) {
          const formFieldsString = codeBlocks[0].code
          if (formFieldsString) {
            try {
              formFields = parseObjectString(formFieldsString)
              if (!formFields) {
                const errors = validateObjectString(formFieldsString)
                logError(pluginJson, `getTemplateFormData: error validating form fields in ${selectedTemplate}, String:\n${formFieldsString}, `)
                logError(pluginJson, `getTemplateFormData: errors: ${errors.join('\n')}`)
                return
              }
              clo(formFields, `🎅🏼 DBWDELETE NPTemplating.getTemplateFormData formFields=`)
              logDebug(pluginJson, `🎅🏼 DBWDELETE NPTemplating.getTemplateFormData formFields=\n${JSON.stringify(formFields, null, 2)}`)
            } catch (error) {
              const errors = validateObjectString(formFieldsString)
              await showMessage(
                `getTemplateFormData: There is an error in your form fields (most often a missing comma).\nJS Error: "${error.message}"\nCheck Plugin Console Log for more details.`,
              )
              logError(pluginJson, `getTemplateFormData: error parsing form fields: ${error.message} String:\n${formFieldsString}`)
              logError(pluginJson, `getTemplateFormData: errors: ${errors.join('\n')}`)
              return
            }
          }
        }
      } else {
        logError(pluginJson, `getTemplateFormData: could not find form template: ${selectedTemplate}`)
        return
      }
    }
    const templateData = await NPTemplating.getTemplate(selectedTemplate)
    const templateFrontmatterAttributes = await NPTemplating.getTemplateAttributes(templateData)
    clo(templateData, `getTemplateFormData templateData=`)
    clo(templateFrontmatterAttributes, `getTemplateFormData templateFrontmatterAttributes=`)

    if (!templateFrontmatterAttributes?.receivingTemplateTitle) {
      logError(pluginJson, 'Template does not have a receivingTemplateTitle set')
      await showMessage('Template Form does not have a "receivingTemplateTitle" field set. Please set the "receivingTemplateTitle" field in your template frontmatter first.')
      return
    }

    //TODO: we may not need this step, ask @codedungeon what he thinks
    // for now, we'll call renderFrontmatter() via DataStore.invokePluginCommandByName()
    const { _, frontmatterAttributes } = await DataStore.invokePluginCommandByName('renderFrontmatter', 'np.Templating', [templateData])

    if (templateFrontmatterAttributes.formFields) {
      // yaml version of formFields
      frontmatterAttributes.formFields = templateFrontmatterAttributes.formFields
    } else {
      // codeblock version of formFields
      frontmatterAttributes.formFields = formFields
    }

    if (await validateFormFields(frontmatterAttributes.formFields)) {
      await openFormWindow(frontmatterAttributes)
    } else {
      logError(pluginJson, 'Form fields validation failed. The form window will not be opened.')
    }
  } catch (error) {
    logError(pluginJson, error)
  }
}

/**
 * Gathers key data for the React Window, including the callback function that is used for comms back to the plugin
 * @returns {PassedData} the React Data Window object
 */
export function createWindowInitData(argObj: Object): PassedData {
  const startTime = new Date()
  // get whatever pluginData you want the React window to start with and include it in the object below. This all gets passed to the React window
  const pluginData = getPluginData(argObj)
  const ENV_MODE = 'development' /* helps during development. set to 'production' when ready to release */
  const dataToPass: PassedData = {
    pluginData,
    title: argObj?.formTitle || REACT_WINDOW_TITLE,
    width: argObj?.width ? parseInt(argObj.width) : undefined,
    height: argObj?.height ? parseInt(argObj.height) : undefined,
    logProfilingMessage: false,
    debug: false,
    ENV_MODE,
    returnPluginCommand: { id: pluginJson['plugin.id'], command: 'onFormSubmitFromHTMLView' },
    /* change the ID below to your plugin ID */
    componentPath: `../dwertheimer.Forms/react.c.FormView.bundle.dev.js`,
    startTime,
  }
  return dataToPass
}

/**
 * Gather data you want passed to the React Window (e.g. what you you will use to display)
 * You will likely use this function to pull together your starting window data
 * Must return an object, with any number of properties, however you cannot use the following reserved
 * properties: pluginData, title, debug, ENV_MODE, returnPluginCommand, componentPath, passThroughVars, startTime
 * @returns {[string]: mixed} - the data that your React Window will start with
 */
export function getPluginData(argObj: Object): { [string]: mixed } {
  // you would want to gather some data from your plugin
  const pluginData = { platform: NotePlan.environment.platform, ...argObj }
  return pluginData // this could be any object full of data you want to pass to the window
}

/**
 * Router function that receives requests from the React Window and routes them to the appropriate function
 * Typically based on a user interaction in the React Window
 * (e.g. handleSubmitButtonClick example below)
 * Here's where you will process any other commands+data that comes back from the React Window
 * How it works:
 * let reactWindowData...reaches out to the React window and get the most current pluginData that it's using to render.
 * This is the data that you initially built and passed to the window in the initial call (with a few additions you don't need to worry about)
 * Then in the case statements, we pass that data to a function which will act on the particular action type,
 * and you edit the part of the data object that needs to be edited: typically `reactWindowData.pluginData.XXX`
 * and that function IMPORTANTLY returns a modified reactWindowData object after acting on the action (this should be the full object used to render the React Window)
 * That new updated reactWindowData object is sent back to the React window basically saying "hey, the data has changed, re-render as necessary!"
 * and React will look through the data and find the parts that have changed and re-draw only those parts of the window
 * @param {string} actionType - the reducer-type action to be dispatched
 * @param {any} data - the relevant sent from the React Window (could be anything the plugin needs to act on the actionType)
 * @author @dwertheimer
 */
export async function onFormSubmitFromHTMLView(actionType: string, data: any = null): Promise<any> {
  try {
    logDebug(pluginJson, `NP Plugin return path (onMessageFromHTMLView) received actionType="${actionType}" (typeof=${typeof actionType})  (typeof data=${typeof data})`)
    clo(data, `Plugin onMessageFromHTMLView data=`)
    let returnValue = null
    const reactWindowData = await getGlobalSharedData(WEBVIEW_WINDOW_ID) // get the current data from the React Window
    clo(reactWindowData, `Plugin onMessageFromHTMLView reactWindowData=`)
    if (data.passThroughVars) reactWindowData.passThroughVars = { ...reactWindowData.passThroughVars, ...data.passThroughVars }
    switch (actionType) {
      /* best practice here is not to actually do the processing but to call a function based on what the actionType was sent by React */
      /* you would probably call a different function for each actionType */
      case 'onSubmitClick':
        returnValue = await handleSubmitButtonClick(data, reactWindowData) //update the data to send it back to the React Window
        break
      default:
        await sendBannerMessage(WEBVIEW_WINDOW_ID, `Plugin received an unknown actionType: "${actionType}" command with data:\n${JSON.stringify(data)}`)
        break
    }
    if (returnValue && returnValue !== reactWindowData) {
      const updateText = `After ${actionType}, data was updated` /* this is just a string for debugging so you know what changed in the React Window */
      clo(reactWindowData, `Plugin onMessageFromHTMLView after updating window data,reactWindowData=`)
      sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'SET_DATA', reactWindowData, updateText) // note this will cause the React Window to re-render with the currentJSData
    }
    return {} // this return value is ignored but needs to exist or we get an error
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Update the data in the React Window (and cause it to re-draw as necessary with the new data)
 * This is likely most relevant when a trigger has been sent from a NotePlan window, but could be used anytime a plugin wants to update the data in the React Window
 * This is exactly the same as onMessageFromHTMLView, but named updateReactWindowData to clarify that the plugin is updating the data in the React Window
 * rather than a user interaction having triggered it (the result is the same)
 * @param {string} actionType - the reducer-type action to be dispatched -- see onMessageFromHTMLView above
 * @param {any} data - any data that the router (specified in onMessageFromHTMLView) needs -- may be nothing
 * @returns {Promise<any>} - does not return anything important
 */
// export async function updateReactWindowData(actionType: string, data: any = null): Promise<any> {
//   if (!getWindowFromId(WEBVIEW_WINDOW_ID)) {
//     logError(pluginJson, `updateReactWindowData('${actionType}'): Window with ID ${WEBVIEW_WINDOW_ID} not found. Could not update data.`)
//     return
//   }
//   return await onMessageFromHTMLView(actionType, data)
// }

/**
 * When someone clicks a "Submit" button in the React Window, it calls the router (onMessageFromHTMLView)
 * which sees the actionType === "onSubmitClick" so it routes to this function for processing
 * @param {any} data - the data sent from the React Window for the action 'onSubmitClick'
 * @param {any} reactWindowData - the current data in the React Window
 * @returns {any} - the updated data to send back to the React Window
 */
async function handleSubmitButtonClick(data: any, reactWindowData: PassedData): Promise<PassedData | null> {
  const { type, formValues, receivingTemplateTitle } = data //in our example, the button click just sends the index of the row clicked
  clo(data, `handleSubmitButtonClick: data BEFORE acting on it`)
  if (type === 'submit') {
    if (formValues) {
      formValues['__isJSON__'] = true // include a flag to indicate that the formValues are JSON for use in the Templating plugin later
      if (!receivingTemplateTitle) {
        await showMessage('No Template Name was Provided; You should set a receivingTemplateTitle in your template frontmatter. For now, we will prompt you to choose one.')
        // TODO: prompt for a template name
        // const template = (await NPTemplating.chooseTemplate('template-fragment', 'Choose Template Fragment', { templateGroupTemplatesByFolder: false }))
        // receivingTemplateTitle = templateData.title
        return null
      }
      const shouldOpenInEditor = true // TODO: maybe templaterunner should derive this from a frontmatter field. but note that if newNoteTitle is set, it will always open. not set in underlying template
      const argumentsToSend = [receivingTemplateTitle, shouldOpenInEditor, JSON.stringify(formValues)]
      clo(argumentsToSend, `handleSubmitButtonClick: DataStore.invokePluginCommandByName('templateRunner', 'np.Templating' with arguments`)
      await DataStore.invokePluginCommandByName('templateRunner', 'np.Templating', argumentsToSend)
    } else {
      logError(pluginJson, `handleSubmitButtonClick: formValues is undefined`)
    }
  } else {
    logDebug(pluginJson, `handleSubmitButtonClick: formValues is undefined`)
  }
  closeWindowFromCustomId(WEBVIEW_WINDOW_ID)
  return reactWindowData
}

/**
 * Opens the HTML+React window; Called after the form data has been generated
 * @param {Object} argObj - the data to pass to the React Window (comes from templating "getTemplateFormData" command, a combination of the template frontmatter vars and formFields codeblock)
 *  - formFields: array (required) - the form fields to display
 *  - windowTitle: string (optional) - the title of the window (defaults to 'Form')
 *  - formTitle: string (optional) - the title of the form (inside the window)
 *  - width: string (optional) - the width of the form window
 *  - height: string (optional) - the height of the form window
 * @author @dwertheimer
 */
export async function openFormWindow(argObj: Object): Promise<void> {
  try {
    if (!argObj) {
      logError(pluginJson, `openFormWindow: argObj is undefined`)
      await showMessage('openFormWindow: no form fields were sent. Cannot continue. Make sure your template has a "formfields" codeblock.')
      return
    }
    logDebug(pluginJson, `openFormWindow starting up`)
    // get initial data to pass to the React Window
    const data = await createWindowInitData(argObj)

    // Note the first tag below uses the w3.css scaffolding for basic UI elements. You can delete that line if you don't want to use it
    // w3.css reference: https://www.w3schools.com/w3css/defaulT.asp
    // The second line needs to be updated to your pluginID in order to load any specific CSS you want to include for the React Window (in requiredFiles)
    const cssTagsString = `
      <link rel="stylesheet" href="../np.Shared/css.w3.css">
      <!-- Load in fontawesome assets from np.Shared (licensed for NotePlan) -->
      <link href="../np.Shared/fontawesome.css" rel="stylesheet">
      <link href="../np.Shared/regular.min.flat4NP.css" rel="stylesheet">
      <link href="../np.Shared/solid.min.flat4NP.css" rel="stylesheet">
      <link href="../np.Shared/light.min.flat4NP.css" rel="stylesheet">\n`
    const windowOptions = {
      savedFilename: `../../${pluginJson['plugin.id']}/form_output.html` /* for saving a debug version of the html file */,
      headerTags: cssTagsString,
      windowTitle: argObj?.windowTitle || 'Form',
      width: argObj?.width,
      height: argObj?.height,
      customId: WEBVIEW_WINDOW_ID,
      shouldFocus: true /* focus window everyd time (set to false if you want a bg refresh) */,
      generalCSSIn: generateCSSFromTheme(), // either use dashboard-specific theme name, or get general CSS set automatically from current theme
      postBodyScript: `
        <script type="text/javascript" >
        // Set DataStore.settings so default logDebug etc. logging works in React
        let DataStore = { settings: {_logLevel: "${DataStore.settings._logLevel}" } };
        </script>
      `,
    }
    logDebug(`===== testReactWindow Calling React after ${timer(data.startTime || new Date())} =====`)
    logDebug(pluginJson, `testReactWindow invoking window. testReactWindow stopping here. It's all React from this point forward`)
    clo(windowOptions, `testReactWindow windowOptions object passed`)
    clo(data, `testReactWindow data object passed`)
    // now ask np.Shared to open the React Window with the data we just gathered
    await DataStore.invokePluginCommandByName('openReactWindow', 'np.Shared', [data, windowOptions])
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
