# What's Changed in Previews plugin?

## [0.3.0] - 2023-06-01
- Added automatic setting of Mermaid charts to use their 'default' or 'dark' theme according to type of current NotePlan theme. See README for how to override this.
- Update to latest Mermaid library (v10.1.0) -- now loads from internet to make sure its on the most recent version
- Adds a trigger capability, so the preview can be automatically refreshed when the note is updated. The trigger line is `triggers: onEditorWillSave => np.Preview.updatePreview`.
- Added a 'Print me' button at top right of the preview, which opens the preview in your default browser, to allow for printing.

## [0.2.0] - 2023-05-19
- First release for private testing. **preview note** command previews standard Markdown, plus strikethrough text, basic tables, Mermaid diagrams and MathJax fragments or lines.

## [0.1.0] - 2022-09-24
- Initial work to test supporting Mermaid charts and MathJax display.
