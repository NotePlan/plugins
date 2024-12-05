# 📙 NoteHelpers plugin
This plugin provides commands to do things with notes that aren't yet provided in the app:

- **add number of days to dates**: looks for bullets in your current open note that end with `[[YYYY-MM-DD]]:` and adds the number of days to or since that date. Useful for making lists of important days and easily knowing number of days to (or since) that day.
- **add trigger to note**: makes it easy to add a trigger to a particular note. It lists the functions from all plugins that it can work out are written for triggers, but also allows any function to be picked. (See [NotePlan help page on Triggers](https://help.noteplan.co/article/173-plugin-note-triggers).)
- **convert to frontmatter**: convert the current note to use frontmatter syntax, including optional default text that can be added in the Plugin's settings.
- **delete note** (alias **dn**): delete the current note (moves to Trash). This is quicker than the current convoluted way through the NotePlan UI.
- **enable heading links**: converts Local links to headings (they start with the `#` character) to `x-callback-url` links that makes them work the way you expect them to. Note: They currently only support links to headings within the same note.  (by @nmn)
- **find and link unlinked notes in current note**: finds and creates links to existing notes in the current note (by @aaronpoweruser). See below for more details.
- **index folders** (alias **index**): make/update indexes for all notes in a folder (and sub-folders if wanted). There are settings available to customise this:
  - Sort order for index items: 'alphabetical', 'createdDate' or 'updatedDate'
  - What type of date suffix to add?: 'none', 'timeSince' last update, 'updatedDate'
  - Include Subfolders when making an index? If set, then all subfolders will be indexed in the same name as the folder.
  - Title to use for Index notes: this can include a placeholder `{{folder}}` or `{{full_folder_path}}` which will be replaced by the folder's name or full path.
- **jump to heading** (alias **jh**): jumps the cursor to the selected heading in the current note. See below for how to use this from a x-callback-url
- **jump to note's heading** (alias **jn**): jump to a different note, and then to the selected heading
- **jump to done** (alias **jd**): simply jumps the cursor to the `## Done` section of the current note (if it exists)
- **list inconsistent note filenames**: lists the names of notes whose filenames are inconsistent with their titles
- **move note** (alias **mn**): which moves a note to a different folder the user selects
- **open current note new split** (alias **ocns**): open the current note again in a new split of the main window (and places the cursor at what it judges to be the start of the main content)
- **open note new window** (alias **onw**): open a user-selected note in a new window (and places the cursor at what it judges to be the start of the main content)
- **open note new split** (alias **ons**): open a user-selected note in a new split of the main window (and places the cursor at what it judges to be the start of the main content)
- **open url from a note**: asks for a note, and then presents a list of URLs found in that note. The selected one is then opened in your default browser. (There's a setting to ignore URLs in closed tasks.)
- **rename note filename**: renames the currently open note to one you specify. Note: this changes the underlying _filename_ not the visible _title_.
- **rename filename to title**: renames the current filename to the title of the note
- **rename inconsistent note filenames**: renames the files of notes whose filenames are inconsistent with their titles. When run it offers to rename all in one go, or to go one by one so you can choose which ones to rename.
- **reset title to match filename**: resets the current note title to match its filename.
- **reset caches**: this simply runs the command of that name in the NotePlan Help menu.
- **Show This Month** (alias **/stm**)
- **Show This Quarter** (alias **/stq**)
- **Show This Year** (alias **/sty**)
- **update all indexes** (alias **uai**): updates all the existing folder index notes

**Tip**: some of these are even more helpful if you assign a keyboard shortcut to them, using macOS's Keyboard > Shortcuts > App Shortcuts system. For example I have mapped ⇧⌘H to `/jump to heading`.

(If these commands are useful to you, you'll probably find the [TidyUp plugin](https://github.com/NotePlan/plugins/blob/main/np.Tidy/) helpful too. It's rather arbitrary which commands live in which plugin.)

## "find and link unlinked notes ..." commands
Here is a demo:
![Unlinked notes demo](docs/unlinked_note_demo.gif) 

_Awaiting @aaronpoweruser to provide more detailed documentation._

- There is also a version of the command **/find and link unlinked notes in all notes** which runs over all notes, not just the current one
- It introduces a new `onEditorWillSave` trigger called `triggerFindUnlinkedNotes` which can be added to any notes of interest.

## Using from x-callback-url calls
You can trigger these commands from [outside NotePlan using the **x-callback-url mechanism**](https://help.noteplan.co/article/49-x-callback-url-scheme#runplugin). This can be used in a **template** or **shortcut**, or any other place a URL can be accessed. Every call takes the same form:
```
noteplan://x-callback-url/runPlugin?pluginID=jgclark.NoteHelpers&command=<encoded command name>
```
As with all x-callback-urls, all the arguments (including the command name) need to be URL encoded. For example, spaces need to be turned into '%20'.  **Tip**: use @dwertheimer's Link Creator Plugin's "/Get x-callback-url" command to do the fiddly work for you.

Additionally the **add trigger to note**, **index folders** and **jump to heading** commands can take arguments, which also need to be encoded. 
```
noteplan://x-callback-url/runPlugin?pluginID=jgclark.NoteHelpers&command=<encoded command name>&arg0=<encoded string>[&arg1=<encoded string>]
```
The arguments are:

| Command | encoded command name | arg0 | arg1 |
|-----|-------------|-----|-----|
| add trigger to note | `...add%20trigger%20to%20note&` | "triggers: ..." line to add to frontmatter | - |
| index folders | `...index%20folders&` | folder name | other args as a `key=value;key2=value` string.<br />Possible keys are displayOrder (`alphabetical` (default) or `updatedDate`, `createdDate`),  dateDisplayType (`none` (default) or `timeSince`, `updateDate`), includeSubfolders (`true` or `false`) |
| jump to heading | `...jump%20to%20heading&` | heading to jump to | - |

## Support
If you find an issue with this plugin, or would like to suggest new features for it, please raise a [Bug or Feature 'Issue'](https://github.com/NotePlan/plugins/issues).

If you would like to support my late-night work extending NotePlan through writing these plugins, you can through:

[<img width="200px" alt="Buy Me A Coffee" src="https://www.buymeacoffee.com/assets/img/guidelines/download-assets-sm-2.svg" />](https://www.buymeacoffee.com/revjgc)

Thanks!

## History
See [CHANGELOG](CHANGELOG.md) for the plugin's history.
