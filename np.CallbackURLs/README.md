# X-Callback-URL Creator Plugin Noteplan Plugin

## About X-Callback-URL Creator
X-Callback-URLs are extremely useful. They can be used to create links which open notes and perform actions from inside of NotePlan. They also allow you to automate things inside of NotePlan from Shortcuts or other apps. How to use X-Callback-URLs is covered in [the documentation](https://help.noteplan.co/article/49-x-callback-url-scheme), but creating the URLs can be a little challenging. Hence why this wizard was created. It helps take *some* of the guesswork out of creating URLs that you can use to open notes, run plugins, etc.

## X-Callback-Types
As you can see from [the documentation](https://help.noteplan.co/article/49-x-callback-url-scheme), there are lots of different types of callbacks. The most frequently used ones are probably `openNote`, `addText` and `runPlugin`, and so that's where v1 of this plugin started.

### How to use it
Invoke the wizard by typing the `/Get X-Callback-URL` command. You will be walked through creating the X-Callback-URL. 

### Implemented so far:
- openNote - pretty self explanatory in the wizard
- addText - pretty self explanatory in the wizard
- runPlugin - mostly self-explanatory. The only tricky bit is that every plugin command may have slightly different parameters it's expecting, so you may need to figure out what the key/value pairs are that a particular plugin is looking for by reading its documentation.

### Coming in the future (based on user demand -- see below):
- addNote
- deleteNote
- selectTag
- search
- noteInfo (x-success)
- x-success

### Feedback is welcome
If you are interested in the other types (not implemented yet), please comment in the #plugins channel in the Discord, and tag @dwertheimer to let us know which of the above you are most interested in. It will help us prioritize future releases.