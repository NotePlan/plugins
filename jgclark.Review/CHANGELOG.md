# Changelog
See [website README for more details](https://github.com/NotePlan/plugins/tree/main/jgclark.Review), and how to configure.

<!-- - new: command `/addProject` that adds a new note representing a project, asking for its metadata -->

### v0.3.0, 21.8.2021
- update: changes the `noteTypeTags` setting to be an array of strings not a comma-separated string. E.g. `noteTypeTags: ["#area", "#project"]`
- new: adds support for projects labelled `#cancelled` or `#someday` -- these are marked differently in the output lists
- new: adds setting `displayArchivedProjects` which for the command `/project lists` controls whether to display project notes marked `#archive`

### v0.2.3, 1.8.2021
- new: command `/complete project` that adds a `@completed(today)` date,

### v0.2.2, 1.8.2021
- new: setting `foldersToIgnore` that allows an array of folder names to ignore in the commands
- fix: contents of sub-folders were being duplicated in the lists

### v0.2.0, 26.7.2021
- first release.
