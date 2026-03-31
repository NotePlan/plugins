# 💭 Journalling & Reviews Plugin
This plugin makes it easier for you to journal and/or review your days/weeks/months/quarters/years into NotePlan. It also makes it quicker to apply templates at the start or end of days/weeks/months/quarters/years.

### Configuration
To use this plugin on weekly/monthly/quarterly/yearly notes, you first need to have them turned on in **NotePlan Settings** > Calendar pane:

<img src="calendar-settings@2x.png" width="600px"/>

All the available commands require also some **configuration** first. On Mac click on the 'Journalling & Reviews' card in the Plugin Preferences panel, and then the the gear button.

## Quickly applying Templates at the start of each Day/Week
The NotePlan website has good [articles on getting started with Templates](https://help.noteplan.co/article/136-templates), and a helpful [Template Gallery](https://noteplan.co/templates), to build from.

For more details of the tag commands you can use in a Template, including a list of events, a quote-of-the-day or summary weather forecast, see the [full Templating Documentation](https://noteplan.co/templates/docs).

### /dayStart & /todayStart commands
These commands make it quicker to apply a Template at the start or end of a day or week. The names of the Templates to use are set in the Plugin Settings pane, referring to Template names stored in the special NotePlan `Templates` folder.  (This command has become less necessary since about NotePlan v3.17, which introduced [auto-inserting of templates into new calendar notes](https://help.noteplan.co/article/229-auto-insert-templates).)

- **/todayStart**: applies your 'Daily Note' Template only to _today's_ calendar note, no matter what note you're editing.
- **/dayStart** appends your 'Daily Note' Template to the _currently open daily note_ (or today's note if you're not editing a daily note). Therefore, be careful using it on another calendar note than today using template tag commands like `<%- date... / formattedDate... %>` or `<%- weather() %>` -> because this renders the TODAY content!

### /weekStart and /monthStart commands
These act very similarly to the /dayStart command above.

### /dayEnd, /todayEnd, /weekEnd, /monthEnd commands
These act in the same way as above, but can be tailored to adding items at the end of a day, perhaps like a Habit or Stats summary from the separate [**Habits & Summaries plugin**](https://noteplan.co/plugins/jgclark.Summaries).

This is also a quick way of regularly running one or more commands from the separate [**Tidy Up plugin**](https://noteplan.co/plugins/np.Tidy).

## Helping with periodic Reviews
There's no right or wrong way to do reviews, and you'll no doubt change what you find helpful over time. But the key is to be taking some time to answer questions to help you pause and review what has and hasn't gone well over the last day/week/month/quarter. Some use it as a way of capturing their main **emotions**; others to track **goals**; others to write a simple **gratitude journal**.

### Using Templates you fill in
One way to do this is to configure an end-of-day/week Template -- for example this [Mental Health Journal](https://noteplan.co/templates/mental-health-journal-template) -- which you then apply to your current note using the /dayEnd or /weekEnd command, and then add your responses.

### Interactively
Alternatively, the **/dayReview**, **/weekReview**, **/monthReview**, **/quarterReview**, and/or **/yearReview** commands present you with a window with your set of questions to fill in. You first need to configure the sets of questions to ask in the plugin settings. In each case a default set of questions is provided to get you started.  Each setting is explained:

#### Journal Section Heading
The name of an existing markdown heading after which the review answers are added. If it doesn't exist, it is added at the end of the note.
???
      "key": "dailyJournalSectionHeading",
      "title": "Daily Journal Section Heading",
      "description": "The name of a section heading after which Daily Journal answers are added - if it doesn't exist, it is added at the end of the note.",
      "type": "string",
      "default": "Journal",
      "required": true
    },
    {
      "key": "reviewSectionHeading",
      "title": "Review Section Heading",
      "description": "The name of a section heading after which weekly/monthly/quarterly/yearly Review answers are added - if it doesn't exist, it is added at the end of the note.",

#### Daily / Weekly / Monthly / Quarterly / Year Journal Questions
This string includes both the questions and how to lay out the answers in the note. These are the possible question types:
- `<boolean>` shows the text as a question, and if you answer "Yes" to the question, the text is included. If you answer "No" it isn't included.
- `<int>` asks for an integer number
- `<number>` asks for a number (which may include fractional part)
- `<duration>` asks for a duration in `[H]H:MM` format (for example `1:05` or `12:30`)
- `<string>` asks for a string
- `<bullets>` asks for one or more lines; each non-empty line is written to the note as a markdown bullet (`- `)
- `<checklists>` same, but each line is written with a checklist marker (`+ `)
- `<tasks>` same, but each line is written with a task marker (`* `)
- `<mood>`select one of the configured moods
- `<done>` will include the rest of the text in the line and will be included in the output if you answer "Yes" to the "Yes"/"No" question about it.

There are also some placeholders you can use to add things to your output:
- `<h2>` and `<h3>` (or the legacy equivalent `<subheading>`) includes the text on the rest of the line as a usual H2 or H3 markdown heading.
- `<date>` is replaced in the window and output with the review note title (e.g. `2026-03-25`,  `2026-03` or `2025-W52`).
- `<datenext>` or `<nextdate>` acts similarly but gives the _next_ date (e.g. `2026-03-26`,  `2026-04` or `2026-W01`).
- You can also use markdown heading lines directly in the settings, for example `## Heading` and `### Subheading`.
- You can include line breaks, or `\n` characters.

Other notes:
- You can have multiple questions of type `<boolean>`, `<int>` or `<number>` on a line, with any text around them. The answers will also be placed on the one line, but with the `||` removed, and with a space separating them.
<!-- - You can hide the question text by starting it with a dash e.g. `-(thoughts) <string>`. This will just output the entered text. (The identifier is there to work out which question the user currently is on.) -->
- If a particular question isn't answered (i.e. no input entered), then that question isn't included in the output.
- If a particular question has already been answered in the note (i.e. if a line starts with the same question text), the current answer will be shown in the review window

#### Moods
A comma-separated list of possible moods to select from.  They don't have to have emoji, but I rather like them.

### Example for /dayReview
The following question setting:
```
@sleep(<number>) @work(<int>)
@fruitveg(<int>) #stretches<boolean> #closedRings<boolean>
Mood: <mood>
Gratitude: <string>
Wins: <bullets>

<h2>'Big three' tasks for <nextdate>
<checklists>
```
produces this review window:

After answering the questions, would produce something like this in today's note:

```markdown
## Journal
@sleep(6.8) @work(7)
@fruitveg(4) #stretches
Mood: 😇 Blessed
Gratitude: Went to great Nana's 100th birthday party -- result!
Wins:
- First win...
- Another one

## 'Big three' tasks for 2026-03-29
+ Main thing
+ Another important thing
```
## Automation
???

## Support
If you find an issue with this plugin, or would like to suggest new features for it, please raise a [Bug or Feature 'Issue' in GitHub](https://github.com/NotePlan/plugins/issues).

If you would like to support my late-night work extending NotePlan through writing these plugins, you can through:

[<img width="200px" alt="Buy Me A Coffee" src="https://www.buymeacoffee.com/assets/img/guidelines/download-assets-sm-2.svg" />](https://www.buymeacoffee.com/revjgc)

Thanks!

## History
Please see the [CHANGELOG](https://github.com/NotePlan/plugins/blob/main/jgclark.DailyJournal/CHANGELOG.md).
