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
### Font Awesome Fonts

NotePlan's licensed **Font Awesome Pro 7** 'Regular', 'Solid', 'Duotone' and 'Light' webfonts (`*.woff2`) are made available through this Shared Resource plugin, along with their CSS. To use them your HTML will need to include the relevant items from the following in the `<head>` section:

```html
<head>
    ...
    <link href="../np.Shared/fontawesome.css" rel="stylesheet">
    <link href="../np.Shared/light.min.flat4NP.css" rel="stylesheet">
    <link href="../np.Shared/regular.min.flat4NP.css" rel="stylesheet">
    <link href="../np.Shared/solid.min.flat4NP.css" rel="stylesheet">
    <link href="../np.Shared/duotone.min.flat4NP.css" rel="stylesheet">
    ...
</head>
```

(Note: the `*.flat4NP.css` stylesheets are FA style sheets tweaked so font `url(...)` paths are flat filenames, which NotePlan's shared-file layout requires.)

And then to use the icons use the italic-element syntax like:

```html
<p><i class="fa-solid fa-arrow-rotate-right"></i>&nbsp;Refresh</p>
```

Please use the [Font Awesome website](https://fontawesome.com/search) to view/search for icons.

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

## Dialogs
### Opening a dialog/form from a Template:
- The template function `/Open Template Form` will open a dialog/form with the items specified in the template.
- Under the hood, this uses the `DynamicDialog` component from np.Shared and another Component `FormView` which basically just takes the form items from the template and sends them to the DynamicDialog component 
- Users shouldn't need to know anything about this

### Opening a dialog from within a React plugin window:
Use the `DynamicDialog` component from np.Shared

> **NOTE:** The html-plugin-comms.js is where you will do the sending/receiving in the HTML window (browser side). That file is auto-created for you when you run a `np-cli plugin:create` command. 

## Previewing React
The `live-server` npm package can be very useful to locally open saved HTML output file but running the react script files updated in the background by `npc ... -w`. For example:

`live-server --open="jgclark.Dashboard/dashboard-react.html" --ignore="*.json"`

(The `ignore` in this case stops it re-loading when that plugin's `todaysChangedNoteList.json` file changes, which it can do frequently.)

## Tag / mention cache

Plugins can share a vault-wide index of which notes contain particular `#hashtags` and `@mentions`, without each plugin scanning every note itself. Implementation: `np.Shared/src/tagMentionCache.js`. Originally written by @jgclark for Dashboard; moved here in Sep 2026 so other plugins (e.g. Projects + Reviews) can use it.

### What it delivers

The cache does **not** return paragraphs or task text. It answers: "which note filenames currently have any of these wanted tags/mentions?"

Each hit is stored as `{ filename, items: ['#project', '@alice'] }` in two lists: `regularNotes` and `calendarNotes`. Lookups are **case-insensitive** (`#Area` matches `#area`).

A note is indexed only if a **wanted** item appears in:

- an open, checklist, scheduled, or checklist-scheduled paragraph, or
- any frontmatter field value.

Hashtags that appear only on done tasks, or only in body prose, are **not** indexed (that would make the file much larger). Notes in `@` special folders (`@Archive`, `@Templates`, `@Trash`, …) are skipped on a full rebuild.

### Data Files
Two files under `data/np.Shared/` (paths are fully specified so any plugin context can read them):

| File | Role |
|------|------|
| `wantedTagMentionsList.json` | Per-plugin registrations. The cache indexes the **union**. |
| `tagMentionCache.json` | The index: `generatedAt`, `lastUpdated`, `wantedItems`, `regularNotes`, `calendarNotes`. |

An item stays in the union until **no** registered plugin still wants it.

### Updates
Shared owns the cache **functions** (`generateTagMentionCache`, `updateTagMentionCache`, age checks, and a `regenerate` preference). It does **not** run a timer, as it doesn't have a long-lived context to run from. Something else has to call those functions periodically:

- **Dashboard** is still the usual driver. After the Dashboard window first paints, and again after a section refresh, it checks `isTagMentionCacheGenerationScheduled()` and then runs `generateTagMentionCache` (with a progress banner). TAG section generation calls `getFilenamesOfNotesWithTagOrMentions`, which incrementally updates if the cache is more than about **1 hour** old, and *schedules* a full rebuild if the cache is more than about **5 days** old (Dashboard then runs that rebuild on the next open/refresh).
- **Registering new union items** (from any plugin) fire-and-forgets `generateTagMentionCache` immediately. A full rebuild can take 1-2 minutes; do not `await` it on a UI refresh path.

So, if another plugin never opens and no plugin calls generate/update, the cache is _not_ refreshed, and will not be useful.

### Register your items

Import from Shared (Rollup will bundle the module). Use your `plugin.id` so other plugins' lists are left alone.

```javascript
import {
  registerTagMentionCacheItems,
  unregisterTagMentionCacheItems,
  addTagMentionCacheItemsForPlugin,
  getTagMentionCacheDefinitions,
  isTagMentionCacheAvailable,
  isTagMentionCacheAvailableForItem,
} from '../../np.Shared/src/tagMentionCache'

// Replace this plugin's list (does not wipe other plugins)
registerTagMentionCacheItems('jgclark.Reviews', ['#project', '#area', '#goal'])

// Add without removing existing items for this plugin
addTagMentionCacheItemsForPlugin('jgclark.Reviews', ['#area'])

// Drop this plugin's list. Items remain if another plugin still registered them.
unregisterTagMentionCacheItems('jgclark.Reviews')
```

`getTagMentionCacheDefinitions()` returns the current **union**. `isTagMentionCacheAvailable()` is true when `tagMentionCache.json` exists. `isTagMentionCacheAvailableForItem('#project')` is true when that item is already in the cache body's `wantedItems` (so a lookup will not miss it for being unregistered).

If you register items that are not yet in the union, Shared **starts** a full rebuild (fire-and-forget `generateTagMentionCache`). Do not `await` that rebuild on a UI refresh path. A 5-day-old cache is only *flagged* for rebuild; Dashboard (or another caller) has to run generate.

`addTagMentionCacheDefinitions` / `setTagMentionCacheDefinitions` are Dashboard-compat helpers that write only the `jgclark.Dashboard` slot.

### How to query

**Cheap read (preferred on a refresh path).** Regular notes only. Does not update or rebuild. Returns `[]` if the cache file is missing.

```javascript
import { getRegularNoteFilenamesFromTagMentionCache } from '../../np.Shared/src/tagMentionCache'

const filenames = getRegularNoteFilenamesFromTagMentionCache(['#project', '#area'])
// e.g. ['Projects/Home.md', 'Areas/Health.md']
```

Resolve a note with `DataStore.projectNoteByFilename(filename)` (or your usual helper) if you need the `TNote`.

**Full lookup (calendar + regular).** Can incrementally update the cache first, and optionally compare counts with the NotePlan API (slower; useful for diagnostics).

```javascript
import { getFilenamesOfNotesWithTagOrMentions } from '../../np.Shared/src/tagMentionCache'

// firstUpdateCache=false: do not rebuild or incrementally update on this call
const [filenames, comparison] = await getFilenamesOfNotesWithTagOrMentions(
  ['#project', '@alice'],
  false,
  false,
)
```

Pass `firstUpdateCache: true` (the default) only when you can afford `updateTagMentionCache()` (it walks notes changed since last run). Pass `turnOnAPIComparison: false` unless you want the comparison string.

**One note.** `getCacheItemsFromNote(note, wantedItems)` returns the wanted tags/mentions found on that note using the same rules as a cache build (open items + any frontmatter field).

### Typical plugin flow

1. On settings load, `registerTagMentionCacheItems(yourPluginId, yourTags)`.
2. On a hot path, if `isTagMentionCacheAvailableForItem` is true for the tags you need, call `getRegularNoteFilenamesFromTagMentionCache`.
3. If the cache is missing or does not yet include your tags, fall back to your own scan (or wait for the scheduled rebuild). Do not trigger `generateTagMentionCache` from a window-refresh handler.

## Support

If you find an issue with this plugin, or would like to suggest new features for it, please raise a [Bug or Feature 'Issue' in GitHub](https://github.com/NotePlan/plugins/issues).

## History

See [CHANGELOG](https://github.com/NotePlan/plugins/blob/main/np.Shared/CHANGELOG.md) for latest updates/changes to this plugin.
