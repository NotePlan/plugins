# 🤝 Shared Noteplan Plugin

This plugin simply ensures that there are some shared resources for NotePlan plugins to use. It has no commands for users to run (apart from some test functions).

## Fontawesome Fonts

The licensed 'Regular', 'Solid', 'Duotone' and 'Light' styles of Fontawesome OTF fonts are made available through this plugin, along with their necessary CSS files:

- ...

To use them your HTML will need to include the relevant items from the following in the `<head>` section:

```html ??? flatten?
<head>
    ...
    <link href="../np.Shared/css/fontawesome.css" rel="stylesheet">
    <link href="../np.Shared/css/light.min.css" rel="stylesheet">
    <link href="../np.Shared/css/regular.min.css" rel="stylesheet">
    <link href="../np.Shared/css/solid.min.css" rel="stylesheet">
    <link href="../np.Shared/css/duotone.css" rel="stylesheet">
    @font-face { 
      font-family: "FontAwesome6Duotone-Solid"; src: url('webfonts/fa-duotone-900.woff2') format('opentype'); 
    }
    @font-face { 
      font-family: "FontAwesome6Duotone-Light"; src: url('webfonts/fa-light-300.woff2') format('opentype'); 
    }
    @font-face { 
      font-family: "FontAwesome6Pro-Regular"; src: url('webfonts/fa-regular-400.woff2') format('opentype'); 
    }
    @font-face { 
      font-family: "FontAwesome6Pro-Solid"; src: url('webfonts/fa-solid-900.woff2') format('opentype'); 
    }
    ...
  <style>
</head>
```

And then to use the icons use the non-obvious italic syntax like:

```html ???
<p><i class="fa-solid fa-arrow-rotate-right"></i>&nbsp;Refresh<p>
```

There is also a pluginToHTMLCommsBridge file that can be used to enable bi-directional communications between the plugin and the HTML window. To use this file, import it like so:

```html

  <script>
    /* you must set these variables before you import the bridge */

    const receivingPluginID = "jgclark.Dashboard"; // the plugin ID of the plugin which will receive the comms from HTML
    // That plugin should have a function NAMED `onMessageFromHTMLView` (in the plugin.json and exported in the plugin's index.js)
    // this onMessageFromHTMLView will receive any arguments you send using the sendToPlugin() command in the HTML window

    /* the onMessageFromPlugin function is called when data is received from your plugin and needs to be processed. this function
       should not do the work itself, it should just send the data payload to a function for processing. The onMessageFromPlugin function
       below and your processing functions can be in your html document or could be imported in an external file. The only
       requirement is that onMessageFromPlugin (and receivingPluginID) must be defined or imported before the `pluginToHTMLCommsBridge`
       be in your html document or could be imported in an external file */
    function onMessageFromPlugin(type, data) {
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

## Latest Updates

See [CHANGELOG](https://github.com/NotePlan/plugins/blob/main/np.Shared/CHANGELOG.md) for latest updates/changes to this plugin.

## Support

... @jgclark, @dwertheimer ...
