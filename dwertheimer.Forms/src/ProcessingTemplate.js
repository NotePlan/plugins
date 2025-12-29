// @flow
import pluginJson from '../plugin.json'
import { logDebug, logError, JSP, clo } from '@helpers/dev'
import { showMessage } from '@helpers/userInput'
import NPTemplating from 'NPTemplating'
import { getNoteByFilename } from '@helpers/note'
import { ensureFrontmatter } from '@helpers/NPFrontMatter'
import { getFolderFromFilename } from '@helpers/folders'

export const varsInForm = `# Variables in your form:`
export const varsCodeBlockType = 'template:ignore form variables'
export const templateBodyCodeBlockType = 'template:ignore templateBody'
export const templateRunnerArgsCodeBlockType = 'template:ignore templateRunnerArgs'
export const templateJSCodeBlockType = 'template:ignore templateJS'

/**
 * Create a form processing template (standalone command or called from Form Builder)
 * Allows users to create a processing template separately from the Form Builder flow
 * @param {Object} options - Optional parameters for integration with Form Builder
 * @param {string} options.formTemplateTitle - Pre-filled form template title (when called from Form Builder)
 * @param {string} options.formTemplateFilename - Pre-filled form template filename (when called from Form Builder)
 * @param {string} options.suggestedProcessingTitle - Pre-filled suggested processing template title
 * @param {string} options.formLaunchLink - The form's launch link x-callback URL to add to processing template frontmatter
 * @param {string} options.formEditLink - The form's edit link x-callback URL to add to processing template frontmatter
 * @returns {Promise<{processingTitle?: string, processingFilename?: string}>}
 */
export async function createProcessingTemplate(options?: {
  formTemplateTitle?: string,
  formTemplateFilename?: string,
  suggestedProcessingTitle?: string,
  formLaunchLink?: string,
  formEditLink?: string,
}): Promise<{ processingTitle?: string, processingFilename?: string }> {
  try {
    logDebug(pluginJson, `createProcessingTemplate: Starting with options: ${JSP(options || {})}`)

    let formTemplateTitle = options?.formTemplateTitle || ''
    let formTemplateFilename = options?.formTemplateFilename || ''
    let suggestedProcessingTitle = options?.suggestedProcessingTitle || ''
    
    // Generate default suggested title based on form template title if not provided
    if (!suggestedProcessingTitle && formTemplateTitle) {
      // Remove "Form" from the end if present, then add "Processing Template"
      const baseTitle = formTemplateTitle.replace(/\s+Form\s*$/i, '').trim()
      suggestedProcessingTitle = `${baseTitle} Processing Template`
      logDebug(pluginJson, `createProcessingTemplate: Generated suggested title "${suggestedProcessingTitle}" from form template "${formTemplateTitle}"`)
    }

    // If called from Form Builder (with pre-filled options), skip the initial prompts
    if (!formTemplateTitle && !formTemplateFilename) {
      // Ask user if they want to create for an existing form or standalone
      const createOption = await CommandBar.showOptions(
        ['For an existing form template', 'Standalone (no form created yet)'],
        'Create Processing Template',
        'How would you like to create this processing template?',
      )

      if (createOption?.value === 'For an existing form template' || createOption?.index === 0) {
        // Get the form template
        formTemplateFilename = await NPTemplating.chooseTemplate('template-form')
        if (!formTemplateFilename) {
          logDebug(pluginJson, `createProcessingTemplate: User cancelled template selection`)
          return { processingTitle: undefined, processingFilename: undefined }
        }

        const formTemplateNote = await getNoteByFilename(formTemplateFilename)
        if (formTemplateNote) {
          formTemplateTitle = formTemplateNote.title || ''
          suggestedProcessingTitle = `${formTemplateTitle} Processing Template`
          logDebug(pluginJson, `createProcessingTemplate: Selected form template "${formTemplateTitle}"`)
        }
      }
    }

    // Ask for the processing template title (always prompt, but use suggestedProcessingTitle as default)
    const processingTitle = await CommandBar.textPrompt(
      'Processing Template',
      'Enter processing template title:',
      suggestedProcessingTitle || '',
    )

    if (!processingTitle || typeof processingTitle === 'boolean') {
      logDebug(pluginJson, `createProcessingTemplate: User cancelled or empty title`)
      return { processingTitle: undefined, processingFilename: undefined }
    }

    // Determine folder path - use the same folder as the form template if provided
    let folderPath = '@Forms'
    if (formTemplateFilename) {
      // Extract folder from the form template filename
      const formFolder = getFolderFromFilename(formTemplateFilename)
      if (formFolder && formFolder !== '/') {
        folderPath = formFolder
        logDebug(pluginJson, `createProcessingTemplate: Using form template folder "${folderPath}"`)
      } else {
        logDebug(pluginJson, `createProcessingTemplate: Form template is in root, using default folder "@Forms"`)
      }
    }

    // Check if template already exists
    const templateList = await NPTemplating.getTemplateList('forms-processor')
    const existingTemplate = templateList.find((t) => t.label === processingTitle)
    if (existingTemplate) {
      const overwrite = await CommandBar.showOptions(
        ['Yes, overwrite', 'No, cancel'],
        'Processing Template Exists',
        `A processing template named "${processingTitle}" already exists. Overwrite it?`,
      )
      if (overwrite?.value !== 'Yes, overwrite' && overwrite?.index !== 0) {
        logDebug(pluginJson, `createProcessingTemplate: User chose not to overwrite`)
        return { processingTitle: undefined, processingFilename: undefined }
      }
    }

    // Create the processing template
    logDebug(pluginJson, `createProcessingTemplate: Creating note "${processingTitle}" in folder "${folderPath}"`)
    const filename = DataStore.newNote(processingTitle, folderPath)

    if (!filename) {
      logError(pluginJson, `createProcessingTemplate: Failed to create template "${processingTitle}"`)
      await showMessage(`Failed to create processing template "${processingTitle}"`)
      return { processingTitle: undefined, processingFilename: undefined }
    }

    const processingNote = await getNoteByFilename(filename)
    if (!processingNote) {
      logError(pluginJson, `createProcessingTemplate: Could not open newly created template`)
      await showMessage(`Failed to open newly created template "${processingTitle}"`)
      return { processingTitle: undefined, processingFilename: undefined }
    }

    // Ask about note creation/writing destination
    const noteDestination = await CommandBar.showOptions(
      ['Create a new note', 'Write to an existing note', 'Skip for now (manual setup)'],
      'Processing Template Setup',
      'Where should the form data be written?',
    )

    // Build frontmatter vars object - always include title and type
    const frontmatterVars: { [string]: any } = {
      title: processingTitle,
      type: 'forms-processor',
    }

    // Add form links to frontmatter if provided (must be done early, before other frontmatter vars)
    if (options?.formLaunchLink) {
      frontmatterVars.formLaunchLink = options.formLaunchLink
      logDebug(pluginJson, `createProcessingTemplate: Added formLaunchLink to processing template frontmatter`)
    }
    if (options?.formEditLink) {
      frontmatterVars.formEditLink = options.formEditLink
      logDebug(pluginJson, `createProcessingTemplate: Added formEditLink to processing template frontmatter`)
    }

    if (noteDestination?.value === 'Create a new note' || noteDestination?.index === 0) {
      // Create new note - ask for title
      const newNoteTitleValue = await CommandBar.textPrompt('New Note Title', 'Enter the title for the new note (use <%- fieldName %> for form data):', '<%- noteTitle %>')
      if (newNoteTitleValue && typeof newNoteTitleValue !== 'boolean') {
        frontmatterVars.newNoteTitle = newNoteTitleValue

        // Ask for folder
        const folderValue = await CommandBar.textPrompt(
          'Note Folder',
          'Enter folder path for the new note (leave empty for root, use <select> to be prompted each time for the folder):',
          '<select>',
        )
        if (folderValue && typeof folderValue !== 'boolean') {
          frontmatterVars.folder = folderValue
        }
      }
    } else if (noteDestination?.value === 'Write to an existing note' || noteDestination?.index === 1) {
      // Write to existing note - ask for note title
      const noteTitleValue = await CommandBar.textPrompt(
        'Target Note',
        'Enter note title (<today>, <current>, <choose>, or specific title - use <%- fieldName %> for form data):',
        '<today>',
      )
      if (noteTitleValue && typeof noteTitleValue !== 'boolean') {
        frontmatterVars.writeNoteTitle = noteTitleValue
      }
    }

    // Ask about write location (if not skipping)
    if (noteDestination?.index !== 2) {
      const writeLocation = await CommandBar.showOptions(
        ['Append to note', 'Prepend to note', 'Replace note contents', 'Write under heading'],
        'Write Location',
        'Where should the form content be written?',
      )
      if (writeLocation?.value === 'Append to note' || writeLocation?.index === 0) {
        frontmatterVars.location = 'append'
      } else if (writeLocation?.value === 'Prepend to note' || writeLocation?.index === 1) {
        frontmatterVars.location = 'prepend'
      } else if (writeLocation?.value === 'Replace note contents' || writeLocation?.index === 2) {
        frontmatterVars.replaceNoteContents = true
      } else if (writeLocation?.value === 'Write under heading' || writeLocation?.index === 3) {
        frontmatterVars.location = 'append'
        const headingValue = await CommandBar.textPrompt('Heading Name', 'Enter the heading name (use <choose> for interactive selection):', 'Form Results')
        if (headingValue && typeof headingValue !== 'boolean') {
          frontmatterVars.writeUnderHeading = headingValue
          frontmatterVars.createMissingHeading = true
        }
      }
    }

    // Ensure frontmatter exists before updating (this sets the title in frontmatter)
    ensureFrontmatter(processingNote, true, processingTitle)

    // Convert frontmatterVars object to array format for updateFrontmatterAttributes API
    // Note: title is already set by ensureFrontmatter, but we include it here to ensure it's correct
    const frontmatterAttributes = Object.keys(frontmatterVars).map((key) => ({
      key,
      value: String(frontmatterVars[key]),
    }))
    logDebug(
      pluginJson,
      `createProcessingTemplate: About to set frontmatter with ${frontmatterAttributes.length} attributes: ${frontmatterAttributes
        .map((a) => `${a.key}=${a.value.substring(0, 50)}`)
        .join(', ')}`,
    )

    // Set frontmatter using native NotePlan API
    // Note: updateFrontmatterAttributes should update all attributes including title
    try {
      processingNote.updateFrontmatterAttributes(frontmatterAttributes)
      logDebug(pluginJson, `createProcessingTemplate: Successfully set frontmatter for processing template "${processingTitle}"`)
    } catch (error) {
      logError(pluginJson, `createProcessingTemplate: Failed to update frontmatter for processing template "${processingTitle}": ${JSP(error)}`)
      await showMessage(`Warning: Created processing template but failed to set frontmatter. You may need to add it manually.`)
    }

    // Add basic template content with field variable examples
    let basicContent = `\`\`\`template:ignore
## Content from forms will be processed by this template
NOTE: template:ignore code blocks like this one will be ignored in the template output but all other content in this template (including the blank lines) will be included in the output!

### Add your form field variables in the template body using the format:

Example (these variables may or may not be in your particular form):
Project: <%- noteTitle %>
Team: <%- team %>
Status: <%- status %>
(assuming your form has fields with keys "noteTitle", "team", and "status")

## OTHER NOTES:
`
    // Add note-specific instructions based on what was configured
    if (frontmatterVars.newNoteTitle) {
      basicContent += `\nNote: This template will create a new note with title: "${frontmatterVars.newNoteTitle}"\n`
    }
    if (frontmatterVars.folder) {
      basicContent += `Folder: ${frontmatterVars.folder} (use <select> to be prompted each time for the folder, change in frontmatter if you want to use a different folder)\n`
    }
    if (frontmatterVars.writeNoteTitle) {
      basicContent += `\nNote: This template will write to: "${frontmatterVars.writeNoteTitle}"\n`
    }
    if (frontmatterVars.writeUnderHeading) {
      basicContent += `Heading: ${frontmatterVars.writeUnderHeading}\n`
    }
    if (frontmatterVars.location) {
      basicContent += `Location: ${frontmatterVars.location} (append, prepend, replace, write under heading)\n`
    }
    basicContent += `\n\`\`\`\n`
    basicContent += `\`\`\`${varsCodeBlockType}\n`
    basicContent += `${varsInForm}\n\`\`\`\n`

    processingNote.appendParagraph(basicContent, 'text')
    const emptyParagraph = processingNote.paragraphs.find((p) => p.type === 'empty')
    if (emptyParagraph) processingNote.removeParagraph(emptyParagraph)

    // Note: Form template frontmatter is updated by the caller (NPTemplateForm.js), so we don't update it here
    // to avoid duplicate receivingTemplateTitle entries
    // Only show message and open note if called standalone (not from Form Builder)
    // When called from Form Builder, the React UI will handle the update
    if (!formTemplateFilename) {
      if (formTemplateTitle) {
        await showMessage(`Created processing template "${processingTitle}" and linked it to form template "${formTemplateTitle}"`)
      } else {
        await showMessage(`Created processing template "${processingTitle}"`)
      }
      // Open the note in the Editor when called standalone
      await Editor.openNoteByFilename(filename)
    }

    logDebug(pluginJson, `createProcessingTemplate: Successfully created processing template "${processingTitle}"`)

    return { processingTitle, processingFilename: filename }
  } catch (error) {
    logError(pluginJson, `createProcessingTemplate error: ${JSP(error)}`)
    await showMessage(`Error creating processing template: ${error.message}`)
    return { processingTitle: undefined, processingFilename: undefined }
  }
}
