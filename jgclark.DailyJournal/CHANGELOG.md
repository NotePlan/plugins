# What's changed in 💭 Journalling Plugin?
_Please also see the Plugin [README](https://github.com/NotePlan/plugins/blob/main/jgclark.DailyJournal/README.md)._

<!-- TODO: improved flexibility of questions -->

## [0.15.1] - 2023-06-16
### Added
- **/Journalling: update plugin settings**: This command allows the plugin's settings to be changed on iOS/iPadOS.

## [0.15.0] - 2022-11-24
### Added
To go with the new calendar note capabilities of NotePlan v3.7.2:
- new **/weekReview**, **/monthReview**, **/quarterReview**, and **/yearReview**  commands, each with a setting so you can tailor the questions to them as suits your life and work.
- new **/monthStart** command, which applies your 'Monthly Note' Template to the currently open monthly note (or the current monthly note if you're not editing a monthly note).

## [0.14.0] - 2022-11-11
### Added
- added **/weekStart** command, which applies your 'Weekly Note' Template to the currently open weekly note (or the current weekly note if you're not editing a weekly note). (For @tastapod.)

## [0.13.0] - 2022-08-21
### Added
- added **/weekReview**, **/monthReview** and **/quarterReview** commands, each with a setting so you can tailor the questions to them as suits your life and work. (None need to be used!)
- /dayStart and /todayStart now uses the template's location field to determine where in the note to insert the results of the template.
-
### Changed
- because of the new commands, the plugin name has changed to the **Journalling plugin**.
- updated logging framework

## [0.12.1] - 2022-07-18
### Changed
- under-the-hood change to be ready for **Templating 2.0** framework.

## [0.12.0] - 2022-03-13
### Changed
- now uses the new **Templating** framework, not the old **Templates** system.  The 'Daily Note Template' file now lives in the new top-level 'Templates' folder listed as one of the Smart Folders.
- removed ability to read its settings from the old _configuration note: from now on you need to use the (much easier) user interface by clicking the ⚙️ button in the Plugin Preferences pane.

## [0.11.1..0.11.4] - 2022-02-04
### Changed
- now using new Configuration UI system instead of _configuration.

## [0.11.0] - 2022-01-29
### Added
- /dayReview now checks to see if a question has already been answered in the daily note before it asks it; if it has, it won't ask again.

### Changed
- uses new 'native' dialog boxes (available from NP v3.4)
- under-the-hood changes to prepare for next Configuration system

## [0.10.0] - 2021-11-25 (@m1well)
### Changed
- trim input from user in /dayReview questions

## [0.9.0] - 2021-11-25  (@m1well)
### Added
- it is now possible to add `<subheading>`s in the review questions string
- you can also add bullet points

## [0.8.3] - 2021-10-11
### Changed
- recompiled to bring in knowledge of recently-added functions in other plugins

## [0.8.2] - 2021-09-07
### Fixed
- fixed an error in /todayStart that kept it from running if the note wasn't open

## [0.8.1] - 2021-08-31
### Changed
- under-the-hood changes responding to underlying framework changes

## [0.8.0] -@dwertheimer
- new: Brought back the original /dayStart as /todayStart ;)

### [0.7.0..0.7.1], 2021-08-07
### Added
- now supports macOS back to v10.13
- the commands now work on whatever daily calendar note is open, not only on today's note

### [0.6.0..0.6.9] - 2021-07-30
### Added
- additions to weather() template macro to add more fields and use string replacements (@dwertheimer)
- ability to check for `<number>` as well as `<int>` values in daily review questions

### Changed
- under-the-hood changes responding to underlying API and framework changes, and other plugins' changes
- more informative pop ups as it works
- on first use it now offers to populate default configuration (as shown above) into the _configuration file
- now `/dayStart` calls the Templates plugin to apply the `Daily Note Template` template. To include a weather forecast, now include the `{{weather()}}` tag in that template, and configure the OpenWeather calls as described in the `Templates/_configuration` file.
- now `/dayReview` also uses the `Templates/_configuration` file to get settings for this command.

## [0.5.0] - 2021-05-27
### Changed
- use Template system (from '**NoteHelpers**' plugin) to provide the `Daily Note Template`. This template title defaults to 'Daily Note Template', but can be configured in `pref_templateText ` (as above).
- updated code to use newer NotePlan APIs

## [0.4.0] - 2021-04-24
- first main release
