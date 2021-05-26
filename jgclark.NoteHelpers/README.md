# NoteHelpers plugin
This plugin provides commands to help work with NotePlan notes.

The first ones are very simple:
- `/mn`: which moves a note to a different folder the user selects
- `/jh`: jumps the cursor to the heading of the current note that the user selects
- `/jd`: simply jumps the cursor to the `## Done` section of the current note (if it exists)

The other two help apply **template**s to new or existing notes:
- `/it`: inserts a template into the current note, after the title
- `/nn`: creates a new note in the current folder, with title, optional template, and optional current text selection

## Configuration
Before the configuration mechanism is available, you need to update the `jgclark.noteHelpers\noteHelpers.js` file in the plugin's folder directly. Update the following lines at the top of the file accordingly:
```js
// Items that should come from the Preference framework in time:
pref_templateName.push("Daily note structure")
pref_templateText.push("### Tasks\n### Media\n\n### Journal\n")
pref_templateName.push("Project Meeting note")
pref_templateText.push("### Project X Meeting on [[date]] with @Y and @Z\n\n### Notes\n\n### Actions\n")
```
You can have any number of templates defined, but each needs a Name and Text.  If there is only a single template configured, then it will be applied automatically by `applyTemplate`.

Templates should normally end with a linefeed character (`\n`).

## History

### v0.8.0, 26.5.2021
- change to using a separate folder for storing Templates, rather than have to hard-code in the plugin code. The first time **/it** or **/nn** is called the command offers to create and populate the '📋 Templates' folder if it doesn't exist
- fix: the **/jd** command now works if the Done section has been folded

### v0.7.1, 15.5.2021
- change to using two-letter command names, to match new style agreed with EM

### v0.7.0, 14.5.2021
- move the **show statistics** command to a separate statistics plugin
- add option to copy to clipboard statistics summary

### v0.6.1, 14.5.2021
- add the **jump to Done** command
- add option to copy to clipboard statistics summary

### v0.5.0, 8.5.2021
- include the example plugin **move Note** command to this plugin

### v0.4.0, 7.5.2021
- added multiple templates to **newNote**
- added **applyTemplate** command

### v0.3.2
- show statistics output on the command bar as well
 
### 0.3.0
- added **statistics**: for now this only writes to the console log (open from the Help menu)
 
### v0.2.0
- added **newNote**
