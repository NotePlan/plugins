# 📝 Forms Plugin for NotePlan

## Latest Updates

See [CHANGELOG](https://github.com/NotePlan/plugins/blob/main/dwertheimer.Forms/CHANGELOG.md) for latest updates/changes to this plugin.

## About This Plugin

The Forms plugin enables you to create dynamic, interactive forms in NotePlan. You define form fields using the visual **Form Builder**, and when you fill out the form and click "Submit", the data is automatically processed to create notes or write to existing notes - **no coding or template writing required!**

> **⚠️ Beta Warning:** This is an early beta release and may not yet be fully functional. Features may change, and you may encounter bugs or incomplete functionality. Please report issues to @dwertheimer on Discord.

## Quick Start (3 Steps!)

1. **Open the Form Builder**: Type `/builder` in the command bar
2. **Create your form**: Add fields, configure how you want the data saved (new note or add to existing)
3. **Use your form**: Type `/form` and select your form, fill it out, and submit!

**That's it!** No templates to write, no JSON to edit, no advanced configuration needed for typical use cases.

## How It Works

1. You use the **Form Builder** to visually create a form (no coding required)
2. In the Form Builder, you configure how to handle the data:
   - **Create a new note** - Form data creates a new note with the content you specify
   - **Write to existing note** - Form data gets added to an existing note (today's note, a specific note, etc.)
   - **Run JavaScript** - Execute custom JavaScript code (advanced)
   - **Use custom template** - Use a processing template for complex scenarios (advanced)
3. When someone fills out the form and clicks "Submit", the plugin automatically handles everything based on your configuration

## Form Builder - Your Main Tool

The **Form Builder** is where you'll do everything. It's a visual interface that lets you:

- Add form fields by clicking a button (text inputs, dropdowns, date pickers, switches, etc.)
- Configure each field (label, description, default value, required/optional)
- Arrange fields by dragging them
- **Configure output**: Choose whether to create a new note, write to an existing note, or use advanced options
- Preview your form in real-time
- Save and test your form

### Opening the Form Builder

Type any of these commands:
- `/builder`
- `/buildform`
- `/📝 Forms: Form Builder/Editor`

### Creating Your First Form

1. **Launch Form Builder**: Type `/builder`

2. **Create New Form**: Click "Create New Form" and give it a name (e.g., "Project Form")

3. **Add Fields**: Click "+ Add Field" and select field types:
   - **Text Input** - For entering text (project name, description, etc.)
   - **Textarea** - For longer text entries
   - **Number** - For numeric values
   - **Switch** - For yes/no options
   - **Dropdown** - For selecting from a list
   - **Date Picker** - For selecting dates
   - **Note Chooser** - For selecting a note
   - **Folder Chooser** - For selecting a folder
   - And many more...

4. **Configure Each Field**: Click on a field to edit:
   - **Label**: What the user sees
   - **Key**: Internal name (auto-generated, usually don't need to change)
   - **Description**: Help text below the field
   - **Default Value**: Pre-filled value
   - **Required**: Must be filled out
   - **Compact Display**: Show label and field side-by-side

5. **Configure Form Output** (left sidebar under "Form Settings"):
   
   **Option 1: Create New Note** (most common)
   - Choose "Create New Note" as processing method
   - Set "New Note Title" template (e.g., `<%- projectName %>`)
   - Choose folder where notes should be created
   - Define the note content template

   **Option 2: Write to Existing Note**
   - Choose "Write to Existing Note" as processing method
   - Specify target note (`<today>` for today's note, or a specific note title)
   - Choose where to write (append, prepend, under a heading)
   - Define the content template

6. **Save Your Form**: Click "Save Form" button

7. **Test Your Form**: Click "Open Form" to test it right away

### Form Output Configuration

The Form Builder lets you configure exactly what happens when the form is submitted:

#### Creating New Notes

Perfect for: Project notes, meeting notes, person notes, etc.

**Configuration:**
- **New Note Title**: Use form fields in the title like `<%- projectName %>`
- **Folder**: Where to create the note (can use `<select>` to choose each time)
- **Space**: Private or a specific Teamspace
- **Note Content**: Write a template using form fields like:
  ```
  # <%- projectName %>
  
  **Start Date:** <%- startDate %>
  **Team:** <%- team %>
  
  ## Description
  <%- description %>
  ```

#### Writing to Existing Notes

Perfect for: Adding to today's note, logging entries, appending to project notes, etc.

**Configuration:**
- **Target Note**: 
  - `<today>` - Today's daily note
  - `<current>` - Currently open note
  - `<choose>` - Prompt to choose note each time
  - Specific note title
- **Write Location**: Where to add content
  - **Append** - Add to end of note
  - **Prepend** - Add to beginning of note
  - **Under Heading** - Add under a specific heading
- **Content Template**: What to write using form fields

### Tips for Form Builder

- **Start Simple**: Create a form with just 2-3 fields first to learn how it works
- **Use Descriptions**: Help text makes forms easier to use
- **Test Early**: Use "Open Form" button frequently to test as you build
- **Use Headings**: Group related fields with heading elements
- **Add Separators**: Visual dividers help organize long forms
- **Preview Updates Live**: The preview pane shows changes as you make them

## Using Forms

### Launching a Form

**Method 1: Command Bar** (easiest)
1. Type `/form` or `/dialog`
2. Select your form from the list
3. Fill out and submit

**Method 2: x-callback URL Link**

When you create a form, a launch link is automatically added to the top of your form template. Copy that link and paste it anywhere (daily notes, project notes, etc.) to launch the form with one click.

Example: `[Launch My Form](noteplan://x-callback-url/runPlugin?pluginID=dwertheimer.Forms&command=Open%20Template%20Form&arg0=My%20Form)`

**Method 3: Auto-Open on Note Open** (advanced)

Forms can auto-open when you open certain notes by adding this to the note's frontmatter:
```yaml
triggers: onOpen => dwertheimer.Forms.triggerOpenForm
```

### Form Browser

View all your forms in a browsable interface:

Type `/browser` or `/formbrowser`

The Form Browser shows all your forms in a two-column layout where you can:
- Browse available forms
- Preview form details
- Launch forms directly
- Edit forms in Form Builder

## Available Field Types

The Form Builder includes these field types:

### Basic Fields
- **Text Input** - Single-line text
- **Textarea** - Multi-line text (expandable)
- **Number** - Numeric input with +/- buttons
- **Read-only Field** - Display-only text

### Selection Fields
- **Dropdown** - Select from a list
- **Switch** - Toggle on/off
- **Button Group** - Choose one option from buttons

### Date & Time
- **Date Picker** - Calendar for selecting dates

### NotePlan Selectors
- **Note Chooser** - Search and select a note (supports single or multi-select with configurable output format)
- **Folder Chooser** - Search and select a folder
- **Space Chooser** - Select Private or a Teamspace
- **Heading Chooser** - Select a heading from a note
- **Event Chooser** - Select a calendar event
- **Tag Chooser** - Select multiple hashtags
- **Mention Chooser** - Select multiple @mentions
- **Frontmatter Key Chooser** - Select values from frontmatter keys across notes

### Display Elements
- **Heading** - Section title
- **Separator** - Horizontal divider line
- **Text** - Instructions or descriptions
- **Markdown Preview** - Display formatted markdown content
- **Table of Contents** - Clickable links to form sections

### Advanced Fields
- **Hidden Field** - Store data without displaying it
- **JSON Editor** - Edit JSON data
- **Button** - Clickable action button
- **Autosave** - Auto-save form progress
- **TemplateJS Block** - Execute JavaScript code (advanced)

## Additional Commands

### Restore from Autosave

Forms automatically save your progress. If a form is closed before submitting, you can restore it:

Type `/restoreautosave` or `/restoreform`

Autosave files are stored in `@Trash/Autosave-{timestamp}` by default.

### Form Browser

Browse all your forms in a visual interface:

Type `/browser` or `/formbrowser`

Can open as a floating window: `/formbrowser true`

## Plugin Settings

The Forms plugin has one main setting:

**Enable Autosave for All Forms** (default: ON)
- When enabled, all forms automatically save progress every 30 seconds
- Protects against data loss from crashes or accidental closes
- Autosave files are stored in @Trash folder

You can disable this globally and add autosave to specific forms only if preferred.

## Tips and Best Practices

1. **Start with the Form Builder** - Don't try to edit JSON manually
2. **Test frequently** - Use the "Open Form" button to test as you build
3. **Use meaningful field labels** - Clear labels make forms easy to use
4. **Add descriptions** - Help text prevents confusion
5. **Set good defaults** - Pre-fill common values to save time
6. **Group with headings** - Organize long forms with section headings
7. **Use conditional fields** - Hide advanced fields until needed (use `dependsOnKey`)
8. **Create separate forms for different use cases** - Don't try to make one giant form do everything

## Troubleshooting

### Form won't open
- Check Plugin Console (NotePlan → Help → Plugin Console) for errors
- Try re-saving the form in Form Builder
- Make sure the form template has `type: template-form` in frontmatter

### Form doesn't save data correctly
- Check your output configuration in Form Builder
- For "Create New Note": Verify folder path and note title template
- For "Write to Existing Note": Verify target note exists
- Check Plugin Console for error messages

### Form Builder shows errors
- Close and reopen Form Builder
- Check Plugin Console for details
- Try creating a new simple form to test

### Lost form data
- Check @Trash folder for autosave files
- Use `/restoreautosave` command
- Enable autosave in plugin settings if it's disabled

---

## Advanced Topics

**Most users won't need anything below this line.** The sections below are for advanced users who need custom processing logic or want to understand the underlying structure.

### Custom Processing Templates

For advanced use cases that can't be handled by the Form Builder's built-in options, you can create custom processing templates.

**When you might need this:**
- Complex conditional logic beyond what Form Builder supports
- Advanced date/time calculations
- Integration with other plugins
- Custom note structure generation

**Creating a Processing Template:**

1. Run `/createprocessor` or `/newprocessor`
2. Follow the wizard to set up basic configuration
3. Edit the template to add custom logic using EJS templating

**Processing Template Structure:**

```yaml
---
title: My Processing Template
type: forms-processor
newNoteTitle: <%- fieldName %>
folder: /Projects
---
# Template body here
Use form fields like: <%- fieldName %>
```

All form field `key` values become variables in your template.

**Date Formatting Example:**

```ejs
<%- startDate ? date.format("YYYY-MM-DD", startDate) : '' %>
```

**Conditional Logic Example:**

```ejs
<% if (isUrgent) { %>
**URGENT:** Requires immediate attention
<% } %>
```

### Processing Methods

The Form Builder uses these processing methods:

1. **form-processor** - Uses a custom processing template (advanced)
2. **create-new** - Creates a new note (handled by Form Builder)
3. **write-existing** - Writes to existing note (handled by Form Builder)
4. **run-js-only** - Executes JavaScript only (advanced, requires TemplateJS Block fields)

### Manual Template Editing

**You typically don't need this** - use Form Builder instead!

Form templates are stored as NotePlan notes with:
- `type: template-form` in frontmatter
- A `formfields` code block with JSON array of field definitions
- Optional launch links (auto-generated by Form Builder)

See the end of this document for complete JSON field reference if you need to edit manually.

### TemplateJS Blocks

For executing custom JavaScript during form processing:

1. Add a "TemplateJS Block" field in Form Builder
2. Write JavaScript code that executes when form is submitted
3. Useful for: creating folders, moving files, custom data processing

Example:
```javascript
// Create a folder based on form data
const folderPath = `${parentFolder}/${projectName}`;
DataStore.createFolder(folderPath);
```

### Reserved Field Keys

Don't use these as field keys (the plugin uses them internally):
- `__isJSON__`, `submit`, `location`, `writeUnderHeading`
- `openNoteTitle`, `writeNoteTitle`, `getNoteTitled`
- `replaceNoteContents`, `createMissingHeading`
- `receivingTemplateTitle`, `windowTitle`, `formTitle`
- `width`, `height`, `hideDependentItems`, `allowEmptySubmit`, `title`

---

## Complete Field Reference (Advanced)

**Note:** You typically don't need this - the Form Builder provides a visual interface for all field types. This reference is for users who need to manually edit form JSON or understand field properties in detail.

### Common Field Properties

All fields support these properties:

| Property | Type | Description |
|----------|------|-------------|
| `key` | string | Variable name (required for most types) |
| `label` | string | Field label displayed to user |
| `type` | string | Field type (required) |
| `description` | string | Help text shown below field |
| `default` | any | Default value for the field |
| `value` | any | Initial/current value |
| `compactDisplay` | boolean | Label and field side-by-side |
| `dependsOnKey` | string | Make field conditional on another field |
| `required` | boolean | Field must be filled |
| `placeholder` | string | Placeholder text (for input fields) |

### Input Field Types

**`input`** - Text input field
```javascript
{
  key: 'projectName',
  label: 'Project Name',
  type: 'input',
  required: true,
  compactDisplay: true,
  validationType: 'email' // optional: 'email', 'number', 'date-interval'
}
```

**`textarea`** - Multi-line expandable text field
```javascript
{
  key: 'description',
  label: 'Description',
  type: 'textarea',
  placeholder: 'Enter description...'
}
```

**`number`** - Numeric input
```javascript
{
  key: 'quantity',
  label: 'Quantity',
  type: 'number',
  default: 1,
  step: 1 // increment amount
}
```

**`input-readonly`** - Read-only display field
```javascript
{
  key: 'displayOnly',
  label: 'Read-only',
  type: 'input-readonly',
  value: 'Cannot be changed'
}
```

### Selection Field Types

**`dropdown-select`** - Simple dropdown
```javascript
{
  key: 'team',
  label: 'Team',
  type: 'dropdown-select',
  options: ['Alpha', 'Beta', 'Charlie'],
  // or with explicit values:
  // options: [{label: 'Alpha', value: 'a'}, {label: 'Beta', value: 'b'}],
  default: 'Beta'
}
```

**`switch`** - Toggle on/off
```javascript
{
  key: 'isUrgent',
  label: 'Urgent',
  type: 'switch',
  default: false
}
```

**`button-group`** - Mutually exclusive buttons
```javascript
{
  key: 'priority',
  label: 'Priority',
  type: 'button-group',
  options: [
    {label: 'High', value: 'high'},
    {label: 'Medium', value: 'med', isDefault: true},
    {label: 'Low', value: 'low'}
  ],
  vertical: false // true to stack vertically
}
```

### Date Field Types

**`calendarpicker`** - Date picker with configurable output format
```javascript
{
  key: 'dueDate',
  label: 'Due Date',
  type: 'calendarpicker',
  buttonText: 'Select Date',
  visible: false, // true to show calendar by default
  numberOfMonths: 1,
  size: 0.75, // scale factor
  dateFormat: 'YYYY-MM-DD', // moment.js format string (default: 'YYYY-MM-DD' ISO 8601)
  // Use '__object__' to return Date object instead of formatted string
  // Examples:
  // dateFormat: 'MM/DD/YYYY' - US format (12/25/2024)
  // dateFormat: 'DD/MM/YYYY' - European format (25/12/2024)
  // dateFormat: 'MMMM Do, YYYY' - Long format (December 25th, 2024)
  // dateFormat: 'YYYY-MM-DD HH:mm' - ISO with time (2024-12-25 14:30)
  // dateFormat: '__object__' - Returns Date object
}
```

### NotePlan Chooser Field Types

**`note-chooser`** - Searchable note selector (single or multi-select)
```javascript
{
  key: 'targetNote',
  label: 'Select Note',
  type: 'note-chooser',
  placeholder: 'Search notes...',
  showValue: false, // false=show title, true=show filename
  // Multi-select options:
  allowMultiSelect: true, // Enable multi-select mode (default: false)
  noteOutputFormat: 'wikilink', // 'wikilink' | 'pretty-link' | 'raw-url' (default: 'wikilink')
  noteSeparator: 'space', // 'space' | 'comma' | 'newline' (default: 'space')
  // Filter options:
  includePersonalNotes: true, // Include personal/project notes (default: true)
  includeCalendarNotes: false, // Include calendar notes (default: false)
  includeRelativeNotes: false, // Include relative notes like <today> (default: false)
  includeTeamspaceNotes: true, // Include teamspace notes (default: true)
  includeTemplatesAndForms: false, // Include @Templates and @Forms folders (default: false)
  // Display options:
  showCalendarChooserIcon: true, // Show calendar picker button (default: true if calendar notes included)
  showTitleOnly: false, // Show only title, not path/title (default: false)
  shortDescriptionOnLine2: false // Show description on second line (default: false)
}
```

**`folder-chooser`** - Searchable folder selector
```javascript
{
  key: 'targetFolder',
  label: 'Select Folder',
  type: 'folder-chooser',
  placeholder: 'Search folders...'
}
```

**`space-chooser`** - Space/Teamspace selector
```javascript
{
  key: 'space',
  label: 'Space',
  type: 'space-chooser',
  placeholder: 'Select space...'
}
```

**`heading-chooser`** - Heading selector (static or dynamic)
```javascript
{
  key: 'heading',
  label: 'Select Heading',
  type: 'heading-chooser',
  noteFilename: 'project.md', // static note
  // OR
  noteFieldKey: 'targetNote', // get note from another field
  placeholder: 'Select heading...'
}
```

**`event-chooser`** - Calendar event selector
```javascript
{
  key: 'meeting',
  label: 'Select Event',
  type: 'event-chooser',
  date: '2024-01-15', // static date
  // OR
  dateFieldKey: 'eventDate', // get date from another field
  placeholder: 'Select event...'
}
```

**`tag-chooser`** - Multi-select hashtags
```javascript
{
  key: 'tags',
  label: 'Tags',
  type: 'tag-chooser',
  returnAsArray: false // false=comma-separated, true=array
}
```

**`mention-chooser`** - Multi-select @mentions
```javascript
{
  key: 'people',
  label: 'People',
  type: 'mention-chooser',
  returnAsArray: false
}
```

**`frontmatter-key-chooser`** - Frontmatter value selector
```javascript
{
  key: 'status',
  label: 'Status',
  type: 'frontmatter-key-chooser',
  frontmatterKey: 'status', // which frontmatter key to search
  returnAsArray: false
}
```

### Display Field Types

**`heading`** - Section heading
```javascript
{
  type: 'heading',
  label: 'Section Title',
  description: 'Optional subtitle'
}
```

**`separator`** - Horizontal line
```javascript
{
  type: 'separator'
}
```

**`text`** - Display-only text
```javascript
{
  type: 'text',
  label: 'Instructions text here',
  textType: 'description' // 'title', 'description', or 'separator'
}
```

**`markdown-preview`** - Display markdown
```javascript
{
  type: 'markdown-preview',
  content: '# Hello\n\nMarkdown content', // static content
  // OR
  noteFilename: 'preview.md', // load from note
  // OR
  noteFieldKey: 'selectedNote', // load from another field
  height: 300 // optional fixed height
}
```

**`table-of-contents`** - Clickable form section links
```javascript
{
  type: 'table-of-contents',
  label: 'Form Sections'
}
```

### Advanced Field Types

**`hidden`** - Hidden field (not displayed)
```javascript
{
  key: 'hiddenData',
  type: 'hidden',
  value: 'some-value'
}
```

**`json`** - JSON editor
```javascript
{
  key: 'metadata',
  label: 'Metadata',
  type: 'json',
  default: {}
}
```

**`button`** - Clickable button
```javascript
{
  key: 'actionBtn',
  type: 'button',
  label: 'Click Me',
  isDefault: false // true for primary styling
}
```

**`autosave`** - Auto-save form state
```javascript
{
  type: 'autosave',
  key: 'formAutosave',
  saveLocation: '@Trash/Autosave-<ISO8601>',
  autoSaveInterval: 30000, // milliseconds
  showStatus: true
}
```

**`templatejs-block`** - JavaScript execution (advanced)
```javascript
{
  type: 'templatejs-block',
  key: 'myScript',
  label: 'Script',
  templateJSContent: 'const result = await doSomething(); return result;',
  executeTiming: 'after' // 'before' or 'after'
}
```

### Conditional Fields

Make fields dependent on other fields:

```javascript
{
  key: 'showAdvanced',
  label: 'Show Advanced',
  type: 'switch',
  default: false
},
{
  key: 'advancedOption',
  label: 'Advanced Option',
  type: 'input',
  dependsOnKey: 'showAdvanced' // only enabled when showAdvanced is true
}
```

### Complete Example Form Template

````markdown
---
title: Project Form
type: template-form
processingMethod: create-new
windowTitle: "New Project"
width: 750
height: 600
---

[Run Form: Project Form](noteplan://x-callback-url/runPlugin?pluginID=dwertheimer.Forms&command=Open%20Template%20Form&arg0=Project%20Form)

```formfields
[
  {
    type: 'heading',
    label: 'Project Details'
  },
  {
    key: 'projectName',
    label: 'Project Name',
    type: 'input',
    required: true,
    compactDisplay: true
  },
  {
    key: 'startDate',
    label: 'Start Date',
    type: 'calendarpicker',
    buttonText: 'Select Date'
  },
  {
    key: 'team',
    label: 'Team',
    type: 'dropdown-select',
    options: ['Alpha', 'Beta', 'Charlie'],
    compactDisplay: true
  },
  {
    type: 'separator'
  },
  {
    key: 'description',
    label: 'Description',
    type: 'textarea',
    placeholder: 'Enter project description...'
  }
]
```
````

## See Also

- [np.Templating Plugin](../np.Templating/README.md) - For advanced template processing
- [np.CallbackURLs Plugin](../np.CallbackURLs/README.md) - For creating x-callback-url links easily
