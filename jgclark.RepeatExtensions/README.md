# Repeat Extension plugin
NotePlan has a simple [built-in repeat mechanism](https://noteplan.co/faq/Notes%20&%20Todos/How%20to%20create%20a%20recurring%20or%20repeating%20todo/), which allows for `@repeat(1/n)`.  That wasn't flexible enough for my purposes, so I created my own extension to this mechanism.

This plugin allows repeats **every x days, weeks, months, quarters or years**. It does the work of creating the next task using information from completed tasks that include a `@repeat(interval)`, on the appropriate future date.

- Valid intervals are specified as `[+][0-9][bdwmqy]`. This allows for `b`usiness days, `d`ays, `w`eeks, `m`onths, `q`uarters or `y`ears.  ('Business' days ignore weekends, but doesn't ignore public holidays, as they're different for each country.)
- When _interval_ is of the form `+2w` it will duplicate the task for 2 weeks after the date the _task was completed_.
- When _interval_ is of the form `2w` it will duplicate the task for 2 weeks after the date the _task was last due_. This is found from a `>yyyy-mm-dd` scheduled date. If this can't be determined, then it defaults to the first option.

**To run it on the _currently open note_, type `/rpt` in the command bar**.

When run on a _project note_, it creates the new repeat task straight after the completed task.
When run on a _daily note_, it creates the new repeat task on the date of the new repeat.

## Configuration
For this feature to work, you need to have the 'Append Completion Date' NotePlan setting turned on in the Preferences (and not to mind the time portion of the `@done(...)` tag being removed, as a sign that the line has been processed).

## History

### v0.2.2, 11.6.2021
- [update] following API fix, future repeats are created OK in daily notes

### v0.2.1, 30.5.2021
- [fix] allow for other date localisations (that make `@done()` include versions of AM/PM string as well)
- [new] where the repeat is in a daily note, now 'throw' the new repeat of the task into the future date. (Note this is currently waiting on a fix to the API to be implemented fully.)

### v0.2.0, 27.5.2021
- first released version for plugin, ported to JavaScript plugin framework from my [npTools Ruby script](https://github.com/jgclark/NotePlan-tools/).
