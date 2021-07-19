# 🕓 Review Projects plugin
This plugin provides commands to help work with Project-based notes. This will be of interest for those who use NotePlan to plan and track work in different areas, which could be loosely referred to as 'Projects'. This will be familiar to people who use David Allen's **Getting Things Done** approach, or any other where **regular reviews** are important. It probably won't have much applicability to people who use NotePlan as a Zettelkasten-style knowledge base.

## Using NotePlan for Project-like work
Unlike many task or project management apps, NotePlan is both much less structured, and entirely text/markdown based.  This makes it much more flexible, but makes it less obvious how to use it for project tracking or management.  This is how I use it: there may be better ways for you.

Each **Project** is described by a separate note. Each such project contains the hashtag `#project` and some other metadata fields on the line immediately after the title.  For example:

```markdown
# Secret Undertaking
#project @review(2w) @reviewed(2021-07-20) @start(2021-04-05) @due(2021-11-30)
Aim: Do this amazing secret thing

## Details
...
```

The other fields I use are:
- `@review(...)`: interval to use between reviews, of form [nn][dwmqy]
- `@reviewed(YYYY-MM-DD)`: last time this project was reviewed, using this plugin
- `@start(YYY-MM-DD)`: project's start date
- `@due(YYY-MM-DD)`: project's due date

Similarly, if you follow the PARA method, then you will also have "**Areas** of responsibility" to maintain. These don't normally have a start or end date, but they also need reviewing.  For example:

```markdown
# Car maintenance
#area @review(1m) @reviewed(2021-06-25)
Aim: Make sure car runs well, is legal etc.

* check tyres @repeat(+1m) >2021-07-23
* pay car/road tax @repeat(1y) >2021-10-11
* book yearly service @repeat(1y) >2022-02-01
...
```

## Reviewing Projects / Areas
This plugin provides the following commands, which are described in more detail below:

### `/prepare for review`
This prepare lists of project notes ready for review @@@

### `/completeProjectReview`
This updates the project's @reviewed() date
@@@

### `/nextProjectReview`
This updates this project's @reviewed() date, and jump to next project review
@@@

## Configuration
These commands require configuration; the first time they're run they should detect they don't have configuration, and offer to write default configuration to the first configuration block of the `Templates/_configuration` note (as used by the Templates system). 

Alternatively, in the `Templates/_configuration` note, include the following settings you want in the note's first configuration block. For example:

```javascript
...
  review: {
    folderToStore: 'Summaries' // will be created if necessary
    noteTypeTags: '#area' // or #project, #archive etc.
    displayGroupedByFolder: true
    displayOrder: 'alpha' // 'due', 'review' or 'alpha'
...
```
(This uses JSON5 format: ensure there are commas at the end of all that lines that need them.)

## To do
- tbd

## History

### v0.2.0, .7.2021
- first release.  See [website README for more details](https://github.com/NotePlan/plugins/tree/main/jgclark.Review), and how to configure.
