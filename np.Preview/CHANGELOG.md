# What's Changed in Previews plugin?
See [website README for more details](https://github.com/NotePlan/plugins/tree/main/np.Preview), and how to configure it.

## [0.4.0] - 2023-07-10
- new command **/start live preview** that adds a trigger to the note (if it doesn't already exist) to enable near-live update to the note preview, and then opens the preview window
- fix to preview display of title and frontmatter for some notes
- make all open task and checklist types (according to user's Markdown settings) now render as open tasks (using basic GFM rendering)

## [0.3.1] - 2023-06-29
- clarify instructions around Printing the preview, including disabling it on iOS, where it doesn't work.
- preview output now hides sync line markers
- added a hack to avoid displaying hashtags at the start of lines as headings [problem is in the third party library]

## [0.3.0] - 2023-06-26
- Added automatic setting of Mermaid charts to use their 'default' or 'dark' theme according to type of current NotePlan theme. See README for how to override this.
- Will use latest Mermaid library -- now loads from internet to make sure its on the most recent version. But this means offline preview is likely to fail.
- Adds a trigger capability, so the preview can be automatically refreshed when the note is updated. The trigger line is `triggers: onEditorWillSave => np.Preview.updatePreview`.
- Added a 'Print me' button at top right of the preview, which opens the preview in your default browser, to allow you to then print it. (I currently can't make this all happen in a single step.)

## [0.2.0] - 2023-05-19
- First release for private testing. **/preview note** command previews standard Markdown, plus strikethrough text, basic tables, Mermaid diagrams and MathJax fragments or lines.

## [0.1.0] - 2022-09-24
- Initial work to test supporting Mermaid charts and MathJax display.
