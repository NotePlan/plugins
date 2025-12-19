# Forms Noteplan Plugin

## Latest Updates

See [CHANGELOG](https://github.com/NotePlan/plugins/blob/main/dwertheimer.Forms/CHANGELOG.md) for latest updates/changes to this plugin.

## About This Plugin

The Forms plugin enables you to create dynamic, interactive forms in NotePlan. You define form fields in a template, and when you fill out the form and click "Submit", the data is automatically processed through a template to create notes, tasks, or other content.

> **⚠️ Beta Warning:** This is an early beta release and may not yet be fully functional. Features may change, and you may encounter bugs or incomplete functionality. Please report issues to @dwertheimer on Discord.

| Form Definition > | Form Entry > | Form Processor > | Result |
|--------|----------|-------------|---------|
| <img width="962" height="1778" alt="Screen Cap 2025-12-17 at 23 12 54@2x" src="https://github.com/user-attachments/assets/5ffe85dd-51b8-47ae-84a8-1fbf6061ae92" /> | <img width="756" height="938" alt="Screen Cap 2025-12-17 at 23 16 26@2x" src="https://github.com/user-attachments/assets/e2681277-de53-4fcd-84b2-ae8638f2bc15" /> | <img width="922" height="932" alt="Screen Cap 2025-12-17 at 23 17 09@2x" src="https://github.com/user-attachments/assets/ffd7b7b1-fead-4853-83b9-8ce93049438c" /> | <img width="864" height="692" alt="Screen Cap 2025-12-17 at 23 17 40@2x" src="https://github.com/user-attachments/assets/67929891-ded3-4b4e-9ac5-490e97e1e4f0" /> |

## How It Works

1. You create a **Form Template** that defines the fields to be filled out
2. When the form command is triggered, a dialog window opens with your form fields
3. Fill out the form and click "Submit"
4. The form data is automatically sent to a **Processing Template** (specified by `receivingTemplateTitle`)
5. The processing template uses the form data to create a note or other content. You can use any Templating capabilities in your processing template to do just about anything you want.

## Quick Start

1. **Open the Form Builder**: Type `/📝 Forms: Form Builder` (or `/builder` or `/buildform`) in the command bar
2. **Create a new form**: Choose "Create New Template" and enter a name for your form
3. **Add fields**: Click "+ Add Field" to add form fields and configure them
4. **Set up processing**: The Form Builder will prompt you to create a processing template
5. **Save and launch**: Click "Save Form" and then use `/📝 Forms: Open Template Form` to launch your form

## Form Builder

The **Form Builder** is a visual tool that makes it easy to create and edit forms without writing JSON manually. You should use the Form Builder for all form creation - it's the recommended way to build forms!

> **Note:** When you create a new form using the Form Builder, a launch link (`[Run Form: Form Name](...)`) is automatically added to the top of your form template body. This link contains the x-callback-url that launches your form. You can copy this link and paste it anywhere you want (daily notes, project notes, etc.) to quickly access your form.

### Using the Form Builder

1. **Launch the Form Builder**:
   - Command: `/📝 Forms: Form Builder` (or `/builder` or `/buildform`)
   - Choose to create a new form template or edit an existing one

2. **Add and Configure Fields**:
   - Click "+ Add Field" in the "Form Fields" section
   - Select a field type from the menu (input, dropdown, switch, calendar picker, etc.)
   - Click on any field to edit its properties:
     - **Label**: The text shown to users
     - **Key**: Variable name used in processing templates (auto-generated but editable)
     - **Description**: Help text shown below the field
     - **Default Value**: Pre-filled value for the field
     - **Required**: Mark fields as required (must be filled)
     - **Compact Display**: Show label and field side-by-side
     - **Dependencies**: Make fields conditional on other fields

3. **Configure Form Settings** (left sidebar):
   - **Receiving Template**: The template that processes form submissions (required)
   - **Window Title**: Title shown in the form window
   - **Form Title**: Title shown inside the form dialog
   - **Window Size**: Width and height of the form window
   - **Hide Dependent Items**: Hide dependent fields until parent is enabled
   - **Allow Empty Submit**: Allow submitting form with empty required fields

4. **Preview Your Form** (right side):
   - See a live preview of how your form will look
   - The preview updates as you make changes

5. **Reorder Fields**:
   - Drag fields up or down using the grip handle (☰) on the left
   - Fields appear in the order they're listed

6. **Delete Fields**:
   - Click the trash icon (🗑️) next to any field to remove it

7. **Save Your Form**:
   - Click "Save Form" to save your changes
   - The Form Builder automatically creates the JSON codeblock in your template
   - If you've made changes, you'll see an "Unsaved changes" warning

8. **Open Your Form**:
   - Once saved, use the "Open Form" button to test your form
   - Or use `/📝 Forms: Open Template Form` from the command bar

### Form Builder Tips

- **Use descriptive labels**: Clear labels help users understand what each field is for
- **Set defaults**: Pre-fill commonly-used values to save time
- **Add descriptions**: Help text clarifies what each field should contain
- **Group related fields**: Use headings and separators to organize complex forms
- **Test as you go**: Use the "Open Form" button to test your form before finishing

## Launching Forms

### From Command Bar

1. Type `/form` or `/dialog` or `/📝 Forms: Open Template Form`
2. Select your form template from the list
3. Fill out and submit the form

### From x-callback-url

When you create a new form using the Form Builder, a launch link is automatically added to the top of your form template. You can copy this link from your template and paste it anywhere you want to quickly launch your form.

You can also manually create links to launch forms:

```markdown
[Launch Project Form](noteplan://x-callback-url/runPlugin?pluginID=dwertheimer.Forms&command=Open%20Template%20Form&arg0=jgclark%20Project%20Form)
```

Replace `jgclark%20Project%20Form` with your form template title (URL-encoded).

> **Tip:** Instead of manually creating x-callback-url links, consider using the [np.CallbackURLs](../np.CallbackURLs/README.md) plugin to create callback links with a user-friendly wizard. This plugin helps you build these URLs correctly without having to URL-encode template names manually. Or simply copy the link that's automatically added to your form template!

## Creating the Processing Template

The processing template receives the form data and uses it to generate content. It's a standard NotePlan template with the type `forms-processor`.

### Accessing Form Data

All form field `key` values become available as variables in your processing template. Use them with `<%- variableName %>` syntax.

### Example Processing Template

```yaml
---
title: Project Form Processing Template
type: forms-processor
newNoteTitle: <%- noteTitle %>
folder: <select Projects>
start: <%- startDateEntry ? date.format("YYYY-MM-DD", startDateEntry) : '' %>
due: <%- dueDateEntry ? date.format("YYYY-MM-DD", dueDateEntry) : '' %>
---
#project @start(<%- start %>) @due(<%- due %>) @review(<%- interval %>)

**Aim:** <%- aim %>

**Context:** <%- context %>

**Team:** <%- team %>

Progress: 0@<%- start %>: project started
```

### Date Handling

Date fields from `calendarpicker` return ISO date strings. You can format them using the `date.format()` function:

```ejs
<%- startDateEntry ? date.format("YYYY-MM-DD", startDateEntry) : '' %>
```

### Conditional Rendering

You can use conditional logic in your processing template:

```ejs
<% if (isUrgent) { %>
**URGENT:** This task requires immediate attention
<% } %>
```

## Tips and Best Practices

1. **Use descriptive keys**: Field keys become variable names in your processing template, so use clear, descriptive names
2. **Provide defaults**: Use default values for commonly-used fields to save time
3. **Add descriptions**: Help users understand what each field is for
4. **Validate input**: Use required fields and validation for critical fields
5. **Group related fields**: Use headings and separators to organize complex forms
6. **Test thoroughly**: Make sure your processing template handles all field combinations correctly
7. **Date formatting**: Always check date formatting in your processing template - date picker returns ISO strings

## Troubleshooting

### Form won't open

- Check that your template has the `template-form` type
- Verify the `formfields` code block is correctly formatted JSON
- Check the Plugin Console for error messages
- Try using the Form Builder to edit the form and save it again

### Form data not appearing in processing template

- Verify all field keys are spelled correctly (case-sensitive)
- Check that `receivingTemplateTitle` matches your processing template title exactly
- Ensure variables are referenced correctly in the processing template (e.g., `<%- variableName %>`)

### Date fields not working

- Date picker returns ISO date strings - format them using `date.format()` if needed
- Check date parsing in your processing template

### Form Builder issues

- If the Form Builder shows errors, check the Plugin Console
- Try closing and reopening the Form Builder
- If a form has duplicate codeblocks, use the Form Builder to edit and save - it will fix duplicates automatically

---

## Advanced / API Reference

The following sections provide detailed reference information for manually editing form templates. **You typically don't need this** - use the Form Builder instead! This reference is for advanced users or when you need to understand the underlying structure.

### Creating a Form Template Manually

Form templates should have the `template-form` type. Each form template consists of:

- **Frontmatter** with configuration settings
- A **`formfields` code block** containing an array of field definitions

### Form Template Frontmatter

The frontmatter controls the form's appearance and behavior:

```yaml
---
title: My Form Template
type: template-form
receivingTemplateTitle: "My Processing Template"
windowTitle: "My Form"
formTitle: "Fill Out This Form"
hideDependentItems: false
allowEmptySubmit: false
width: 750
height: 750
---
```

#### Frontmatter Options

| Option | Required | Description | Default |
|--------|----------|-------------|---------|
| `title` | Yes | The name of your form template | - |
| `receivingTemplateTitle` | Yes | Title of the template that will process the form data | - |
| `type` | Yes | Set to `template-form` so it comes up in the forms chooser | - |
| `windowTitle` | No | Title shown in the form window | "Form" |
| `formTitle` | No | Title shown inside the form dialog | "Form Entry" |
| `width` | No | Width of the form window in pixels | Auto |
| `height` | No | Height of the form window in pixels | Auto |
| `hideDependentItems` | No | Hide dependent fields until parent is enabled | `false` |
| `allowEmptySubmit` | No | Allow submitting form with empty required fields | `false` |

### Form Fields Code Block

After the frontmatter, include a code block with type `formfields` containing a JSON array of field definitions.

> **Important:** We highly recommend using [JSONLint](http://jsonlint.com/) to validate your JSON code (copy only the content inside the code block, not including the backticks). This will help catch syntax errors like missing commas, incorrect quotes, or malformed structures before you try to use the form.

````markdown
\`\`\`formfields
[
  {
    key: 'fieldName',
    label: 'Field Label',
    type: 'input',
    description: 'Help text for this field'
  }
]
\`\`\`
````

### Field Types Reference

The Forms plugin supports the following field types:

#### Input Fields

##### `input`

A standard text input field.

```javascript
{
  key: 'projectName',
  label: 'Project Name',
  type: 'input',
  description: 'Enter the name of your project',
  default: 'My Project',
  required: true,
  compactDisplay: true,
  focus: false, // Set to true to focus this field when form opens
  validationType: 'email' | 'number' | 'date-interval' // Optional validation
}
```

**Properties:**

- `key` (required): Variable name used in processing template
- `label` (required): Label displayed to user
- `type`: `'input'`
- `description`: Help text shown below the field
- `default`: Default value
- `required`: If `true`, field must be filled
- `compactDisplay`: If `true`, label and field are side-by-side
- `focus`: If `true`, field receives focus when form opens
- `validationType`: `'email'`, `'number'`, or `'date-interval'` for validation

##### `input-readonly`

A read-only text input field (display only).

```javascript
{
  key: 'readonlyField',
  label: 'Read-only Info',
  type: 'input-readonly',
  default: 'This cannot be changed',
  compactDisplay: true
}
```

##### `number`

A numeric input with increment/decrement buttons.

```javascript
{
  key: 'quantity',
  label: 'Quantity',
  type: 'number',
  default: 0,
  step: 1, // Increment/decrement amount
  compactDisplay: true
}
```

**Properties:**

- `step`: Number to increment/decrement by (default: 1)

#### Selection Fields

##### `dropdown-select`

A dropdown menu (simple select).

```javascript
{
  key: 'team',
  label: 'Team',
  type: 'dropdown-select',
  options: ['Team Alpha', 'Team Beta', 'Team Charlie'],
  default: 'Team Beta',
  fixedWidth: 300, // Optional: fixed width in pixels
  isEditable: false, // If true, user can type to search/edit
  placeholder: 'Select a team', // Optional: placeholder text
  compactDisplay: true
}
```

**Properties:**

- `options`: Array of strings or objects `{label: 'Display', value: 'value'}`
- `fixedWidth`: Fixed width in pixels
- `isEditable`: Allow user to edit/type in dropdown
- `placeholder`: Text shown when no option is selected (won't be submitted)

##### `combo`

An advanced dropdown with search capabilities (react-select).

```javascript
{
  key: 'priority',
  label: 'Priority',
  type: 'combo',
  options: ['High', 'Medium', 'Low'],
  default: 'Medium',
  compactDisplay: true,
  noWrapOptions: false, // If true, truncate options instead of wrapping
  placeholder: 'Select priority' // Optional: placeholder text
}
```

**Properties:**

- `options`: Array of strings or objects `{label: 'Display', value: 'value'}`
- `noWrapOptions`: If `true`, truncate labels instead of wrapping
- `placeholder`: Text shown when no option is selected (won't be submitted)

#### Boolean Fields

##### `switch`

A toggle switch (on/off).

```javascript
{
  key: 'isUrgent',
  label: 'Mark as Urgent',
  type: 'switch',
  default: false,
  compactDisplay: true
}
```

**Properties:**

- `default`: `true` or `false`

#### Date Fields

##### `calendarpicker`

A date picker for selecting dates.

```javascript
{
  key: 'dueDate',
  label: 'Due Date', // Optional: label for the calendar picker
  buttonText: 'Select Due Date', // Text on button (optional if visible: true)
  type: 'calendarpicker',
  selectedDate: new Date(), // Optional: initially selected date
  numberOfMonths: 1, // Optional: number of months to show
  visible: false, // If true, show calendar by default (no button needed if no buttonText)
  size: 0.75 // Optional: scale factor (0.5 = 50%, 1.0 = 100%, default: 0.75)
}
```

**Properties:**

- `label`: Label displayed for the calendar picker
- `buttonText`: Text shown on the date picker button (not needed if `visible: true` and no button desired)
- `selectedDate`: Initially selected date (Date object)
- `numberOfMonths`: Number of calendar months to display
- `visible`: If `true`, calendar is shown by default (button only shown if `buttonText` is provided)
- `size`: Scale factor for calendar size (default: 0.75 = 75% of full size)

#### Layout Elements

##### `heading`

A section heading.

```javascript
{
  type: 'heading',
  label: 'Section Title',
  description: 'Optional description text'
}
```

**Note:** No `key` required for headings.

##### `separator`

A horizontal line separator.

```javascript
{
  type: 'separator'
}
```

**Note:** No `key` required for separators.

##### `text`

Display-only text for instructions or descriptions.

```javascript
{
  key: 'instructions', // Optional but recommended
  type: 'text',
  label: 'Instructions',
  textType: 'description' // 'title' | 'description' | 'separator'
}
```

**Properties:**

- `textType`: `'title'`, `'description'`, or `'separator'`

#### Advanced Fields

##### `json`

A JSON editor for complex data structures.

```javascript
{
  key: 'metadata',
  label: 'Metadata',
  type: 'json',
  default: {}
}
```

##### `button`

A clickable button that triggers an action.

```javascript
{
  key: 'actionButton',
  type: 'button',
  label: 'Click Me',
  isDefault: false // If true, appears as primary button
}
```

##### `button-group`

A group of mutually exclusive selectable buttons (like a toggle group or radio buttons).

```javascript
{
  key: 'option',
  type: 'button-group',
  label: 'Choose Option',
  options: [
    { label: 'Option 1', value: 'opt1' },
    { label: 'Option 2', value: 'opt2', isDefault: true },
    { label: 'Option 3', value: 'opt3' }
  ],
  vertical: false // If true, stack buttons vertically
}
```

**Properties:**

- `options`: Array of strings or objects `{label: 'Display', value: 'value', isDefault: true}`
- `vertical`: If `true`, stack buttons vertically

##### `hidden`

A hidden field (not displayed, but value is passed to processing template).

```javascript
{
  key: 'hiddenValue',
  type: 'hidden',
  value: 'some-value'
}
```

### Conditional Fields (Dependencies)

You can make fields conditional using `dependsOnKey`. A field will only be enabled/visible when the field it depends on is `true` (for switches) or has a value (for other types).

```javascript
{
  key: 'showAdvanced',
  label: 'Show Advanced Options',
  type: 'switch',
  default: false,
  compactDisplay: true
},
{
  key: 'advancedSetting',
  label: 'Advanced Setting',
  type: 'input',
  dependsOnKey: 'showAdvanced', // Only enabled when showAdvanced is true
  compactDisplay: true
}
```

**Properties:**

- `dependsOnKey`: The `key` of another field this field depends on

### Common Field Properties

All fields support these common properties:

| Property | Type | Description |
|----------|------|-------------|
| `key` | string | Variable name (required for most types) |
| `label` | string | Field label displayed to user |
| `type` | string | Field type (required) |
| `description` | string | Help text shown below field |
| `default` | any | Default value for the field |
| `compactDisplay` | boolean | If `true`, label and field display side-by-side |
| `dependsOnKey` | string | Make field conditional on another field |
| `required` | boolean | Field must be filled (for input fields) |

### Reserved Keys

The following keys are reserved and should not be used as field keys:

- `__isJSON__`
- `submit`
- `location`
- `writeUnderHeading`
- `openNoteTitle`
- `writeNoteTitle`
- `getNoteTitled`
- `replaceNoteContents`
- `createMissingHeading`
- `receivingTemplateTitle`
- `windowTitle`
- `formTitle`
- `width`
- `height`
- `hideDependentItems`
- `allowEmptySubmit`
- `title`

### Complete Example

#### Form Template

````markdown
---
title: jgclark Project Form
type: template-form
receivingTemplateTitle: "Project Form Processing Template"
windowTitle: "Project"
formTitle: "Create New Project"
hideDependentItems: false
allowEmptySubmit: false
width: 750
height: 750
---
```formfields
[
  {
    key: 'noteTitle',
    label: 'Project Title',
    description: 'This will be the name/title of the project.',
    type: 'input',
    compactDisplay: true,
    required: true,
  },
  {
    key: 'startDateEntry',
    label: 'Start Date',
    buttonText: 'Start date',
    type: 'calendarpicker',
    visible: false,
  },
  {
    key: 'dueDateEntry',
    label: 'Due Date',
    buttonText: 'Due date',
    type: 'calendarpicker',
    visible: false,
  },
  {
    key: 'aim',
    label: 'Aim',
    description: 'The aim/purpose of the project.',
    type: 'input',
    compactDisplay: true,
  },
  {
    key: 'context',
    label: 'Context',
    description: 'The context of the project.',
    type: 'input',
    compactDisplay: true,
  },
  {
    key: 'team',
    label: 'Team',
    type: 'dropdown-select',
    options: ['team alpha', 'team beta', 'team charlie'],
    default: 'team beta',
    compactDisplay: true,
  },
  {
    key: 'interval',
    label: 'Review Interval',
    description: 'Enter the review interval in the format: nn[bdwmqy]',
    compactDisplay: true,
    type: 'input',
    validationType: 'date-interval'
  },
]
```
````

#### Processing Template

```yaml
---
title: Project Form Processing Template
type: forms-processor
newNoteTitle: <%- noteTitle %>
folder: <select Projects>
start: <%- startDateEntry ? date.format("YYYY-MM-DD", startDateEntry) : '' %>
due: <%- dueDateEntry ? date.format("YYYY-MM-DD", dueDateEntry) : '' %>
---
#project @start(<%- start %>) @due(<%- due %>) @review(<%- interval %>)

**Aim:** <%- aim %>

**Context:** <%- context %>

**Team:** <%- team %>

Progress: 0@<%- start %>: project started
```

## See Also

- [np.Templating Documentation](../np.Templating/README.md) - For advanced template processing
- [DynamicDialog Component Documentation](../../helpers/react/DynamicDialog/_README.md) - For technical details on field rendering
