// @flow
//--------------------------------------------------------------------------
// Field Types Constants
//--------------------------------------------------------------------------

import { type TSettingItemType } from '@helpers/react/DynamicDialog/DynamicDialog.jsx'

export type FieldTypeOption = {
  value: TSettingItemType,
  label: string,
  description: string,
}

export const FIELD_TYPES: Array<FieldTypeOption> = [
  { value: 'input', label: 'Text Input', description: 'Single-line text field' },
  { value: 'input-readonly', label: 'Read-only (display value) field', description: 'Display-only text field' },
  { value: 'textarea', label: 'Expandable Textarea', description: 'Multi-line text field that expands as you type' },
  { value: 'number', label: 'Number', description: 'Numeric input with increment/decrement' },
  { value: 'text', label: 'Text', description: 'Display-only text/instructions' },
  { value: 'switch', label: 'Switch', description: 'Toggle on/off' },
  { value: 'dropdown-select', label: 'Dropdown', description: 'Simple dropdown menu' },
  // combo is not available because of missing NP_Theme in showHTMLV2 (and maybe doesn't work reliably anyway)
  //   { value: 'combo', label: 'Combo', description: 'Advanced dropdown with search' },
  { value: 'calendarpicker', label: 'Date Picker', description: 'Date selection calendar' },
  { value: 'folder-chooser', label: 'Folder Chooser', description: 'Searchable folder selector' },
  { value: 'note-chooser', label: 'Note Chooser', description: 'Searchable note selector' },
  { value: 'space-chooser', label: 'Space Chooser', description: 'Select a Space (Private or Teamspace)' },
  { value: 'heading-chooser', label: 'Heading Chooser', description: 'Select a heading from a note (static or dynamic based on note-chooser)' },
  { value: 'event-chooser', label: 'Event Chooser', description: 'Select a calendar event for a specific date' },
  { value: 'markdown-preview', label: 'Markdown Preview', description: 'Display markdown content (static text, note by filename/title, or note from another field). Note: This is a very basic markdown renderer that does not display full NotePlan formatted tasks and items. It\'s intended for a quick preview, not a faithful rendering.' },
  { value: 'heading', label: 'Heading', description: 'Section heading' },
  { value: 'separator', label: 'Separator', description: 'Horizontal line' },
  { value: 'button', label: 'Button', description: 'Clickable button' },
  { value: 'button-group', label: 'Button Group', description: 'Group of mutually exclusive selectable buttons (like a toggle group or radio buttons)' },
  { value: 'json', label: 'JSON Editor', description: 'JSON data editor' },
  { value: 'hidden', label: 'Hidden Field', description: 'Hidden data field' },
  { value: 'templatejs-block', label: 'TemplateJS Block', description: 'JavaScript code block that executes during template processing' },
  { value: 'autosave', label: 'Autosave', description: 'Automatically saves form state periodically (shows "Saved x ago" status)' },
]
