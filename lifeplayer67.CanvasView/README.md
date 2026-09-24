# Canvas View plugin

View [JSON Canvas](https://jsoncanvas.org) (`.canvas`) files — the open format used by
Obsidian Canvas — right inside NotePlan.

## Commands

- `/open canvas` — opens a `.canvas` file in an editor window with pan & zoom.
  - Scroll / trackpad to pan, ⌘+scroll (or ctrl+scroll) to zoom, drag the background to pan,
    double-click the background to re-fit.
  - Drag a node to move it; double-click a text node to edit its markdown
    (⌘+Enter or click away to save, Esc to cancel). Changes are saved back to the
    same `.canvas` file and stay compatible with Obsidian.
  - File and link cards: plain click selects, ⌘+click opens (the note in NotePlan / the
    URL in your browser), double-click edits the file path or URL. `[[wikilinks]]` inside
    text cards open on plain click. Notes are matched by title and must exist in NotePlan.

## Settings

- **Canvas folder** — absolute path to the folder holding your `.canvas` files (e.g. your
  Obsidian vault). Relative paths given to the command are resolved against it.

## Roadmap

- v0.1: read-only viewer
- v0.2: editing — drag nodes, edit text, save back to the same `.canvas` file (this version)
- Creating/deleting nodes and edges; group dragging with children
- Importer command: convert a canvas into a structured NotePlan note

## Support

Please report issues in the [NotePlan/plugins repository](https://github.com/NotePlan/plugins/issues)
or ping @lifeplayer67 in the NotePlan Discord.
