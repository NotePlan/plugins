# 💭 Journalling plugin
This plugin helps you write daily, weekly, monthly and/or quarterly **journals**, by prompting you for review questions that you set in advance. It also speeds up applying a pre-set daily template each day.

The commands are:
- `/dayStart`: Apply your 'Daily Note' Template to the currently open calendar note
- `/todayStart`: Apply your 'Daily Note' Template to today's calendar note
- `/dayReview`: Ask journal questions for an end-of-day review, and write answers in the currently open daily note. See below for details and examples.
- `/weekReview`: Ask journal questions for an end-of-week review, and write answers in the currently open weekly note.
- `/monthReview`: Ask journal questions for an end-of-month review, and write answers in the currently open note.
- `/quarterReview`: Ask journal questions for an end-of-quarter review, and write answers in the currently open note.

The `/(to)dayStart` 

## Configuration
Click the gear button on the 'Journalling' line in the Plugin Preferences panel, and fill in the settings accordingly. Defaults are given for each one, to give you some ideas.

### /dayStart and /todayStart
These commands require the [Templating plugin](https://github.com/NotePlan/plugins/tree/main/np.Templating/) to be installed.

They then use your pre-set Template name stored in the special NotePlan `Templates` folder. By default this is set to `Daily Note Template`.

The NotePlan website has good [articles on getting started with Templates](https://help.noteplan.co/article/136-templates). For more details of the tag commands you can use in a Template, including a list of events, a quote-of-the-day or summary weather forecast, see the [Templating Getting Started](https://nptemplating-docs.netlify.app/docs/templating-basics/getting-started). 

NB: Be careful with `/dayStart` in another calendar note than today using template tag commands like `<%- date... / formattedDate... %>` or `<%- weather() %>` -> because this renders the TODAY content!  

### /dayReview, /weekReview, /monthReview, and /quarterReview
You first need to configure the sets of questions to ask (though a default set is provided to get you started).

Each setting is explained:

#### Journal Section Heading
The name of an existing markdown heading after which the review answers are added. If it doesn't exist, it is added at the end of the note.

#### Daily Journal Questions
This string includes both the questions and how to lay out the answers in the daily note. There are several possible question types:
- `<int>` -> asks for a integer number
- `<number>` -> asks for a (floating point) number
- `<string>` -> asks for a string
- You can also add bulletpoints with an idenfitier e.g. `-(thoughts) <string>` -> the identifier doesn't get rendered. (The purpose of the identifier is to see on which question the user currently is, otherwise one would only have a lot of `-`.) If the user doesn't answer a bulletpoint, then it doesn't appear in the final note.
- `<mood>`-> select one of the configured moods

There is also another "question type" but no question is asked here:
- `<subheading>` -> asks for a subheading (which gets rendered as `### Subheading`)

You can indicate new lines with `\n` characters.

#### Weekly / Monthly / Quarterly Journal Questions
These strings include both the questions and how to lay out the answers in the weekly note.  The details are as for Daily Journal Questions, above.

#### Moods
A comma-separated list of possible moods to select from.  They don't have to have emoji, but I rather like them.

## /dayReview Example
The following `reviewQuestions` string:  
```
@work(<int>)\n@fruitveg(<int>)\nMood: <mood>\nThoughts <subheading>\n- (Thought 1/3) <string>\n- (Thought 2/3) <string>\n
- (Thought 3/3) <string>\nGratitude <subheading>\n- (Gratitude 1/3) <string>\n- (Gratitude 2/3) <string>\n- (Gratitude 3/3) <string>\n
```
would get rendered something like this in today's note:  

```markdown
## Journal
@work(3)
@fruitveg(2)
Mood: 😇 Blessed

### Thoughts
- Thought 1
- Thought 2

### Gratitude
- Thankful 1
- Thankful 2
- Thankful 3
```
Tip: you can also avoid answering like in Thought 3/3 - then there is also no bullet point in the final note.

## Support
If you find an issue with this plugin, or would like to suggest new features for it, please raise a [Bug or Feature 'Issue'](https://github.com/NotePlan/plugins/issues).

If you would like to support my late-night work extending NotePlan through writing these plugins, you can through:

[<img width="200px" alt="Buy Me A Coffee" src="https://www.buymeacoffee.com/assets/img/guidelines/download-assets-sm-2.svg">](https://www.buymeacoffee.com/revjgc)

Thanks!

## History
Please see the [CHANGELOG](CHANGELOG.md).
