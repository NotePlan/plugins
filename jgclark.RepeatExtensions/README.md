# 🔁 Repeat Extension plugin

NotePlan has a simple [built-in repeat mechanism](https://noteplan.co/faq/Notes%20&%20Todos/How%20to%20create%20a%20recurring%20or%20repeating%20todo/), which allows for `@repeat(1/n)`.  That wasn't flexible enough for my purposes, so I created my own extension to this mechanism.

This plugin allows repeats **every x days, weeks, months, quarters or years**. It does the work of creating the next task using information from completed tasks that include a `@repeat(interval)`, on the appropriate future date.  Here's an example (from v0.5) where it will repeat 6 weeks after completion:

<img src="repeat-auto-mode.gif" width="500px">

And here's an example where the repeat is calculated from a set date:
```
* [ ] put out recycling bin @repeat(2w)
```
is completed, and then `/rpt` run, the task then becomes:
```
* [ ] put out recycling bin @repeat(2w) >2021-07-15
* [x] put out recycling bin @repeat(2w) @done(2021-07-01)
```
and the task will show up again 2 weeks after the last set date.

## Running it Automatically
From NotePlan v3.7.2, this plugin can **automatically generate** the new repeated task after you complete an existing one. This requires adding the following line to frontmatter at the start of _every note_ you wish to automate in this way:
``` yaml
---
triggers: onEditorWillSave => jgclark.RepeatExtensions.onEditorWillSave
---
```

Note: This uses the [experimental new trigger feature](https://help.noteplan.co/article/173-plugin-note-triggers), and the NotePlan developer is rightly being cautious with it. Hence ensuring you don't turn it on unintentionally.

## Running it Manually
On the _currently open note_, open the command bar and type the **/generate repeats** command.  
- When run on a _Project note_, it creates the new repeated task straight before the completed task.
- When run on a (daily or weekly) _Calendar note_, it creates the new repeated task on the date of the new repeat.

## Specifiying the Intervals
The time intervals have two parts: number and then a character. The **character** is one of:
- `b`: business days (ignore weekends, but doesn't ignore public holidays, as they're different for each country.)
- `d`: days
- `w`: weeks
- `m`: months
- `q`: quarters
- `y`: years.

When the **number** starts with a **+** (e.g. `+1m`) it will duplicate the task for 1 month after the date the _task was completed_.
When the number doesn't start with a + (e.g. `1m`) it will duplicate the task for 1 month after the date the _task was last due_. This is found from a `>yyyy-mm-dd` scheduled date. If this can't be determined, then it defaults to the first option.

## Configuration
For this feature to work, you need to have the '**Append Completion Date**' NotePlan setting turned on in the Preferences (and not to mind the time portion of the `@done(...)` tag being removed, as a sign that the line has been processed).

## Support
If you find an issue with this plugin, or would like to suggest new features for it, please raise a [Bug or Feature 'Issue'](https://github.com/NotePlan/plugins/issues).

If you would like to support my late-night work extending NotePlan through writing these plugins, you can through

[<img width="200px" alt="Buy Me A Coffee" src="https://www.buymeacoffee.com/assets/img/guidelines/download-assets-sm-2.svg">](https://www.buymeacoffee.com/revjgc)

Thanks!

## Changes
Please see the [CHANGELOG](CHANGELOG.md).
