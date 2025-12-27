// @flow

import pluginJson from '../plugin.json'
import { getGlobalSharedData, sendToHTMLWindow, sendBannerMessage } from '../../helpers/HTMLView'
import { type PassedData } from './shared/types.js'
// Note: getAllNotesAsOptions is no longer used here - FormView loads notes dynamically via requestFromPlugin
import { handleRequest, testRequestHandlers, updateFormLinksInNote, removeEmptyLinesFromNote } from './requestHandlers'
import {
  saveFormFieldsToTemplate,
  saveTemplateBodyToTemplate,
  loadTemplateBodyFromTemplate,
  saveTemplateRunnerArgsToTemplate,
  loadTemplateRunnerArgsFromTemplate,
  updateReceivingTemplateWithFields,
  getFormTemplateList,
} from './templateIO.js'
import { handleSubmitButtonClick } from './formSubmission.js'
import { openFormWindow, openFormBuilderWindow, FORMBUILDER_WINDOW_ID, WEBVIEW_WINDOW_ID, getFormWindowId, findFormWindowId } from './windowManagement.js'
import { log, logError, logDebug, logWarn, timer, clo, JSP, logInfo } from '@helpers/dev'
import { /* getWindowFromId, */ closeWindowFromCustomId } from '@helpers/NPWindows'
import { showMessage } from '@helpers/userInput'
import { waitForCondition } from '@helpers/promisePolyfill'
import NPTemplating from 'NPTemplating'
import { getNoteByFilename } from '@helpers/note'
import { validateObjectString, stripDoubleQuotes, parseObjectString } from '@helpers/stringTransforms'
import { updateFrontMatterVars, ensureFrontmatter, noteHasFrontMatter, getFrontmatterAttributes } from '@helpers/NPFrontMatter'
import { loadCodeBlockFromNote } from '@helpers/codeBlocks'
// Note: getFoldersMatching is no longer used here - FormView loads folders dynamically via requestFromPlugin

// Re-export shared type for backward compatibility
export type { PassedData }

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
      const options = getFormTemplateList()
      const chosenOpt = options.find((option) => option.label === templateTitle)
      if (chosenOpt) {
        // variable passed is a note title, but we need the filename
        selectedTemplate = chosenOpt.value
      }
    } else {
      // ask the user for the template - use getFormTemplateList to show options
      const options = getFormTemplateList()
      if (options.length === 0) {
        await showMessage('No form templates found. Please create a form template first.')
        return
      }
      const choice = await CommandBar.showOptions(
        options.map((opt) => opt.label),
        'Select Form Template',
        'Choose a form template to open:',
      )
      if (choice && choice.index >= 0 && choice.index < options.length) {
        selectedTemplate = options[choice.index].value
      }
    }
    let formFields: Array<Object> = []
    if (selectedTemplate) {
      const note = await getNoteByFilename(selectedTemplate)
      if (note) {
        const fm = note.frontmatterAttributes
        clo(fm, `getTemplateFormData fm=`)

        // Check processing method - determine from frontmatter or infer from receivingTemplateTitle (backward compatibility)
        const processingMethod = fm?.processingMethod || (fm?.receivingTemplateTitle || fm?.receivingtemplatetitle ? 'form-processor' : null)

        // If no processing method is set, require the user to set one
        if (!processingMethod) {
          await showMessage(
            `Template "${
              note.title || ''
            }" does not have a receivingTemplateTitle or processingMethod set. Please edit and save the form in the Form Builder or edit the frontmatter manually.`,
          )
          return
        }

        // Only require receivingTemplateTitle if processing method is 'form-processor'
        if (processingMethod === 'form-processor') {
          const receiver = fm && (fm.receivingTemplateTitle || fm.receivingtemplatetitle) // NP has a bug where it sometimes lowercases the frontmatter keys
          if (!receiver) {
            await showMessage(
              `Template "${
                note.title || ''
              }" uses "form-processor" processing method but does not have a "receivingTemplateTitle" set in frontmatter. Please set the "receivingTemplateTitle" field in your template frontmatter, or change the processing method.`,
            )
            return
          }
        }
        // Use generalized helper function to load formFields
        const loadedFormFields = await loadCodeBlockFromNote<Array<Object>>(selectedTemplate, 'formfields', pluginJson.id, parseObjectString)
        if (loadedFormFields) {
          formFields = loadedFormFields
          if (!formFields) {
            const formFieldsString: ?string = await loadCodeBlockFromNote<string>(selectedTemplate, 'formfields', pluginJson.id, null)
            if (formFieldsString) {
              const errors = validateObjectString(formFieldsString)
              logError(pluginJson, `getTemplateFormData: error validating form fields in ${selectedTemplate}, String:\n${formFieldsString}, `)
              logError(pluginJson, `getTemplateFormData: errors: ${errors.join('\n')}`)
              return
            }
          }
          clo(formFields, `🎅🏼 DBWDELETE NPTemplating.getTemplateFormData formFields=`)
          logDebug(pluginJson, `🎅🏼 DBWDELETE NPTemplating.getTemplateFormData formFields=\n${JSON.stringify(formFields, null, 2)}`)
        } else {
          // Try to get raw string for error reporting
          const formFieldsString: ?string = await loadCodeBlockFromNote<string>(selectedTemplate, 'formfields', pluginJson.id, null)
          if (formFieldsString) {
            try {
              formFields = parseObjectString(formFieldsString)
              if (!formFields) {
                const errors = validateObjectString(formFieldsString)
                logError(pluginJson, `getTemplateFormData: error validating form fields in ${selectedTemplate}, String:\n${formFieldsString}, `)
                logError(pluginJson, `getTemplateFormData: errors: ${errors.join('\n')}`)
                return
              }
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

    // Ensure we have a selectedTemplate before proceeding
    if (!selectedTemplate) {
      logError(pluginJson, 'getTemplateFormData: No template selected')
      return
    }

    // Get the note directly (bypassing getTemplateContent which assumes @Templates folder)
    const templateNote = await getNoteByFilename(selectedTemplate)
    if (!templateNote) {
      logError(pluginJson, `getTemplateFormData: could not find form template note: ${selectedTemplate}`)
      return
    }

    // Get template content directly from note (not through getTemplateContent which assumes @Templates)
    const templateData = templateNote.content || ''
    const templateFrontmatterAttributes = await NPTemplating.getTemplateAttributes(templateData)
    clo(templateData, `getTemplateFormData templateData=`)
    clo(templateFrontmatterAttributes, `getTemplateFormData templateFrontmatterAttributes=`)

    // Check processing method - determine from frontmatter or infer from receivingTemplateTitle (backward compatibility)
    const processingMethod = templateFrontmatterAttributes?.processingMethod || (templateFrontmatterAttributes?.receivingTemplateTitle ? 'form-processor' : null)

    // If no processing method is set, require the user to set one
    if (!processingMethod) {
      logError(pluginJson, 'Template does not have a processingMethod set')
      await showMessage(
        `Template does not have a receivingTemplateTitle or processingMethod set. Please edit and save the form in the Form Builder or edit the frontmatter manually.`,
      )
      return
    }

    // Only require receivingTemplateTitle if processing method is 'form-processor'
    if (processingMethod === 'form-processor' && !templateFrontmatterAttributes?.receivingTemplateTitle) {
      logError(pluginJson, 'Template uses form-processor method but does not have a receivingTemplateTitle set')
      await showMessage(
        'Template Form uses "form-processor" processing method but does not have a "receivingTemplateTitle" field set. Please set the "receivingTemplateTitle" field in your template frontmatter, or change the processing method.',
      )
      return
    }

    //TODO: we may not need this step, ask @codedungeon what he thinks
    // for now, we'll call renderFrontmatter() via DataStore.invokePluginCommandByName()
    const { _, frontmatterAttributes } = await DataStore.invokePluginCommandByName('renderFrontmatter', 'np.Templating', [templateData])

    // Load TemplateRunner processing variables from codeblock (not frontmatter)
    // These contain template tags that reference form field values and should not be processed during form opening
    if (templateNote) {
      if (templateNote) {
        // Load templateBody from codeblock
        const templateBodyFromCodeblock = await loadTemplateBodyFromTemplate(templateNote)
        if (templateBodyFromCodeblock) {
          frontmatterAttributes.templateBody = templateBodyFromCodeblock
        }

        // Load TemplateRunner args from codeblock
        const templateRunnerArgs = await loadTemplateRunnerArgsFromTemplate(templateNote)
        if (templateRunnerArgs) {
          // Merge TemplateRunner args into frontmatterAttributes (overriding any from frontmatter)
          Object.assign(frontmatterAttributes, templateRunnerArgs)
        }
      }
    }

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
/**
 * Parse a value that can be a number or percentage string
 * @param {string|number|undefined} value - The value to parse (e.g., "750", "50%", or 750)
 * @param {number} screenDimension - Screen dimension (width or height) for percentage calculation
 * @returns {number|undefined} Parsed pixel value or undefined
 */
// Window management functions are now imported from windowManagement.js

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
/**
 * Open FormBuilder for creating/editing form fields
 * @param {string} templateTitle - Optional template title to edit
 * @returns {Promise<void>}
 */
export async function openFormBuilder(templateTitle?: string): Promise<void> {
  try {
    logDebug(pluginJson, `openFormBuilder: Starting, templateTitle="${templateTitle || ''}"`)
    let selectedTemplate
    let formFields: Array<Object> = []
    let templateNote = null
    const receivingTemplateTitle: string = '' // Track receiving template title for newly created forms

    if (templateTitle?.trim().length) {
      logDebug(pluginJson, `openFormBuilder: Using provided templateTitle`)
      const options = getFormTemplateList()
      const chosenOpt = options.find((option) => option.label === templateTitle)
      if (chosenOpt) {
        selectedTemplate = chosenOpt.value
        logDebug(pluginJson, `openFormBuilder: Found template, selectedTemplate="${selectedTemplate}"`)
      } else {
        logError(pluginJson, `openFormBuilder: Could not find template with title "${templateTitle}"`)
      }
    } else {
      logDebug(pluginJson, `openFormBuilder: Asking user to choose or create template`)
      // Ask user to choose or create a new template
      const createNew = await CommandBar.showOptions(['Create New Form', 'Edit Existing Form'], 'Form Builder', 'Choose an option')
      clo(createNew, `openFormBuilder: User selected option`)
      // $FlowFixMe[incompatible-type] - showOptions returns number index
      if (createNew.value === 'Create New Form' || createNew.index === 0) {
        logDebug(pluginJson, `openFormBuilder: User chose to create new template`)
        // Create new template
        let newTitle = await CommandBar.textPrompt('New Form Template', 'Enter template title:', '')
        logDebug(pluginJson, `openFormBuilder: User entered title: "${String(newTitle)}"`)
        if (!newTitle || typeof newTitle === 'boolean') {
          logDebug(pluginJson, `openFormBuilder: User cancelled or empty title, returning`)
          return
        }

        // Append "Form" to title if it doesn't already contain "form" (case-insensitive)
        if (!/form/i.test(newTitle)) {
          newTitle = `${newTitle} Form`
          logDebug(pluginJson, `openFormBuilder: Appended "Form" to title, new title: "${newTitle}"`)
        }

        // Create folder path: @Forms/{form name}
        const formFolderPath = `@Forms/${newTitle}`
        logDebug(pluginJson, `openFormBuilder: Creating form in folder "${formFolderPath}"`)

        logDebug(pluginJson, `openFormBuilder: Creating new note with title "${newTitle}" in ${formFolderPath} folder`)
        // Create new note in Forms subfolder
        const filename = DataStore.newNote(newTitle, formFolderPath)
        logDebug(pluginJson, `openFormBuilder: DataStore.newNote returned filename: "${filename || 'null'}"`)
        if (!filename) {
          logError(pluginJson, `openFormBuilder: Failed to create template "${newTitle}"`)
          await showMessage(`Failed to create template "${newTitle}"`)
          return
        }
        logDebug(pluginJson, `openFormBuilder: Created new template "${newTitle}" with filename: ${filename}`)
        templateNote = await getNoteByFilename(filename)
        logDebug(pluginJson, `openFormBuilder: getNoteByFilename returned: ${templateNote ? 'note found' : 'null'}`)
        if (!templateNote) {
          logError(pluginJson, `openFormBuilder: Could not find note with filename: ${filename}`)
          await showMessage(`Failed to open newly created template "${newTitle}"`)
          return
        }

        // LOG: Check note content immediately after creation
        logDebug(pluginJson, `openFormBuilder: [STEP 1] Note content after creation (first 20 lines):\n${(templateNote.content || '').split('\n').slice(0, 20).join('\n')}`)
        const hasFM1 = noteHasFrontMatter(templateNote)
        logDebug(pluginJson, `openFormBuilder: [STEP 1] Note has frontmatter: ${String(hasFM1)}`)
        if (hasFM1) {
          const attrs = getFrontmatterAttributes(templateNote)
          logDebug(pluginJson, `openFormBuilder: [STEP 1] Existing frontmatter attributes: ${JSON.stringify(attrs)}`)
        }

        logDebug(pluginJson, `openFormBuilder: Setting frontmatter for new template`)

        // Generate launchLink URL (needed for both form and processing template)
        const encodedTitle = encodeURIComponent(newTitle)
        const launchLink = `noteplan://x-callback-url/runPlugin?pluginID=dwertheimer.Forms&command=Open%20Template%20Form&arg0=${encodedTitle}`
        // Generate formEditLink URL to launch Form Builder
        const formEditLink = `noteplan://x-callback-url/runPlugin?pluginID=dwertheimer.Forms&command=Form%20Builder/Editor&arg0=${encodedTitle}`

        // Ensure frontmatter exists with correct title FIRST (before updating other fields)
        // This must be called before any other operations to ensure title is set correctly
        logDebug(pluginJson, `openFormBuilder: [STEP 2] Calling ensureFrontmatter with title: "${newTitle}"`)
        ensureFrontmatter(templateNote, true, newTitle)

        // LOG: Check note content after ensureFrontmatter
        logDebug(
          pluginJson,
          `openFormBuilder: [STEP 2] Note content after ensureFrontmatter (first 20 lines):\n${(templateNote.content || '').split('\n').slice(0, 20).join('\n')}`,
        )
        if (noteHasFrontMatter(templateNote)) {
          const attrs = getFrontmatterAttributes(templateNote)
          logDebug(pluginJson, `openFormBuilder: [STEP 2] Frontmatter attributes after ensureFrontmatter: ${JSON.stringify(attrs)}`)
        }

        // Set initial frontmatter including launchLink and formEditLink
        // Note: title is already set by ensureFrontmatter above
        // Set default window settings: 25% width, 40% height, center, center
        logDebug(
          pluginJson,
          `openFormBuilder: [STEP 3] Calling updateFrontMatterVars with: ${JSON.stringify({
            type: 'template-form',
            receivingTemplateTitle,
            windowTitle: newTitle,
            // formTitle: (not set - left blank for user to fill in)
            launchLink,
            formEditLink,
            width: '25%',
            height: '40%',
            x: 'center',
            y: 'center',
          })}`,
        )
        updateFrontMatterVars(templateNote, {
          type: 'template-form',
          receivingTemplateTitle: receivingTemplateTitle,
          windowTitle: newTitle,
          // formTitle is left blank by default - user can fill it in later
          launchLink: launchLink,
          formEditLink: formEditLink,
          width: '25%',
          height: '40%',
          x: 'center',
          y: 'center',
        })

        // LOG: Check note content after updateFrontMatterVars
        logDebug(
          pluginJson,
          `openFormBuilder: [STEP 3] Note content after updateFrontMatterVars (first 20 lines):\n${(templateNote.content || '').split('\n').slice(0, 20).join('\n')}`,
        )
        if (noteHasFrontMatter(templateNote)) {
          const attrs = getFrontmatterAttributes(templateNote)
          logDebug(pluginJson, `openFormBuilder: [STEP 3] Frontmatter attributes after updateFrontMatterVars: ${JSON.stringify(attrs)}`)
        }

        selectedTemplate = filename
        logDebug(pluginJson, `openFormBuilder: Set frontmatter and selectedTemplate = ${selectedTemplate}, receivingTemplateTitle = "${receivingTemplateTitle}"`)

        // Generate processing template link if receiving template exists
        let processingTemplateLink = ''
        if (receivingTemplateTitle) {
          const encodedProcessingTitle = encodeURIComponent(receivingTemplateTitle)
          processingTemplateLink = `noteplan://x-callback-url/openNote?noteTitle=${encodedProcessingTitle}`
        }

        // Reload the note to ensure state is synchronized after updateFrontMatterVars
        // This ensures paragraphs array and content are in sync before we try to insert body content
        logDebug(pluginJson, `openFormBuilder: [STEP 3.5] Reloading note to sync state after updateFrontMatterVars`)
        templateNote = await getNoteByFilename(filename)
        if (!templateNote) {
          logError(pluginJson, `openFormBuilder: Failed to reload note after updateFrontMatterVars`)
          return
        }
        logDebug(pluginJson, `openFormBuilder: [STEP 3.5] Reloaded note has ${templateNote.paragraphs.length} paragraphs`)

        // Update markdown links in body using helper function (AFTER frontmatter is set and note is reloaded)
        logDebug(pluginJson, `openFormBuilder: [STEP 4] Calling updateFormLinksInNote with formTitle: "${newTitle}"`)
        await updateFormLinksInNote(templateNote, newTitle, launchLink, formEditLink, processingTemplateLink)

        // LOG: Check note content after updateFormLinksInNote
        logDebug(
          pluginJson,
          `openFormBuilder: [STEP 4] Note content after updateFormLinksInNote (first 30 lines):\n${(templateNote.content || '').split('\n').slice(0, 30).join('\n')}`,
        )
        if (noteHasFrontMatter(templateNote)) {
          const attrs = getFrontmatterAttributes(templateNote)
          logDebug(pluginJson, `openFormBuilder: [STEP 4] Frontmatter attributes after updateFormLinksInNote: ${JSON.stringify(attrs)}`)
        }

        // Clean up empty lines after all operations
        logDebug(pluginJson, `openFormBuilder: [STEP 5] Calling removeEmptyLinesFromNote`)
        removeEmptyLinesFromNote(templateNote)

        // Update cache to ensure frontmatter is parsed and available
        // This is critical for openFormBuilderWindow to read the frontmatter attributes
        logDebug(pluginJson, `openFormBuilder: [STEP 5.5] Updating cache to refresh frontmatter attributes`)
        const cachedNote = DataStore.updateCache(templateNote, true)
        if (cachedNote) {
          logDebug(pluginJson, `openFormBuilder: [STEP 5.5] Cache updated successfully`)
        } else {
          logWarn(pluginJson, `openFormBuilder: [STEP 5.5] Cache update returned null`)
        }

        // Reload the note to ensure frontmatter is up to date before opening FormBuilder
        // This ensures frontmatterAttributes is populated from the updated cache
        templateNote = await getNoteByFilename(filename)
        logDebug(pluginJson, `openFormBuilder: [STEP 6] Reloaded template note after cache update`)

        // Wait for frontmatter attributes to be available (race condition fix)
        // NotePlan may need a moment to parse the frontmatter after cache update
        if (templateNote) {
          logDebug(pluginJson, `openFormBuilder: [STEP 6.5] Waiting for frontmatter attributes to be parsed...`)
          const frontmatterAvailable = await waitForCondition(
            async () => {
              const reloadedNote = await getNoteByFilename(filename)
              if (reloadedNote && reloadedNote.frontmatterAttributes) {
                const hasWindowTitle = reloadedNote.frontmatterAttributes.windowTitle != null
                const hasWidth = reloadedNote.frontmatterAttributes.width != null
                if (hasWindowTitle && hasWidth) {
                  logDebug(pluginJson, `openFormBuilder: [STEP 6.5] Frontmatter attributes are now available`)
                  return true
                }
              }
              return false
            },
            { maxWaitMs: 2000, checkIntervalMs: 50 },
          )

          if (frontmatterAvailable) {
            // Reload one more time to get the fully parsed note
            templateNote = await getNoteByFilename(filename)
          }

          const reloadedReceivingTitle = templateNote?.frontmatterAttributes?.receivingTemplateTitle
          const reloadedWindowTitle = templateNote?.frontmatterAttributes?.windowTitle
          const reloadedWidth = templateNote?.frontmatterAttributes?.width
          logDebug(pluginJson, `openFormBuilder: [STEP 6] After reload, frontmatter receivingTemplateTitle = "${reloadedReceivingTitle || 'NOT FOUND'}"`)
          logDebug(pluginJson, `openFormBuilder: [STEP 6] After reload, frontmatter windowTitle = "${reloadedWindowTitle || 'NOT FOUND'}"`)
          logDebug(pluginJson, `openFormBuilder: [STEP 6] After reload, frontmatter width = "${reloadedWidth || 'NOT FOUND'}"`)
          if (!reloadedReceivingTitle && receivingTemplateTitle) {
            logWarn(pluginJson, `openFormBuilder: [STEP 6] WARNING - receivingTemplateTitle was set to "${receivingTemplateTitle}" but not found in reloaded note frontmatter!`)
          }
        }
        // $FlowFixMe[incompatible-type] - showOptions returns number index
      } else if (createNew.index === 1 || createNew.value === 'Edit Existing Form') {
        logDebug(pluginJson, `openFormBuilder: User chose to edit existing form`)
        // Edit existing
        selectedTemplate = await NPTemplating.chooseTemplate('template-form')
        logDebug(pluginJson, `openFormBuilder: User selected existing template: "${selectedTemplate || 'none'}"`)
      } else {
        logDebug(pluginJson, `openFormBuilder: User cancelled, returning`)
        return // cancelled
      }
    }

    if (!selectedTemplate) {
      logError(pluginJson, 'openFormBuilder: No template selected, cannot open FormBuilder')
      await showMessage('No template selected. Cannot open Form Builder.')
      return
    }

    logDebug(pluginJson, `openFormBuilder: Opening FormBuilder for template: ${selectedTemplate}`)

    // Get template note if we don't already have it
    if (!templateNote) {
      logDebug(pluginJson, `openFormBuilder: Getting template note for filename: ${selectedTemplate}`)
      templateNote = await getNoteByFilename(selectedTemplate)
      logDebug(pluginJson, `openFormBuilder: getNoteByFilename returned: ${templateNote ? 'note found' : 'null'}`)
    }

    if (templateNote) {
      logDebug(pluginJson, `openFormBuilder: Checking for existing formfields code blocks`)
      // Use generalized helper function to load formFields
      const loadedFormFields = await loadCodeBlockFromNote<Array<Object>>(templateNote, 'formfields', pluginJson.id, parseObjectString)
      if (loadedFormFields) {
        formFields = loadedFormFields || []
        logDebug(pluginJson, `openFormBuilder: Loaded ${formFields.length} existing form fields`)
      } else {
        logDebug(pluginJson, `openFormBuilder: No existing formfields code blocks found, starting with empty array`)
      }
    } else {
      logWarn(pluginJson, `openFormBuilder: templateNote is null, will start with empty form fields`)
    }

    logDebug(
      pluginJson,
      `openFormBuilder: About to call openFormBuilderWindow with ${formFields.length} fields, templateFilename="${selectedTemplate}", templateTitle="${templateNote?.title || ''}"`,
    )
    // If we just created a receiving template, pass it directly to ensure it's available
    const initialReceivingTemplateTitle = receivingTemplateTitle || undefined
    await openFormBuilderWindow({
      formFields,
      templateFilename: selectedTemplate,
      templateTitle: templateNote?.title || '',
      initialReceivingTemplateTitle: initialReceivingTemplateTitle,
    })
    logDebug(pluginJson, `openFormBuilder: openFormBuilderWindow call completed`)
  } catch (error) {
    logError(pluginJson, error)
  }
}

// openFormBuilderWindow is now imported from windowManagement.js

/**
 * Handle FormBuilder actions (save, cancel)
 * @param {string} actionType - The action type ('save' or 'cancel')
 * @param {any} data - The data sent from FormBuilder
 * @returns {Promise<any>}
 */
export async function onFormBuilderAction(actionType: string, data: any = null): Promise<any> {
  try {
    logDebug(pluginJson, `onFormBuilderAction received actionType="${actionType}"`)
    clo(data, `onFormBuilderAction data=`)

    // Check if this is a request that needs a response
    if (data?.__requestType === 'REQUEST' && data?.__correlationId) {
      try {
        logDebug(pluginJson, `onFormBuilderAction: Handling REQUEST type="${actionType}" with correlationId="${data.__correlationId}"`)

        // Handle save action as a special case (it's not in requestHandlers)
        const actualActionType = data?.type
        if (actualActionType === 'save') {
          const saveResult = await handleSaveRequest(data)
          sendToHTMLWindow(FORMBUILDER_WINDOW_ID, 'RESPONSE', {
            correlationId: data.__correlationId,
            success: saveResult.success,
            data: saveResult.data,
            error: saveResult.message,
          })
          return {}
        }

        // For other request types, use the standard handleRequest
        const result = await handleRequest(actionType, data)
        // Don't log the data if it's an object/array to avoid cluttering logs with [object Object]
        const dataPreview = result.data != null ? (typeof result.data === 'object' ? `[object]` : String(result.data)) : 'null'
        logDebug(
          pluginJson,
          `onFormBuilderAction: handleRequest result for "${actionType}": success=${String(result.success)}, data type=${typeof result.data}, data="${dataPreview}"`,
        )

        // Send response back to React
        sendToHTMLWindow(FORMBUILDER_WINDOW_ID, 'RESPONSE', {
          correlationId: data.__correlationId,
          success: result.success,
          data: result.data,
          error: result.message,
        })
        return {}
      } catch (error) {
        logError(pluginJson, `onFormBuilderAction: Error handling REQUEST: ${error.message || String(error)}`)
        sendToHTMLWindow(FORMBUILDER_WINDOW_ID, 'RESPONSE', {
          correlationId: data.__correlationId,
          success: false,
          data: null,
          error: error.message || String(error) || 'Unknown error',
        })
        return {}
      }
    }

    // The data structure from React is: { type: 'save'|'cancel'|'openForm', fields: [...], templateFilename: ..., templateTitle: ... }
    // actionType will be "onFormBuilderAction" (the command name), and the actual action is in data.type
    const actualActionType = data?.type
    logDebug(pluginJson, `onFormBuilderAction: actualActionType="${actualActionType}"`)
    logDebug(pluginJson, `onFormBuilderAction: data keys: ${Object.keys(data || {}).join(', ')}`)
    if (actualActionType === 'openForm') {
      logDebug(pluginJson, `onFormBuilderAction: openForm detected, data.templateTitle="${data?.templateTitle || 'MISSING'}"`)
    }

    // Get the template filename from the data passed from React, or fall back to reactWindowData
    const templateFilename = data?.templateFilename
    const reactWindowData = await getGlobalSharedData(FORMBUILDER_WINDOW_ID)
    const fallbackTemplateFilename = reactWindowData?.pluginData?.templateFilename || ''
    const finalTemplateFilename = templateFilename || fallbackTemplateFilename

    logDebug(pluginJson, `onFormBuilderAction: templateFilename="${finalTemplateFilename}"`)

    if (actualActionType === 'save' && data?.fields) {
      // Parse fields if they're strings (shouldn't happen, but just in case)
      let fieldsToSave = data.fields
      if (Array.isArray(fieldsToSave) && fieldsToSave.length > 0 && typeof fieldsToSave[0] === 'string') {
        logWarn(pluginJson, `onFormBuilderAction: Fields are strings, attempting to parse`)
        fieldsToSave = fieldsToSave.map((field) => {
          try {
            return typeof field === 'string' ? JSON.parse(field) : field
          } catch (e) {
            logError(pluginJson, `onFormBuilderAction: Error parsing field: ${e.message}`)
            return field
          }
        })
      }

      logDebug(pluginJson, `onFormBuilderAction: Saving ${fieldsToSave.length} fields to template "${finalTemplateFilename}"`)
      clo(fieldsToSave, `onFormBuilderAction: fieldsToSave`)

      await saveFormFieldsToTemplate(finalTemplateFilename, fieldsToSave)

      // Extract TemplateRunner processing variables from frontmatter
      // These contain template tags and should be stored in codeblock, not frontmatter
      const templateRunnerArgs: { [string]: any } = {}
      const templateRunnerArgKeys = [
        'newNoteTitle', // Contains template tags like <%- field1 %>
        'getNoteTitled', // May contain special values like <today>, <current>
        'location', // Write location setting
        'writeUnderHeading', // Heading to write under
        'replaceNoteContents', // Whether to replace note contents
        'createMissingHeading', // Whether to create missing heading
        'newNoteFolder', // Folder for new note
      ]

      // Extract TemplateRunner args from frontmatter
      if (data?.frontmatter) {
        templateRunnerArgKeys.forEach((key) => {
          if (data.frontmatter[key] !== undefined) {
            templateRunnerArgs[key] = data.frontmatter[key]
          }
        })
      }

      // Save templateBody to codeblock if provided
      if (data?.frontmatter?.templateBody !== undefined) {
        await saveTemplateBodyToTemplate(finalTemplateFilename, data.frontmatter.templateBody || '')
      }

      // Save TemplateRunner args to codeblock if any exist
      if (Object.keys(templateRunnerArgs).length > 0) {
        await saveTemplateRunnerArgsToTemplate(finalTemplateFilename, templateRunnerArgs)
      }

      // Save frontmatter if provided (but exclude TemplateRunner args and templateBody as they're in codeblocks)
      if (data?.frontmatter) {
        const frontmatterForSave = { ...data.frontmatter }
        // Remove TemplateRunner args and templateBody from frontmatter
        delete frontmatterForSave.templateBody
        templateRunnerArgKeys.forEach((key) => {
          delete frontmatterForSave[key]
        })
        await saveFrontmatterToTemplate(finalTemplateFilename, frontmatterForSave)
      }

      // Check if we should update the receiving template
      const templateNote = await getNoteByFilename(finalTemplateFilename)
      if (templateNote) {
        const receivingTemplateTitle = templateNote.frontmatterAttributes?.receivingTemplateTitle
        if (receivingTemplateTitle) {
          const updateReceiving = await CommandBar.showOptions(['Yes, update receiving template', 'No, skip'], 'Form Builder', 'Update receiving template with new field keys?')

          if (updateReceiving?.value === 'Yes, update receiving template' || updateReceiving?.index === 0) {
            await updateReceivingTemplateWithFields(receivingTemplateTitle, fieldsToSave)
          }
        }
      }

      // If you want to automatically close the window after saving, uncomment the line below
      // closeWindowFromCustomId(FORMBUILDER_WINDOW_ID)
    } else if (actualActionType === 'cancel') {
      logDebug(pluginJson, `onFormBuilderAction: User cancelled, closing window`)
      closeWindowFromCustomId(FORMBUILDER_WINDOW_ID)
    } else if (actualActionType === 'openForm' && data?.templateTitle) {
      logDebug(pluginJson, `onFormBuilderAction: Opening form with templateTitle="${data.templateTitle}"`)
      logDebug(pluginJson, `onFormBuilderAction: Calling getTemplateFormData with templateTitle="${data.templateTitle}"`)
      try {
        await getTemplateFormData(data.templateTitle)
        logDebug(pluginJson, `onFormBuilderAction: getTemplateFormData completed successfully`)
      } catch (error) {
        logError(pluginJson, `onFormBuilderAction: Error in getTemplateFormData: ${error.message}`)
        throw error
      }
    } else if (actualActionType === 'duplicateForm' && data?.newTemplateFilename) {
      // After duplicating, open the new form in Form Builder
      logDebug(pluginJson, `onFormBuilderAction: Opening duplicated form with filename="${data.newTemplateFilename}"`)
      const newNote = await getNoteByFilename(data.newTemplateFilename)
      if (newNote) {
        const loadedFormFields = await loadCodeBlockFromNote<Array<Object>>(newNote, 'formfields', pluginJson.id, parseObjectString)
        const formFields = loadedFormFields || []
        await openFormBuilderWindow({
          formFields,
          templateFilename: data.newTemplateFilename,
          templateTitle: data.newTemplateTitle || newNote.title || '',
          initialReceivingTemplateTitle: data.newReceivingTemplateTitle,
        })
      }
    } else {
      logWarn(pluginJson, `onFormBuilderAction: Unknown actualActionType="${actualActionType}" or missing fields/data`)
      logWarn(pluginJson, `onFormBuilderAction: data.keys=${Object.keys(data || {}).join(', ')}`)
    }

    return {}
  } catch (error) {
    logError(pluginJson, `onFormBuilderAction error: ${JSP(error)}`)
  }
}

/**
 * Save frontmatter to template
 * @param {string} templateFilename - The template filename
 * @param {Object} frontmatter - The frontmatter object
 * @returns {Promise<void>}
 */
async function saveFrontmatterToTemplate(templateFilename: string, frontmatter: Object): Promise<void> {
  try {
    if (!templateFilename) {
      await showMessage('No template filename provided. Cannot save frontmatter.')
      return
    }

    const templateNote = await getNoteByFilename(templateFilename)
    if (!templateNote) {
      await showMessage(`Template not found: ${templateFilename}`)
      return
    }

    // Convert all frontmatter values to strings (updateFrontMatterVars expects strings)
    // Strip any quotes that might have been added
    // IMPORTANT: Skip empty string values to avoid writing "" to frontmatter
    const frontmatterAsStrings: { [string]: string } = {}
    Object.keys(frontmatter).forEach((key) => {
      const value = frontmatter[key]
      // Skip null, undefined, and empty strings - don't write them to frontmatter
      if (value === null || value === undefined) {
        // Skip - don't add to frontmatterAsStrings
        return
      }

      let stringValue: string = ''
      if (typeof value === 'boolean') {
        stringValue = String(value)
      } else if (typeof value === 'number') {
        stringValue = String(value)
      } else if (typeof value === 'string') {
        // Strip quotes from string values
        stringValue = stripDoubleQuotes(value)
      } else {
        stringValue = stripDoubleQuotes(String(value))
      }

      // Allow empty strings for specific fields that users may want to blank out (formTitle, windowTitle)
      // For other fields, skip empty strings to avoid writing "" to frontmatter
      const fieldsThatAllowEmpty = ['formTitle', 'windowTitle']
      const shouldInclude = stringValue !== '' || fieldsThatAllowEmpty.includes(key)
      if (shouldInclude) {
        frontmatterAsStrings[key] = stringValue
        logDebug(pluginJson, `saveFrontmatterToTemplate: Including ${key}="${stringValue}" (empty string allowed: ${String(fieldsThatAllowEmpty.includes(key))})`)
      } else {
        logDebug(pluginJson, `saveFrontmatterToTemplate: Skipping ${key}="${stringValue}" (empty string not allowed for this field)`)
      }
    })

    // Update frontmatter (only non-empty values will be written)
    updateFrontMatterVars(templateNote, frontmatterAsStrings)
    logDebug(pluginJson, `saveFrontmatterToTemplate: Saved frontmatter to template`)
  } catch (error) {
    logError(pluginJson, `saveFrontmatterToTemplate error: ${JSP(error)}`)
    await showMessage(`Error saving frontmatter: ${error.message}`)
  }
}

/**
 * Handle save request from React (request/response pattern)
 * @param {Object} data - Request data containing fields, frontmatter, templateFilename, templateTitle
 * @returns {Promise<{success: boolean, message?: string, data?: any}>}
 */
async function handleSaveRequest(data: any): Promise<{ success: boolean, message?: string, data?: any }> {
  try {
    // Get the template filename from the data passed from React, or fall back to reactWindowData
    const templateFilename = data?.templateFilename
    const reactWindowData = await getGlobalSharedData(FORMBUILDER_WINDOW_ID)
    const fallbackTemplateFilename = reactWindowData?.pluginData?.templateFilename || ''
    const finalTemplateFilename = templateFilename || fallbackTemplateFilename

    if (!finalTemplateFilename) {
      return {
        success: false,
        message: 'No template filename provided',
        data: null,
      }
    }

    if (!data?.fields) {
      return {
        success: false,
        message: 'No fields provided to save',
        data: null,
      }
    }

    // Parse fields if they're strings (shouldn't happen, but just in case)
    let fieldsToSave = data.fields
    if (Array.isArray(fieldsToSave) && fieldsToSave.length > 0 && typeof fieldsToSave[0] === 'string') {
      logWarn(pluginJson, `handleSaveRequest: Fields are strings, attempting to parse`)
      fieldsToSave = fieldsToSave.map((field) => {
        try {
          return typeof field === 'string' ? JSON.parse(field) : field
        } catch (e) {
          logError(pluginJson, `handleSaveRequest: Error parsing field: ${e.message}`)
          return field
        }
      })
    }

    logDebug(pluginJson, `handleSaveRequest: Saving ${fieldsToSave.length} fields to template "${finalTemplateFilename}"`)

    await saveFormFieldsToTemplate(finalTemplateFilename, fieldsToSave)

    // Extract TemplateRunner processing variables from frontmatter
    // These contain template tags and should be stored in codeblock, not frontmatter
    const templateRunnerArgs: { [string]: any } = {}
    const templateRunnerArgKeys = [
      'newNoteTitle', // Contains template tags like <%- field1 %>
      'getNoteTitled', // May contain special values like <today>, <current>
      'location', // Write location setting
      'writeUnderHeading', // Heading to write under
      'replaceNoteContents', // Whether to replace note contents
      'createMissingHeading', // Whether to create missing heading
      'newNoteFolder', // Folder for new note
    ]

    // Extract TemplateRunner args from frontmatter
    if (data?.frontmatter) {
      templateRunnerArgKeys.forEach((key) => {
        if (data.frontmatter[key] !== undefined) {
          templateRunnerArgs[key] = data.frontmatter[key]
        }
      })
    }

    // Save templateBody to codeblock if provided
    if (data?.frontmatter?.templateBody !== undefined) {
      await saveTemplateBodyToTemplate(finalTemplateFilename, data.frontmatter.templateBody || '')
    }

    // Save TemplateRunner args to codeblock if any exist
    if (Object.keys(templateRunnerArgs).length > 0) {
      await saveTemplateRunnerArgsToTemplate(finalTemplateFilename, templateRunnerArgs)
    }

    // Save frontmatter if provided (but exclude TemplateRunner args and templateBody as they're in codeblocks)
    if (data?.frontmatter) {
      const frontmatterForSave = { ...data.frontmatter }
      // Remove TemplateRunner args and templateBody from frontmatter
      delete frontmatterForSave.templateBody
      templateRunnerArgKeys.forEach((key) => {
        delete frontmatterForSave[key]
      })
      await saveFrontmatterToTemplate(finalTemplateFilename, frontmatterForSave)
    }

    // Get template note for success message and cleanup
    const templateNote = await getNoteByFilename(finalTemplateFilename)
    const templateTitle = templateNote?.title || finalTemplateFilename

    // Remove empty lines from the note
    if (templateNote) {
      removeEmptyLinesFromNote(templateNote)
    }

    return {
      success: true,
      message: `Form saved successfully to "${templateTitle}"`,
      data: { templateFilename: finalTemplateFilename, templateTitle },
    }
  } catch (error) {
    logError(pluginJson, `handleSaveRequest error: ${JSP(error)}`)
    return {
      success: false,
      message: `Error saving form: ${error.message || String(error)}`,
      data: null,
    }
  }
}

/**
 * Save form fields to template as formfields code block
 * @param {string} templateFilename - The template filename
 * @param {Array<Object>} fields - The form fields array
 * @returns {Promise<void>}
 */
// Template I/O functions are now imported from templateIO.js

export async function onFormSubmitFromHTMLView(actionType: string, data: any = null): Promise<any> {
  try {
    logDebug(pluginJson, `NP Plugin return path (onMessageFromHTMLView) received actionType="${actionType}" (typeof=${typeof actionType})  (typeof data=${typeof data})`)
    clo(data, `Plugin onMessageFromHTMLView data=`)

    // Check if this is a request that needs a response
    if (data?.__requestType === 'REQUEST' && data?.__correlationId) {
      try {
        logDebug(pluginJson, `onFormSubmitFromHTMLView: Handling REQUEST type="${actionType}" with correlationId="${data.__correlationId}"`)
        const result = await handleRequest(actionType, data)

        // Get window ID - prioritize windowId from request (most reliable), then try lookup
        let windowId = data?.__windowId || null
        logDebug(pluginJson, `onFormSubmitFromHTMLView: windowId from request: "${windowId || 'NOT PROVIDED'}"`)

        // If windowId was provided in request, use it directly (most reliable)
        if (windowId) {
          logDebug(pluginJson, `onFormSubmitFromHTMLView: Using windowId from request: "${windowId}"`)
        } else {
          // Fallback: try to find it from open windows or window data
          // For form entry windows, use findFormWindowId() first
          windowId = findFormWindowId() || WEBVIEW_WINDOW_ID
          logDebug(pluginJson, `onFormSubmitFromHTMLView: Fallback - Initial windowId from findFormWindowId: "${windowId}"`)
          try {
            // Try to get window data with the found ID
            const tempWindowData = await getGlobalSharedData(windowId)
            logDebug(
              pluginJson,
              `onFormSubmitFromHTMLView: Got window data for "${windowId}", has pluginData.windowId=${String(!!tempWindowData?.pluginData?.windowId)}, has formTitle=${String(
                !!tempWindowData?.pluginData?.formTitle,
              )}`,
            )
            if (tempWindowData?.pluginData?.windowId) {
              windowId = tempWindowData.pluginData.windowId
              logDebug(pluginJson, `onFormSubmitFromHTMLView: Updated windowId from pluginData.windowId: "${windowId}"`)
            } else if (tempWindowData?.pluginData?.formTitle) {
              windowId = getFormWindowId(tempWindowData.pluginData.formTitle)
              logDebug(pluginJson, `onFormSubmitFromHTMLView: Updated windowId from formTitle "${tempWindowData.pluginData.formTitle}": "${windowId}"`)
            }
          } catch (e) {
            logDebug(pluginJson, `onFormSubmitFromHTMLView: Error getting window data for "${windowId}": ${e.message}, trying WEBVIEW_WINDOW_ID`)
            // If that fails, try the base WEBVIEW_WINDOW_ID
            try {
              const tempWindowData = await getGlobalSharedData(WEBVIEW_WINDOW_ID)
              logDebug(
                pluginJson,
                `onFormSubmitFromHTMLView: Got window data for WEBVIEW_WINDOW_ID, has pluginData.windowId=${String(!!tempWindowData?.pluginData?.windowId)}, has formTitle=${String(
                  !!tempWindowData?.pluginData?.formTitle,
                )}`,
              )
              if (tempWindowData?.pluginData?.windowId) {
                windowId = tempWindowData.pluginData.windowId
                logDebug(pluginJson, `onFormSubmitFromHTMLView: Updated windowId from WEBVIEW_WINDOW_ID data: "${windowId}"`)
              } else if (tempWindowData?.pluginData?.formTitle) {
                windowId = getFormWindowId(tempWindowData.pluginData.formTitle)
                logDebug(pluginJson, `onFormSubmitFromHTMLView: Updated windowId from WEBVIEW_WINDOW_ID formTitle: "${windowId}"`)
              } else {
                windowId = WEBVIEW_WINDOW_ID
                logDebug(pluginJson, `onFormSubmitFromHTMLView: Using WEBVIEW_WINDOW_ID as fallback: "${windowId}"`)
              }
            } catch (e2) {
              // Last resort: use the found ID or base ID
              windowId = findFormWindowId() || WEBVIEW_WINDOW_ID
              logDebug(pluginJson, `onFormSubmitFromHTMLView: Last resort windowId: "${windowId}"`)
            }
          }
        }
        logDebug(pluginJson, `onFormSubmitFromHTMLView: Final windowId for RESPONSE: "${windowId}", correlationId="${data.__correlationId}", success=${String(result.success)}`)
        // Send response back to React
        sendToHTMLWindow(windowId, 'RESPONSE', {
          correlationId: data.__correlationId,
          success: result.success,
          data: result.data,
          error: result.message,
        })
        logDebug(pluginJson, `onFormSubmitFromHTMLView: sendToHTMLWindow called with windowId="${windowId}"`)
        return {}
      } catch (error) {
        logError(pluginJson, `onFormSubmitFromHTMLView: Error handling REQUEST: ${error.message}`)
        // Get window ID - prioritize windowId from request (most reliable), then try lookup
        let windowId = data?.__windowId || findFormWindowId() || WEBVIEW_WINDOW_ID
        logDebug(pluginJson, `onFormSubmitFromHTMLView: Error handler - windowId from request: "${data?.__windowId || 'NOT PROVIDED'}", using: "${windowId}"`)
        try {
          // Try to get window data with the found ID
          const tempWindowData = await getGlobalSharedData(windowId)
          if (tempWindowData?.pluginData?.windowId) {
            windowId = tempWindowData.pluginData.windowId
          } else if (tempWindowData?.pluginData?.formTitle) {
            windowId = getFormWindowId(tempWindowData.pluginData.formTitle)
          }
        } catch (e) {
          // If that fails, try the base WEBVIEW_WINDOW_ID
          try {
            const tempWindowData = await getGlobalSharedData(WEBVIEW_WINDOW_ID)
            if (tempWindowData?.pluginData?.windowId) {
              windowId = tempWindowData.pluginData.windowId
            } else if (tempWindowData?.pluginData?.formTitle) {
              windowId = getFormWindowId(tempWindowData.pluginData.formTitle)
            } else {
              windowId = WEBVIEW_WINDOW_ID
            }
          } catch (e2) {
            // Last resort: use the found ID or base ID
            windowId = findFormWindowId() || WEBVIEW_WINDOW_ID
          }
        }
        sendToHTMLWindow(windowId, 'RESPONSE', {
          correlationId: data.__correlationId,
          success: false,
          data: null,
          error: error.message || 'Unknown error',
        })
        return {}
      }
    }

    // Window ID lookup: Use windowId from data if provided (most reliable), otherwise use fallback strategies
    let windowId = data?.windowId || ''
    let reactWindowData = null

    // If windowId was provided in data, use it directly
    if (windowId) {
      try {
        reactWindowData = await getGlobalSharedData(windowId)
        logDebug(pluginJson, `onFormSubmitFromHTMLView: Using windowId from data: ${windowId}`)
      } catch (e) {
        logDebug(pluginJson, `onFormSubmitFromHTMLView: Could not get window data with provided windowId: ${windowId}, falling back to search`)
        windowId = '' // Reset to trigger fallback
      }
    }

    // Fallback strategies if windowId not provided or lookup failed
    if (!windowId || !reactWindowData) {
      // Strategy 1: Try to find window by looking at all open windows (most reliable for dynamic IDs)
      windowId = findFormWindowId() || WEBVIEW_WINDOW_ID

      // Strategy 2: Try to get window data using the found/fallback window ID
      try {
        reactWindowData = await getGlobalSharedData(windowId)
        // If we got window data, use the windowId from it if available (most reliable)
        if (reactWindowData?.pluginData?.windowId) {
          windowId = reactWindowData.pluginData.windowId
          // Re-fetch with the correct window ID if different
          if (windowId !== WEBVIEW_WINDOW_ID) {
            try {
              reactWindowData = await getGlobalSharedData(windowId)
            } catch (e) {
              logDebug(pluginJson, `onFormSubmitFromHTMLView: Could not re-fetch with corrected windowId: ${windowId}`)
            }
          }
        } else if (reactWindowData?.pluginData?.formTitle) {
          // Reconstruct window ID from form title if we have it
          const reconstructedId = getFormWindowId(reactWindowData.pluginData.formTitle)
          if (reconstructedId !== windowId) {
            windowId = reconstructedId
            try {
              reactWindowData = await getGlobalSharedData(windowId)
            } catch (e) {
              logDebug(pluginJson, `onFormSubmitFromHTMLView: Could not fetch with reconstructed windowId: ${windowId}`)
            }
          }
        }
      } catch (e) {
        // Strategy 3: Fallback - try base WEBVIEW_WINDOW_ID for backward compatibility
        if (windowId !== WEBVIEW_WINDOW_ID) {
          try {
            const tempWindowData = await getGlobalSharedData(WEBVIEW_WINDOW_ID)
            if (tempWindowData?.pluginData?.windowId) {
              windowId = tempWindowData.pluginData.windowId
              reactWindowData = await getGlobalSharedData(windowId)
            } else if (tempWindowData) {
              // Use base ID window data if available
              windowId = WEBVIEW_WINDOW_ID
              reactWindowData = tempWindowData
            }
          } catch (e2) {
            logDebug(pluginJson, `onFormSubmitFromHTMLView: Could not get window data with base ID either`)
          }
        }
      }
    }

    let returnValue = null
    if (!reactWindowData) {
      logError(pluginJson, `onFormSubmitFromHTMLView: Could not get window data for windowId: ${windowId}`)
      return {}
    }
    // clo(reactWindowData, `Plugin onMessageFromHTMLView reactWindowData=`)
    if (data.passThroughVars && reactWindowData.passThroughVars) {
      reactWindowData.passThroughVars = { ...reactWindowData.passThroughVars, ...data.passThroughVars }
    } else if (data.passThroughVars) {
      reactWindowData.passThroughVars = { ...data.passThroughVars }
    }
    switch (actionType) {
      /* best practice here is not to actually do the processing but to call a function based on what the actionType was sent by React */
      /* you would probably call a different function for each actionType */
      case 'onSubmitClick':
        returnValue = await handleSubmitButtonClick(data, reactWindowData) //update the data to send it back to the React Window
        // Close the window after successful submission
        if (returnValue !== null) {
          closeWindowFromCustomId(windowId)
        }
        break
      default:
        await sendBannerMessage(windowId, `Plugin received an unknown actionType: "${actionType}" command with data:\n${JSON.stringify(data)}`, 'ERROR')
        break
    }
    if (returnValue && returnValue !== reactWindowData) {
      const updateText = `After ${actionType}, data was updated` /* this is just a string for debugging so you know what changed in the React Window */
      clo(reactWindowData, `Plugin onMessageFromHTMLView after updating window data,reactWindowData=`)
      sendToHTMLWindow(windowId, 'SET_DATA', reactWindowData, updateText) // note this will cause the React Window to re-render with the currentJSData
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
 * Insert TemplateJS blocks into templateBody based on executeTiming
 * @param {string} templateBody - The base template body
 * @param {Array<Object>} formFields - The form fields array (may contain templatejs-block fields)
 * @returns {string} - The templateBody with TemplateJS blocks inserted
 */
// Form submission handling functions are now imported from formSubmission.js

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
// openFormWindow is now imported from windowManagement.js

/**
 * Export testRequestHandlers for direct testing
 */
export { testRequestHandlers }
