# What's Changed in 🗃 Summaries plugin?

## [0.5.0] - 2022-01-16
### Added
- added hashtags to the `/insertProgressUpdate` command.
- the list of hashtags and mentions to include in Progress Updates are now specified separately, using the `progressHashtags` and `progressMentions` settings.

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
