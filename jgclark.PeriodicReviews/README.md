# 💭 Periodic Reviews Plugin

This plugin makes it easier for you to review your days, weeks, months, quarters, and years in NotePlan. It's designed to help you intentionally focus on whatever are the most important projects/goals/behaviours across all of your different endeavours in life.

Many truly productive people suggest that regular reviews are the most important tool to help us focus on the most important outcomes in life.

There is no single “right” way to review personal or work aims or goals. What matters is pausing to answer questions about what went well, what did not, goals, gratitude, mood, and so on. This is where this plugin fits in.

First you need to configure the questions you want to use for each time period (some of daily, weekly, monthly, quarterly and yearly). Then at the end of the period, run the **/Daily Review** command (alias: 'dr'), or the similar one for the other review periods. **Daily Review** and **Weekly Review** can also be opened from the sidebar.

The plugin then opens a window that shows **all** these questions in a form (colours and fonts follow your current NotePlan theme). When you submit the form, your answers are written under the correct section heading in that period’s calendar note — even if the review window itself has focus (Main Window or Split View).

It then asks you to decide your top few tasks/goals/priority items for the next period. If you give any, they are written into the **next** period’s calendar note with your selected big-task marker (`>>`, `!!!`, or `!!`) and optional suffix (default `#win`). That next note is created or updated without stealing the editor from the note you are reviewing.

### Example (Daily Review)
Here's an example of the Daily Review Window:

<img src="daily-review-2.0.0.b7@2x.png" width="600px"/>

This is generated from the following settings:
- **Daily Review/Journal Questions**:

```
## Stats for <date>
Health: @sleep(<number>) @work(<int>) @fruitveg(<int>) #stretches<boolean> #closedRings<boolean>
Work: @work(<number>)

### Journal
Mood: <mood>
Gratitude: <string>
Wins: <bullets>
Challenges: <string>
```

- **Daily Planned Items Heading**: `Wins`

Submitting the form will insert something like this into **today**'s note (under the Daily Review/Journal section heading, default `Journal`):

```markdown
## Stats for 2026-04-10
Health: @sleep(6.8) @work(7) @fruitveg(4) #stretches
Work: @work(7)

### Journal
Mood: 😇 Blessed
Gratitude: Went to great Nana's 100th birthday party -- result!
Wins:
- First win...
- Another one
Challenges: Feeling a bit tired
```

Unchecked booleans (here `#closedRings`) are omitted. Empty question answers are omitted. A `<number>` of `0` is written (it is a valid value).

If you enter items in the Planning section, they are written at the start of **tomorrow**'s note. The H2 uses `{heading} for {next period title}`:

```markdown
## Wins for 2026-04-11
* >> First win #win
* >> Second win #win
```

(The date on that heading is tomorrow’s title, not today’s. Leave **Daily Planned Items Heading** blank to write the task lines with no H2.)

### Which period is reviewed?
If a calendar note of the matching kind is already open when you run a review command (for example yesterday’s daily note when running **/Daily Review**), that note is reviewed. Teamspace calendar notes are supported. Split view: if a sidebar click moves focus to another pane, the plugin still looks for an open calendar note of the right kind.

If none is open:
- with **Open the calendar note when reviewing it?** on (the default), the plugin opens the current period (today, this week, and so on — weeks use NotePlan’s `YYYY-Www` titles, including year-boundary weeks);
- with that setting off, it still reviews the current period’s calendar note but does not switch the editor to it. Answers and planning still write to the correct calendar notes.

The review window can move to the previous or next period of the same kind.

The window first shows a **Summary** section:
- **Carry-over plan items** — tasks under this note’s planned-items H2 (`{heading} for {this period}`, e.g. `Big Wins for 2026-09-24`), including those without a big-task marker. If that heading is blank (or missing), tasks anywhere in the note that use your configured big-task marker (`>>` / `!!!` / `!!`) are listed instead, including cancelled ones (shown as not done). Expanded by default.
- **Daily** reviews also list completed tasks and checklists for the period (from calendar and regular notes that changed, using `@done` dates in range), with `#win` / `#bigwin` / big-task-marker lines first. They also list calendar events for the day (timed and all-day; optionally filtered by **Calendars to include in review summaries**).
- **Weekly** reviews list **wins** for the week the same way (not a full completed-task list).
- **Monthly / quarterly / yearly** reviews do not show those completed-task blocks.
- Completed-task and event subsections start collapsed.

## Configuration
To use weekly, monthly, quarterly, or yearly notes, turn them on in NotePlan Settings → Calendar:
<img src="calendar-settings@2x.png" width="600px" />

<img src="settings-button@2x.png" align="right" width="100px" />

Open the **Periodic Reviews** card in Plugin Preferences, then use the gear button to edit settings. 

### Setting the Review Questions
The terms in angle brackets define both the input controls and how lines are written to the note. The available input controls are:

- `<boolean>` — ticked/unticked; if ticked, the question text (often a `#tag`) is included in the output. Matching in the note is case-insensitive.
- `<int>` or `<integer>` — whole number (integer), including `0`
- `<number>` — number, which may include a decimal part (including `0`)
- `<duration>` — `[H]H:MM` (e.g. `1:05`, `12:30`). Decimal hours are also accepted (`@sleep(7)` pre-fills as `7:00`, `@sleep(7.5)` as `7:30`).
- `<string>` — single-line text
- `<bullets>` — multi-line; each non-empty line is prefixed with a markdown bullet (`- `)
- `<checklists>` — same, with checklist markers (`+ `)
- `<tasks>` — same, with task markers (`* `)
- `<lines>` — multi-line; each non-empty line is written as `{label}: {text}` (e.g. `Learned<lines>` or `Learned: <lines>` with three answers becomes three lines: `Learned: first thing`, `Learned: second thing`, `Learned: third thing`). On mixed templates such as `Programming: @prog(<number>) <lines>`, intervening `<number>` / `<int>` fields sit on the **first** output line with the first `<lines>` row (`Programming: @prog(2.5) first note`). Extra `<lines>` rows are prefixed on following lines. A one-line `<lines>` answer is therefore a single note line, like the question template. Existing note lines that start with that prefix are pre-filled (markers/prefix stripped in the form).
- `<mood>` — pick from your configured mood list.

You can include headings and placeholders:

- Literal `##` / `###` lines in settings (and legacy `<subheading>`) — output as headings in the note/HTML.
- `<date>` — current review period’s calendar title in the window and in saved output (e.g. `2026-03-28`, `2026-W13`, `2026-Q1`). Substituted in **parsed** heading and label text too (e.g. `## Weekly Review for <date>` matches the period title in the UI).
- `<datenext>` or `<nextdate>` — the **following** period in the same format (e.g. weekly `2026-W52` → `2027-W01`).
- line breaks or `\n`.
- `||` to put multiple questions on one settings line (they still lay out as one output line).

Type tags in settings are matched case-insensitively (e.g. `<NUMBER>` works like `<number>`).

Notes:
- Multiple `<boolean>`, `<int>`, `<number>`, or `<duration>` items on one line are supported (for example `Health: @steps(<int>) @distance(<number>) @sleep(<duration>) <string>`).
- If matching answers already exist in the **active** part of the note, they appear **pre-filled** in the form. The **first** matching line wins.
- When you save, **single-line** template answers (including mixed `@token` / boolean / string lines) update the existing matching line in the review section rather than duplicating it. Extra `@mentions`, `#hashtags`, or free text that are not part of the template are kept; template tokens on that line are updated in place. Unchecked booleans are cleared from that line.
- Multiline `<bullets>` / `<checklists>` / `<tasks>` are written as a label plus following lines. Re-saving currently **appends** those extra lines rather than replacing the previous list — edit or delete the old list in the note if you re-run the review.
- `<lines>` answers are written as note lines that start with the label. If the template also has intervening `<number>` / `<int>` fields, those sit on the first output line with the first `<lines>` row. On save, matching lines in the review section are updated in order; extra new lines are appended. Extra old prefix lines are not deleted if you reduce the number of answers.

### Other Settings

- **Review Window type**: 'New Window' (the default), 'Main Window', or a 'Split View' within the main window.
- **Open the calendar note when reviewing it?** (default: true). See [Which period is reviewed?](#which-period-is-reviewed) above.
- **Calendars to include in review summaries**: optional filter list; leave empty to include all calendars.
- **Big task marker style:** choose whether major tasks/goals are indicated by `>>` (priority 4, the default), `!!!` (priority 3), or `!!` (priority 2). Used for summary/carry-over “big task” lines and when writing planning tasks to the next period. The planning textarea only strips this configured marker (not the other styles).
- **Planned items suffix (for next period note):** optional text appended to each planned item written to the next period’s note (default: `#win`). Clear the setting to write no suffix.
- **Review Section Heading**: The name of a section heading after which weekly/monthly/quarterly/yearly Review answers are added. If it doesn't exist, it is added at the end of the note (default: `Review`).
- **List of moods**: optional comma-separated list of possible `<mood>`s to select from. Can include emojis, as the default shows.

Then for the **day period**, there are 3 settings:
- **Daily Review/Journal Section Heading**: The name of a section heading after which Daily Review/Journal answers are added. If it doesn't exist, it is added at the end of the note (default: `Journal`).
- **Daily Planned Items Heading**: Used in the review window and as the H2 title prefix for planned tasks written to the next day's note (e.g. 'Big Wins' becomes 'Big Wins for YYYY-MM-DD'). Leave blank to write planned items only, with no heading.
- **Daily Review/Journal Questions**: Multi-line string that includes both the Journal/Review questions and how to lay out the answers in the daily note (details above).

Then for each **other time period**, there are 2 settings:
- **Name for [period] Planned items**: Used in the review window and as the H2 title prefix for planned items written to the next [period]'s note (e.g. 'Theme' becomes 'Theme for 2027'). Leave blank to write planned items only, with no heading. Defaults: week `Big Rocks`, month `Key Outcomes`, quarter `Goals`, year `Theme`.
- **[period] Review/Journal Questions**: String that includes both the Journal/Review questions and how to lay out the answers in the [period] note (details above).

If a question is left empty, that line is omitted from the output. If a line in the note already starts with the same question text, it is treated as an existing answer, and prefilled.

---

## FAQ
Q: What's the minimum version of NotePlan this runs with?  
A: v3.20 (for the integrated HTML plugin windows). 

Q: How is this plugin related to your **Journalling Helpers** plugin?  
A: This plugin replaces that older plugin for the review questions functionality, but not its start- and end-of-day template helpers. On first install, those settings will be migrated from that plugin automatically, if you'd used that before.

Q: How is this different from your **Projects & Reviews** plugin?  
A: That plugin is designed to be used for assisting track and review Projects or project-like activities. It works on regular notes, and helps you review work on many projects, and review each at its suitable review interval. This plugin is designed to help you intentionally focus on whatever are the most important projects/goals/behaviours across all of your different endeavours in life.

## Support

Issues and feature ideas: [NotePlan plugins on GitHub](https://github.com/NotePlan/plugins/issues).

If you would like to support my late-night work extending NotePlan through writing these plugins, you can through:

[<img width="200px" alt="Buy Me A Coffee" src="https://www.buymeacoffee.com/assets/img/guidelines/download-assets-sm-2.svg" />](https://www.buymeacoffee.com/revjgc)

Thanks!

## History

See the [CHANGELOG](https://noteplan.co/plugins/jgclark.PeriodicReviews/CHANGELOG.md) for release history for v2.
