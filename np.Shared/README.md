# 🤝 Shared Resources plugin

This plugin simply ensures that there are some shared resources for NotePlan plugins to use. It has no commands for users to run (apart from some test functions).

## To use in your plugin
In your plugin's `plugin.json` file include a list of files you want from the shared resouce. E.g. some font resources:
```json
  "plugin.requiredSharedFiles": [
    "fontawesome.css",
    "regular.min.flat4NP.css",
    "solid.min.flat4NP.css",
    "fa-regular-400.woff2",
    "fa-solid-900.woff2"
  ],
```

Important notes:
- don't confuse this list with `"plugin.requiredFiles": [ ... ]` list, which are provided by your plugin itself.
- this currently has to be a flat list, without any folder structure. (@jgclark has requested API support to overcome this limitation.)

To reference them in your own plugin, you need to traverse up and down the folder structure, e.g. the first file above is available at `"../np.Shared/fontawesome.css"`.

There are some functions provided to help you test:

### `logProvidedResources()` function
This function logs the list of resource files that should currently be available by this plugin (i.e. at run-time, not compile-time).

### `logAvailableSharedResources()` function
This function logs the set of resource files actually available from np.Shared (by checking its list when this was compiled into your client plugin).

### `checkForWantedResources(fileList?)` function
This function is provided for your plugin to be able to check resources are available before trying to use them.  It can be called two ways:
- `checkForWantedResources()`: returns `true` or `false` depending whether np.Shared is loaded
- `checkForWantedResources(Array<filenames>)`: returns the number of the filenames that are available from np.Shared.

Note: You must set `const pluginID = '<your plugin ID>'` in the file(s) where you call this function.

If your plugin's `_logLevel` is set to "DEBUG" then useful details are logged.

## Available Resources
### Fontawesome Fonts

NotePlan's licensed 'Regular', 'Solid', 'Duotone' and 'Light' styles of Fontawesome OTF fonts are made available to your plugin through this 'Shared Resource' plugin, along with their necessary CSS files. To use them your HTML will need to include the relevant items from the following in the `<head>` section:

```html
<head>
    ...
    <link href="../np.Shared/fontawesome.css" rel="stylesheet">
    <link href="../np.Shared/light.min.css" rel="stylesheet">
    <link href="../np.Shared/regular.min.css" rel="stylesheet">
    <link href="../np.Shared/solid.min.css" rel="stylesheet">
    <link href="../np.Shared/duotone.css" rel="stylesheet">
    ...
  <style>
</head>
```
(Note: I have had to tweak the stylesheets to make the font files to be available in the constrained NotePlan environment.)

And then to use the icons use the non-obvious italic syntax like:

```html
<p><i class="fa-solid fa-arrow-rotate-right"></i>&nbsp;Refresh<p>
```

Please use the [fontawesome website](https://fontawesome.com/search) to view/search for icons of interest from amongst their 22,000+ choices.

### Bridging between Plugins and HTML Windows
There is also a `pluginToHTMLCommsBridge` file that can be used to enable bi-directional communications between the plugin and the HTML window. To use this file, import it like so, making sure to set the variable `receivingPluginID` to your plugin where you want to receive the messages:

```html
  <script type="text/javascript" src="../np.Shared/pluginToHTMLErrorBridge.js"></script>
  <script>const receivingPluginID = "jgclark.Dashboard"</script>
  <script type="text/javascript" src="./html-plugin-comms.js"></script>
  <script type="text/javascript" src="../np.Shared/pluginToHTMLCommsBridge.js"></script>
  <script>
    /* you must set these variables before you import the bridge */

    const receivingPluginID = "author.PluginName"; // the plugin ID of the plugin which will receive the comms from HTML
    // That plugin should have a function NAMED `onMessageFromHTMLView` (in the plugin.json and exported in the plugin's index.js)
    // this onMessageFromHTMLView will receive any arguments you send using the sendToPlugin() command in the HTML window

    /* the switchboard function is called when data is received from your plugin and needs to be processed. this function
       should not do the work itself, it should just send the data payload to a function for processing. The switchboard function
       below and your processing functions can be in your html document or could be imported in an external file. The only
       requirement is that switchboard (and receivingPluginID) must be defined or imported before the `pluginToHTMLCommsBridge`
       be in your html document or could be imported in an external file */
    function switchboard(type, data) {
      switch (type) {
        case 'yourType1':
          // call some function to process the data for yourType1 messages and pass the `data` parameter
          break
        case 'yourType2':
          // call some function to process the data for yourType2 messages
          break
      }
    }
  </script>
  <script type="text/javascript" src="../npShared/pluginToHTMLCommsBridge.js"></script>
```

>**NOTE:** The html-plugin-comms.js is where you will do the sending/receiving in the HTML window (browser side). That file is auto-created for you when you run a `np-cli plugin:create` command. 


## Support

If you find an issue with this plugin, or would like to suggest new features for it, please raise a [Bug or Feature 'Issue'](https://github.com/NotePlan/plugins/issues).

## History

See [CHANGELOG](https://github.com/NotePlan/plugins/blob/main/np.Shared/CHANGELOG.md) for latest updates/changes to this plugin.
