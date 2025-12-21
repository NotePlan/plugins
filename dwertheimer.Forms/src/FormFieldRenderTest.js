// @flow
//--------------------------------------------------------------------------
// Form Field Render Test
// Opens a test form with examples of ALL field types from DynamicDialog
// This ensures all field types render correctly and helps catch regressions
// Field types are based on TSettingItemType in DynamicDialog.jsx
//--------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { openFormWindow } from './NPTemplateForm'
import { logInfo, logWarn, logError } from '@helpers/dev'
import { isHTMLWindowOpen, focusHTMLWindowIfAvailable } from '@helpers/NPWindows'
import { showMessage } from '@helpers/userInput'

const WEBVIEW_WINDOW_ID = `${pluginJson['plugin.id']} Form Entry React Window`

/**
 * Form Field Render Test
 * Opens a test form with examples of ALL field types from DynamicDialog
 * This ensures all field types render correctly and helps catch regressions
 * Field types are based on TSettingItemType in DynamicDialog.jsx
 * @returns {Promise<void>}
 */
export async function testFormFieldRender(): Promise<void> {
  try {
    logInfo(pluginJson, '🧪 Form Field Render Test...')
    logInfo(pluginJson, 'Opening test form with all DynamicDialog field types...')
    logInfo(pluginJson, 'This form includes examples of every field type to catch rendering issues')

    // All field types from DynamicDialog.jsx TSettingItemType
    // This list should match the type definition to ensure we test everything
    const testFormFields = [
      {
        type: 'heading',
        label: 'Form Field Render Test',
        description: 'This form tests all DynamicDialog field types to ensure they render correctly.',
      },
      {
        type: 'separator',
        label: 'Basic Input Fields',
      },
      {
        type: 'input',
        label: 'Text Input',
        key: 'testInput',
        placeholder: 'Enter text here',
        description: 'Standard text input field',
      },
      {
        type: 'input-readonly',
        label: 'Readonly Input',
        key: 'testInputReadonly',
        value: 'This is readonly',
        description: 'Read-only text input field',
      },
      {
        type: 'number',
        label: 'Number Input',
        key: 'testNumber',
        value: '42',
        step: 1,
        description: 'Number input with step increment',
      },
      {
        type: 'text',
        label: 'Text Display',
        textType: 'description',
        description: 'This is a text display field (not editable)',
      },
      {
        type: 'separator',
        label: 'Selection Fields',
      },
      {
        type: 'switch',
        label: 'Switch/Toggle',
        key: 'testSwitch',
        checked: false,
        description: 'Boolean switch/toggle field',
      },
      {
        type: 'dropdown-select',
        label: 'Dropdown Select (Searchable)',
        key: 'testDropdown',
        options: ['Option 1', 'Option 2', 'Option 3', 'Option 4', 'Option 5', 'Long Option Name That Might Be Truncated'],
        placeholder: 'Select an option',
        description: 'Searchable dropdown select field (now uses SearchableChooser)',
      },
      {
        type: 'separator',
        label: 'Chooser Fields',
      },
      {
        type: 'folder-chooser',
        label: 'Folder Chooser',
        key: 'testFolder',
        includeNewFolderOption: true,
        startFolder: 'Projects',
        description: 'Loads folders dynamically when form opens',
      },
      {
        type: 'note-chooser',
        label: 'Note Chooser',
        key: 'testNote',
        description: 'Loads notes dynamically when form opens',
      },
      {
        type: 'heading-chooser',
        label: 'Heading Chooser (Static)',
        key: 'testHeadingStatic',
        staticHeadings: ['Tasks', 'Projects', 'Archive', 'Done'],
        defaultHeading: 'Tasks',
        description: 'Static heading chooser with predefined headings',
      },
      {
        type: 'heading-chooser',
        label: 'Heading Chooser (Dynamic)',
        key: 'testHeadingDynamic',
        dependsOnNoteKey: 'testNote',
        defaultHeading: 'Tasks',
        optionAddTopAndBottom: true,
        includeArchive: false,
        description: 'Dynamic heading chooser that loads headings from the selected note above',
      },
      {
        type: 'separator',
        label: 'Date & Time',
      },
      {
        type: 'calendarpicker',
        label: 'Calendar Picker',
        key: 'testCalendar',
        selectedDate: new Date(),
        numberOfMonths: 1,
        description: 'Date picker calendar field',
      },
      {
        type: 'separator',
        label: 'Action Fields',
      },
      {
        type: 'button',
        label: 'Button',
        key: 'testButton',
        buttonText: 'Click Me',
        description: 'Action button field',
      },
      {
        type: 'button-group',
        label: 'Button Group',
        key: 'testButtonGroup',
        options: ['Option A', 'Option B', 'Option C'],
        description: 'Group of selectable buttons',
      },
      {
        type: 'separator',
        label: 'Advanced Fields',
      },
      {
        type: 'json',
        label: 'JSON Editor',
        key: 'testJson',
        value: '{ test: "data", number: 123 }',
        description: 'JSON editing field (uses JavaScript object notation, not JSON)',
      },
      {
        type: 'hidden',
        label: 'Hidden Field',
        key: 'testHidden',
        value: 'hidden-value',
        description: 'Hidden field (not visible but included in form data)',
      },
      // Note: 'orderingPanel' is not included as it's typically used in specific contexts
      // and may require special setup. Add it if needed for testing.
    ]

    const testArgObj = {
      title: '[TEST] Form Field Render Title',
      type: 'template-form',
      formFields: testFormFields,
      windowTitle: '[TEST] Field Render Window',
      formTitle: '[TEST] Field Render Form Title',
      allowEmptySubmit: true,
      hideDependentItems: false,
    }

    // Open the form window - openFormWindow will call createWindowInitData internally
    await openFormWindow(testArgObj)

    // Check if window is actually open
    const windowIsOpen = isHTMLWindowOpen(WEBVIEW_WINDOW_ID)
    if (windowIsOpen) {
      focusHTMLWindowIfAvailable(WEBVIEW_WINDOW_ID)
      logInfo(pluginJson, `✅ Test form opened! Window is open with customId: ${WEBVIEW_WINDOW_ID}`)
    } else {
      logWarn(pluginJson, `⚠️ Window may not be visible. Expected customId: ${WEBVIEW_WINDOW_ID}`)
      logWarn(pluginJson, `⚠️ Note: Window might still be initializing. Check NotePlan windows or try again.`)
    }
    logInfo(pluginJson, '📋 Form Field Render Test includes:')
    logInfo(pluginJson, '  • All DynamicDialog field types')
    logInfo(pluginJson, '  • Folder/note choosers load dynamically when form opens')
    logInfo(pluginJson, '  • Check Plugin Console for [DIAG] logs showing request/response timing')
  } catch (error) {
    logError(pluginJson, `❌ Error in testFormFieldRender: ${error.message}`)
    await showMessage(`Error in form field render test: ${error.message}`)
  }
}
