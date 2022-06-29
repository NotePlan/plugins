# X-Callback-URL Creator Plugin Noteplan Plugin

[Help/Support on Discord](https://discord.com/channels/763107030223290449/989382962736922635/989382964016193597)

## About X-Callback-URL Creator
X-Callback-URLs are extremely useful. They can be used to create links which open notes and perform actions from inside of NotePlan. They also allow you to automate things inside of NotePlan from Shortcuts or other apps. How to use X-Callback-URLs is covered in [the documentation](https://help.noteplan.co/article/49-x-callback-url-scheme), but creating the URLs can be a little challenging. Hence why this wizard was created. It helps take *some* of the guesswork out of creating URLs that you can use to open notes, run plugins, etc.

## X-Callback-Types
As you can see from [the documentation](https://help.noteplan.co/article/49-x-callback-url-scheme), there are lots of different types of callbacks. 

### How to use it
Invoke the wizard by typing the `/Get X-Callback-URL` command. You will be walked through creating the X-Callback-URL. In the final step, you will be asked what type of output you want:
- a raw URL/link
- a pretty URL link with descriptive text and the URL hidden

The result will be pasted in your Editor at the cursor location.

### Template Tags for Running Plugin Commands
Sometimes you don't want to have to click a link, but rather, you want a certain plugin command to run when you insert/append/invoke a Template (using [np.Templating](https://nptemplating-docs.netlify.app/docs/intro/)). You can also use the wizard to create a template tag for running the plugin. Simply go through the same X-Callback flow, and at the very end, you will be given the choice to paste the link optionally as a Templating tag, like this:
`<% await DataStore.invokePluginCommandByName("Remove All Previous Time Blocks in Calendar Notes Written by this Plugin","dwertheimer.EventAutomations",["no"])  -%>`

### Implemented so far:
- openNote - pretty self explanatory in the wizard
- addText - pretty self explanatory in the wizard
- filter - open "Filters" with a pre-defined filter
- search - search for specified text
- runPlugin - helps you run specific plugin commands from a link. The only tricky bit is that every plugin command may have slightly different parameters it's expecting, so you may need to figure out what the key/value pairs are that a particular plugin is looking for by reading its documentation. The wizard will help you with that also.
- run shortcut - create a URL to run an Apple Shortcut command by name

### Coming in the future (based on user demand -- see below):
- addNote
- deleteNote
- selectTag
- noteInfo (x-success)
- x-success

### Feedback is welcome
If you are interested in the other types (not implemented yet), please comment on [This Plugin's Discord Thread](https://discord.com/channels/763107030223290449/989382962736922635/989382964016193597) to let us know which of the above you are most interested in. It will help us prioritize future releases.
