# Preview Plugin
This plugin provides the **preview note** command that renders the current note to HTML including:
- standard Markdown conversion
- [Mermaid diagrams](https://mermaid.js.org) (e.g. flowcharts, gantt charts, sequence diagrams ...)
- MathJax fragments or lines (for mathematical equations and notation)
- some advanced Markdown conversion (e.g. strikethrough and tables)

[This example NotePlan note](https://noteplan.co/n/EA936BC2-A6C1-43F7-9C34-E2C31CF96AC6) includes examples of these different capabilities.

Note: This is designed to be a temporary solution while we wait for similar functionality to get baked into the NotePlan app itself.  To that end, I don't intend to be making many improvements to this.

## Automatic updating
It's possible to set a **trigger** on a note so that ???


## Mermaid charts
The markdown-ish definition of these charts is done in one or more fenced code blocks:

```
``` mermaid
... chart defintion
lines  ...
```  .
```
(Please ignore the closing period; it's just there to make this render in HTML.)

You might want to read these [Mermaid Tutorials](https://mermaid.js.org/config/Tutorials.html).

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
To the people who've spend the time to create and maintain Mermaid, MathJax and the [showdown library](https://github.com/showdownjs/showdown).

## Support
If you find an issue with this plugin, or would like to suggest new features for it, please raise a [Bug or Feature 'Issue'](https://github.com/NotePlan/plugins/issues).

If you would like to support my late-night work extending NotePlan through writing these plugins, you can through

[<img width="200px" alt="Buy Me A Coffee" src="https://www.buymeacoffee.com/assets/img/guidelines/download-assets-sm-2.svg">](https://www.buymeacoffee.com/revjgc)

Thanks!

## Changes
Please see the [CHANGELOG](CHANGELOG.md).
