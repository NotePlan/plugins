# Canvas View plugin

View [JSON Canvas](https://jsoncanvas.org) (`.canvas`) files — the open format used by
Obsidian Canvas — right inside NotePlan.

## Commands

- `/new canvas` — creates an empty `.canvas` file (in the *Canvas folder* setting, or
  `Canvases/` by default) and opens it.
- `/open canvas` — pick any indexed `.canvas` file from a list and open it in the
  canvas editor (opens as a split pane inside the main window by default).
  - Scroll / trackpad to pan, ⌘+scroll (or ctrl+scroll) to zoom, drag the background to pan,
    double-click the background to re-fit.
  - Drag a node to move it; double-click a text node to edit its markdown
    (⌘+Enter or click away to save, Esc to cancel). Changes are saved back to the
    same `.canvas` file and stay compatible with Obsidian.
  - File and link cards: plain click selects, ⌘+click opens (the note in NotePlan / the
    URL in your browser), double-click edits the file path or URL. `[[wikilinks]]` inside
    text cards open on plain click. Notes are matched by title and must exist in NotePlan.

## Editor cheat-sheet

| Action | How |
|---|---|
| Create a card | double-click the background, or drag/click a palette button (`+ card`, `+ note`, `+ group`) |
| Connect cards | hover a card, drag from a side anchor dot onto another card |
| Select | click; ⇧+click adds; drag on the background rubber-bands (a band fully enclosing a group selects the group) |
| Move | drag a card; a selected group drags from anywhere inside; an unselected group only by its frame or label |
| Edit | double-click: text card → markdown, note card body → the note itself, note card header → note picker, group frame/label → rename, edge → label |
| Open | ↗ button or ⌘+click (note in NotePlan / URL in browser); links inside text open on plain click |
| Colors | toolbar swatches or keys 1–6, 0 clears |
| Group / duplicate / delete | ⌘G / ⌘D / ⌫ |
| Copy & paste | ⌘C / ⌘V (JSON Canvas snippet via the system clipboard — works across canvases) |
| Undo / redo | ⌘Z / ⇧⌘Z |
| Navigate | scroll pans, ⌘+scroll zooms, ⇧+drag pans, F zooms to selection, double-click background re-fits |

## Settings

- **Canvas folder** — absolute path to the folder holding your `.canvas` files (e.g. your
  Obsidian vault). Relative paths given to the command are resolved against it.

## Roadmap

- v0.1: read-only viewer
- v0.2: editing — drag nodes, edit text, save back to the same `.canvas` file (this version)
- Creating/deleting nodes and edges; group dragging with children
- Importer command: convert a canvas into a structured NotePlan note

## Platform limitations (API wishlist)

Feature parity with Obsidian Canvas is limited by a few NotePlan plugin-API gaps.
Native support (or new APIs) for these would close the remaining distance:

1. **No directory listing API.** `DataStore.loadData` reads a known path, but plugins
   cannot enumerate folder contents — so an autocomplete over media/attachment files
   (like Obsidian's "drag to add media") is not implementable. A `DataStore.listFiles(folder)`
   would solve it.
2. **Website previews are best-effort.** Link cards embed sites via `<iframe>`, and
   WKWebView honours `X-Frame-Options`/CSP — many sites render blank. Obsidian bypasses
   this with per-card native webviews; an equivalent would need NotePlan-side support.
3. **No custom file-type editors.** A plugin cannot register itself as the editor for
   `.canvas` files, so canvases can't open from the sidebar like notes — the closest
   integration is the HTML split view this plugin uses. First-class JSON Canvas support
   in NotePlan (an open format: https://jsoncanvas.org) would be the ideal endgame.
4. **No note-change events.** Note contents shown inside file cards are read when the
   canvas opens; edits made in the NotePlan editor while the canvas is open aren't
   pushed to the window (workaround: reopen the canvas).

## Support

Please report issues in the [NotePlan/plugins repository](https://github.com/NotePlan/plugins/issues)
or ping @lifeplayer67 in the NotePlan Discord.
