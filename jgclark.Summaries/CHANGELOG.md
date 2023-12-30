# What's Changed in ⏱ Habits and Summaries plugin?
(And see the full [README](https://github.com/NotePlan/plugins/tree/main/jgclark.Summaries).)

<!-- - ??? make below work with all options -->

## [0.20.2] - 2023-12-30
- added x-callback options for /periodStats command. See documentation for details.

## [0.20.1] - 2023-11-10
- fix Refresh button not working after '/append progress update' command
- turns down logging against an API error

## [0.20.0] - 2023-10-12
### Added
- new **today progress** command that summarises tags or mentions _within today's note_. This could be useful for summarising `@calories(...)` noted from different meals, for example. This can also be invoked by an x-callback call, and through template calls. (For @seanokana)
- new **heatmap for tag** command that displays a 'heatmap' chart of a chosen tag's values for each day (e.g. all `@work(...)` values from daily notes)
- new **Habits+Summaries:update plugin settings** command, that allows settings to be changed on iOS/iPadOS.

## [0.19.4] - 2023-09-26 unreleased
### Added
- Refresh button to output of **periodStats** command, where the time period is "<period> to date"
## [0.19.3] - 2023-08-06
### Fixed
- date logic on 'weeklyStatsToCSV' command output

## [0.19.2] - 2023-07-28
### Fixed
- date logic when selecting 'other month' for stats (thanks to tip by @chrismalek)

## [0.19.1] - 2023-05-15
### Added
- new settings '#hashtags to average' and '#hashtags to total' alongside existing '#hashtags to count' setting for **periodStats** command
- new setting 'Include sparkline graphs?' that now applies separately to the 'periodStats' command
### Changed
- the 'periodStats' command will attempt not to open another copy of the output note in another split view, if that output note is already open
### Fixed
- regression in last release with /periodStats

## [0.19.0] - 2023-05-14
### Added
- new settings '#hashtags to average' and '#hashtags to total' alongside existing '#hashtags to count' setting for **appendProgressUpdate** command.
### Changed
- increased the number of significant figures shown in Progress Summary 'average' outputs (for @chrismalek, #443)
- code tidy up

## [0.18.0] - 2023-03-21
### New
- Added new '@mentions to average' and '@mentions to total' alongside existing '@mentions to count' setting for **periodStats** command. These tailor the output to focus on just the average or total, rather than all the currently-presented statistics (count, total and average). (These now match what is already possible with /insertProgressUpdate.)
### Changed
- changed name of user command **insertProgressUpdate** to **appendProgressUpdate** to better reflect how it works. (The earlier name still works, and it also doesn't require changing any existing templates or x-callback calls.)

### Fixed
- 'Exclude today?' setting being ignored
- Other fixes to date display for some periodStats

## [0.17.3] - 2023-01-19
### Fixed
- fix edge case of malformed @mentions in "insertProgressUpdate" calls

## [0.17.2] - 2023-01-03
### Fixed
- end-of-year bug in dates for "periodStats" for "last month" option.

## [0.17.1] - 2022-11-27
### Fixed
- worked around newly-discovered API bug when processing repeats like @repeats(1/7) in Summaries commands.

## [0.17.0] - 2022-11-25
### Added
- will write **periodStats** summaries to the new monthly/quarterly/yearly notes (available from NP v3.7.2) as well as the existing folder you can set in the settings.

## [0.16.1] - 2022-11-17
### Fixed
- error in template `progressUpdate(...)` when using `heading` field with new `{{OPTION}}`, and `period` field with a YYYY-MM-DD date. (Spotted by @dwertheimer)

## [0.16.0] - 2022-11-16
### Added
- Allow to be used by **x-callback calls** -- see README for details
- Greater flexibility for using **insert progress update** from templates, all of which can override what is in the various settings:
    - 'period' setting: pass a specific YYY-MM-DD date to run the summary report from (thanks to @dwertheimer)
    - 'excludeToday' setting which if true excludes today's date from the output. (thanks to @dwertheimer)
    - allow arbitrary hashtags to be used (for @dwertheimer)
    - added a Refresh 'button'
- Also greater flexibility when used as a command with following new settings:
  - 'excludeToday' setting which if true excludes today's date from the output. (thanks to @dwertheimer)
  - the way `progressHeading` can be used is noq more flexible, as you can now insert `{{PERIOD}}` anywhere in the string, which will be replaced by the actual period you've asked to summarise (for @dwertheimer)

## [0.15.1] - 2022-11-12
### Added
- Adds new '@mentions to average' and '@mentions to total' alongside existing '@mentions to count' setting. These tailor the output to focus on just the average or total, rather than all the currently-presented statistics (count, total and average). You might want to migrate some in the existing setting to the two new alternatives.
### Changed
- The niche **/weeklyStatsToCSV** command has been speeded up significantly, tweaked to write to a hidden file, and made more generic. It now has a separate 'Items to Chart' setting to list the @mentions or #hashtags to include.

## [0.15.0] - 2022-11-04
### Added
- Adds new '@mentions to average' and '@mentions to total' alongside existing '@mentions to count' setting. These tailor the output to focus on average or total, not all the currently-presented statistics. (You might want to migrate some in the existing setting to the two new alternatives.)
### Changed
- Improved display of results of average and totals in the various stats updates
### Fixed
- Fixed an issue with display order in sparklines
## [0.14.1] - 2022-10-15
## Changed
- the date in the title is now formatted according to your locale

## [0.14.0] - 2022-10-04
### Added
- new **/heatmap for complete tasks** command displays a 'heatmap' chart of how many tasks you've completed on each day (see example above). This checks in all daily, weekly and project notes over the number of weeks you specify to look back (via the 'Chart Duration (in weeks)' setting). If you don't set it, the plugin will generate a sensible period up to 12 months. Note: requires NotePlan v3.7.
### Changed
- stop sparklines appearing in  the '**/periodStats**' command for periods of more than a month.

## [0.13.1] - 2022-09-03
### Fixed
- the new '**Did/Didn't Do**' items can now include track simple **@mention**s (i.e. without something in brackets after them) as well as #hashtags.

## [0.13.0] - 2022-09-02
### Name changes
- The Summaries Plugin is renamed to **⏱ Habits and Summaries** Plugin, to better reflect what it now does.
- the /countsInPeriod command is now renamed **/periodStats**, though you can still use the original as an alias to it.
- the /insertProgressUpdate command is now aliased to **/habitTracker**, which gives more of a hint about it can be used
### Added
- Added simpler '**Did/Didn't Do**' items your can track (for example for `#closedrings`), which can get displayed in the graphs with its own pair of characters or emojis that you choose (for example '✅❌' or '✓·').
- the **/insertProgressUpdate** command, and its template equivalent, now also supports 'last7d', 'last2w', 'last4w' as options for the 'period' parameter (for @george65)
- the **/periodStats** command now includes sparklines for periods up to a month, if you request them.
### Changed
- in the /periodStats command the '@mentions to exclude' and '#hashtags to exclude' settings have now been removed, as I don't think they're useful any more, and make the code much harder to extend. If you're affected by this please get in touch -- the details at the end of the README.

## [0.12.0] - 2022-08-14
### Added
- now little 'sparkline' charts can be shown in the **/insertProgressUpdate** command. They're done using ASCII art, and are just a bit of fun really, until such a time we can have proper graphs or charts.
- they are also available in the equivalent template command, such as `<%- progressUpdate({interval: 'wtd', heading: 'Habits', showSparklines: true}) %>`.
### Changed
- the stats summary for each line is now a little smarter about what it shows.

## [0.11.1] - 2022-07-24
### Changed
- tweaked **/insertProgressUpdate** output to use ISO day-of-week numbering when run as the command (Monday = 1)
- upgraded the logging framework (thanks, @dwertheimer)

## [0.11.0] - 2022-07-02
### Changed
- moved the **/saveSearchResults** and **/saveSearchResultsInPeriod** commands to a separate **SearchHelpers** plugin.
## [0.10.0] - 2022-06-26
### Changed
- the **/countsInPeriod** command now offers to write to the new weekly notes (available from in v3.6) if the selected period is 'this week'
- the **/insertProgressUpdate** command now can write to the 'current' note, or today's 'daily' or 'weekly' note. This is controlled by the new setting 'Where to write the progress update?'
- started to use the auto-update mechanism for plugins (I think!)

## [0.9.0] - 2022-06-22
### Changed
- now that NP doesn't force all #hashtags and @mentions to be lower-case, the searching now by default doesn't match case ("case insensitive"). The new setting 'Match case when searching?' allows you to change this if you wish.
- search terms are now matched on whole words, not parts of words
- **/insertProgressUpdate** command now calculates the week according to the user's 'Start of Week' setting (in NotePlan preferences)
- the titles of week-based summary notes has been changed from e.g. 'W25 2022' to '2022-W25' to match NotePlan's new weekly notes' filenames (coming in v3.6).
- now ignores matches in paths of [markdown links](path), as well as in file:/... and https://... URLs.

## [0.8.0] - 2022-06-09
### Added
- ability to use these commands from x-callback-url calls. For example, calling the following (e.g. from the  Shortcuts app, or even within NP itself) will do the equivalent of running the command `/saveSearchResults` and supplying with input 'search,terms': `noteplan://x-callback-url/runPlugin?pluginID=jgclark.Summaries&command=saveSearchResults&arg0=search,terms`
- now allows the include & exclude fields for mention and hashtag counts to both be empty (thanks to the suggestion by @atlgc)

### Fixed
- fix for negative numbers in @mention trackers breaking the summary statistics (thanks for the report by @atlgc)

## [0.7.1..0.7.0] - 2022-04-26
### Added
- added 'Prefix for search results' setting to configure what marker to put before search results, not just `- ` (though that remains the default).
### Changed
- code clean up
- now only uses the built-in configuration system, which has been provided since v3.4 through the Plugins preference pane

## [0.6.1..0.6.0] - 2022-03-14
### Changed
- switched to newer logging framework
- uses the new Configuration interface available from NotePlan v3.4. There is an automatic one-off migration of settings from your _configuration note.
- use newer style of dialog boxes (available from NotePlan v3.3.1)

### Fixed
- fix to /weeklyStats when run over a year boundary

## [0.5.0] - 2022-01-18
### Added
- added hashtags to the **/insertProgressUpdate** command (requested by @dwertheimer)
- the list of hashtags and mentions to include in Progress Updates are now specified separately, using the `progressHashtags` and `progressMentions` settings.
- and the ability for `{{insertProgressUpdate(...)}}` to take a second `heading` parameter to let you use this multiple times in the same template (requested by @dwertheimer)
- under-the-hood changes to get ready for ConfigV2

### Changed
- renamed /occurrencesInPeriod as **/saveSearchResultsInPeriod**.
- search terms are now not highlighted if the match is in a `http[s]://...` URL or `file:...` filepath

## [0.4.0] - 2022-01-14
### Added
- added **/insertProgressUpdate** command. This writes out a summary of mentions of interest so far this week or month, showing the count/sum/average so far in that time period, to the current note. This is particularly designed to be used from a daily template by `{{insertProgressUpdate()}}`. See [README](https://github.com/NotePlan/plugins/tree/main/jgclark.Summaries/) for more details.

## [0.3.0] - 2022-01-01
### Added
- added **/weeklyStats** command. This very niche command writes out a summary of stats for each hashtag and mention of interest, summed/averaged per week, to the note 'Summaries/weekly_stats'. This is designed for plotting using the third-party gnuplot tool.

### Changed
- worked around a bug in NotePlan API that mis-reports heirarchical @mentions and #hashtags (e.g. @read/book/four)
- re-wrote the settings framework for this plugin

### Fixed
- found a bug that only manifests for week-based statistics on today's date (2022-01-01). It's the time when week number = 52 but month = 1!

## [0.2.2..0.2.0] - 2021-11-08
### Added
- missing spaces before date references
- added last week / this week / other week as possible date intervals
- new `/saveSearchResult` command that asks user for a search term, and then saves a copy of all matching lines in a note of your choosing. This search is simple and non-fuzzy matching.
- new setting `addDates` that controls whether dates are added in `/occurrencesInPeriod`, and if so as date links.
- new setting `foldersToIgnore` that allows you to ignore notes from one or more folders from these commands.

### Changed
- setting `addDates` changed to `dateStyle` to be a little clearer. It now also applies to any dates returned in `/saveSearchResults`
- code refactoring

### Fixed
- a timezone problem leading to wrong dates on some output

## [0.1.0] - 2021-10-10
### Added
- moved Statistics Plugin's `/stp` command into this new plugin as **`/countsInPeriod`**
- new **`/occurrencesInPeriod`** command. See README for details.
