# ☀️ Daily Journal plugin
This plugin provides two commands for daily journalling, including start-of-day template, and end-of-day review questions.  
Both work on the currently open daily calendar note:

- `/dayStart`: Apply your `Daily Note Template` to the currently open calendar note (which by default includes list of today's events and local weather lookup)
- `/todayStart`: Apply your `Daily Note Template` to today's calendar note (which by default includes list of today's events and local weather lookup)
- `/dayReview`: Ask journal questions for an end-of-day review in the currently open calendar note. See below for details and examples.

## Changes
Please see the [CHANGELOG](CHANGELOG.md).

## Requirements
This template requires prior installation of the [Templates plugin](https://github.com/NotePlan/plugins/tree/main/nmn.Templates/).

## Configuration

### /dayStart and /todayStart
`/dayStart` and `/todayStart` use the `Daily Note Template` note found in the `Templates` folder. If this note has not been added, it should prompt you to create one.
For details of the commands you can use, including a list of events, a quote-of-the-day or summary weather forecast, see [Templates plugin README](https://github.com/NotePlan/plugins/tree/main/nmn.Templates/).

### /dayReview
You configure the set of questions to ask in the `Templates/_configuration` note. For example:
```json5
{
  dailyJournal: {
    reviewSectionHeading: "Journal",
    reviewQuestions: "@work(<int>)\n@fruitveg(<int>)\nMood:: <mood>\nGratitude:: <string>\nGod was:: <string>\nAlive:: <string>\nNot Great:: <string>\nWife:: <string>\nRemember:: <string>",
    // NB: need to use "\n" for linebreaks rather than actual linebreaks, as even JSON5 doesn't fully support multi-line strings.
    moods: "🤩 Great,🙂 Good,😇 Blessed,🥱 Tired,😫 Stressed,😤 Frustrated,😔 Low,🥵 Sick,Other"
  }
}
```
(This example is in JSON5 format: see the help text in `_configuration` note.)

#### reviewSectionHeading
The name of an existing markdown heading after which the review answers are added - if it doesn't exist, it is added at the end of the note
#### reviewQuestions
This string includes both the questions and how to layout the answers in the daily note. There are several possible question types:
- `<int>` -> input a integer number
- `<number>` -> input a float number
- `<string>` -> input a string
- You can also add bulletpoints with an idenfitier e.g. `-(thoughts) <string>` -> the identifier doesn't get rendered. (The purpose of the identifier is to see on which question the user currently is, otherwise one would only have a lot of `-`.) If the user doesn't answer a bulletpoint, then it doesn't appear in the final note.
- `<mood>`-> select one of the configured moods

There is also another "question type" but no question is asked here:
- `<subheading>` -> input a subheading (which gets rendered as `### Subheading`)

You can indicate new lines with `\n` characters.

#### moods
A comma-separated list of possible moods to select from.  They don't have to have emoji, but I rather like them.

### /dayReview Example
The following `reviewQuestions` string:  
```
@work(<int>)\n@fruitveg(<int>)\nMood -> <mood>\nThoughts <subheading>\n- (Thought 1/3) <string>\n- (Thought 2/3) <string>\n
- (Thought 3/3) <string>\nGratitude <subheading>\n- (Gratitude 1/3) <string>\n- (Gratitude 2/3) <string>\n- (Gratitude 3/3) <string>\n
```
would get rendered something like this in today's note:  

```markdown
## Journalling
@work(3)
@fruitveg(2)
Mood -> 😇 Blessed

### Thoughts
- Thought 1
- Thought 2

### Gratitude
- Thankful 1
- Thankful 2
- Thankful 3
```
Tip: you can also avoid answering like in Thought 3/3 - then there is also no bullet point in the final note.
