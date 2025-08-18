# Using Helpers in Templates

The `helpers` module provides access to commonly used helper functions in templates. You can use it like other modules such as `date`, `time`, or `note`.

## Basic Usage

```javascript
// Logging functions
<%- helpers.log('Hello from template!') %>
<%- helpers.logError('Something went wrong') %>
<%- helpers.logDebug('Debug info') %>
<%- helpers.clo(someObject, 'Object description') %>

// User input functions
<%- helpers.showMessage('Enter your name:', 'OK', 'Name Input') %>
<%- helpers.chooseOption(['Option 1', 'Option 2'], 'Choose an option') %>
<%- helpers.datePicker('Select a date') %>
<%- helpers.askDateInterval('Select date range') %>

// Date/time functions
<%- helpers.getFormattedTime('YYYY-MM-DD') %>
<%- helpers.getISOWeekAndYear() %>
<%- helpers.getNPWeekData() %>

// Note functions
<%- helpers.getNote('Note Title') %>
<%- helpers.chooseNote('Select a note') %>
<%- helpers.selectFirstNonTitleLineInEditor() %>

// Frontmatter functions
<%- helpers.hasFrontMatter(note) %>
<%- helpers.updateFrontMatterVars(note, {title: 'New Title'}) %>
<%- helpers.getNoteTitleFromTemplate(template) %>

// Configuration functions
<%- helpers.getSetting('settingName', 'defaultValue') %>
<%- helpers.updateSettingData('settingName', 'newValue') %>

// Paragraph functions
<%- helpers.findStartOfActivePartOfNote(note) %>
<%- helpers.smartPrependPara(note, 'New content') %>
<%- helpers.replaceContentUnderHeading(note, 'Heading', 'New content') %>

// String transformation functions
<%- helpers.parseObjectString('{"key": "value"}') %>
<%- helpers.validateObjectString('{"key": "value"}') %>

// Code block functions
<%- helpers.getCodeBlocksOfType('javascript') %>

// Editor functions
<%- helpers.checkAndProcessFolderAndNewNoteTitle('folder', 'title') %>

// Task relationship functions
<%- helpers.getOpenTasksAndChildren(tasks) %>

// Week formatting functions
<%- helpers.formatWithNotePlanWeeks(date) %>

// General utility functions
<%- helpers.parseJSON5('{"key": "value"}') %>
<%- helpers.semverVersionToNumber('1.2.3') %>
<%- helpers.getRandomUUID() %>

// Regex functions
<%- helpers.escapeRegExp('special.chars') %>
```

## Available Helper Functions

### Development & Debugging
- `log`, `logError`, `logDebug`, `logWarn`, `logInfo`
- `clo`, `JSP`, `timer`, `clof`, `getAllPropertyNames`, `overrideSettingsWithStringArgs`

### User Input
- `showMessage`, `showMessageYesNo`, `chooseOption`, `chooseFolder`
- `datePicker`, `askDateInterval`, `chooseNote`, `chooseHeading`
- `chooseOptionWithModifiers`, `getInput`

### Date & Time
- `getFormattedTime`, `getISOWeekAndYear`, `getISOWeekString`
- `getNPWeekData`, `hyphenatedDate`

### Notes
- `getNote`, `removeSection`, `selectFirstNonTitleLineInEditor`
- `getNoteFromIdentifier`, `getFlatListOfBacklinks`

### Paragraphs
- `findStartOfActivePartOfNote`, `findEndOfActivePartOfNote`
- `smartPrependPara`, `smartAppendPara`
- `replaceContentUnderHeading`, `insertContentUnderHeading`
- `getParagraphBlock`, `getBlockUnderHeading`

### Frontmatter
- `hasFrontMatter`, `updateFrontMatterVars`, `getNoteTitleFromTemplate`
- `getNoteTitleFromRenderedContent`, `analyzeTemplateStructure`
- `getSanitizedFmParts`, `isValidYamlContent`, `getValuesForFrontmatterTag`
- `getFrontmatterAttributes`

### Configuration
- `getSetting`, `updateSettingData`, `pluginUpdated`, `initConfiguration`

### Code & Strings
- `getCodeBlocksOfType`, `parseObjectString`, `validateObjectString`

### Editor
- `checkAndProcessFolderAndNewNoteTitle`

### Tasks
- `getOpenTasksAndChildren`

### Week Formatting
- `formatWithNotePlanWeeks`

### General Utilities
- `parseJSON5`, `semverVersionToNumber`, `getRandomUUID`

### Regex
- `escapeRegExp`

## Notes

- All helper functions maintain their original signatures and behavior
- Functions are available through `helpers.functionName` in templates
- The module only includes specific functions actually imported in np.Templating
- This keeps the bundle size minimal while providing useful functionality
- No entire modules are imported - only the specific functions needed
