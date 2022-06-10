# What's Changed in 🗃 Summaries plugin?

## [0.8.0] - 9.6.2022
### Added
- ability to use these commands from x-callback-url calls. For example, calling the following (e.g. from the  Shortcuts app, or even within NP itself) will do the equivalent of running the command `/saveSearchResults` and supplying with input 'search,terms': `noteplan://x-callback-url/runPlugin?pluginID=jgclark.Summaries&command=saveSearchResults&arg0=search,terms`
- now allows the include & exclude fields for mention and hashtag counts to both be empty (thanks to the suggestion by @atlgc)

### Fixed
- fix for negative numbers in @mention trackers breaking the summary statistics (thanks for the report by @atlgc)

## [0.7.1] - 2022-04-26
### Changed
- code clean up

## [0.7.0] - 2022-04-01
### Added
- added 'Prefix for search results' setting to configure what marker to put before search results, not just `- ` (though that remains the default).

### Changed
- now only uses the built-in configuration system, which has been provided since v3.4 through the Plugins preference pane

## [0.6.1] - 2022-03-14
### Changed
- switched to newer logging framework

## [0.6.0] - 2022-02-07
### Changed
- uses the new Configuration interface available from NotePlan v3.4. There is an automatic one-off migration of settings from your _configuration note.
- use newer style of dialog boxes (available from NotePlan v3.3.1)

### Fixed
- fix to /weeklyStats when run over a year boundary

## [0.5.0] - 2022-01-18
### Added
- added hashtags to the `/insertProgressUpdate` command (requested by @dwertheimer)
- the list of hashtags and mentions to include in Progress Updates are now specified separately, using the `progressHashtags` and `progressMentions` settings.
- and the ability for `{{insertProgressUpdate(...)}}` to take a second `heading` parameter to let you use this multiple times in the same template (requested by @dwertheimer)
- under-the-hood changes to get ready for ConfigV2

### Changed
- renamed `/occurrencesInPeriod` as `/saveSearchResultsInPeriod`.
- search terms are now not highlighted if the match is in a `http[s]://...` URL or `file:...` filepath

### Changed
- renamed `/occurrencesInPeriod` as `/saveSearchResultsInPeriod`.

## [0.4.0] - 2022-01-14
### Added
- added `/insertProgressUpdate` command. This writes out a summary of mentions of interest so far this week or month, showing the count/sum/average so far in that time period, to the current note. This is particularly designed to be used from a daily template by `{{insertProgressUpdate()}}`. See [README](https://github.com/NotePlan/plugins/tree/main/jgclark.Summaries/) for more details.

## [0.3.0] - 2022-01-01
### Added
- added `/weeklyStats` command. This very niche command writes out a summary of stats for each hashtag and mention of interest, summed/averaged per week, to the note 'Summaries/weekly_stats'. This is designed for plotting using the third-party gnuplot tool.

### Changed
- worked around a bug in NotePlan API that mis-reports heirarchical @mentions and #hashtags (e.g. @read/book/four)
- re-wrote the settings framework for this plugin

### Fixed
- found a bug that only manifests for week-based statistics on today's date (2022-01-01). It's the time when week number = 52 but month = 1!

## [0.2.2] - 2021-11-08
### Added
- missing spaces before date references

## [0.2.1] - 2021-10-16
### Added
- added last week / this week / other week as possible date intervals

### Changed
- setting `addDates` changed to `dateStyle` to be a little clearer. It now also applies to any dates returned in `/saveSearchResults`
- code refactoring

### Fixed
- a timezone problem leading to wrong dates on some output

## [0.2.0] - 2021-10-14
### Added
- new `/saveSearchResult` command that asks user for a search term, and then saves a copy of all matching lines in a note of your choosing. This search is simple and non-fuzzy matching.
- new setting `addDates` that controls whether dates are added in `/occurrencesInPeriod`, and if so as date links.
- new setting `foldersToIgnore` that allows you to ignore notes from one or more folders from these commands.

## [0.1.0] - 2021-10-10
### Added
- moved Statistics Plugin's `/stp` command into this new plugin as **`/countsInPeriod`**
- new **`/occurrencesInPeriod`** command. See README for details.
