# 🧩 Link Creator Plugin

[Help/Support on Discord](https://discord.com/channels/763107030223290449/989382962736922635/989382964016193597)

## Major functions

- X-Callback Link Creation
- Act on URLs in a document (open one URL or all URLs in a document)

## About X-Callback-URL Creator

X-Callback-URLs are extremely useful. They can be used to create links which open notes and perform actions from inside of NotePlan. They also allow you to automate things inside of NotePlan from Shortcuts or other apps. How to use X-Callback-URLs is covered in [the documentation](https://help.noteplan.co/article/49-x-callback-url-scheme), but creating the URLs can be a little challenging. Hence why this wizard was created. It helps take *some* of the guesswork out of creating URLs that you can use to open notes, run plugins, etc.

## Example: Links to Notes and a specific heading

The simplest use case is to create a link to the currently-open document and the currently-selected heading level (e.g. a link to block).
You can run this command directly by running the commmand:
    `/Create Link to Current Note+Heading`

## X-Callback-Types

As you can see from [the documentation](https://help.noteplan.co/article/49-x-callback-url-scheme), there are lots of different types of callbacks.

### How to use it

Invoke the wizard by typing the `/Get X-Callback-URL` command. You will be walked through creating the X-Callback-URL. In the final step, you will be asked what type of output you want:

- a raw URL/link
- a pretty URL link with descriptive text and the URL hidden
- (or, in relevant cases) a Template tag that can be used in a Template

The result will be pasted in your Editor at the cursor location.

### Template Tags for Running Plugin Commands

Sometimes you don't want to have to click a link, but rather, you want a certain plugin command to run when you insert/append/invoke a Template (using [np.Templating](https://nptemplating-docs.netlify.app/docs/intro/)). You can also use the wizard to create a template tag for running the plugin. Simply go through the same X-Callback flow, and at the very end, you will be given the choice to paste the link optionally as a Templating tag, like this:
`<% await DataStore.invokePluginCommandByName("Remove All Previous Time Blocks in Calendar Notes Written by this Plugin","dwertheimer.EventAutomations",["no"])  -%>`

### X-Callback Types

- openNote - pretty self explanatory in the wizard
- addNote - create a note with optional title, folder, content, and opening type
- addText - pretty self explanatory in the wizard
- deleteNote - delete a specified note when link is clicked
- filter - open "Filters" with a pre-defined filter
- search - search for specified text
- noteInfo (x-success) - can be used to tell another app about the currently-open note in NotePlan
- runPlugin - helps you run specific plugin commands from a link. The only tricky bit is that every plugin command may have slightly different parameters it's expecting, so you may need to figure out what the key/value pairs are that a particular plugin is looking for by reading its documentation. The wizard will help you with that also.
- run TEMPLATE - run a self-running Template using TemplateRunner (see below)
- run shortcut - create a URL to run an Apple Shortcut command by name

### Coming in the future (based on user demand -- see below)

- selectTag

### Running a Template

By selecting the option "Run Template", you can use Templating2.0+'s feature of self-running templates. These special type of templates can be invoked via URL. The "Run a Template" command in this plugin will walk you through the creation of a self-running template and the link to call it (both of which you can edit later)

Field names can be sent in the URL to your template as key=value pairs, separated by semicolons.

## X-Success Returns

- Any NotePlan X-Callback command can run and return execution to a different app after execution. The Wizard will ask at the end of command creation if this is something you want to do. By default this option is turned off in the wizard, however you can enable it in the plugin settings.
  
## Act on URLs in a document (open one URL or all URLs in a document)

Commands are:

- `/open todos containing links in browser` - will open any URLs found in the current document's OPEN todos (or open checklist items)
- `/open URL on this line` - will open any url on the line the cursor is currently on

### Feedback is welcome

If you are interested in the other types (not implemented yet), please comment on [This Plugin's Discord Thread](https://discord.com/channels/763107030223290449/989382962736922635/989382964016193597) to let us know which of the above you are most interested in. It will help us prioritize future releases.
