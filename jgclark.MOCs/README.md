# 🕸 Maps of Content plugin

This will be particularly of interest to Zettelkasten/PKM users, who are used to the idea of 'Maps of Content' (MOC) to be a contents page into a topic.

The plugin has a single command **/make MOC** that runs iteratively, asking the user for search term(s) to look for across all notes. It then creates (or updates) the MOC note, inserting `[[note links]]` to all notes it finds with those search term(s).  These are by default inserted in order of most to least recently updated, though other sorting is possible.

## Configuration
On macOS, click the gear button on the 'MOCs' line in the Plugin Preferences panel to configure this plugin. Each setting has an explanation:

- Match whole words? Should search terms only match whole words? For non-European languages, this may need to be set to false.
- Folders to exclude List of folders to exclude in these commands. May be empty. (Note that @Trash, @Templates and @Archive are always excluded.)
- Heading level Heading level (1-5) to use when writing search term headings in notes.
- Subheading prefix Subheading text to go before the search term. (Default is 'Notes matching'.)
- Prefix for note links Optional string to put at the start of each note link. (Default is '- '.)
- Sort order for results Whether results are sorted alphabetically (the default), by created date, or by last updated date
- Show empty matches? If no matches of the search term(s) are found, setting this true will still show a heading for the term(s).

On iOS/iPadOS run the **/MOC: update plugin settings** command instead.

## Support
If you find an issue with this plugin, or would like to suggest new features for it, please raise a [Bug or Feature 'Issue'](https://github.com/NotePlan/plugins/issues).

If you would like to support my late-night work extending NotePlan through writing these plugins, you can through:

[<img width="200px" alt="Buy Me A Coffee" src="https://www.buymeacoffee.com/assets/img/guidelines/download-assets-sm-2.svg" />](https://www.buymeacoffee.com/revjgc)

Thanks!

## History
Please see the [CHANGELOG](CHANGELOG.md).
