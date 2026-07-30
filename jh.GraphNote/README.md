GraphNote - Graph visualisations for NotePlan

I’ve used many note-taking tools over the years, each with strengths in different areas:
- Tools with strong graph views that reveal connections
- Tools that link notes closely to time and calendar
- Tools that prioritise simplicity and speed
- Tools that allow layered structure and systems

NotePlan brings many of these ideas together in one place — but it was missing a flexible way to see how notes connect.

GraphNote is an attempt to fill that gap.

It provides an interactive graph of your notes, plus several alternative visualisation styles that can highlight different patterns depending on how you think and what you’re exploring.

This is a starting point, not a finished system. Feedback is very welcome, and improvements will follow where possible.

☕ If you’d like to support development:
https://buymeacoffee.com/iamjameshannam

What it does

GraphNote scans your project and calendar notes and builds a relationship graph based on:
[[Wiki links]] between notes
#tags
@mentions
calendar note entries (optional and toggleable)
external URLs

These relationships are then explored visually using multiple graph and hierarchy-based views, allowing you to switch between structural and exploratory perspectives depending on what you’re trying to understand.

Visualisation modes (and why they’re useful)
Disjoint force-directed graph

The classic graph view.
- Best for spotting clusters, hubs, and isolated groups
- A good default for open-ended exploration

Force-directed tree
- A tree-like layout driven by force simulation.
- Useful when notes form chains or threads
- Helps reveal implicit structure in loosely organised notes

Radial cluster
- A circular hierarchical layout.
- Useful for seeing breadth and fan-out from central ideas
- Highlights heavily branched areas

Tangled tree
- A layered, directional layout.
- Useful for understanding flow and dependency
- Helps when notes naturally form sequences

Icicle

A stacked hierarchical block view.
- Useful for high-level structural overview
- Makes depth and hierarchy immediately visible
- Cascaded treemap
- A nested rectangle map.
- Useful when you want structure without edge clutter
- Good for spotting dominant areas quickly

Sequences sunburst
- A radial hierarchy with path context.
- Useful for understanding navigation and progression
- Helps answer “how did I get here?”

Setup
1) Install

Download or clone the plugin folder into your NotePlan plugins directory.

Typical macOS location:

~/Library/Containers/co.noteplan.NotePlan3/Data/Library/Application Support/co.noteplan.NotePlan3/Plugins/


The GraphNote folder should contain:
- plugin.json
- script.js
- d3.v7.min.js

Restart NotePlan (or reload plugins).

2) Run the command

Open the NotePlan command bar and run:

/graphnote


This opens the GraphNote window and loads your graph.

When opening notes from GraphNote, they open in the main NotePlan app window.

Settings and options

⚠️ Do not edit script.js to change settings.
Any changes made directly to plugin files will be overwritten when the plugin updates.

All GraphNote configuration is handled using NotePlan’s built-in settings system.

Where settings live

You can access GraphNote settings via:

NotePlan → Settings → AI & Plugins → GraphNote

All settings are saved automatically and restored the next time GraphNote is opened.

Options and ways of viewing

From the top bar you can:
- Filter nodes using Filter nodes…
- Switch visualisation type via the dropdown
- Toggle visibility of:
   - Calendar notes
   - Tags
   - Mentions
   - External links
   - Labels
   - Adjust Label density (Low / Medium / High)

Use controls:
- Fit – fit graph to view
- Relayout – re-render the current view
- Rebuild – re-index notes and rebuild the graph

All changes are applied immediately and persisted via NotePlan’s settings system.

Interaction
- Click a node – select it and see its connections
- Double-click a note node – open the note in NotePlan
- Double-click a note in the right-hand list – open it in NotePlan
- In hierarchical views (sunburst, treemap, icicle):
   - Hover to see structure and context
   - Use zoom and fit controls to navigate dense areas

Tips for getting the most out of it
Use it like a spotlight

Start with a filter term:
- a concept
- a topic
- a tag

Then expand outward by toggling Tags, Mentions, or Calendar notes.

- Don’t label everything at once
- Large graphs become noisy quickly.
- Reduce label density

Turn labels off temporarily
- Use selection and the side panel instead

Match the view to the question
- “Where are the clusters?” → Disjoint force
- “What branches from this?” → Radial cluster
- “What leads to what?” → Tangled tree
- “Show structure, not edges” → Icicle / Treemap
- “Help me understand paths” → Sequences sunburst

Feedback

This plugin is intentionally exploratory and evolving.

Feedback is especially welcome on:
- Better defaults for large graphs
- Labelling heuristics
- Performance improvements
- Alternative ways to derive hierarchy from non-tree graphs
- Usability improvements
- Issues and pull requests are welcome.

Credits

D3.js (v7) – used for all visualisations
https://d3js.org/

Licensed under the BSD 3-Clause license
Visualisation concepts inspired by publicly available D3 and Observable examples:
- Force-directed graphs
- Radial cluster
- Tangled tree
- Icicle
- Treemap
- Sequences sunburst