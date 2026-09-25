// @flow
// -----------------------------------------------------------------------------
// Server-side shell for the canvas window. All rendering and interaction live
// in requiredFiles/canvasClient.js (loaded via <script src>); this module just
// embeds the canvas data safely and ships the CSS.
// Spec: https://jsoncanvas.org / https://github.com/obsidianmd/jsoncanvas
// -----------------------------------------------------------------------------

export type TCanvasData = {
  nodes?: Array<Object>,
  edges?: Array<Object>,
}

export function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Make a JSON blob safe to inline inside a <script> tag */
export function inlineJSON(value: any): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

const SWATCHES = ['1', '2', '3', '4', '5', '6']
  .map((c) => `<div class="swatch" data-color="${c}" title="Color ${c}"></div>`)
  .join('')

export function renderCanvasHTML(
  canvas: TCanvasData,
  title: string,
  canvasPath: string,
  fileContents: { [string]: Object } = {},
  noteIndex: Array<{ t: string, f: string }> = [],
): string {
  return `
<style>${CSS}</style>
<script>
window.__canvas = ${inlineJSON(canvas)}
window.__canvasPath = ${inlineJSON(canvasPath)}
window.__fileContents = ${inlineJSON(fileContents)}
window.__noteIndex = ${inlineJSON(noteIndex)}
</script>
<div id="viewport">
  <div id="world"></div>
  <div id="toolbar">${SWATCHES}<div class="swatch swatch-none" title="No color">×</div><div class="tb-group" title="Group the selection (⌘G)">⊞</div><div class="tb-delete" title="Delete (⌫)">🗑</div></div>
  <div id="palette">
    <button data-new="text" title="Drag onto the canvas or click (double-click the background works too)">+ card</button>
    <button data-new="file" title="Drag onto the canvas or click — with note autocomplete">+ note</button>
    <button data-new="group" title="Drag onto the canvas or click (⌘G groups the selection)">+ group</button>
  </div>
  <div id="hud"><span id="title">${escapeHtml(title)}</span><span id="zoom-level"></span></div>
</div>
<script type="text/javascript" src="./showdown.min.js"></script>
<script type="text/javascript" src="./canvasClient.js"></script>
`
}

const CSS = `
html, body { margin: 0; padding: 0; overflow: hidden; height: 100%; }
#viewport { position: absolute; inset: 0; overflow: hidden; cursor: default;
  background: var(--bg-main-color, #1e1e1e);
  background-image: radial-gradient(circle, rgba(128,128,128,0.25) 1px, transparent 1px);
  background-size: 24px 24px; }
#viewport.panning { cursor: grabbing; }
#viewport.linking { cursor: crosshair; }
#world { position: absolute; transform-origin: 0 0; }
.node { position: absolute; box-sizing: border-box; border: 2px solid; border-radius: 8px;
  padding: 10px 12px; overflow: visible; font-family: -apple-system, sans-serif; font-size: 14px;
  background: var(--bg-alt-color, #262626); color: var(--fg-main-color, #d4d4d4); }
.node > .content, .node > a, .node > span { display: block; overflow: hidden; width: 100%; height: 100%; }
.node.group { border-style: dashed; border-radius: 12px; z-index: 0; padding: 0; background-clip: padding-box; }
.node.text, .node.file, .node.link { z-index: 2; cursor: default; }
.node.selected { outline: 2px solid #4da3ff; outline-offset: 2px; }
.node.dragging { opacity: 0.85; }
.group-label { position: absolute; top: -24px; left: 8px; font-weight: 600; font-size: 13px; }
.node a { color: #4da3ff; text-decoration: none; cursor: pointer; -webkit-user-drag: none; }
.node code { background: rgba(128,128,128,0.25); border-radius: 3px; padding: 0 3px; font-size: 0.9em; }
.node h1, .node h2, .node h3, .node h4 { margin: 0 0 6px 0; background: transparent; }
.node p { margin: 0; }
.node .blank { height: 0.7em; }
.node textarea { position: absolute; inset: 0; width: 100%; height: 100%; box-sizing: border-box;
  border: none; outline: none; resize: none; padding: 10px 12px; font: inherit;
  background: var(--bg-alt-color, #262626); color: inherit; border-radius: 6px; z-index: 5; }
.file-link { display: flex !important; align-items: center; gap: 6px; font-weight: 500; }
.file-head { display: flex; align-items: center; gap: 6px; font-weight: 600; font-size: 13px;
  padding-bottom: 5px; margin-bottom: 6px; border-bottom: 1px solid rgba(128,128,128,0.3); }
.fh-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.open-btn { cursor: pointer; opacity: 0.55; font-size: 15px; padding: 0 2px; }
.open-btn:hover { opacity: 1; }
.file-content { font-size: 12px; overflow-y: auto !important; max-height: calc(100% - 34px); }
.file-missing { opacity: 0.65; font-style: italic; font-size: 12px; }
.card-input { position: absolute; inset: 0; width: 100%; height: 100%; box-sizing: border-box;
  border: none; outline: 2px solid #4da3ff; border-radius: 6px; padding: 10px 12px; font: inherit;
  background: var(--bg-alt-color, #262626); color: inherit; z-index: 6; }
.picker-input { inset: auto 0 auto 0; top: 0; height: 40px; }
.picker { position: absolute; top: 42px; left: 0; right: 0; z-index: 40; border-radius: 8px;
  background: var(--bg-alt-color, #262626); border: 1px solid rgba(128,128,128,0.4);
  box-shadow: 0 8px 24px rgba(0,0,0,0.4); overflow: hidden; }
.picker-row { padding: 6px 10px; font-size: 13px; cursor: pointer; display: flex; gap: 8px; align-items: baseline; }
.picker-row .p-path { font-size: 11px; opacity: 0.55; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.picker-row.active, .picker-row:hover { background: rgba(77,163,255,0.25); }
.card-img { max-width: 100%; max-height: calc(100% - 30px); object-fit: contain; display: block; }
/* shared content styling so text cards and note cards look identical */
.node .content img { max-width: 100%; border-radius: 4px; margin: 4px 0; }
.node .content table { border-collapse: collapse; margin: 6px 0; font-size: 0.95em; }
.node .content th, .node .content td { border: 1px solid rgba(128,128,128,0.4); padding: 3px 8px; text-align: left; }
.node .content th { font-weight: 600; background: rgba(128,128,128,0.12); }
.node .content ul, .node .content ol { margin: 2px 0 2px 4px; padding-left: 16px; }
.node .content ul { list-style: disc; }
.node .content li { margin: 1px 0; }
.node .content p { margin: 0; }
.node .content blockquote { margin: 4px 0; padding-left: 8px; border-left: 3px solid rgba(128,128,128,0.5); opacity: 0.9; }
.web-frame { width: 100%; height: calc(100% - 30px); border: none; border-radius: 0 0 6px 6px;
  pointer-events: none; background: #fff; }
#ghost { position: fixed; z-index: 50; pointer-events: none; padding: 8px 14px; border-radius: 8px;
  border: 2px dashed #4da3ff; background: rgba(77,163,255,0.15); font-family: -apple-system, sans-serif;
  font-size: 13px; color: var(--fg-main-color, #d4d4d4); transform: translate(-50%, -50%); }
.anchor { position: absolute; width: 12px; height: 12px; border-radius: 50%; background: #4da3ff;
  opacity: 0; transition: opacity 0.12s; z-index: 6; cursor: crosshair; }
.node:hover .anchor { opacity: 0.9; }
.anchor[data-side="top"] { top: -7px; left: calc(50% - 6px); }
.anchor[data-side="bottom"] { bottom: -7px; left: calc(50% - 6px); }
.anchor[data-side="left"] { left: -7px; top: calc(50% - 6px); }
.anchor[data-side="right"] { right: -7px; top: calc(50% - 6px); }
.handle { position: absolute; width: 10px; height: 10px; background: #fff; border: 1.5px solid #4da3ff;
  border-radius: 2px; z-index: 7; }
.handle-nw { top: -6px; left: -6px; cursor: nwse-resize; }
.handle-n { top: -6px; left: calc(50% - 5px); cursor: ns-resize; }
.handle-ne { top: -6px; right: -6px; cursor: nesw-resize; }
.handle-e { right: -6px; top: calc(50% - 5px); cursor: ew-resize; }
.handle-se { bottom: -6px; right: -6px; cursor: nwse-resize; }
.handle-s { bottom: -6px; left: calc(50% - 5px); cursor: ns-resize; }
.handle-sw { bottom: -6px; left: -6px; cursor: nesw-resize; }
.handle-w { left: -6px; top: calc(50% - 5px); cursor: ew-resize; }
/* pointer-events none is load-bearing: the svg spans the whole canvas ABOVE groups
   (z 1 vs 0), so without it the transparent svg box eats every click on a group */
#edges { position: absolute; z-index: 1; overflow: visible; pointer-events: none; }
.edge-line { fill: none; stroke-width: 2; pointer-events: none; }
.edge-line.selected { stroke-width: 4; filter: drop-shadow(0 0 3px #4da3ff); }
.edge-hit { fill: none; stroke: transparent; stroke-width: 14; pointer-events: stroke; cursor: pointer; }
.edge-temp { fill: none; stroke: #4da3ff; stroke-width: 2; stroke-dasharray: 6 4; pointer-events: none; }
.edge-label { fill: var(--fg-main-color, #d4d4d4); font-size: 12px; font-family: -apple-system, sans-serif; cursor: pointer; }
.label-input { position: absolute; z-index: 8; width: 160px; padding: 3px 6px; font-size: 12px;
  font-family: -apple-system, sans-serif; border: 1px solid #4da3ff; border-radius: 4px;
  background: var(--bg-alt-color, #262626); color: var(--fg-main-color, #d4d4d4); }
.node .label-input { top: -28px; left: 4px; }
#marquee { position: absolute; border: 1px solid #4da3ff; background: rgba(77,163,255,0.12); z-index: 20; pointer-events: none; }
#toolbar { position: fixed; top: 10px; left: 50%; transform: translateX(-50%); z-index: 30;
  display: none; gap: 8px; align-items: center; padding: 8px 12px; border-radius: 10px;
  background: rgba(30,30,30,0.9); border: 1px solid rgba(128,128,128,0.35); }
#toolbar .swatch { width: 18px; height: 18px; border-radius: 50%; cursor: pointer;
  border: 1.5px solid rgba(255,255,255,0.4); text-align: center; line-height: 15px;
  color: #ccc; font-family: -apple-system, sans-serif; font-size: 13px; }
#toolbar .swatch[data-color="1"] { background: #e93147; }
#toolbar .swatch[data-color="2"] { background: #ec7500; }
#toolbar .swatch[data-color="3"] { background: #e0ac00; }
#toolbar .swatch[data-color="4"] { background: #08b94e; }
#toolbar .swatch[data-color="5"] { background: #00bfbc; }
#toolbar .swatch[data-color="6"] { background: #7852ee; }
#toolbar .tb-group { cursor: pointer; font-size: 17px; margin-left: 6px; color: var(--fg-main-color, #d4d4d4); }
#toolbar .tb-group:hover, #toolbar .tb-delete:hover { transform: scale(1.15); }
#toolbar .tb-delete { cursor: pointer; font-size: 15px; margin-left: 4px; }
#palette { position: fixed; top: 10px; left: 10px; z-index: 30; display: flex; flex-direction: column;
  gap: 4px; padding: 6px; border-radius: 10px; background: rgba(30,30,30,0.9);
  border: 1px solid rgba(128,128,128,0.35); }
#palette button { border: none; border-radius: 6px; padding: 4px 10px; font-size: 12px; text-align: left;
  font-family: -apple-system, sans-serif; cursor: pointer; background: transparent;
  color: var(--fg-main-color, #d4d4d4); }
#palette button:hover { background: rgba(128,128,128,0.25); }
#hud { position: fixed; bottom: 10px; left: 12px; z-index: 10; font-family: -apple-system, sans-serif;
  font-size: 12px; color: rgba(128,128,128,0.9); user-select: none; }
#zoom-level { margin-left: 10px; }
@media (prefers-color-scheme: light) {
  #viewport { background: var(--bg-main-color, #fafafa); }
  .node { background: var(--bg-alt-color, #ffffff); color: var(--fg-main-color, #222); }
  .node textarea { background: var(--bg-alt-color, #ffffff); }
  #toolbar { background: rgba(250,250,250,0.95); }
  #palette { background: rgba(250,250,250,0.95); }
  .label-input { background: #fff; color: #222; }
}
`
