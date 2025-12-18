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
5. The processing template uses the form data to create a note or other content. You can use any Tempalating capabilities in your processing template to do just about anything you want.

## Quick Start

1. **Create your templates**: Create both your form template and receiving (processing) template in the `@Templates` directory
2. **Form Template Requirements**:
   - Your form template must have the `template-form` type
   - Include a `formfields` code block defining your form fields
   - Include a `receivingTemplateTitle` in the frontmatter pointing to your processing template
3. **Run the command**: Once your templates are set up, use `/📝 Forms: Open Template Form` (or `/form` or `/dialog`) to launch your form

## Creating a Form Template

Form templates should have the `template-form` tyoe. Each form template consists of:

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

## Field Types

The Forms plugin supports the following field types:

### Input Fields

#### `input`

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

#### `input-readonly`

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

#### `number`

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

### Selection Fields

#### `dropdown-select`

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
  compactDisplay: true
}
```

**Properties:**

- `options`: Array of strings or objects `{label: 'Display', value: 'value', isDefault: true}`
- `fixedWidth`: Fixed width in pixels
- `isEditable`: Allow user to edit/type in dropdown

#### `combo`

An advanced dropdown with search capabilities (react-select).

```javascript
{
  key: 'priority',
  label: 'Priority',
  type: 'combo',
  options: ['High', 'Medium', 'Low'],
  default: 'Medium',
  compactDisplay: true,
  noWrapOptions: false // If true, truncate options instead of wrapping
}
```

**Properties:**

- `options`: Array of strings or objects `{label: 'Display', value: 'value', isDefault: true}`
- `noWrapOptions`: If `true`, truncate labels instead of wrapping

### Boolean Fields

#### `switch`

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

### Date Fields

#### `calendarpicker`

A date picker for selecting dates.

```javascript
{
  key: 'dueDate',
  buttonText: 'Select Due Date',
  type: 'calendarpicker',
  selectedDate: new Date(), // Optional: initially selected date
  numberOfMonths: 1 // Optional: number of months to show
}
```

**Properties:**

- `buttonText`: Text shown on the date picker button
- `selectedDate`: Initially selected date (Date object)
- `numberOfMonths`: Number of calendar months to display

### Layout Elements

#### `heading`

A section heading.

```javascript
{
  type: 'heading',
  label: 'Section Title'
}
```

**Note:** No `key` required for headings.

#### `separator`

A horizontal line separator.

```javascript
{
  type: 'separator'
}
```

**Note:** No `key` required for separators.

#### `text`

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

### Advanced Fields

#### `json`

A JSON editor for complex data structures.

```javascript
{
  key: 'metadata',
  label: 'Metadata',
  type: 'json',
  default: {}
}
```

#### `button`

A clickable button that triggers an action.

```javascript
{
  key: 'actionButton',
  type: 'button',
  label: 'Click Me',
  isDefault: false // If true, appears as primary button
}
```

#### `button-group`

A group of buttons for selection.

```javascript
{
  key: 'option',
  type: 'button-group',
  label: 'Choose Option',
  options: ['Option 1', 'Option 2', 'Option 3'],
  vertical: false, // If true, stack buttons vertically
  isDefault: 0 // Index of default selected option
}
```

#### `hidden`

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

## Common Field Properties

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

## Creating the Processing Template

The processing template receives the form data and uses it to generate content. It's a standard NotePlan template with the type "forms-processor"

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

## Complete Example

### Form Template

````markdown
---
title: jgclark Project Form
type: form-processor
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
    buttonText: 'Start date',
    type: 'calendarpicker',
    visible: false,
  },
  {
    key: 'dueDateEntry',
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

### Processing Template

```yaml
---
title: Project Form Processing Template
type: form-processor
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

## Launching Forms

### From Command Bar

1. Type `/form` or `/dialog` or `/📝 Forms: Open Template Form`
2. Select your form template from the list
3. Fill out and submit the form

### From x-callback-url

You can create links to launch forms directly:

```markdown
[Launch Project Form](noteplan://x-callback-url/runPlugin?pluginID=dwertheimer.Forms&command=Open%20Template%20Form&arg0=jgclark%20Project%20Form)
```

Replace `jgclark%20Project%20Form` with your form template title (URL-encoded).

> **Tip:** Instead of manually creating x-callback-url links, consider using the [np.CallbackURLs](../np.CallbackURLs/README.md) plugin to create callback links with a user-friendly wizard. This plugin helps you build these URLs correctly without having to URL-encode template names manually.

## Tips and Best Practices

1. **Use descriptive keys**: Field keys become variable names in your processing template, so use clear, descriptive names
2. **Provide defaults**: Use `default` values for commonly-used fields to save time
3. **Add descriptions**: Help users understand what each field is for
4. **Validate input**: Use `required: true` and `validationType` for critical fields
5. **Group related fields**: Use `heading` and `separator` to organize complex forms
6. **Test thoroughly**: Make sure your processing template handles all field combinations correctly
7. **Date formatting**: Always check date formatting in your processing template - date picker returns ISO strings

## Troubleshooting

### Form won't open

- Check that your template is in the `template-form` folder
- Verify the `formfields` code block is correctly formatted JSON
- Check the Plugin Console for error messages

### Form data not appearing in processing template

- Verify all field keys are spelled correctly (case-sensitive)
- Check that `receivingTemplateTitle` matches your processing template title exactly
- Ensure variables are referenced correctly in the processing template (e.g., `<%- variableName %>`)

### Date fields not working

- Date picker returns ISO date strings - format them using `date.format()` if needed
- Check date parsing in your processing template

### Validation errors

- Ensure JSON syntax is correct in the `formfields` code block
- Check for missing commas between field definitions
- Verify all required properties (`key`, `type`, `label` where needed) are present

## See Also

- [np.Templating Documentation](../np.Templating/README.md) - For advanced template processing
- [DynamicDialog Component Documentation](../../helpers/react/DynamicDialog/_README.md) - For technical details on field rendering
