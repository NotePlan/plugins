# Tidy plugin

This plugin provides commands to help tidy up your notes:

- **/Remove section from recent notes** (alias "rsfrn"): Remove a given section (heading + its content block) from recently-changed notes. Can be used with parameters from Template or x-callback.
- **/Remove time parts from @done() dates** (alias "rtp"): Remove time parts of @done(date time) from recently-updated notes. Can be used with parameters from Template or Callback.

??? - **/Remove @done() markers** (alias "rdm"): Remove @done() markers from recently-updated notes. 

??? - **/Remove content under heading in all notes** (alias "rcuh"). (original function by @dwertheimer)

All can be used with parameters from a Template, or via an x-callback call.

## Using from Templates

You can use all these capabilites from Template calls as well. They all take the form:

`<% await DataStore.invokePluginCommandByName("<command name>","np.Tidy",['<parameters>'])  %>`

Note: the parameters are passed as `"key":"value"` pairs separated by commas, and surrounded by curly brackets `{...}`. (This is JSON encoding.) Note the parameters then need to be surrounded by square brackets and single quotes.

For example:

`<% await DataStore.invokePluginCommandByName("Remove section from notes","np.Tidy",['{"numDays":2, "sectionHeading":"Test Delete Me"}'])  %>`

**Tip:** as these are complicated and fiddly to create, **I suggest you use @dwertheimer's excellent [Link Creator plugin]() command "/Get X-Callback-URL"** which makes it much simpler.

**Note:** These work particularly well in **Daily Note templates** where they can be set to silently tidy things up over the last week or so.

## Using from x-callback calls

It's possible to call these commands from [outside NotePlan using the **x-callback mechanism**](https://help.noteplan.co/article/49-x-callback-url-scheme#runplugin). The URL calls all take the same form:

`noteplan://x-callback-url/runPlugin?pluginID=np.Tidy&command=<encoded command name>&arg0=<encoded parameters>`

Notes:
- all parameters are passed as `"key":"value"` pairs separated by commas, and surrounded by curly brackets `{...}`. (This is JSON encoding.)
- as with all x-callback URLs, all the arguments (including the command name) need to be URL-encoded. For example, spaces need to be turned into '%20'.

This is an example of a fully URL-encoded call:

| un-encoded call | URL-encoded call |
| ----- | ----- |
| `noteplan://x-callback-url/runPlugin?pluginID=np.Tidy&command=Remove section from notes&arg0={"numDays":20, "sectionHeading":"Test Delete Me"}` | `noteplan://x-callback-url/runPlugin?pluginID=np.Tidy&command=Remove%20section%20from%20notes&arg0=%7B%22numDays%22%3A%202%2C%20%22sectionHeading%22%3A%22Test%20Delete%20Me%22%7D` |

**Tip:** as these are complicated and fiddly to create, **I strongly suggest you use @dwertheimer's excellent [Link Creator plugin]() command "/Get X-Callback-URL"** which makes it vastly easier.

## Configuration
Click the gear button on the 'Tidy' line in the Plugin Preferences panel, and fill in the settings accordingly. Defaults and descriptions are given for each one.

## Thanks
@dwertheimer wrote one of the functions used in this plugin.

## Support
If you find an issue with this plugin, or would like to suggest new features for it, please raise a [Bug or Feature 'Issue'](https://github.com/NotePlan/plugins/issues).

If you would like to support my late-night work extending NotePlan through writing these plugins, you can through:

[<img width="200px" alt="Buy Me A Coffee" src="https://www.buymeacoffee.com/assets/img/guidelines/download-assets-sm-2.svg">](https://www.buymeacoffee.com/revjgc)

Thanks!

## History
Please see the [CHANGELOG](CHANGELOG.md).
