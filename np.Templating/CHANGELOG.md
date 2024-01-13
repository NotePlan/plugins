# np.Templating Changelog

## About np.Templating Plugin

See Plugin [README](https://github.com/NotePlan/plugins/blob/main/np.Templating/README.md) for details on available commands and use case.

## [1.10.1] 2024-01-11 @dwertheimer

- Bug fix to remove spaces after comment tags (<%#...)

## [1.10.0] 2023-10-31 @dwertheimer

- Command name changes require NotePlan 3.9.10
- Change commands to be more descriptive (using @eduardme's new naming scheme)
- Tweak np:invoke to work correctly with frontmatter

## [1.9.12] 2023-10-24 @dwertheimer

- Changed title to just 'Templating']

## [1.9.11] 2023-10-12 @jgclark
- add 'todayProgressFromTemplate' template command (from Habits & Summaries v0.20)

## [1.9.10] (aka 2.0.0-bet1.13): 2023-09-11 @dwertheimer

- add folder attribute to np:new for xcallback creation inside a specific folder]

## [1.9.9] (aka 2.0.0-beta.12): 2023-08-12 @dwertheimer

- Fix templatejs code so it doesn't add extra spaces

## [1.9.8] (aka 2.0.0-beta.11): 2023-07-12 @dwertheimer

- Fix web services intermittent bug

## [1.9.7] (aka 2.0.0-beta.10) - 2023-05-01 @dwertheimer

- Fix bug in promptDate / promptDateInterval

## [1.9.6] (aka 2.0.0-beta.09) - 2023-04-02 @dwertheimer

- Fix bug in template importing

## [2.0.0-beta.08] - 2023-03-31 @dwertheimer NOTE: this version was released publicly as [1.9.5]

- Fix bug where you could not use the word 'prompt' in text in a tag

## [2.0.0-beta.07] - NOTE: this version was released publicly as [1.9.4]

- Updated globals for command name change to: appendProgressUpdate

## [2.0.0-beta.06] - NOTE: this version was released publicly as [1.9.3]

- double dashes in templates create frontmatter is now in render (not just np:new)

## [2.0.0-beta.05] - 2023-03-01 (@dwertheimer)

- roll back change of replacing '---' with '*****'
- added new tests to ensure rendering with separators works as expected

## [2.0.0-beta.04] - 2023-02-24 (@dwertheimer)

- Fixed issue that template was not passable to np:new and np:qtn
- Removed template migration code (now one year past migration)
- Added folder creation option to folder chooser

## [2.0.0-beta.03] - 2023-02-05 (dwertheimer)

- Fixed minor issue in .isWeekend where NP was getting different answers than Jest. Has to do with locales, so changed it to use moment in this function. there are more that need to be changed.

## [2.0.0-beta.02] - 2023-02-01 (dwertheimer)

- Fixed minor timezone issue in .add (now using same method as subtract was using)

## [2.0.0-beta.01] - 2023-01-15 (mikeerickson)

- Lowered version to beta, this should not be a release version which was changed by @dwertheimer on 2022-01-13

## [2.0.2] - 2023-01-13 (dwertheimer)

- fix bug that was keeping promptDateInterval from working
- fix bug that was causing prompts to fail if you had a period in the prompt

## [2.0.1-alpha.14] - 2023-01-03 (dwertheimer)

- fix logging whitespace on error message

## [2.0.0-alpha.13] - 2022-12-21 (dwertheimer)

- fix edge case in self-running templates
- Added getNoteTitled instead of writeNoteTitle|openNoteTitle

## [2.0.0-alpha.12] - 2022-12-08 (dwertheimer)

- Added a little extra logging to self-running templates

## [2.0.0-alpha.11] - 2022-12-13 (dwertheimer)

- Allow np:append to be called with a template variable

## [2.0.0-alpha.10] - 2022-09-19 (dwertheimer)

- Tweaks to NPEditor to allow for replaceNoteContents to replace all content in a note
- Minor bug fixes for bugs found along the way

## [2.0.0-alpha.09] - 2022-08-12 (dwertheimer)

- self-running templates: fixed problems in introduced by API changes in how args are passed using xcallbacks
- self-running templates: added <select>|<choose> for heading and for file to open
- removed some logging I had previously put in for debugging MeetingNotes

## [2.0.0-alpha.08] - 2022-08-12 (mikeerickson)

- fixed issues with prompts that included reserved words such as `import`, `note`.

## [2.0.0-alpha.07] - 2022-07-24 (mikeerickson)

## [2.0.0-alpha.06] - 2022-07-24 (mikeerickson)

- incorporated Debugging section to np.Templating Settings (thanks @dwertheimer)

## [2.0.0-alpha.05] - 2022-07-17 (mikeerickson)

- Added preRender code to `NPTemplating.renderTemplate`

## [2.0.0-alpha.04] - 2022-07-17 (mikeerickson)

- Renamed `src/Editor.js` -> `src/NPEditor.js` (my bad, didn't follow naming convention rules)

## [2.0.0-alpha.03] - 2022-07-17 (mikeerickson)

- quite a bit of refactoring, addressing growing Templating.js file (969 loc -> 647 loc)
- removed outdated commands (no longer a need as most users templates have been migrated)
  > Note: The automatic template conversion will still run when np.Templating is installed, just removing command noise
- fixed issues when template code contained reserved words `include`, `note`, `calendar`, and `template` (was to loose with keyword replacement)
- expanded template error output to include line and position (results will vary depending on how you have constructed template)

## [2.0.0-alpha.02] - 2022-07-13 (mikeerickson)

- added Word Of The Day
  > Use `np:wotd` to insert at cursor of current note
  > Or, use in template `<%- web.wotd() %>`

## [2.0.0-alpha.01] - 2022-06-05 .. 2022-07-07 (mikeerickson)

- added template code block execution
- added `import` statement for importing any type of helper modules
- added `include` method (will include project notes, calendar notes, templates)
  > when "including" template, it will be rendered automatically
- added `template` method
  > you can also use `include` with the template and it will perform the same action as the `include` method
  > when "including" template, it will be rendered automatically
- added `note` method
    > you can also use `include` with a note and it will perform the same action as the `note` method
- added `calendar` method
    > you can also use `include` with a note and it will perform the same action as the `calendar` method
- added `clo` helper which can be used to help debug more complex templates
- added a `calendar` module placeholder (more coming in the future but didn't want to lose sight )
- `getTemplateList` will now filter out any templates which have `type = ignore` (@dwertheimer)
- added `np:xcb` command to build x-callback for current template

## [1.2.0] - 2022-06-04 (mikeerickson)

- Public Release
- Changed Plugin Name to "📒 np.Templating"

> Removed - New designation

## [1.2.0-rc.01] - 2022-06-02 (mikeerickson)

- Release Candidate #1

## [1.2.0-beta.09] - 2022-06-02 (mikeerickson)

- Added `daysBetween` to [Date Module](https://nptemplating-docs.netlify.app/docs/templating-modules/date-module#daysbetween)

## [1.2.0-beta.08] - 2022-06-01 (mikeerickson)

- Added `Note Module`
  > There are 14 new commands in Note Module, thus only listing the new module here, refer to [documentation](https://nptemplating-docs.netlify.app/docs/templating-modules/note-module) for more information
- Added `startOfMonth` to [Date Module](https://nptemplating-docs.netlify.app/docs/templating-modules/date-module#startofmonth)
- Added `endOfMonth` to [Date Module](https://nptemplating-docs.netlify.app/docs/templating-modules/date-module#endofmonth)
- Added `daysInMonth` to [Date Module](https://nptemplating-docs.netlify.app/docs/templating-modules/date-module#daysinmonth)
- Added `getFrontmatterText` to [Frontmatter Module](https://nptemplating-docs.netlify.app/docs/templating-modules/frontmatter-module#getfrontmattertext)

## [1.2.0-beta.07] - 2022-05-26 (mikeerickson)

- added `NPTemplating.getTemplate` export, supporting `DataStore.invokePluginCommandByName`
- added `NPTemplating.preRender` export, supporting `DataStore.invokePluginCommandByName`
- added `NPTemplating.render` export, supporting `DataStore.invokePluginCommandByName`

## [1.2.0-beta.06] - 2022-05-24 (mikeerickson)

- fixed issue passing format string to `web.weather` (was not passing data in fix applied in `1.2.0-beta.03`)
- adjusted `np:invoke` command to use `prepend`, `insert`, `append`

## [1.2.0-beta.05] - 2022-05-20 (mikeerickson)

- fixed regression created by merge conflicts in recent push

## [1.2.0-beta.04] - 2022-05-20 (mikeerickson)

- fixed issue with DateModule `now` when using `offset` value
- added template reentrance when calling `FrontMatter.parse` provide ability for attributes to use any attribute before the current attribute.
- added `np:invoke` which uses a new template attribute `location` to control where template is placed on current note

> `append` appends to the end of current note (same as `np:append`)
> `cursor` inserts at the cursor position of the current note
> `insert` inserts at the beginning of current note (same as `np:insert`)

- added `convertProjectNoteToFrontmatter` to `FrontMatterModule` class
- added new command `np:convert` which will convert the current project note to frontmatter format

> uses `FrontmatterModule.convertProjectNoteToFrontmatter` method

## [1.2.0-beta.03] - 2022-05-18 (mikeerickson)

- refactor web service implementation, experiencing issues latest vesion of NotePlan

## [1.2.0-beta.02] - 2022-05-17 (mikeerickson)

- fixed issue when template contains folder which has value of `<select>` to prompt user of where new note should be created (@jgclark)

## [1.2.0-beta.01] - 2022-05-15 (mikeerickson)

- added `templateGroupTemplatesByFolder` setting (default: false)

> If true, template chooser will show complete folder path
> If false, template choooser will only show template name

- implemented `onSettingsUpdated` to handle new `templateGroupTemplatesByFolder` setting
- fixed issue when using `previousBusinessDay` and `nextBusinessDay` when system Preferred language is not `English US`
- fixed issue with `prompt` command when using choices and one of choice values contained `let` text in option such as `completed by`
- fixed date display when using business functions (`businessAdd`, `businessSubtract`, `nextBusinessDay`, `previousBusinessDay`)
- fixed issue with `prompt` when supplying default value

> e.g. `<%- prompt('placeholder','Enter First Name', 'Mike')%>`

- added `invokePluginCommandByName` to `globals.js` process, decoupling associated plugin commands

> see `globals.js` for implementation

- extended template rendering error message to include `line` and `column` where available

> making it much easier to identify where the error exists in template

## [1.1.3-beta.02] - 2022-05-07 (mikeerickson)

- fix regression introduced in 1.1.2-beta.03 related to replacing `---` with `*****`, was perform replacement too soon
  - Revealed in jgclark.DailyJournal

## [1.1.3-beta.01] - 2022-05-06 (mikeerickson)

WIP - Publishing Internal for @jgclark test with `/dayStart`

## [1.1.2-beta.04] - 2022-05-04 (mikeerickson)

- Interval validation passed (confirmed by @eduard, @dwertheimer, and @jgclark)
- Removed `/Test` condition applied to `1.1.2-beta.03`

## [1.1.2-beta.03] - 2022-05-04 (mikeerickson)

IMPORTANT: Internal beta 03 release is migration templates to "@Templates/Test".  This "Test" will be removed when released to public

- additional migration adjustments
- automatically correct template rendering when `---` used as separator in body of template (replaced with `*****`)
- when migrating templates, all `---` in template body (after frontmatter) will be replaced with `****`

Template Migration should only take place under the following conditions

1. There are existing templates in "📋 Templates" folder
2. There are 0 tempaltes in "@Templates" folder which don't have a template containing `tags: migrated-template`

If there are > 0 templates which have `tags: migrated-template` migration will NOT be executed.  This is how I can determine if a previous migration was executed
Also, it should be encouraged to rename "📋 Templates" to another name "📋 Templates (Legacy)" after it has been determined migration was successful, I can update the np.Templating docs about this

## [1.1.2-beta.02] - 2022-05-03 (mikeerickson)

- small adjustment to the template migration checker

## [1.1.2-beta.01] - 2022-05-03 (mikeerickson)

- public beta release, confirming template migration code is not executed when migration has already occurred.

## [1.1.1] - 2022-05-03 (mikeerickson)

- fixed issue which was prompting tempalte migration when install or updating `np.Templating` plugin

## [1.1.0] - 2022-05-02 (mikeerickson)

- public release

## [1.1.0-beta.02] - 2022-05-01 (mikeerickson)

- fixed date math when using `.now()` command with `offset` parameter
- deprecated `pickDate` will now return message stating deprecation, point to using `promptDate`
- deprecated `pickDateInterval` will now return message stating deprecation, point to using `promptDateInterval`

> Examples: `<%- date.now('',10) %>`, `<%- date.now('', -90) %>`,  `<%- date.now('', '10w') %>`, `<%- date.now('', '-3M') %>`

## [1.1.0-beta.01] - 2022-04-30 (mikeerickson)

- made adjustments to the template migration code, no longer skipped if `np.Templating` sessions exist

> Note: You can execute `np:migrate-templates` at any time if you need to rexecute migration

- add template migration code to `init` method so it will be executed for each np.Templating command

> This will assure templates have been migrated should something of happened and they were not migrated during np.Templating installation

- fixed tag details (removed `<%=` from documentation, will be supported internally but not an "official" tag`)
- removed `np:mtn` command (and removed from documentation) as it was conflicting with `np.MeetingNotes` implementation
- fixed `np:new` which was not using entered note title (if `newNoteTitle` does not exist in template attributes)
- fixed issue with `NPTemplating.getFolder` interface, was displaying "Choose Destination Folder" even though a default folder was supplied
- added `trim()` to weather output, fixing an issue when applying NotePlan _italic_ style

> `*<%- web.weather() %>*` would be rendered as a todo item

- added `promptDate` which should be used instead of `pickDate` so `placeholder` value can be used in same template in different location
- added `promptDateInterval` which should be used instead of `pickInterval` so `placeholder` value can be used in same template in different location
- fixed issues with `templateLocale` not be used properly in some methods in `DateModule`
- implemented workaround issue with `date.dayNumber()` when running in locales not `en` or `en-US`
- removed hard coded `discuss` variable in template rendering, would have collided if there was a variable in the rendering process which was `dicsuss`
- fixed prompt interface to only ouput prompt value when using output tag `<%-`

> for example, the following will get retrieve the prompt value into variable, but will not show value when template rendered
> `<% prompt('myVar','Enter myVar;') %>`

## [1.0.3] - 2022-04-17 (mikeerickson)

## [1.0.2] - 2022-04-16 (mikeerickson)

- version bump mistake, but it is what it is so we had a very short bug fix release which contained ONLY of version bump (sorry folks)

## [1.0.1] - 2022-04-16 (mikeerickson)

- changed `getTemplateList` and `chooseTemplate` commands to sort templates in alphabetical order
- fixed issue disabling `nmn.Templates` during install or update (`onUpdateOrInstall` hook)
- changed `nmn.Templates` disable message to be more clear and concise, and changed `nmn.Templates` to "Previous Templates"
- changed all dialogs which referenced `np.Templating` documentation url, providing consistency
- fixed `np:qtn` and `np:mtn` to prompt for new note title if `newNoteTitle` attribute not defined in template
- fixed `np:qtn` to prompt for destination folder if `folder` attribute not defined in template
- added default date/time prompt value when when using `np:mtn` (uses `timestampFormat` format in `np.Templating` settings)
- updated README command reference

## [1.0.0] - 2022-04-14 (mikeerickson)

- Public Release

## [1.0.0-beta.38] - 2022-04-12 (mikeerickson)

- fixed second regression, spreading `userData` from `.preRender` to `frontmatterAttributes` (@EduardMe)

## [1.0.0-beta.37] - 2022-04-12 (mikeerickson)

- fixed regression in `np.Templating.preRender` (@EduardMe)

## [1.0.0-beta.36] - 2022-04-12 (mikeerickson)

- Removed test code for template migration (`np:migrate-template`) (@dwertheimer)
- added action to disable `nmn.Templates` during `np.Templating` install, after template migration (@dwertheimer)

## [1.0.0-beta.35] - 2022-04-12 (mikeerickson)

- fixed some additional prompt issues (including regression handling of promps with spaced variables `<%- sleep hours? %>`) (@dwertheimer)

## [1.0.0-beta.34] - 2022-04-11 (mikeerickson)

- Implemented `<current>` and `<select>` when defined in templates which `folder` attribute

> Works with `np:mtn`, `np:qtn` and `np:new` commands

- fixed `<%- meetingName %>` issue when process Quick Note
- added `NPTemplating :: getFolder`
- fixed some prompt related issues
- fixed migration issue when changing `date` to `legacyDate` (was incorrectly updating `progressUpdate`)
- fixed migration issue, fronmatter title was not matching legacy template note name under certain circumstances
- refactor `np:migrate-templates` to not call `np:migration-quick-notes` intrisnically

> still executed together when running in `onUpdateOrInstall` method

- added action to disable `nmn.Templates` in `onUpdateOrInstall` method, after successful template migrations

## [1.0.0-beta.33] - 2022-04-10 (mikeerickson)

- fix issue passing renderData in `data` and `method` properties
- Resolved issue when using `<%- discuss %>`

> Recommend refactoring to use `<%- prompt('discuss') %>`

- Fixed issue with `<%- selection() %>` and `<%- system.selection() %>`

## [1.0.0-beta.32] - 2022-04-09 (mikeerickson)

- Refactored template migration `np:migrate-templates` to create frontmatter templates

## [1.0.0-beta.31] - 2022-04-09 (mikeerickson)

- Added `NPTemplating.preRender` which will render frontmatter attributes
- Refactored `FrontMatter.render` to `FrontMatter.parse`
- Updated `np:qtn` and `np:mtn` to use new `NPTemplating.preRender` method

## [1.0.0-beta.30] - 2022-04-05 (mikeerickson)

- Fixed issue when rendering frontmatter templates which have empty attribute values (this was realised when creating templates which had an empty `type`) [@dwertheimer]
- Extended Editor mock [@mikeerickson]
- Added CommandBar, and DataStor mocks [@mikeerickson]
- Updated `np-module.spec.js` to use new/updated mocks [@mikeerickson]
- Cleared up `skipped` specs, entire test suite is not executed

> _Note: Still working on using alias importing when running specs, thus full E2E tests are incomplete [@dwertheimer]_

- Added `ignore` to `chooseTemplate` which will ignore any templates which include `type: ignore`

## [1.0.0-beta.29] - 2022-04-04 (mikeerickson)

- Changed issue with `np:mtn` to use `newNoteTitle` template attribute if exists, otherwise user will be prompted to supply note title [@jgclark]
- Updated `np:qtn` and `np:mtn` documentation to note required use of new template format (no more legacy template support) [@jgclark]
- Fixed issue with `np:qtn` to use correct `quick-note` type when display template chooser (regression from b28) [@jgclark]
- Updated `np:mtn` to only prompt for discussion if refernce actually exists on template (e.g. `<%- discussion %>`) [@jgclark]

## [1.0.0-beta.28] - 2022-04-04 (mikeerickson)

- Added `np:mtn` which create a meeting note
- Refactored `np:append`, `np:qtn`, `np:new`, and `np:insert` to use new `np.Templating chooseTemplate` interface
- Added `chooseTemplate` method to `NPTemplating` module
- Added `getTemplateList` method to `NPTemplating` module

## [1.0.0-beta.27] - 2022-04-02 (mikeerickson)

- Modified clipboard access to only trigger on templates which have `system.clipboard()` [@EduardMe]
- Added `chooseTemplate` method, extending normal `chooseOption` method to show path to templates (required when templates have same name in different folders)

## [1.0.0-beta.26] - 2022-04-02 (mikeerickson)

- renamed `date` function to `legacyDate` when migrating templates [@dwertheimer]

> `date` is a reserved word in `np.Templating` used for `DateModule`

- updated `np:migrate-quick-notes` to enquote attribute values if they don't start with legal character (`a-zA-z`) [@jgclark]
- updated `frontmatter-module.test.js` to check for invalid attribute values
- see [template documentation](https://nptemplating-docs.netlify.app/docs/templating-commands/quick-notes/#quick-note-template-required-attributes) for details
- added `legacyDates` to `np.Templating` globals [@dwertheimer]
- fixed `pickDate` in `np.Templating` globals [@jgclark]

> Was throwing error parsing JSON5 (see `@helpers/datePicker`) due to invalid parameters

- fixed issue when testing for template `types` using `.includes` instead of `===`
- removed debug code in `templateQuickNote` method

## [1.0.0-beta.25] - 2022-04-01 (mikeerickson)

- fixed regressions with `np:qtn` (<https://github.com/NotePlan/plugins/issues/255>)
- fixed issue with global functions not workign properly when using `np:qtn` (<https://github.com/NotePlan/plugins/issues/255>)
- Refactor `np:migrate-quick-notes` to align with changes discussed with plugin team

> Add `type` field assigning `quick-note` value
> Extended migration to change all `{{` and `}}` tags to align with remainder of template migration

- Refactor `np:qtn` command to only include templates which have `type: quick-note` all other templates will be ignored
- Refactor `np:append`, `np:insert`, `np:new` to exclude templates which have `type: quick-note`
- Added `qqq` alias to `np:qtn` command (requested by @dwertheimer)

> Note: The following aliases are available: qnt, qtn, quick

- Added aliases to each of the following commands (removing requirement for `:`)

> np:append (npa)
> np:new (npn)
> np:insert (npi)
> np:qtn (npq)

## [1.0.0-beta.24] - 2022-03-29 (mikeerickson)

- fixed regression introduced in b23
- removed NotePlan environment specific debug code from all modules, all tests are passing now

## [1.0.0-beta.23] - 2022-03-29 (mikeerickson)

- fixed additional locations of `.md` and `.txt` support that were missed in b22
- fixed issue accessing np.Templating Settings data when getting template list

## [1.0.0-beta.22] - 2022-03-29 (mikeerickson)

- Fixed issue when using `<%-` tag with data containing `<` and `>` characters in output variable (reported by @eduard)
- Added choose template interface when refrencing templates with same name (e.g. "Daily Note Template")
- Changed filename extension to support `.md` and `.txt` (previously assumed disk filename of `.md`) (reported by @dwertheimer)

## [1.0.0-beta.21] - 2022-03-28 (mikeerickson)

- Reverted settings access changed in b18 as it was not working properly (restored previous method of accessing np.Templating Settings)

> This will need to be tested in the library version used by NotePlan

- Removed migration test code inadvertenly left in published version

## [1.0.0-beta.20] - 2022-03-27 (mikeerickson)

- Syncing version with this document (thanks @jgclark)

## [1.0.0-beta.19] - 2022-03-27 (mikeerickson)

- Fixed template prompt issues when displaying `?` at end of prompt
- Added `np:about` command to display current np.Templating information

## [1.0.0-beta.18] - 2022-03-27 (mikeerickson)

- Refactored loading np.Templating Settings as an attempt to fix issue when used as library in NotePlan core.

> This may be a permanent solution, but unable to confirm until it has been installed into NP core

## [1.0.0-beta.17] - 2022-03-27 (mikeerickson)

- fixed issue when using `progressUpdate` in template
- fixed issue when using prompts in tempaltes in new (frontmatter) format

## [1.0.0-beta.16] - 2022-03-26 (mikeerickson)

- Changed NotePlan minimum version to 3.5
- Fixed issue when executing `np:qtn`

## [1.0.0-beta.15] - 2022-03-20 (mikeerickson)

- final beta release (barring any last minute issues)
- Added `fog` icon to extended weather

## [1.0.0-beta.14] - 2022-03-20 (mikeerickson)

- updated `np:weather` command to use extended weather service and np.Templating Settings - Weather Format
- updated `globals :: weather` command to use `np.Templating` settings

## [1.0.0-beta.13] - 2022-03-20 (mikeerickson)

- refactored WebModule imports to use path instead of aliases as they break tests
- refactored weahterSummary imports to use path instead of aliases as they break tests

## [1.0.0-beta.12] - 2022-03-20 (mikeerickson)

### Extended Weather Features

- Added `weatherFormat` settings object which contains the default format string to be used when using default weather `<%- web.weather() %>`
- If a format string has been supplied such as `<%- web.weather( ':icon: :description: :FeelsLikeF:°F (:areaName:, :region:)' ) %>`, it will override settings `weatherFormat` value
- Updated `np:weather` command to use settings `weatherFormat` value

## [1.0.0-beta.11] - 2022-03-19 (mikeerickson)

- fixed DateModule `format` helper to handle dates in `mm/dd/yyyy` format from producing `Invalid Date`
- added `date8601` and `timestamp` helpers from DateModule (see `date-module.test.js` for example)
- added `time` helper from TimeModule (see `time-module.test.js` for example)
- extended `np.weather( 'format_string' )` to allow a string parameter that gives a format for the resulting weather data from wttr.in. See the documentaiton for more details of what can be returned.
- added global `now` helper (e.g. <%- now() %>, same as calling <% date.now() %>)
- added global `date8601` helper (e.g. <%- date8601() %>, same as calling <% date.date8601() %>)
- added global `timestamp` helper (e.g. <%- timestamp() %>, same as calling <% date.timestamp() %>)
- added global `currentDate` helper (e.g. <%- currentDate() %>, same as calling <% date.now() %>)
- added global `currentTime` helper (e.g. <%- currentTime() %>, same as calling <% time.now() %>)

## [1.0.0-beta.10] - 2022-03-18 (mikeerickson)

- refactored all `fetch` calls to use fetch with timeout in NP 3.4.2 or greater

> reverting attempt to use `fetchWithTimeout` call added in 1.0.0-beta.09 as it did not work due to unsupported `AbortController` interface which is part of Web API but not supported by NotePlan

## [1.0.0-beta.09] - 2022-03-15 (mikeerickson)

- replaced all `fetch` calls to use `fetchWithTimeout` which will handle condition where API service goes offline, returning "An error occurred accessing {serviceName} service" message if request takes longer than timeout
- fixed "Quick Notes" migration, removing `Test` defintion
- added `np:migrate-templates` command which can be used to inititate migration from "📋 Templates" to "@Templates"
- added `migraQuickNotes` to end of `migrateTemplates` so the process will happen at the same time (previously you had to execute `np:migrate-quick-notes` manually)
- restored conversion of `{{ date8601() }}` to `<%- date8601() %>`
- added `format` and `now` helpers from DateModule (see `date-module.test.js` for example)
- added `getAttributes` and `getBody` from FrontMatterModule (see `frontmatter-module.test.js` for example)

## [1.0.0-beta.08] - 2022-03-14 (mikeerickson)

- Removed spurious `dog` override in "Quick Notes"
- Fixed issue when migrating Quick Notes (inadvertent `Test` folder creation)
- Fixed issue with promise based methods in templates not excecuting (all method calls are converted to async/await at runtime)

> You should not be required to have `await` keyword in templates
> For example:  `<%- date8601() %>` is converted to `<%- await date86010() %>` at runtime

## [1.0.0-beta.07] - 2022-03-14 (mikeerickson)

- Removed `usePrompts` parameter from options as this will be on by default, thus no longer required
- Removed some spurious `console.log` statements (don't litter the console)
- Added alert if "Quick Notes" folder does not exists when executing `np:qtn` command

> See np.Templating Settings to override default "Quick Notes" folder name

## [1.0.0-beta.06] - 2022-03-14 (mikeerickson)

- removed `docs` directory, moved to [np.Templating Docs](https://nptemplating-docs.netlify.app/)
- fixed issue when selecting `Cancel` in prompt message, throwing incorrect error

## [1.0.0-beta.05] - 2022-03-14 (mikeerickson)

- fix `__tests__/fronmatter-module.test.js` using new fixtures
- added `np:qtn` to replace current `/qtn` and will be adding `/qtn` when `nmn.Templates` is deprecated
- fixed several issues with prompt interface, including display multiple prompts for same key

## [1.0.0-beta.04] - 2022-02-26 (mikeerickson)

- added support for new template format introduced by `NotePlan 3.4.1` and frontmatter formatted templates
- fixed issue where templates were sometimes being loaded from old "Templates" directory, it should now ONLY use `@Templates`
- renamed **globals** helper `date` to `currentDate` as `date` is a reserved work for internal Date Module
- fixed issues with **globals** date methods, including

```html
**pickdate:**
- <%- pickDate() %>
- <%- pickDate({question:'Please enter a date:'}) %>
- <%- pickDateInterval() %>
- <%- pickDateInterval({question:'Date interval to use:'}) %>
```

## [1.0.0-beta.03] - 2022-02-24 (mikeerickson)

- added template migration to `onUpdateOrInstall` method which will run first time `np.Templating` is installed
- added `np:templating-migration` command which can be used to run migration method on command
- updated to use `@Templates` instead of `:clipboard: Templates`

## [1.0.0-beta.02] - 2022-02-22 (mikeerickson)

### Added

- Added generic formatting (removed pipe format from templates)

### Changed

- Implemented advanced `getWeather` (this may be removed in a future release)
- Reviewing use of `globals.js` and many (or all) of these functions may be removed - proceed accordingly

## [1.0.0-beta.01] - 2022-02-15 (mikeerickson)

### Added

Initial Release

## Changelog

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

### Plugin Versioning Uses Semver

All NotePlan plugins follow `semver` versioning. For details, please refer to [semver website](https://semver.org/)
