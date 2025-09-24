# np.MeetingNotes Changelog

## About np.MeetingNotes Plugin

See Plugin [README](https://github.com/NotePlan/plugins/blob/main/np.MeetingNotes/README.md) for details on available commands and use case.

## [2.0.6] - 2025-09-11 @dwertheimer

- Fix using button on empty template, especially with teamspace notes

### b3
- fix chooseFolder() that was forcing new folder creation when it was not needed

## [2.0.5] - 2025-08-11 @dwertheimer

- Just bumping version to make sure title setting and meeting note validation are happening in MN

## [2.0.4] - 2025-08-07 @dwertheimer

- Fix edge case where note had frontmatter but empty body and the template was overwriting the frontmatter
- Add logging

## [2.0.3] - 2025-08-06 @dwertheimer

- Make it possible for a template to have any level of heading for the title (was previously H1 only)

## [2.0.2] - 2025-08-05 @dwertheimer

- Fix bug where inline H1 title was not being used in templateNew (thx @crussell)

## [2.0.1] - 2025-08-02 @dwertheimer

- Add override when inserting a template into a blank note but template has folder or newNoteTitle attribute

## [2.0.0] - 2025-05-13 @dwertheimer

- Add <current> to append/prepend frontmatter tag
- prepending a recurring meeting note will now accept a folder argument
- Use Templating 2.0, but...
- call Templating 2.0 commands via DataStore.invokePluginCommandByName() instead of directly calling them and importing all of np.Templating
- removed renderNoteTemplate() function which did not do anything

## [1.2.3] -  2024-02-19 @dwertheimer

- Allow for empty template frontmatter

## [1.2.2] -  2024-02-07 @dwertheimer

- Update MEETINGNOTE link handling to allow for existing meeting notes to be opened automatically

## [1.2.1] -  2023-10-24 @dwertheimer

- hiding plugin from directory

## [1.2.0] - 2023-09-25 (@dwertheimer)

- Adding some intelligence to try to pick up existing meeting notes so as to not create them again

## [1.1.9] - 2023-03-03 (@dwertheimer)

- no meeting note code changes. just pulling in newest Templating code with fix for promptDate

## [1.1.8] - 2023-03-03 (@dwertheimer)

- no code changes. just pulling in newest Templating code with fix for dashes in template

## [1.1.7] - 2023-02-24 (@dwertheimer)

- add ability to output meeting note at cursor in <current> note

## [1.1.6] - 2022-12-14 (@dwertheimer)

- fix bug that Ed found in newMeetingNote asking you to select from all templates

## [1.1.5] - 2022-12-13 (@jgclark)

- fix flow erorrs

## [1.1.4] - 2022-12-12 (@eduardme)

- under the hood changes to allow call by template's title as well as filename

## [1.1.2] - 2022-12-06 (@jgclark)

- Further refined error reporting on bad templates to help people fix them
- improved jsdoc a little more
- use np.Templating::getAttributes instead of calling fm() directly

## [1.1.1] - 2022-12-06 (@jgclark)

- Make newMeetingNoteFromEventID() better at handling bad template defintions
- improved JSDoc where I could

## [1.1.0] - 2022-12-06 (@dwertheimer)

- Added newMeetingNoteFromEventID() to be called via xcallback
- Made newMeetingNote not hidden anymore (allow people to select event/note)
- Changed the order of selection (meeting first then template)
- Fixed a lot of Flow defs

## [0.1.2] - 2022-08-16 (@dwertheiemr)

- Commented out DataStore.invokePluginCommandByName
- Other minor changes

## [0.1.0] - 2022-08-09 (@codedungeon)

- Fixed linting errors
- Implemented `DataStore.invokePluginCommandByName`, replacing intrinsically calling `NPTemplating` command

## Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Plugin Versioning Uses Semver

All NotePlan plugins follow `semver` versioning. For details, please refer to [semver website](https://semver.org/)
