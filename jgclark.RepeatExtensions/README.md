# Repeat Extension plugin
NotePlan has a simple [built-in repeat mechanism](https://noteplan.co/faq/Notes%20&%20Todos/How%20to%20create%20a%20recurring%20or%20repeating%20todo/), which allows for `@repeat(1/n)`.  That wasn't flexible enough for my purposes, so I created my own extension to this mechanism.

This plugin allows repeats **every x days, weeks, months, quarters or years**. It does the work of creating the next task using information from completed tasks that include a `@repeat(interval)`, on the appropriate future date.  For example when this task:
```
* [ ] put out recycling bin @repeat(2w)
```
is completed, and then `/rpt` run, the task then becomes:
```
* [x] put out recycling bin @repeat(2w) @done(2021-07-01)
* [ ] put out recycling bin @repeat(2w) >2021-07-15
```
and the task will show up again 2 weeks later. 

**To run it on the _currently open note_, type `/rpt` in the command bar**.  There is no automatic way to trigger plugins in NotePlan at the moment, so it needs to be run each time one of these `@repeat(interval)` tasks is completed.

When run on a _project note_, it creates the new repeat task straight after the completed task.
When run on a _daily note_, it creates the new repeat task on the date of the new repeat.

Notes: 

- Valid intervals are specified as `[+][0-9][bdwmqy]`. This allows for `b`usiness days, `d`ays, `w`eeks, `m`onths, `q`uarters or `y`ears.  ('Business' days ignore weekends, but doesn't ignore public holidays, as they're different for each country.)
- When _interval_ is of the form `+2w` it will duplicate the task for 2 weeks after the date the _task was completed_.
- When _interval_ is of the form `2w` it will duplicate the task for 2 weeks after the date the _task was last due_. This is found from a `>yyyy-mm-dd` scheduled date. If this can't be determined, then it defaults to the first option.

## Changes
Please see the [CHANGELOG](CHANGELOG.md).

## Configuration
For this feature to work, you need to have the 'Append Completion Date' NotePlan setting turned on in the Preferences (and not to mind the time portion of the `@done(...)` tag being removed, as a sign that the line has been processed).
