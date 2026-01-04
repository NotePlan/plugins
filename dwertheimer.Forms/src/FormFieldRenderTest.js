// @flow
//--------------------------------------------------------------------------
// Form Field Render Test
// Opens a test form with examples of ALL field types from DynamicDialog
// This ensures all field types render correctly and helps catch regressions
// Field types are based on TSettingItemType in DynamicDialog.jsx
//--------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { openFormWindow, WEBVIEW_WINDOW_ID } from './windowManagement.js'
import { logInfo, logWarn, logError } from '@helpers/dev'
import { isHTMLWindowOpen, focusHTMLWindowIfAvailable } from '@helpers/NPWindows'
import { showMessage } from '@helpers/userInput'

/**
 * Form Field Render Test
 * Opens a test form with examples of ALL field types from DynamicDialog
 * This ensures all field types render correctly and helps catch regressions
 * Field types are based on TSettingItemType in DynamicDialog.jsx
 * @returns {Promise<void>}
 */
export async function testFormFieldRender(): Promise<void> {
  try {
    logInfo(pluginJson, '📚 Form Field Examples...')
    logInfo(pluginJson, 'Opening form with examples of all DynamicDialog field types and configuration options...')
    logInfo(pluginJson, 'This form demonstrates various field types and their settings')

    // All field types from DynamicDialog.jsx TSettingItemType
    // This list should match the type definition to ensure we test everything
    const testFormFields = [
      {
        type: 'heading',
        label: 'Form Field Examples',
        description:
          'This form demonstrates all available field types and their configuration options in DynamicDialog. Use these examples to see how different settings affect field appearance and behavior.',
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
        type: 'input',
        label: 'Text Input (With Default Value)',
        key: 'testInputDefault',
        placeholder: 'Enter text here',
        default: 'Default value',
        description: 'Text input with a pre-filled default value',
      },
      {
        type: 'input',
        label: 'Text Input (Compact Display)',
        key: 'testInputCompact',
        placeholder: 'Enter text here',
        compactDisplay: true,
        description: 'Text input in compact mode - label and field side by side',
      },
      {
        type: 'input',
        label: 'Text Input (Auto-Focus)',
        key: 'testInputFocus',
        placeholder: 'This field receives focus when form opens',
        focus: true,
        description: 'Text input that automatically receives focus when the form opens',
      },
      {
        type: 'input',
        label: 'Required Input',
        key: 'testInputRequired',
        placeholder: 'This field is required',
        required: true,
        description: 'This field must be filled out (required validation)',
      },
      {
        type: 'input',
        label: 'Email Input (Validated)',
        key: 'testInputEmail',
        placeholder: 'user@example.com',
        validationType: 'email',
        description: 'This field validates email format',
      },
      {
        type: 'input',
        label: 'Number Input (Validated)',
        key: 'testInputNumber',
        placeholder: 'Enter a number',
        validationType: 'number',
        description: 'This field validates that input is a number',
      },
      {
        type: 'input',
        label: 'Date Interval (Validated)',
        key: 'testInputDateInterval',
        placeholder: 'e.g., 7d, 2w, 1m',
        validationType: 'date-interval',
        description: 'This field validates date interval format (nn[bdwmqy])',
      },
      {
        type: 'input-readonly',
        label: 'Readonly Input',
        key: 'testInputReadonly',
        value: 'This is readonly',
        description: 'Read-only text input field',
      },
      {
        type: 'textarea',
        label: 'Expandable Textarea',
        key: 'testTextarea',
        placeholder: 'Type here and watch it expand...',
        minRows: 3,
        maxRows: 10,
        description: 'Multi-line text field that automatically expands as you type. Starts at 3 rows, expands up to 10 rows, then scrolls.',
      },
      {
        type: 'textarea',
        label: 'Expandable Textarea (Large)',
        key: 'testTextareaLarge',
        placeholder: 'This one starts larger and can expand more...',
        minRows: 5,
        maxRows: 15,
        description: 'Larger textarea starting at 5 rows, expanding up to 15 rows',
      },
      {
        type: 'textarea',
        label: 'Expandable Textarea (Small)',
        key: 'testTextareaSmall',
        placeholder: 'Small textarea...',
        minRows: 1,
        maxRows: 5,
        description: 'Small textarea starting at 1 row, expanding up to 5 rows',
      },
      {
        type: 'textarea',
        label: 'Expandable Textarea (Compact)',
        key: 'testTextareaCompact',
        placeholder: 'Compact textarea...',
        minRows: 2,
        maxRows: 8,
        compactDisplay: true,
        description: 'Textarea in compact mode - label and field side by side',
      },
      {
        type: 'number',
        label: 'Number Input',
        key: 'testNumber',
        value: '42',
        step: 1,
        description: 'Number input with step increment of 1',
      },
      {
        type: 'number',
        label: 'Number Input (Step: 5)',
        key: 'testNumberStep5',
        value: '10',
        step: 5,
        description: 'Number input with step increment of 5 - increments/decrements by 5',
      },
      {
        type: 'number',
        label: 'Number Input (Step: 0.1)',
        key: 'testNumberStepDecimal',
        value: '1.5',
        step: 0.1,
        description: 'Number input with decimal step increment of 0.1',
      },
      {
        type: 'text',
        label: 'Text Display (Description)',
        textType: 'description',
        description: 'This is a text display field with textType="description" (not editable)',
      },
      {
        type: 'text',
        label: 'Text Display (Title)',
        textType: 'title',
        description: 'This is a text display field with textType="title" (not editable)',
      },
      {
        type: 'text',
        label: 'Text Display (Separator)',
        textType: 'separator',
        description: 'This is a text display field with textType="separator" (not editable)',
      },
      {
        type: 'separator',
        label: 'Selection Fields',
      },
      {
        type: 'switch',
        label: 'Switch/Toggle (Off)',
        key: 'testSwitch',
        checked: false,
        description: 'Boolean switch/toggle field in the "off" state',
      },
      {
        type: 'switch',
        label: 'Switch/Toggle (On)',
        key: 'testSwitchOn',
        checked: true,
        description: 'Boolean switch/toggle field in the "on" state',
      },
      {
        type: 'switch',
        label: 'Switch (Compact Display)',
        key: 'testSwitchCompact',
        checked: false,
        compactDisplay: true,
        description: 'Switch in compact mode - label and switch side by side',
      },
      {
        type: 'dropdown-select',
        label: 'Dropdown Select (Searchable)',
        key: 'testDropdown',
        options: ['Option 1', 'Option 2', 'Option 3', 'Option 4', 'Option 5', 'Long Option Name That Might Be Truncated'],
        placeholder: 'Select an option',
        showValue: true, // Show the selected value for debugging
        description: 'Searchable dropdown select field (now uses SearchableChooser)',
      },
      {
        type: 'dropdown-select',
        label: 'Dropdown Select (Editable)',
        key: 'testDropdownEditable',
        options: ['Option A', 'Option B', 'Option C'],
        placeholder: 'Select or type a value',
        isEditable: true,
        showValue: true,
        description: 'Editable dropdown - allows typing a custom value not in the options list',
      },
      {
        type: 'separator',
        label: 'Chooser Fields',
      },
      {
        type: 'space-chooser',
        label: 'Space Chooser',
        key: 'testSpace',
        showValue: true, // Show the selected value for debugging
        description: 'Select a Space (Private or Teamspace). This is used to filter folders below.',
      },
      {
        type: 'separator',
        label: 'Custom Width Examples',
      },
      {
        type: 'folder-chooser',
        label: 'Folder Chooser',
        key: 'testFolderCompact30vw',
        compactDisplay: true,
        width: '30vw',
        showValue: true,
        description: 'Compact display with field custom width of 30vw. Width overrides default even in compact mode.',
      },
      {
        type: 'note-chooser',
        label: 'Note Chooser (Non-Compact, Custom Width: 79%)',
        key: 'testNote79Percent',
        compactDisplay: false,
        width: '79%',
        showValue: true,
        description: 'Non-compact display with custom width of 79%. Width applies to the input field.',
      },
      {
        type: 'dropdown-select',
        label: 'Dropdown',
        key: 'testDropdown300px',
        compactDisplay: true,
        width: '300px',
        options: ['Option 1', 'Option 2', 'Option 3', 'Option 4', 'Option 5'],
        showValue: true,
        description: 'Compact display with custom width of 300px. Width overrides default even in compact mode.',
      },
      {
        type: 'space-chooser',
        label: 'Space Chooser (Non-Compact, Custom Width: calc(100% - 140px))',
        key: 'testSpaceCalc',
        compactDisplay: false,
        width: 'calc(100% - 140px)',
        showValue: true,
        description: 'Non-compact display with custom width using calc(). Demonstrates advanced CSS width values.',
      },
      {
        type: 'space-chooser',
        label: 'Space Chooser (With All Option)',
        key: 'testSpaceWithAll',
        includeAllOption: true,
        showValue: true,
        description: 'Space chooser with "All Private + Spaces" option that returns "__all__"',
      },
      {
        type: 'folder-chooser',
        label: 'Folder Chooser',
        key: 'testFolder',
        includeNewFolderOption: true,
        startFolder: 'Projects',
        showValue: true, // Show the selected value for debugging
        description: 'Loads folders dynamically when form opens',
      },
      {
        type: 'folder-chooser',
        label: 'Folder Chooser (With Archive)',
        key: 'testFolderWithArchive',
        includeArchive: true,
        showValue: true,
        description: 'Folder chooser that includes the Archive folder in the list',
      },
      {
        type: 'folder-chooser',
        label: 'Folder Chooser (With Folder Path)',
        key: 'testFolderWithPath',
        includeFolderPath: true,
        showValue: true,
        description: 'Folder chooser that shows the full folder path, not just the folder name',
      },
      {
        type: 'folder-chooser',
        label: 'Folder Chooser (Exclude Teamspaces)',
        key: 'testFolderNoTeamspaces',
        excludeTeamspaces: true,
        showValue: true,
        description: 'Folder chooser that excludes teamspace folders, showing only Private folders',
      },
      {
        type: 'folder-chooser',
        label: 'Folder Chooser (Start in Specific Folder)',
        key: 'testFolderStartFolder',
        startFolder: 'Projects',
        showValue: true,
        description: 'Folder chooser that starts in a specific folder (e.g., "Projects")',
      },
      {
        type: 'separator',
        label: 'Folder Chooser with Space Dependency',
      },
      {
        type: 'space-chooser',
        label: 'Space Chooser (for Folder Dependency)',
        key: 'testSpaceForFolder',
        showValue: true,
        description: 'Select a space to filter folders in the chooser below',
      },
      {
        type: 'folder-chooser',
        label: 'Folder Chooser (Depends on Space)',
        key: 'testFolderDependsOnSpace',
        sourceSpaceKey: 'testSpaceForFolder',
        includeNewFolderOption: true,
        showValue: true,
        description: 'This folder chooser filters folders by the space selected above. Select a space first, then this will show only folders from that space.',
      },
      {
        type: 'note-chooser',
        label: 'Note Chooser (Default)',
        key: 'testNote',
        showValue: true, // Show the selected value for debugging
        description: 'Default: Personal notes + Teamspace notes (no calendar, no relative)',
      },
      {
        type: 'note-chooser',
        label: 'Note Chooser (Personal + Calendar)',
        key: 'testNotePersonalCalendar',
        includePersonalNotes: true,
        includeCalendarNotes: true,
        includeRelativeNotes: false,
        includeTeamspaceNotes: true,
        description: 'Personal notes + Calendar notes + Teamspace notes',
      },
      {
        type: 'note-chooser',
        label: 'Note Chooser (Personal + Relative)',
        key: 'testNotePersonalRelative',
        includePersonalNotes: true,
        includeCalendarNotes: false,
        includeRelativeNotes: true,
        includeTeamspaceNotes: true,
        description: 'Personal notes + Relative notes (<today>, <thisweek>, etc.) + Teamspace notes',
      },
      {
        type: 'note-chooser',
        label: 'Note Chooser (Personal + Calendar + Relative)',
        key: 'testNoteAllTypes',
        includePersonalNotes: true,
        includeCalendarNotes: true,
        includeRelativeNotes: true,
        includeTeamspaceNotes: true,
        description: 'All note types enabled: Personal + Calendar + Relative + Teamspace',
      },
      {
        type: 'note-chooser',
        label: 'Note Chooser (Personal Only, No Teamspace)',
        key: 'testNotePersonalOnly',
        includePersonalNotes: true,
        includeCalendarNotes: false,
        includeRelativeNotes: false,
        includeTeamspaceNotes: false,
        description: 'Personal notes only (no calendar, no relative, no teamspace)',
      },
      {
        type: 'note-chooser',
        label: 'Note Chooser (Title Only)',
        key: 'testNoteTitleOnly',
        includePersonalNotes: true,
        includeCalendarNotes: false,
        includeRelativeNotes: false,
        includeTeamspaceNotes: true,
        showTitleOnly: true,
        showValue: true,
        description: 'Note chooser that shows only the note title (not "path / title")',
      },
      {
        type: 'note-chooser',
        label: 'Note Chooser (Calendar Only)',
        key: 'testNoteCalendarOnly',
        includePersonalNotes: false,
        includeCalendarNotes: true,
        includeRelativeNotes: false,
        includeTeamspaceNotes: true,
        description: 'Calendar notes only + Teamspace calendar notes',
      },
      {
        type: 'note-chooser',
        label: 'Note Chooser (Relative Only)',
        key: 'testNoteRelativeOnly',
        includePersonalNotes: false,
        includeCalendarNotes: false,
        includeRelativeNotes: true,
        includeTeamspaceNotes: false,
        description: 'Relative notes only (<today>, <thisweek>, <current>, <choose>, etc.)',
      },
      {
        type: 'note-chooser',
        label: 'Note Chooser (All Enabled)',
        key: 'testNoteAllEnabled',
        includePersonalNotes: true,
        includeCalendarNotes: true,
        includeRelativeNotes: true,
        includeTeamspaceNotes: true,
        description: 'All options enabled: Personal + Calendar + Relative + Teamspace (comprehensive test)',
      },
      {
        type: 'separator',
        label: 'Note Chooser with Folder Dependency',
      },
      {
        type: 'folder-chooser',
        label: 'Folder Chooser (for Note Dependency)',
        key: 'testFolderForNote',
        includeNewFolderOption: true,
        showValue: true,
        description: 'Select a folder to filter notes in the chooser below',
      },
      {
        type: 'note-chooser',
        label: 'Note Chooser (Depends on Folder)',
        key: 'testNoteDependsOnFolder',
        sourceFolderKey: 'testFolderForNote',
        includePersonalNotes: true,
        includeCalendarNotes: false,
        includeRelativeNotes: false,
        includeTeamspaceNotes: true,
        showValue: true,
        description: 'This note chooser filters notes by the folder selected above. Select a folder first, then this will show only notes in that folder.',
      },
      {
        type: 'separator',
        label: 'Note Chooser with Creation',
      },
      {
        type: 'note-chooser',
        label: 'Note Chooser (With New Note Option)',
        key: 'testNoteWithNewOption',
        includeNewNoteOption: true,
        includePersonalNotes: true,
        includeCalendarNotes: false,
        includeRelativeNotes: false,
        includeTeamspaceNotes: true,
        showValue: true,
        description: 'This note chooser includes a "➕ New Note" option at the top of the dropdown. Click it to create a new note.',
      },
      {
        type: 'separator',
        label: 'Note Chooser: Folder Dependency + Creation',
      },
      {
        type: 'folder-chooser',
        label: 'Folder Chooser (for Note Dependency + Creation)',
        key: 'testFolderForCreate',
        includeNewFolderOption: true,
        showValue: true,
        description: 'Select a folder to filter and create notes in the chooser below',
      },
      {
        type: 'note-chooser',
        label: 'Note Chooser (Depends on Folder + Can Create)',
        key: 'testNoteDependsOnFolderWithCreate',
        sourceFolderKey: 'testFolderForCreate',
        includeNewNoteOption: true,
        includePersonalNotes: true,
        includeCalendarNotes: false,
        includeRelativeNotes: false,
        includeTeamspaceNotes: true,
        showValue: true,
        description:
          'This note chooser filters by folder AND allows creating new notes in that folder. Select a folder above, then click "➕ New Note" in the dropdown to create a note in that folder.',
      },
      {
        type: 'heading-chooser',
        label: 'Heading Chooser (Static)',
        key: 'testHeadingStatic',
        staticHeadings: ['Tasks', 'Projects', 'Archive', 'Done'],
        defaultHeading: 'Tasks',
        showValue: true, // Show the selected value for debugging
        description: 'Static heading chooser with predefined headings',
      },
      {
        type: 'heading-chooser',
        label: 'Heading Chooser (Static, No Top/Bottom)',
        key: 'testHeadingStaticNoTopBottom',
        staticHeadings: ['Section 1', 'Section 2', 'Section 3'],
        defaultHeading: 'Section 1',
        optionAddTopAndBottom: false,
        showValue: true,
        description: 'Static heading chooser without "top of note" and "bottom of note" options',
      },
      {
        type: 'heading-chooser',
        label: 'Heading Chooser (Static, With Archive)',
        key: 'testHeadingStaticWithArchive',
        staticHeadings: ['Main', 'Archive'],
        defaultHeading: 'Main',
        includeArchive: true,
        showValue: true,
        description: 'Static heading chooser that includes headings in Archive section',
      },
      {
        type: 'heading-chooser',
        label: 'Heading Chooser (Dynamic)',
        key: 'testHeadingDynamic',
        sourceNoteKey: 'testNote',
        defaultHeading: 'Tasks',
        optionAddTopAndBottom: true,
        showValue: true, // Show the selected value for debugging
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
        type: 'calendarpicker',
        label: 'Calendar Picker (Multiple Months)',
        key: 'testCalendarMultiMonth',
        selectedDate: new Date(),
        numberOfMonths: 3,
        size: 0.8,
        description: 'Date picker showing 3 months at a time, scaled to 80%',
      },
      {
        type: 'calendarpicker',
        label: 'Calendar Picker (With Button Text)',
        key: 'testCalendarButton',
        selectedDate: new Date(),
        numberOfMonths: 1,
        buttonText: 'Choose Date',
        description: 'Date picker with custom button text',
      },
      {
        type: 'calendarpicker',
        label: 'Calendar Picker (Visible by Default)',
        key: 'testCalendarVisible',
        selectedDate: new Date(),
        numberOfMonths: 1,
        visible: true,
        description: 'Date picker that shows the calendar immediately (no button click needed)',
      },
      {
        type: 'separator',
        label: 'Event Chooser',
      },
      {
        type: 'event-chooser',
        label: 'Event Chooser (Today)',
        key: 'testEventToday',
        eventDate: new Date(),
        showValue: true,
        description: "Event chooser for today's date (default)",
      },
      {
        type: 'event-chooser',
        label: 'Event Chooser (With Filters)',
        key: 'testEventFiltered',
        eventDate: new Date(),
        allCalendars: true,
        includeReminders: true,
        showValue: true,
        description: 'Event chooser with all calendars and reminders enabled',
      },
      {
        type: 'event-chooser',
        label: 'Event Chooser (Specific Calendars)',
        key: 'testEventSpecificCalendars',
        eventDate: new Date(),
        allCalendars: false,
        selectedCalendars: ['Work', 'Personal'],
        showValue: true,
        description: 'Event chooser filtered to show only events from specific calendars',
      },
      {
        type: 'event-chooser',
        label: 'Event Chooser (Reminders Only)',
        key: 'testEventRemindersOnly',
        eventDate: new Date(),
        allCalendars: false,
        includeReminders: true,
        showValue: true,
        description: 'Event chooser showing only reminders (no calendar events)',
      },
      {
        type: 'separator',
        label: 'Event Chooser with Date Dependency',
      },
      {
        type: 'calendarpicker',
        label: 'Date Picker (for Event Dependency)',
        key: 'testDateForEvent',
        selectedDate: new Date(),
        numberOfMonths: 1,
        description: 'Select a date to load events for that date in the chooser below',
      },
      {
        type: 'event-chooser',
        label: 'Event Chooser (Depends on Date)',
        key: 'testEventDependsOnDate',
        sourceDateKey: 'testDateForEvent',
        allCalendars: true,
        showValue: true,
        description: 'This event chooser loads events for the date selected above. Change the date to see different events.',
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
        type: 'button',
        label: 'Button (Default)',
        key: 'testButtonDefault',
        buttonText: 'Default Button',
        isDefault: true,
        description: 'Button marked as default (typically styled differently)',
      },
      {
        type: 'button-group',
        label: 'Button Group (Horizontal)',
        key: 'testButtonGroup',
        options: ['Option A', 'Option B', 'Option C'],
        description: 'Group of selectable buttons arranged horizontally',
      },
      {
        type: 'button-group',
        label: 'Button Group (Vertical)',
        key: 'testButtonGroupVertical',
        options: ['Option 1', 'Option 2', 'Option 3'],
        vertical: true,
        description: 'Group of selectable buttons arranged vertically',
      },
      {
        type: 'button-group',
        label: 'Button Group (With Default)',
        key: 'testButtonGroupWithDefault',
        options: [
          { label: 'Low', value: 'low' },
          { label: 'Medium', value: 'medium', isDefault: true },
          { label: 'High', value: 'high' },
        ],
        description: 'Button group with one option marked as default',
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
        type: 'json',
        label: 'JSON Editor (Complex Object)',
        key: 'testJsonComplex',
        value: '{ name: "Example", items: [1, 2, 3], nested: { key: "value" } }',
        description: 'JSON editor with a more complex nested object structure',
      },
      {
        type: 'hidden',
        label: 'Hidden Field',
        key: 'testHidden',
        value: 'hidden-value',
        description: 'Hidden field (not visible but included in form data)',
      },
      // Note: 'multi-select' is not included in this test because it requires functions
      // (multiSelectGetLabel, multiSelectGetValue) that cannot be serialized to JSON when
      // passing form fields to the React window. Multi-select fields work in actual forms
      // because they are configured in the Form Builder where functions can be stored
      // and reconstructed. For testing multi-select, create a real form template instead.
      // {
      //   type: 'multi-select',
      //   label: 'Multi-Select (Simple Options)',
      //   key: 'testMultiSelect',
      //   multiSelectItems: [...],
      //   multiSelectGetLabel: (item: any): string => item.name,
      //   multiSelectGetValue: (item: any): string => item.id,
      //   ...
      // },
      {
        type: 'separator',
        label: 'Markdown Preview',
      },
      {
        type: 'markdown-preview',
        label: 'Markdown Preview (Static Text)',
        markdownText: '# Static Markdown\n\nThis is **static** markdown text.\n\n- Item 1\n- Item 2\n- Item 3',
        description:
          "Markdown preview with static text content. Note: This is a very basic markdown renderer that does not display full NotePlan formatted tasks and items. It's intended for a quick preview, not a faithful rendering.",
      },
      {
        type: 'markdown-preview',
        label: 'Markdown Preview (Note by Filename)',
        markdownNoteFilename: DataStore.projectNotes.length > 0 ? DataStore.projectNotes[0].filename : '',
        description: `Markdown preview loading content from a note by filename: ${
          DataStore.projectNotes.length > 0 ? DataStore.projectNotes[0].filename : '(no notes available)'
        }. Note: This is a very basic markdown renderer that does not display full NotePlan formatted tasks and items. It's intended for a quick preview, not a faithful rendering.`,
      },
      {
        type: 'separator',
        label: 'Markdown Preview with Note Dependency',
      },
      {
        type: 'note-chooser',
        label: 'Note Chooser (for Markdown Preview)',
        key: 'testNoteForMarkdown',
        includePersonalNotes: true,
        includeCalendarNotes: false,
        includeRelativeNotes: false,
        includeTeamspaceNotes: true,
        showValue: true,
        description: 'Select a note to preview its markdown content below',
      },
      {
        type: 'markdown-preview',
        label: 'Markdown Preview (Depends on Note)',
        sourceNoteKey: 'testNoteForMarkdown',
        description:
          "This markdown preview displays the content of the note selected above. Select a note to see its rendered markdown. Note: This is a very basic markdown renderer that does not display full NotePlan formatted tasks and items. It's intended for a quick preview, not a faithful rendering.",
      },
      {
        type: 'separator',
        label: 'Autosave',
      },
      {
        type: 'autosave',
        label: 'Autosave Field',
        key: 'testAutosave',
        autosaveInterval: 2,
        description:
          'Automatically saves form state every 2 seconds after changes are made. Shows "Saved X ago" status. Autosave is by default saved to @Trash/Autosave-<formTitle>-<ISO8601>.',
      },
      {
        type: 'autosave',
        label: 'Autosave Field (Invisible)',
        key: 'testAutosaveInvisible',
        autosaveInterval: 5,
        invisible: true,
        description: 'Invisible autosave field that saves every 5 seconds without showing UI',
      },
      {
        type: 'separator',
        label: 'Prerequisite Dependencies (requiresKey)',
      },
      {
        type: 'switch',
        label: 'Enable Advanced Options',
        key: 'enableAdvanced',
        checked: false,
        description: 'Toggle this switch to show/hide the fields below (prerequisite dependency)',
      },
      {
        type: 'input',
        label: 'Advanced Input (Requires Switch)',
        key: 'advancedInput',
        placeholder: 'This field only appears when the switch above is enabled',
        requiresKey: 'enableAdvanced',
        description: 'This field is only visible when "Enable Advanced Options" is turned on (prerequisite dependency)',
      },
      {
        type: 'textarea',
        label: 'Advanced Textarea (Requires Switch)',
        key: 'advancedTextarea',
        placeholder: 'This textarea only appears when the switch is enabled',
        requiresKey: 'enableAdvanced',
        minRows: 3,
        maxRows: 10,
        description: 'This textarea is only visible when "Enable Advanced Options" is turned on',
      },
      {
        type: 'separator',
        label: 'Compact Display Examples',
      },
      {
        type: 'input',
        label: 'Input (Compact)',
        key: 'testInputCompact2',
        placeholder: 'Compact input',
        compactDisplay: true,
        description: 'Input field in compact display mode',
      },
      {
        type: 'number',
        label: 'Number (Compact)',
        key: 'testNumberCompact',
        value: '10',
        step: 1,
        compactDisplay: true,
        description: 'Number input in compact display mode',
      },
      {
        type: 'switch',
        label: 'Switch (Compact)',
        key: 'testSwitchCompact2',
        checked: false,
        compactDisplay: true,
        description: 'Switch in compact display mode',
      },
      {
        type: 'separator',
        label: 'Form State Viewer',
      },
      {
        type: 'form-state-viewer',
        label: 'Current Form State (Live Preview)',
        description: 'This shows the current values of all form fields as they will be submitted. You will see this section update in real-time as you change field values above.',
      },
      // Note: 'orderingPanel' is not included as it's typically used in specific contexts
      // and may require special setup. Add it if needed for testing.
      // Note: 'templatejs-block' is intentionally hidden in DynamicDialog preview (only visible in Form Builder),
      // so it's not included in this test.
    ]

    const testArgObj = {
      title: 'Form Field Examples',
      type: 'template-form',
      formFields: testFormFields,
      windowTitle: 'Form Field Examples',
      formTitle: 'Form Field Examples',
      allowEmptySubmit: true,
      hideDependentItems: false,
    }

    // Open the form window - openFormWindow will call createWindowInitData internally
    await openFormWindow(testArgObj)

    // Check if window is actually open
    const windowIsOpen = isHTMLWindowOpen(WEBVIEW_WINDOW_ID)
    if (windowIsOpen) {
      focusHTMLWindowIfAvailable(WEBVIEW_WINDOW_ID)
      logInfo(pluginJson, `✅ Form field examples opened! Window is open with customId: ${WEBVIEW_WINDOW_ID}`)
    } else {
      logWarn(pluginJson, `⚠️ Window may not be visible. Expected customId: ${WEBVIEW_WINDOW_ID}`)
      logWarn(pluginJson, `⚠️ Note: Window might still be initializing. Check NotePlan windows or try again.`)
    }
    logInfo(pluginJson, '📋 Form Field Examples includes:')
    logInfo(pluginJson, '  • All DynamicDialog field types with various configuration options')
    logInfo(pluginJson, '  • Field dependencies: folder→space, note→folder, heading→note, event→date, markdown→note')
    logInfo(pluginJson, '  • Prerequisite dependencies (requiresKey) - fields that show/hide based on other fields')
    logInfo(pluginJson, '  • Compact and non-compact display modes')
    logInfo(pluginJson, '  • Custom width examples for chooser fields')
    logInfo(pluginJson, '  • Validation examples (required, email, number, date-interval)')
    logInfo(pluginJson, '  • Folder/note choosers load dynamically when form opens')
    logInfo(pluginJson, '  • Check Plugin Console for [DIAG] logs showing request/response timing')
  } catch (error) {
    logError(pluginJson, `❌ Error opening form field examples: ${error.message}`)
    await showMessage(`Error opening form field examples: ${error.message}`)
  }
}
