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

## Latest Updates
See [CHANGELOG](https://github.com/NotePlan/plugins/blob/main/np.Shared/CHANGELOG.md) for latest updates/changes to this plugin.

## Support
... @jgclark, @dwertheimer ...
