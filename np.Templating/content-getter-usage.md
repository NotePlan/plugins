# Content Getter Usage in np.Templating

.contentWithAbsoluteAttachmentPaths

Discussion: [Discord](https://discord.com/channels/763107030223290449/1419640432681418836/1427347411923243143)

This document lists all places where `Editor.content` or `note.content` is used as a getter (reading the value) in the np.Templating plugin.

## Summary

- **Total Files**: 4
- **Editor.content Occurrences**: 6
- **note.content Occurrences**: 5
- **paragraph.content Occurrences**: 2 (see separate section below)

---

## Part 1: Editor.content Usage

### File: `src/Templating.js`

#### Function: `templateInsert`
**[Line 120](src/Templating.js#L120)**
```javascript
templateData = Editor.content
```
- **Purpose**: Getting current editor content when using `<current>` template
- **Context**: Using the currently open note as a template
- **File**: `np.Templating/src/Templating.js:120`

#### Function: `templateAppend`
**[Line 147](src/Templating.js#L147)**
```javascript
const content: string = Editor.content || ''
```
- **Purpose**: Getting current editor content for length calculation
- **Context**: Determining where to append template content
- **File**: `np.Templating/src/Templating.js:147`

**[Line 158](src/Templating.js#L158)**
```javascript
templateData = Editor.content
```
- **Purpose**: Getting current editor content when using `<current>` template
- **Context**: Using the currently open note as a template
- **File**: `np.Templating/src/Templating.js:158`

#### Function: `templateInvoke`
**[Line 196](src/Templating.js#L196)**
```javascript
const content: string = Editor.content || ''
```
- **Purpose**: Getting current editor content (though variable appears unused)
- **Context**: Initial setup for template invoke
- **File**: `np.Templating/src/Templating.js:196`

#### Function: `templateQuickNote`
**[Line 419](src/Templating.js#L419)**
```javascript
const content: string = Editor.content || ''
```
- **Purpose**: Getting current editor content (though variable appears unused)
- **Context**: Initial setup for quick note creation
- **File**: `np.Templating/src/Templating.js:419`

#### Function: `templateMeetingNote`
**[Line 548](src/Templating.js#L548)**
```javascript
const content: string = Editor.content || ''
```
- **Purpose**: Getting current editor content (though variable appears unused)
- **Context**: Initial setup for meeting note creation
- **File**: `np.Templating/src/Templating.js:548`

#### Function: `templateConvertNote`
**[Line 844](src/Templating.js#L844)**
```javascript
const note = Editor.content || ''
```
- **Purpose**: Getting current editor content for conversion
- **Context**: Converting a project note to frontmatter format
- **File**: `np.Templating/src/Templating.js:844`

---

## Part 2: note.content Usage

### File: `src/NPTemplateRunner.js`

#### Function: `writeNoteContents`
**[Line 272](src/NPTemplateRunner.js#L272)**
```javascript
`writeNoteContents replaceHeading: note.content.includes(headingParagraph.content): ${String(note.content?.includes(`# ${headingParagraph.content}`))}`,
```
- **Purpose**: Checking if note content includes a specific heading
- **Context**: Debugging/error logging when replacing a heading
- **File**: `np.Templating/src/NPTemplateRunner.js:272`

#### Function: `getTemplateData`
**[Line 360](src/NPTemplateRunner.js#L360)**
```javascript
templateData = selectedTemplate ? trTemplateNote?.content || '' : ''
```
- **Purpose**: Getting template data from a template note
- **Context**: Loading template content for processing
- **File**: `np.Templating/src/NPTemplateRunner.js:360`

### File: `src/Templating.js`

#### Function: `templateInsert`
**[Line 123](src/Templating.js#L123)**
```javascript
templateData = templateNote?.content || ''
```
- **Purpose**: Getting template data from a template note
- **Context**: Loading template content for insertion
- **File**: `np.Templating/src/Templating.js:123`

#### Function: `templateAppend`
**[Line 161](src/Templating.js#L161)**
```javascript
templateData = templateNote?.content || ''
```
- **Purpose**: Getting template data from a template note
- **Context**: Loading template content for appending
- **File**: `np.Templating/src/Templating.js:161`

### File: `lib/support/modules/NoteModule.js`

#### Function: `content`
**[Line 55](lib/support/modules/NoteModule.js#L55)**
```javascript
let content = this.getCurrentNote()?.content
```
- **Purpose**: Getting note content to return (optionally stripping frontmatter)
- **Context**: Method to access current note's content
- **File**: `np.Templating/lib/support/modules/NoteModule.js:55`

#### Function: `getRandomLine`
**[Line 81](lib/support/modules/NoteModule.js#L81)**
```javascript
let fullNoteContent = note.content || ''
```
- **Purpose**: Getting note content to extract a random line
- **Context**: Retrieving full note content for processing
- **File**: `np.Templating/lib/support/modules/NoteModule.js:81`

---

## Part 3: Paragraph Content Usage (para|paragraph|p.content)

**Note**: These are separated out as they are a different use case than Editor/note content.

### File: `src/NPTemplateRunner.js`

#### Function: `replaceHeading`
**[Line 96](src/NPTemplateRunner.js#L96)**
```javascript
const paraMatch = para.content.match(/^#+/)
```
- **Purpose**: Getting content from a paragraph to match heading level
- **Context**: Finding the next heading of same or higher level
- **File**: `np.Templating/src/NPTemplateRunner.js:96`

**[Line 272](src/NPTemplateRunner.js#L272)** (also referenced in note.content section above)
```javascript
`writeNoteContents replaceHeading: note.content.includes(headingParagraph.content): ${String(note.content?.includes(`# ${headingParagraph.content}`))}`,
```
- **Purpose**: Getting content from heading paragraph for comparison
- **Context**: Debugging/error logging when replacing a heading
- **File**: `np.Templating/src/NPTemplateRunner.js:272`

### File: `lib/support/modules/TasksModule.js`

#### Function: `_ensureBlockIdsForOpenTasks`
**[Line 94](lib/support/modules/TasksModule.js#L94)**
```javascript
const openTaskParagraphs = getOpenTasksAndChildren(note.paragraphs.filter((p) => p.content.trim() !== ''))
```
- **Purpose**: Filtering out empty paragraphs by checking content
- **Context**: Getting open tasks and ensuring they have block IDs
- **File**: `np.Templating/lib/support/modules/TasksModule.js:94`

---

## Usage Patterns Summary

### Editor.content
- **Count**: 6 occurrences (all in Templating.js)
- **Common patterns**:
  - `Editor.content` - direct access when using `<current>` template
  - `Editor.content || ''` - with fallback to empty string
- **Primary uses**:
  - Getting content when `<current>` is specified as template (2x)
  - Getting content length for insertion/append operations (1x)
  - Getting content for note conversion (1x)
  - Unused variable initialization (3x - lines 196, 419, 548)

### note.content
- **Count**: 5 occurrences (3 files)
- **Common patterns**:
  - `templateNote?.content || ''` - most common pattern for loading templates
  - `note.content?.includes()` - checking if content contains text
  - `note.content || ''` - with fallback to empty string
- **Primary uses**:
  - Loading template content from template notes (3x)
  - Checking if content contains specific text (1x - debug logging)
  - Getting content for processing/conversion (1x)

### paragraph.content
- **Count**: 2 occurrences (2 files)
- **Common patterns**:
  - `para.content.match()` - pattern matching on paragraph content
  - `p.content.trim()` - checking for empty content
- **Primary uses**:
  - Matching heading levels (1x)
  - Filtering empty paragraphs (1x)

---

## Recommendations

If you're planning to replace direct `.content` access with a function call or different API:

1. **Editor.content** (6 occurrences)
   - Consider if this needs special handling since it's the active editor
   - Note: 3 instances appear to be unused variables (lines 196, 419, 548 in Templating.js)

2. **note.content** (5 occurrences)
   - Most common pattern is `templateNote?.content || ''` for loading templates
   - Often used with optional chaining `?.content`
   - One instance is for debug logging only

3. **paragraph.content** (2 occurrences) - SEPARATE USE CASE
   - Used for filtering and matching operations
   - May not need to be changed if note/Editor changes are made

---

## Changes Made: Using `getContentWithLinks()` for Template Content

### Changed (Template Content Reads) ✅

The following locations were updated to use `getContentWithLinks()` because they read template content:

1. **[Line 120](src/Templating.js#L120)** in `src/Templating.js` - `templateInsert()`
   - **Before**: `templateData = Editor.content`
   - **After**: `templateData = getContentWithLinks(Editor.note)`
   - **Reason**: Using `<current>` note as a template (edge case: template open in Editor)
 
2. **[Line 123](src/Templating.js#L123)** in `src/Templating.js` - `templateInsert()`
   - **Before**: `templateData = templateNote?.content || ''`
   - **After**: `templateData = getContentWithLinks(templateNote)`
   - **Reason**: Loading template content from template note file

3. **[Line 170](src/Templating.js#L170)** in `src/Templating.js` - `templateAppend()`
   - **Before**: `templateData = Editor.content`
   - **After**: `templateData = getContentWithLinks(Editor.note)`
   - **Reason**: Using `<current>` note as a template (edge case: template open in Editor)

4. **[Line 173](src/Templating.js#L173)** in `src/Templating.js` - `templateAppend()`
   - **Before**: `templateData = templateNote?.content || ''`
   - **After**: `templateData = getContentWithLinks(templateNote)`
   - **Reason**: Loading template content from template note file

5. **[Line 361](src/NPTemplateRunner.js#L361)** in `src/NPTemplateRunner.js` - `getTemplateData()`
   - **Before**: `templateData = selectedTemplate ? trTemplateNote?.content || '' : ''`
   - **After**: `templateData = selectedTemplate ? getContentWithLinks(trTemplateNote) : ''`
   - **Reason**: Loading template content from template note

### np.MeetingNotes Plugin Changes ✅

The following locations in **np.MeetingNotes** were also updated to use `getContentWithLinks()`:

6. **[Line 39](../np.MeetingNotes/src/NPMeetingNotes.js#L39)** in `np.MeetingNotes/src/NPMeetingNotes.js` - `insertNoteTemplate()`
   - **Before**: `let templateContent = templateNote?.content`
   - **After**: `let templateContent = getContentWithLinks(templateNote)`
   - **Reason**: Loading template content from template note

7. **[Line 195](../np.MeetingNotes/src/NPMeetingNotes.js#L195)** in `np.MeetingNotes/src/NPMeetingNotes.js` - `renderTemplateForEvent()`
   - **Before**: `templateContent = DataStore.projectNoteByFilename(templateFilename)?.content || ''`
   - **After**: `templateContent = getContentWithLinks(DataStore.projectNoteByFilename(templateFilename))`
   - **Reason**: Loading template content from template note for event rendering

8. **[Line 661](../np.MeetingNotes/src/NPMeetingNotes.js#L661)** in `np.MeetingNotes/src/NPMeetingNotes.js` - `chooseTemplateIfNeeded()`
   - **Before**: `const attributes = getAttributes(template.content, true)`
   - **After**: `const attributes = getAttributes(getContentWithLinks(template), true)`
   - **Reason**: Reading template content to check its attributes/type

### Not Changed (Non-Template Content Reads) ⛔

The following locations were NOT changed because they read regular note content, not template content:

1. **[Line 147](src/Templating.js#L147)** in `src/Templating.js` - `templateAppend()`
   - `const content: string = Editor.content || ''`
   - **Reason**: Getting current editor content for length calculation, not reading a template

2. **[Line 196](src/Templating.js#L196)** in `src/Templating.js` - `templateInvoke()`
   - `const content: string = Editor.content || ''`
   - **Reason**: Unused variable, not actually reading a template

3. **[Line 419](src/Templating.js#L419)** in `src/Templating.js` - `templateQuickNote()`
   - `const content: string = Editor.content || ''`
   - **Reason**: Unused variable, not actually reading a template

4. **[Line 548](src/Templating.js#L548)** in `src/Templating.js` - `templateMeetingNote()`
   - `const content: string = Editor.content || ''`
   - **Reason**: Unused variable, not actually reading a template

5. **[Line 844](src/Templating.js#L844)** in `src/Templating.js` - `templateConvertNote()`
   - `const note = Editor.content || ''`
   - **Reason**: Converting a project note to frontmatter format, not reading a template

6. **[Line 272](src/NPTemplateRunner.js#L272)** in `src/NPTemplateRunner.js` - `writeNoteContents()`
   - `note.content.includes(headingParagraph.content)`
   - **Reason**: Debug logging to check if content includes heading, not reading a template

7. **[Line 55](lib/support/modules/NoteModule.js#L55)** in `lib/support/modules/NoteModule.js` - `content()`
   - `let content = this.getCurrentNote()?.content`
   - **Reason**: Method to access current note's content, not reading a template

8. **[Line 81](lib/support/modules/NoteModule.js#L81)** in `lib/support/modules/NoteModule.js` - `getRandomLine()`
   - `let fullNoteContent = note.content || ''`
   - **Reason**: Getting note content to extract a random line, not reading a template

### np.MeetingNotes Non-Template Content (Not Changed) ⛔

9. **[Line 63-66](../np.MeetingNotes/src/NPMeetingNotes.js#L63)** in `np.MeetingNotes/src/NPMeetingNotes.js` - `insertNoteTemplate()`
   - `if (note.content && note.content !== '') { note.content += ...`
   - **Reason**: Setting/modifying content on a target note after template rendering, not reading a template

10. **[Line 77](../np.MeetingNotes/src/NPMeetingNotes.js#L77)** in `np.MeetingNotes/src/NPMeetingNotes.js` - `insertNoteTemplate()`
   - `Editor.content = result`
   - **Reason**: Setting content on the Editor after template rendering, not reading a template

11. **[Line 528](../np.MeetingNotes/src/NPMeetingNotes.js#L528)** in `np.MeetingNotes/src/NPMeetingNotes.js` - `appendPrependNewNote()`
   - `const originalContentLength = note.content?.length ?? 0`
   - **Reason**: Getting length of regular note content, not reading a template

### Summary

- **Total Changes Made**: 8 locations
  - **np.Templating**: 5 locations
  - **np.MeetingNotes**: 3 locations
- **Total Unchanged**: 11 locations
  - **np.Templating**: 8 locations
  - **np.MeetingNotes**: 3 locations
- **Paragraph.content Usage**: 2 locations (not applicable for this change)

All template content reads now use `getContentWithLinks()` which will automatically return `contentWithAbsoluteAttachmentPaths` when the template contains file or image links, ensuring that attachment paths work correctly when templates are processed.

**Note**: np.MeetingNotes uses templates by calling np.Templating functions internally. However, it also has some direct template content reads for pre-rendering and attribute checking, which have been updated.

---

## Additional Refactoring: `getTemplate()` → `getTemplateContent()`

The `getTemplate()` function has been renamed to `getTemplateContent()` throughout the codebase for clarity and consistency. This function now also uses `getContentWithLinks()` internally before returning template content.

### Changes Made:

**Core Template Function:**
- **`np.Templating/lib/core/templateManager.js`**:
  - Renamed function from `getTemplate()` to `getTemplateContent()`
  - Updated to use `getContentWithLinks(selectedTemplate)` instead of `selectedTemplate?.content || ''`
  - Updated all internal log messages

**Wrapper Functions:**
- **`np.Templating/lib/NPTemplating.js`**:
  - Renamed static method from `getTemplate()` to `getTemplateContent()`
  - Updated import and internal call
- **`np.Templating/src/Templating.js`**:
  - Renamed exported function from `getTemplate()` to `getTemplateContent()`
  - Updated all calls to `NPTemplating.getTemplateContent()`
- **`np.Templating/src/index.js`**:
  - Updated export from `getTemplate` to `getTemplateContent`
- **`np.Templating/plugin.json`**:
  - Updated command registration from `getTemplate` to `getTemplateContent`

**Internal Usage:**
- **`np.Templating/lib/rendering/templateProcessor.js`**:
  - Updated import to use `getTemplateContent`
  - Updated all 3 internal calls to `getTemplateContent()`

**External Plugin Usage:**
- **`np.MeetingNotes/src/NPMeetingNotes.js`**: Updated import and call
- **`jgclark.DailyJournal/src/templatesStartEnd.js`**: Updated call to `NPTemplating.getTemplateContent()`
- **`dwertheimer.Forms/src/NPTemplateForm.js`**: Updated call to `NPTemplating.getTemplateContent()`

**Test Files:**
- **`np.Templating/__tests__/import-tag-processor.test.js`**: Updated imports and mocks
- **`np.Templating/__tests__/include-tag-processor.test.js`**: Updated mocks
- **`np.Templating/__tests__/getTemplate.test.js`**: Updated all references to `getTemplateContent`
- **`np.Templating/__tests__/template-preprocessing.test.js`**: Updated mock
- **`np.Templating/__tests__/full-pipeline-integration.test.js`**: Updated mock

**Files Updated:** 16 files total

This refactoring ensures that all template content retrieval goes through `getContentWithLinks()`, automatically handling file/image attachment paths correctly.
