<h1 align="center">
    <img src="docs/images/Templating-logo-2.png" alt="Templating Command Bar">
</h1>

# 🧩 Templating plugin for Noteplan

Here’s a grouped **release announcement** message summarizing the **new features and improvements** in the latest Templating plugin updates (v2.0.0–2.0.8), leaving out bug fixes:

---

### 🆕 Templating Plugin v2.0.x — Major Features & Enhancements

We’re excited to announce a major series of updates to the Templating plugin, packed with powerful new features, workflow enhancements, and developer tools. Here’s what’s new:

---

#### 📄 **Template Note Creation & Insertion**

* You can now use `InsertTemplate` or `AppendTemplate` to:

  * 🆕 Automatically create a new note in the specified folder when used on a blank note.
  * 📁 Prompt to move the current note to the target folder if it's not blank.
* Support for `newNoteTitle` argument and JSON vars for better **Shortcuts** integration.
* `templateAppend` command improvements for **easier testing**.

---

#### 🧠 **Smarter & More Flexible Template Tags**

* New tag functions:

  * `getValuesForKey`: retrieve all values for a specific frontmatter key.
  * `promptKey`: interactive user prompts with folder filtering.
  * `getNote`: fetch notes by title, filename, or ID.
* `<select XXX>` now allows for **folder selection from filtered list**.
* Support for adding properties with `---` block in templates.

---

#### 📅 **Date & Time Enhancements**

* `date.daysUntil` added.
* `formattedDateTime` now supports both `strftime` and `moment.js`.
* `now` works correctly with `offsetDays`.
* `date8601` bug fixed.
* Updated to match NotePlan’s **week numbering and week start** settings.

---

#### 🧾 **Note & Task Utilities**

* New functions in `NoteModule`:

  * `note.currentNote()`
  * `note.getRandomLine()`
  * `openTasks`, `completedTasks`, `openChecklists`, `completedChecklists`
* Added `eventDate` and `eventEndDate` for use with Meeting Notes.
* Stoic quotes, Bible verses, journaling questions now available in `web.services`.

---

#### 🌐 **Web Services Enhancements**

* `web.services` now globally accessible with automatic `await`.
* Improved timeout messages for advice, verse, quote, and weather services.

---

#### 🔗 **Documentation**

* All plugin documentation links now point to the **new documentation site**.

---

Thanks to everyone who submitted feature requests, especially @jgclark and Tim Shaker! As always, feedback is welcome.

---

**Templating** is a template language plugin for NotePlan that lets you insert variables and method results into your notes. It will also let you execute custom JavaScript constructed in the templates providing a rich note taking system.

## Documentation
📖 This README provides a quick overview of Templating, visit [Templating website](https://noteplan.co/templates/docs) for comprehensive documention.

> **NOTE:** Start Here: [Templating Documentation](https://noteplan.co/templates/docs)

## Commands
All commands can be invoked using the _NotePlan Command Bar_ (`Command-J` then ` / `) which NotePlan has reserved for plugin activation. Or by selecting `🧩 Templating` from the **Plugins** menu)

<h1 align="center">
    <img src="docs/images/command-bar-templating.png" alt="Templating Command Bar">
</h1>

Once the command bar is displayed, you can continue typing any of the following commands to invoke the appropriate plugin command.  In some case where specifically noted, you can alternately invoke the plugin command at the current insertion pointer within your document.

📖 Visit [Templating website](https://noteplan.co/templates/docs) for comprehensive documention

| Command                 | Available Inline | Description                                                                                        |
| ----------------------- | ----------------- | ------------------------------------------------------------------------------------------------- |
| np:append               | Yes               | Appends selected template at end of current note (will show list of all available templates)      |
| np:insert               | Yes               | Insert selected template at cursor (will show list of all available templates)                    |
| np:invoke               | Yes               | Invoke Template Command, using `location` key in template to determine injected template          |
|                         |                   | contents into current                                                                             |
| np:new                  | Yes               | Creates a new note from selected template and supplied note name                                  |
| np:qtn                  | Yes               | Invokes Quick Note Generation (displays list of all `type: quick-note`)                           |
| np:update               | Yes               | Invokes settings update method                                                                    |
| np:version              | Yes               | Displays current Templating version                                                            |

## License

Copyright &copy; 2022 Mike Erickson
Released under the MIT license

## Credits

**Codedugeon Toolbox for NotePlan** written by **Mike Erickson**

E-Mail: [codedungeon@gmail.com](mailto:codedungeon@gmail.com)

Support: [https://github.com/NotePlan/plugins/issues](https://github.com/NotePlan/plugins/issues)

Twitter: [@codedungeon](http://twitter.com/codedungeon)

Website: [codedungeon.io](http://codedungeon.io)
