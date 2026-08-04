# 🖥️ Preview Plugin
This plugin provides the **/preview note** and **/start live preview** commands that renders the current note to HTML including:
- standard Markdown conversion (including referenced images)
- [Mermaid diagrams](https://mermaid.js.org) (e.g. flowcharts, gantt charts, sequence diagrams ...)
- [MathJax](https://www.mathjax.org/) fragments or lines (for mathematical equations and notation)
- all open task and checklist types (according to user's Markdown settings) render as open tasks (using basic GFM rendering)
- some non-standard Markdown conversion (e.g. strikethrough, footnotes, tasklists and tables)
- it renders frontmatter slightly differently

It adds a 'Print (opens in system browser)' button to the preview window (on macOS). Clicking this opens the note in your default browser, where you can then select to print it. (There are limitations in the API that prevent me from making this a single button press, sorry.)

[This example NotePlan note](https://noteplan.co/n/EA936BC2-A6C1-43F7-9C34-E2C31CF96AC6) includes examples of these different capabilities.

## Limitations
This is designed to be a temporary solution while we wait for similar functionality to get baked into the NotePlan app itself. To that end, I don't intend to be making many improvements to this.  In particular I'm aware that:

-  there are bugs in the rendering of frontmatter arising from one of the third-party libraries this uses.

## Automatic updating
Use the **/start live preview** command to open the Preview window, _and enable near-live update for this note_. Under the hood this works by adding a **trigger** on the note so that the window will automatically refresh when you edit the note. This is the line it adds to the note's frontmatter block:
```yaml
triggers: onEditorWillSave => np.Preview.updatePreview
```

It deliberately updates the Preview window without giving it focus, so that you can continue editing.

## Mermaid charts
<img src="kanban-mermaid@2x.png" alt="Example of Kanban board in Mermaid charts" />
Mermaid is a third-party library that makes a wide variety of diagrams (including Flowcharts, Gantt, Kanban, state transition etc.) and some simple charts, using markdown-ish definitions. These definitions are placed in one or more fenced code blocks, like this:

```
``` mermaid
... chart definition
lines  ...
```  .
```
(Please ignore the closing period; it's just there to make this render in HTML.)

Please see [Mermaid's own Tutorials](https://mermaid.js.org/config/Tutorials.html).

Note: When online, Mermaid loads the latest **v11.x** from jsDelivr (`mermaid@11`). When offline (or if the CDN fails), the plugin falls back to a shipped official UMD snapshot in `requiredFiles` (currently **11.16.1**). The offline file can lag behind the CDN until the next plugin release.

Developer's note: To refresh the offline snapshot for a release:
1. Bump the root `package.json` `mermaid` dependency (or download from [jsDelivr](https://www.jsdelivr.com/package/npm/mermaid)).
2. Copy `node_modules/mermaid/dist/mermaid.min.js` to `np.Preview/requiredFiles/mermaid@VERSION.min.js`.
3. Update that filename in `plugin.json` `plugin.requiredFiles` and the `MERMAID_OFFLINE_FILENAME` constant in `src/previewMain.js`.

If/when Mermaid releases v12, change the CDN URL major in `src/previewMain.js` (search for `mermaid@11`) and rebuild the plugin.

### Theming Mermaid
The plugin automatically sets the Mermaid chart to use their 'default' or 'dark' theme according to the type of the current NotePlan theme. But you can [override the theme](https://mermaid.js.org/config/theming.html) for individual diagrams by including the following directive at the start of a Mermaid definition:

`%%{init: {'theme':'forest'}}%%`

## MathJax rendering
This provides a way to include complex mathematical expressions either inline or in separate paragraphs, as this example shows:
```md
When \\(a \ne 0\\), there are two solutions to \\(ax^2 + bx + c = 0\\), and they are:
$$x = {-b \pm \sqrt{b^2-4ac} \over 2a}.$$
```

## Thanks
To the people who've spend the time to create and maintain [Mermaid](https://mermaid.js.org), [MathJax](https://www.mathjax.org/) and the [showdown library](https://github.com/showdownjs/showdown).

## Support
If you find an issue with this plugin, or would like to suggest new features for it, please raise a [Bug or Feature 'Issue' in GitHub](https://github.com/NotePlan/plugins/issues).

If you would like to support my late-night work extending NotePlan through writing these plugins, you can through

[<img width="200px" alt="Buy Me A Coffee" src="https://www.buymeacoffee.com/assets/img/guidelines/download-assets-sm-2.svg" />](https://www.buymeacoffee.com/revjgc)

Thanks!

## Changes
Please see the [CHANGELOG](https://github.com/NotePlan/plugins/blob/main/np.Preview/CHANGELOG.md).
