# 🗃 Summaries plugin

This plugin lets you do the following sorts of things with your daily (calendar) notes:
- count every time you've noted you've visited  `#family` this month
- count the times you've met with staff member `@alice` this year so far
- sum the length of your `@run(...)`s last quarter
- automatically add your progress this week against your goal of getting an average 8 hours `@sleep()` when you generate your daily note

And also:
- make a Map of Content (MOC) note for a search term

## Commands
This Plugin provides commands that generate several different sorts of **summaries** and **basic stats from your daily notes**, that are saved back into special NotePlan notes in the Summaries folder. Most start by asking for the time period you wish to operate over:

![time period selection](time-period-selection.jpg)

Each command is considered in turn. 
**Please note** that in each of these: 
- all notes in the special folders (@Archive, @Templates and @Trash) are **ignored**.  Others can be exluded too using the `foldersToExclude` setting (see below).
- the **searches** are simple ones, matching on whole words, not using fuzzy matching or regular expressions.
- now that NP doesn't force all #hashtags and @mentions to be lower-case, the searching by default now doesn't match case ("case insensitive"). The new setting 'Match case when searching?' allows you to change this if you wish.
- these commands require **configuration**. Click the gear button on the 'Summaries' line in the Plugin Preferences panel to configure this plugin. Each setting has an explanation, and they are grouped into relevant sections.

### /countsInPeriod
This command generates some simple counts and other statistics of #hashtags or @mentions that you specify. For example:
- **count** every time you've noted you've visited  `#family` this month
- **count** the times you've met with staff member `@alice` this year so far
- **sum** the length of your `@run(...)`s last quarter (where e.g. `@run(7.5)` means a run of 7.5km/miles)
- automatically add your progress this week against your goal of getting an **average** 8 hours `@sleep()` when you generate your daily note

For example, it produces for me:

```markdown
# Jan 2022
## #hashtag counts (to 2022-01-14)
#article	1
#bankholiday	1
#closedrings	4
#covidtest	3
...
## @mention counts (to 2022-01-14)
@fruitveg	10	(total 40	average 4.0)
@run	2	(total 10.4	average 5.2)
@sleep	14	(total 103	average 7.4)
...
```

It asks where to save its output: to screen, to the Plugin Console, or to a specially-created note in the Summaries folder.
From NotePlan v3.6 it will also offer to write to the current Weekly note if the selected time period is 'Week (to date)'.
It  updates the previous note for that same time period, if it already exists.

The settings for this command are:
- Folder name: e.g. 'Summaries'
- Folders to exclude: e.g. 'Summaries', 'TEST'
- Heading level: e.g. 2
- Hashtag counts heading: e.g. '#hashtag counts',
- Mention counts heading: e.g. '@mention counts'
- Show hashtag or mention as links?
- Include Hashtags: e.g. '#holiday','#jog','#commute','#webinar'
- Exclude Hashtags: e.g. ''
- Include Mentions: e.g. '@work','@fruitveg','@water', '@sleep'
- Exclude Mentions: e.g. '@done', '@repeat'

(Why use `@run(...)` rather than `#run(...)`? Well, it just felt more right to use `@run()` as there are already `@done(...)` and `@repeat(...)` mentions in use in NotePlan. And in NotePlan hashtags that end with a decimal number (e.g. `#run/5.3` ignore the `.3`.)

### /insertProgressUpdate
This command helps show progress within the current week or month against items you track (e.g. `@work(9)`, `@run(5.3)` or `#pray`). It does this by generating stats for the configured hashtags or mentions over either the week to date or month to date. If the progress update section already exists, it will be updated, rather than be repeated.

For example, it produces for me:
```markdown
### Progress Update: Day 14 for Jan 2022
fruitveg	10	(total 40	average 4.0)
run	2	(total 10.4	average 5.2)
pray 8
sleep	14	(total 103	average 7.4)
work	11	(total 90	average 8.2)
```

The relevant settings for this command are:
- Where to write the progress update? Write to 'current' note, or to the current 'daily' or 'weekly' note. 
- Progress Heading: e.g. 'Progress Update'  (this is overriden by a heading parameter if given)
- Included #hashtags for Progress: e.g. '#pray'
- Included @mentions for Progress: e.g. '@fruitveg, @run, @sleep, @work'

It is primarily designed to be used from a **Template** (particularly a "Daily Note Template") by including the command tag
```
<%- progressUpdate({interval: 'wtd', heading: 'Habits'}) %>
```
in a Template. This takes two possible parameters:
1. time period: 'wtd' (week to date) or 'mtd' (month to date)
2. the heading to use before the results.

But it can be used on demand through the  /insertProgressUpdate command.

### /weeklyStats
This is a very niche command! It generates stats for the specified mentions and hashtags over a period of consecutive weeks, and write out as a CSV table to 'Summaries/weekly_stats'. This is designed for plotting using the third-party gnuplot tool.

The relevant settings for this command are:
- Folder name: e.g. 'Summaries'
- Weekly Stats Duration (in weeks): e.g. 26

## History
Please see the [CHANGELOG](CHANGELOG.md).
