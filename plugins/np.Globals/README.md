# ⚙️ np.Globals templating plugin for Noteplan

## Overview
**np.Globals** provides a centralized place where you can store/access commonly used settings which can be shared across all NotePlugin plugins.

### Adding Global Keys
The following outlines the steps to creating a global setting

Step 1: Update `np.Globals/plugin.json`

Step 2: Update `np.Globals/lib/NPGlobals` `GlobalsConfig` type object

```
type GlobalsConfig = $ReadOnly<{
  ...
  newSetting?: string,
}>
```

See **TODO:PluginSettingsDocumentation**

Step 3: Update `np.Globals/plugin.json` and add the associated entry in `plugin.settings` section

```json
  ...
  "plugin.settings": [
    {
      "type": "heading",
      "title": "NotePlan Globals Settings"
    },
    {
      "key": "version",
      "type": "hidden",
      "description": "NotePlan Globals Plugin Settings Version"
    },
    {
      "key": "local",
      "title": "System Locale",
      "description": "Locale used when display dates, times, etc (leave blank for system locale)\n\nDefault: <system>",
      "type": "string",
      "default": "<system>",
      "required": false
    }
  ]
  ...
```


### Accessing Global Settings
If you need to access a global setting from within your own plugin, the process very simple!

```js
import { getSetting } from `@helpers/NPConfiguration'

async function test() {
	const locale = getSetting('np.Globals','locale')
	console.log(`Current locale: ${locale}`)
}

```

## License

Copyright &copy; 2022 Mike Erickson
Released under the MIT license˝

## Credits

**np.Globals** written by **Mike Erickson**

E-Mail: [codedungeon@gmail.com](mailto:codedungeon@gmail.com)

Development Support: [https://github.com/NotePlan/plugins/issues](https://github.com/NotePlan/plugins/issues)

Twitter: [@codedungeon](http://twitter.com/codedungeon)

Website: [codedungeon.io](http://codedungeon.io)
