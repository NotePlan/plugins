// @flow

import pluginJson from '../plugin.json'
import { type PassedData } from './shared/types.js'
// Note: getAllNotesAsOptions is no longer used here - FormView loads notes dynamically via requestFromPlugin
import { testRequestHandlers, updateFormLinksInNote, removeEmptyLinesFromNote } from './requestHandlers'
import { loadTemplateBodyFromTemplate, loadTemplateRunnerArgsFromTemplate, getFormTemplateList } from './templateIO.js'
import { openFormWindow, openFormBuilderWindow, getFormBrowserWindowId } from './windowManagement.js'
import { log, logError, logDebug, logWarn, timer, clo, JSP, logInfo } from '@helpers/dev'
import { showMessage } from '@helpers/userInput'
import { waitForCondition } from '@helpers/promisePolyfill'
import NPTemplating from 'NPTemplating'
import { getNoteByFilename } from '@helpers/note'
import { validateObjectString, parseObjectString } from '@helpers/stringTransforms'
import { updateFrontMatterVars, ensureFrontmatter, noteHasFrontMatter, getFrontmatterAttributes } from '@helpers/NPFrontMatter'
import { loadCodeBlockFromNote } from '@helpers/codeBlocks'
import { generateCSSFromTheme } from '@helpers/NPThemeToCSS'
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
// Router functions are now in separate files and exported from index.js:
// - onFormBuilderAction is in formBuilderRouter.js
// - onFormBrowserAction is in formBrowserRouter.js
// - onFormSubmitFromHTMLView is in formSubmitRouter.js
// - saveFrontmatterToTemplate and handleSaveRequest are in formBuilderHandlers.js

/**
 * Save form fields to template as formfields code block
 * @param {string} templateFilename - The template filename
 * @param {Array<Object>} fields - The form fields array
 * @returns {Promise<void>}
 */
// Template I/O functions are now imported from templateIO.js

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
 * Open Form Browser window - browse and select template forms
 * @param {Object} argObj - Options object
 * @param {boolean} argObj.showFloating - If true, use showReactWindow instead of showInMainWindow
 * @returns {Promise<void>}
 */
export async function openFormBrowser(_showFloating: boolean = false): Promise<void> {
  try {
    logDebug(pluginJson, `openFormBrowser: Starting, showFloating=${String(_showFloating)}`)

    // Make sure we have np.Shared plugin which has the core react code
    await DataStore.installOrUpdatePluginsByID(['np.Shared'], false, false, true)
    logDebug(pluginJson, `openFormBrowser: installOrUpdatePluginsByID ['np.Shared'] completed`)

    const startTime = new Date()
    const ENV_MODE = 'development'
    const showFloating = _showFloating === true || (typeof _showFloating === 'string' && /true/i.test(_showFloating))

    // Create plugin data
    // Note: requestFromPlugin is now implemented in FormBrowserView using the dispatch pattern
    // (functions can't be serialized when passed through HTML/JSON)
    // Generate unique window ID based on whether it's floating or main window
    const windowId = showFloating ? getFormBrowserWindowId('floating') : getFormBrowserWindowId('main')
    const pluginData = {
      platform: NotePlan.environment.platform,
      windowId: windowId, // Store window ID in pluginData so React can send it in requests
      showFloating: showFloating, // Pass showFloating flag so React knows whether to show header
    }

    // Create data object to pass to React
    const dataToPass: PassedData = {
      pluginData,
      title: 'Form Browser',
      logProfilingMessage: false,
      debug: true, // Enable debug mode to show test buttons
      ENV_MODE,
      returnPluginCommand: { id: pluginJson['plugin.id'], command: 'onFormBrowserAction' },
      componentPath: `../dwertheimer.Forms/react.c.FormBrowserView.bundle.dev.js`,
      startTime,
    }

    // CSS tags for styling
    const cssTagsString = `
      <link rel="stylesheet" href="../np.Shared/css.w3.css">
      <link href="../np.Shared/fontawesome.css" rel="stylesheet">
      <link href="../np.Shared/regular.min.flat4NP.css" rel="stylesheet">
      <link href="../np.Shared/solid.min.flat4NP.css" rel="stylesheet">
      <link href="../np.Shared/light.min.flat4NP.css" rel="stylesheet">\n`

    // Use the same windowOptions for both floating and main window
    const windowOptions = {
      savedFilename: `../../${pluginJson['plugin.id']}/form_browser_output.html`,
      headerTags: cssTagsString,
      windowTitle: 'Form Browser',
      width: 1200,
      height: 800,
      customId: windowId, // Use unique window ID instead of constant
      shouldFocus: true,
      generalCSSIn: generateCSSFromTheme(),
      postBodyScript: `
        <script type="text/javascript" >
        // Set DataStore.settings so default logDebug etc. logging works in React
        let DataStore = { settings: {_logLevel: "${DataStore.settings._logLevel}" } };
        </script>
      `,
      // Options for showInMainWindow (main window mode)
      splitView: false,
      icon: 'list',
      iconColor: 'blue-500',
      autoTopPadding: true,
    }

    // Choose the appropriate command based on whether it's floating or main window
    const windowType = showFloating ? 'openReactWindow' : 'showInMainWindow'
    logDebug(pluginJson, `openFormBrowser: Using ${windowType} (${showFloating ? 'floating' : 'main'} window)`)
    await DataStore.invokePluginCommandByName(windowType, 'np.Shared', [dataToPass, windowOptions])

    logDebug(pluginJson, `openFormBrowser: Completed after ${timer(startTime)}`)
  } catch (error) {
    logError(pluginJson, `openFormBrowser: Error: ${JSP(error)}`)
    await showMessage(`Error opening form browser: ${error.message}`)
  }
}

/**
 * Export testRequestHandlers for direct testing
 */
export { testRequestHandlers }
