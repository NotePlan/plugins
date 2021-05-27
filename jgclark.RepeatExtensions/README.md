# Repeat Extension plugin
NotePlan has a simple repeat mechanism built in, which allows for `@repeat(1/n)`.  That wasn't flexible enough for my purposes, so I created my own extension to this mechanism.

This plugin allows repeats **every x days, weeks, months, quarters or years**. It does the work of creating the next task using information from completed tasks that include a `@repeat(interval)`, on the appropriate future date.

- Valid intervals are specified as `[+][0-9][bdwmqy]`. This allows for `b`usiness days, `d`ays, `w`eeks, `m`onths, `q`uarters or `y`ears.  ('Business' days ignore weekends, but doesn't ignore public holidays, as they're different for each country.)
- When _interval_ is of the form `+2w` it will duplicate the task for 2 weeks after the date the _task was completed_.
- When _interval_ is of the form `2w` it will duplicate the task for 2 weeks after the date the _task was last due_. This is found from a `>yyyy-mm-dd` scheduled date. If this can't be determined, then it defaults to the first option.

**To run it on the _currently open note_, type `/rpt` in the command bar**.

## Configuration
For this feature to work, you need to have the 'Append Completion Date' NotePlan setting turned on in the Preferences (and not to mind the time portion of the `@done(...)` tag being removed, as a sign that the line has been processed).

## History

### v0.2.0, 27.5.2021
- first released version for plugin, ported to JavaScript plugin framework from my [npTools Ruby script](https://github.com/jgclark/NotePlan-tools/).
