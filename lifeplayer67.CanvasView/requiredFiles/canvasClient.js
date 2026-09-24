/* eslint-disable */
// -----------------------------------------------------------------------------
// Canvas View — client engine. Runs inside the NotePlan HTML window.
// Owns the canvas state, renders nodes/edges, handles all interactions and
// pushes the whole document to the plugin ('saveCanvas') after every mutation.
// Pure helpers are exported for Jest when loaded under Node.
// -----------------------------------------------------------------------------
;(function () {
  'use strict'

  // ---------- pure helpers (shared with tests) ----------

  var PRESET_COLORS = { 1: '#e93147', 2: '#ec7500', 3: '#e0ac00', 4: '#08b94e', 5: '#00bfbc', 6: '#7852ee' }

  function resolveColor(c, fallback) {
    if (!c) return fallback || '#8a8a8a'
    return PRESET_COLORS[c] || c
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }

  function inlineMd(s) {
    // NB: <b> and <emph> (not <strong>/<em>) — NotePlan's theme CSS targets 'p b'
    // and 'p emph', so this markup inherits the user's theme colors for bold/italic
    return s
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/\*([^*]+)\*/g, '<emph>$1</emph>')
      .replace(/\[\[([^\]|]+)(\|([^\]]+))?\]\]/g, function (_, target, __, alias) {
        var title = String(target).split('/').pop().replace(/\.md$/, '')
        return '<a href="#" class="note-link" data-note-title="' + escapeHtml(title) + '">' + (alias || title) + '</a>'
      })
      .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
      .replace(/(^|[^">\]])(https?:\/\/[^\s<]+)/g, '$1<a href="$2" target="_blank">$2</a>')
  }

  function renderMarkdown(md) {
    return escapeHtml(md)
      .split('\n')
      .map(function (line) {
        var h = line.match(/^(#{1,6})\s+(.*)$/)
        if (h) return '<h' + h[1].length + '>' + inlineMd(h[2]) + '</h' + h[1].length + '>'
        if (/^\s*[-*]\s+/.test(line)) return '<p class="li">•&nbsp;' + inlineMd(line.replace(/^\s*[-*]\s+/, '')) + '</p>'
        if (line.trim() === '') return '<p class="blank"></p>'
        return '<p>' + inlineMd(line) + '</p>'
      })
      .join('')
  }

  function genId() {
    var s = ''
    for (var i = 0; i < 16; i++) s += Math.floor(Math.random() * 16).toString(16)
    return s
  }

  function anchorPoint(n, side) {
    if (side === 'top') return { x: n.x + n.width / 2, y: n.y }
    if (side === 'bottom') return { x: n.x + n.width / 2, y: n.y + n.height }
    if (side === 'left') return { x: n.x, y: n.y + n.height / 2 }
    return { x: n.x + n.width, y: n.y + n.height / 2 }
  }

  function sideNormal(side) {
    if (side === 'top') return { x: 0, y: -1 }
    if (side === 'bottom') return { x: 0, y: 1 }
    if (side === 'left') return { x: -1, y: 0 }
    return { x: 1, y: 0 }
  }

  function autoSides(from, to) {
    var dx = to.x + to.width / 2 - (from.x + from.width / 2)
    var dy = to.y + to.height / 2 - (from.y + from.height / 2)
    if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? ['right', 'left'] : ['left', 'right']
    return dy > 0 ? ['bottom', 'top'] : ['top', 'bottom']
  }

  function nearestSide(node, wx, wy) {
    var best = 'right', bestD = Infinity
    ;['top', 'right', 'bottom', 'left'].forEach(function (side) {
      var p = anchorPoint(node, side)
      var d = Math.hypot(p.x - wx, p.y - wy)
      if (d < bestD) { bestD = d; best = side }
    })
    return best
  }

  function nodeInsideGroup(n, g) {
    return n.id !== g.id && n.x >= g.x && n.y >= g.y && n.x + n.width <= g.x + g.width && n.y + n.height <= g.y + g.height
  }

  var pure = {
    resolveColor: resolveColor,
    escapeHtml: escapeHtml,
    renderMarkdown: renderMarkdown,
    autoSides: autoSides,
    nearestSide: nearestSide,
    nodeInsideGroup: nodeInsideGroup,
    genId: genId,
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = pure
    return
  }

  // ---------- browser-only from here ----------

  var canvas = window.__canvas || { nodes: [], edges: [] }
  if (!canvas.nodes) canvas.nodes = []
  if (!canvas.edges) canvas.edges = []
  var canvasPath = window.__canvasPath
  var fileContents = window.__fileContents || {}
  var nodeById = {}

  var viewport = document.getElementById('viewport')
  var world = document.getElementById('world')
  var toolbar = document.getElementById('toolbar')
  var zoomLabel = document.getElementById('zoom-level')
  var svg = null
  var scale = 1, tx = 0, ty = 0

  var selectedNodes = new Set()
  var selectedEdges = new Set()
  var undoStack = [], redoStack = []
  var saveTimer = null

  function toPlugin(action, data) {
    data.path = canvasPath
    if (typeof sendMessageToPlugin === 'function') sendMessageToPlugin(action, data)
    else console.log('comms bridge missing; wanted to send', action)
  }

  // ---------- persistence & undo ----------

  function serialize() {
    return JSON.stringify(canvas, null, '\t')
  }

  function persist() {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(function () {
      toPlugin('saveCanvas', { json: serialize() })
    }, 400)
  }

  function pushUndo() {
    undoStack.push(JSON.stringify(canvas))
    if (undoStack.length > 100) undoStack.shift()
    redoStack.length = 0
  }

  function restore(json) {
    canvas = JSON.parse(json)
    if (!canvas.nodes) canvas.nodes = []
    if (!canvas.edges) canvas.edges = []
    selectedNodes.clear()
    selectedEdges.clear()
    renderScene()
    persist()
  }

  function undo() {
    if (!undoStack.length) return
    redoStack.push(JSON.stringify(canvas))
    restore(undoStack.pop())
  }

  function redo() {
    if (!redoStack.length) return
    undoStack.push(JSON.stringify(canvas))
    restore(redoStack.pop())
  }

  // ---------- rendering ----------

  function nodeHTML(n) {
    var color = resolveColor(n.color, n.type === 'group' ? '#8a8a8a' : '#9aa0a6')
    var sel = selectedNodes.has(n.id) ? ' selected' : ''
    var style = 'left:' + n.x + 'px;top:' + n.y + 'px;width:' + n.width + 'px;height:' + n.height + 'px;border-color:' + color + ';'
    var anchors =
      '<div class="anchor" data-side="top"></div><div class="anchor" data-side="right"></div>' +
      '<div class="anchor" data-side="bottom"></div><div class="anchor" data-side="left"></div>'
    var inner = ''
    if (n.type === 'group') {
      var label = '<div class="group-label" style="color:' + color + '">' + escapeHtml(n.label || '') + '</div>'
      return '<div class="node group' + sel + '" data-id="' + escapeHtml(n.id) + '" style="' + style + 'background:' + hexAlpha(color, 0.06) + '">' + label + anchors + '</div>'
    }
    var extra = ''
    if (n.type === 'text') inner = '<div class="content">' + renderMarkdown(n.text || '') + '</div>'
    else if (n.type === 'file') {
      var base = String(n.file || '').split('/').pop()
      var title = base.replace(/\.[^.]+$/, '')
      extra = ' data-note-title="' + escapeHtml(title) + '"'
      var fc = fileContents[n.id]
      var body = fc && fc.found
        ? '<div class="content file-content">' + renderMarkdown(fc.content || '') + '</div>'
        : '<div class="content file-missing">Нотатки ще немає в NotePlan.<br>Подвійний клік — написати (нотатка створиться).<br>Подвійний клік по заголовку — змінити шлях.</div>'
      inner = '<div class="file-head"><span>📄</span> <span class="fh-name">' + escapeHtml(base) + '</span><span class="open-btn" title="Відкрити нотатку в NotePlan (або ⌘+клік по картці)">↗</span></div>' + body
    } else if (n.type === 'link') {
      inner = '<a href="' + escapeHtml(n.url || '') + '" target="_blank">🔗 ' + escapeHtml(n.url || '') + '</a>'
    }
    return '<div class="node ' + n.type + sel + '" data-id="' + escapeHtml(n.id) + '"' + extra + ' style="' + style + '">' + inner + anchors + '</div>'
  }

  function hexAlpha(hex, a) {
    var m = hex.match(/^#([0-9a-f]{6})$/i)
    if (!m) return hex
    var v = parseInt(m[1], 16)
    return 'rgba(' + ((v >> 16) & 255) + ',' + ((v >> 8) & 255) + ',' + (v & 255) + ',' + a + ')'
  }

  function renderScene() {
    nodeById = {}
    canvas.nodes.forEach(function (n) { nodeById[n.id] = n })
    var groups = canvas.nodes.filter(function (n) { return n.type === 'group' }).sort(function (a, b) { return b.width * b.height - a.width * a.height })
    var others = canvas.nodes.filter(function (n) { return n.type !== 'group' })
    world.innerHTML = groups.map(nodeHTML).join('') + '<svg id="edges"></svg>' + others.map(nodeHTML).join('')
    svg = document.getElementById('edges')
    drawEdges()
    placeHandles()
    updateToolbar()
  }

  function drawEdges() {
    var defs = '', paths = ''
    canvas.edges.forEach(function (e) {
      var from = nodeById[e.fromNode], to = nodeById[e.toNode]
      if (!from || !to) return
      var auto = autoSides(from, to)
      var fs = e.fromSide || auto[0], ts = e.toSide || auto[1]
      var p1 = anchorPoint(from, fs), p2 = anchorPoint(to, ts)
      var dist = Math.hypot(p2.x - p1.x, p2.y - p1.y)
      var bend = Math.max(40, Math.min(dist / 2, 200))
      var n1 = sideNormal(fs), n2 = sideNormal(ts)
      var col = resolveColor(e.color)
      var sel = selectedEdges.has(e.id)
      var d = 'M ' + p1.x + ' ' + p1.y + ' C ' + (p1.x + n1.x * bend) + ' ' + (p1.y + n1.y * bend) + ', ' + (p2.x + n2.x * bend) + ' ' + (p2.y + n2.y * bend) + ', ' + p2.x + ' ' + p2.y
      defs += '<marker id="arrow-' + escapeHtml(e.id) + '" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="' + col + '"/></marker>'
      var ms = (e.fromEnd || 'none') === 'arrow' ? ' marker-start="url(#arrow-' + escapeHtml(e.id) + ')"' : ''
      var me = (e.toEnd || 'arrow') === 'arrow' ? ' marker-end="url(#arrow-' + escapeHtml(e.id) + ')"' : ''
      paths += '<path class="edge-hit" data-edge-id="' + escapeHtml(e.id) + '" d="' + d + '"/>'
      paths += '<path class="edge-line' + (sel ? ' selected' : '') + '" data-edge-id="' + escapeHtml(e.id) + '" d="' + d + '" stroke="' + col + '"' + ms + me + '/>'
      if (e.label) {
        paths += '<text class="edge-label" data-edge-id="' + escapeHtml(e.id) + '" x="' + (p1.x + p2.x) / 2 + '" y="' + ((p1.y + p2.y) / 2 - 6) + '" text-anchor="middle">' + escapeHtml(e.label) + '</text>'
      }
    })
    var pad = 100
    var ns = canvas.nodes
    var minX = (ns.length ? Math.min.apply(null, ns.map(function (n) { return n.x })) : 0) - pad
    var minY = (ns.length ? Math.min.apply(null, ns.map(function (n) { return n.y })) : 0) - pad
    var maxX = (ns.length ? Math.max.apply(null, ns.map(function (n) { return n.x + n.width })) : 800) + pad
    var maxY = (ns.length ? Math.max.apply(null, ns.map(function (n) { return n.y + n.height })) : 600) + pad
    svg.style.left = minX + 'px'
    svg.style.top = minY + 'px'
    svg.style.width = maxX - minX + 'px'
    svg.style.height = maxY - minY + 'px'
    svg.setAttribute('viewBox', minX + ' ' + minY + ' ' + (maxX - minX) + ' ' + (maxY - minY))
    svg.innerHTML = '<defs>' + defs + '</defs>' + paths + (tempEdgeSVG || '')
    return [minX, minY, maxX, maxY]
  }

  // ---------- pan & zoom ----------

  function apply() {
    world.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + scale + ')'
    zoomLabel.textContent = Math.round(scale * 100) + '%'
  }

  function fit() {
    var b = drawEdges()
    var w = b[2] - b[0], h = b[3] - b[1]
    scale = Math.min(viewport.clientWidth / w, viewport.clientHeight / h, 1.5)
    tx = (viewport.clientWidth - w * scale) / 2 - b[0] * scale
    ty = (viewport.clientHeight - h * scale) / 2 - b[1] * scale
    apply()
  }

  function toWorld(sx, sy) {
    return { x: (sx - tx) / scale, y: (sy - ty) / scale }
  }

  viewport.addEventListener('wheel', function (e) {
    e.preventDefault()
    if (e.ctrlKey || e.metaKey) {
      var factor = Math.exp(-e.deltaY * 0.01)
      var ns = Math.min(Math.max(scale * factor, 0.05), 4)
      tx = e.clientX - ((e.clientX - tx) / scale) * ns
      ty = e.clientY - ((e.clientY - ty) / scale) * ns
      scale = ns
    } else {
      tx -= e.deltaX
      ty -= e.deltaY
    }
    apply()
  }, { passive: false })

  // ---------- selection ----------

  function clearSelection() {
    selectedNodes.clear()
    selectedEdges.clear()
  }

  function updateToolbar() {
    toolbar.style.display = selectedNodes.size || selectedEdges.size ? 'flex' : 'none'
  }

  /**
   * Refresh selection visuals WITHOUT rebuilding the DOM. Rebuilding on mousedown
   * destroys the element under the cursor, which kills the browser's dblclick —
   * that's how text editing broke in 0.3.0. Only structural changes use renderScene().
   */
  function updateSelectionUI() {
    world.querySelectorAll('.node').forEach(function (el) {
      el.classList.toggle('selected', selectedNodes.has(el.dataset.id))
    })
    world.querySelectorAll('.handle').forEach(function (h) { h.remove() })
    placeHandles()
    drawEdges()
    updateToolbar()
  }

  function applyColor(c) {
    if (!selectedNodes.size && !selectedEdges.size) return
    pushUndo()
    canvas.nodes.forEach(function (n) { if (selectedNodes.has(n.id)) { if (c) n.color = c; else delete n.color } })
    canvas.edges.forEach(function (e) { if (selectedEdges.has(e.id)) { if (c) e.color = c; else delete e.color } })
    renderScene()
    persist()
  }

  function deleteSelection() {
    if (!selectedNodes.size && !selectedEdges.size) return
    pushUndo()
    canvas.nodes = canvas.nodes.filter(function (n) { return !selectedNodes.has(n.id) })
    canvas.edges = canvas.edges.filter(function (e) {
      return !selectedEdges.has(e.id) && !selectedNodes.has(e.fromNode) && !selectedNodes.has(e.toNode)
    })
    clearSelection()
    renderScene()
    persist()
  }

  function duplicateSelection() {
    if (!selectedNodes.size) return
    pushUndo()
    var clones = []
    canvas.nodes.forEach(function (n) {
      if (!selectedNodes.has(n.id)) return
      var c = JSON.parse(JSON.stringify(n))
      c.id = genId()
      c.x += 30
      c.y += 30
      clones.push(c)
    })
    canvas.nodes = canvas.nodes.concat(clones)
    clearSelection()
    clones.forEach(function (c) { selectedNodes.add(c.id) })
    renderScene()
    persist()
  }

  // ---------- resize handles ----------

  var HANDLES = [
    ['nw', 0, 0], ['n', 0.5, 0], ['ne', 1, 0], ['e', 1, 0.5],
    ['se', 1, 1], ['s', 0.5, 1], ['sw', 0, 1], ['w', 0, 0.5],
  ]

  function placeHandles() {
    if (selectedNodes.size !== 1) return
    var id = selectedNodes.values().next().value
    var el = world.querySelector('.node[data-id="' + CSS.escape(id) + '"]')
    if (!el) return
    HANDLES.forEach(function (h) {
      var d = document.createElement('div')
      d.className = 'handle handle-' + h[0]
      d.dataset.handle = h[0]
      el.appendChild(d)
    })
  }

  var resizing = null
  function startResize(el, handle, e) {
    var n = nodeById[el.dataset.id]
    resizing = { node: n, handle: handle, startX: e.clientX, startY: e.clientY, ox: n.x, oy: n.y, ow: n.width, oh: n.height }
    pushUndo()
  }

  function doResize(e) {
    var r = resizing
    var dx = (e.clientX - r.startX) / scale
    var dy = (e.clientY - r.startY) / scale
    var h = r.handle
    var MIN = 40
    if (h.indexOf('w') >= 0) { r.node.x = Math.round(Math.min(r.ox + dx, r.ox + r.ow - MIN)); r.node.width = Math.round(Math.max(MIN, r.ow - dx)) }
    if (h.indexOf('e') >= 0) { r.node.width = Math.round(Math.max(MIN, r.ow + dx)) }
    if (h.indexOf('n') >= 0 && h !== 'ne' && h !== 'nw') { r.node.y = Math.round(Math.min(r.oy + dy, r.oy + r.oh - MIN)); r.node.height = Math.round(Math.max(MIN, r.oh - dy)) }
    if (h === 'ne' || h === 'nw') { r.node.y = Math.round(Math.min(r.oy + dy, r.oy + r.oh - MIN)); r.node.height = Math.round(Math.max(MIN, r.oh - dy)) }
    if (h.indexOf('s') >= 0) { r.node.height = Math.round(Math.max(MIN, r.oh + dy)) }
    var el = world.querySelector('.node[data-id="' + CSS.escape(r.node.id) + '"]')
    el.style.left = r.node.x + 'px'
    el.style.top = r.node.y + 'px'
    el.style.width = r.node.width + 'px'
    el.style.height = r.node.height + 'px'
    drawEdges()
  }

  // ---------- edge creation ----------

  var edgeDraft = null
  var tempEdgeSVG = ''

  function startEdge(nodeEl, side) {
    edgeDraft = { fromNode: nodeEl.dataset.id, fromSide: side }
    viewport.classList.add('linking')
  }

  function updateEdgeDraft(e) {
    var from = nodeById[edgeDraft.fromNode]
    var p1 = anchorPoint(from, edgeDraft.fromSide)
    var w = toWorld(e.clientX, e.clientY)
    tempEdgeSVG = '<path class="edge-temp" d="M ' + p1.x + ' ' + p1.y + ' L ' + w.x + ' ' + w.y + '"/>'
    drawEdges()
  }

  function finishEdge(e) {
    var el = e.target.closest && e.target.closest('.node')
    tempEdgeSVG = ''
    viewport.classList.remove('linking')
    if (el && el.dataset.id !== edgeDraft.fromNode) {
      var to = nodeById[el.dataset.id]
      var w = toWorld(e.clientX, e.clientY)
      pushUndo()
      canvas.edges.push({
        id: genId(),
        fromNode: edgeDraft.fromNode,
        fromSide: edgeDraft.fromSide,
        toNode: to.id,
        toSide: nearestSide(to, w.x, w.y),
        toEnd: 'arrow',
      })
      persist()
    }
    edgeDraft = null
    drawEdges()
  }

  // ---------- text / label editing ----------

  function editTextNode(el) {
    if (el.querySelector('textarea')) return
    console.log('canvasClient: editTextNode open for ' + el.dataset.id)
    var n = nodeById[el.dataset.id]
    var content = el.querySelector('.content')
    var ta = document.createElement('textarea')
    ta.value = n.text || ''
    if (content) content.style.display = 'none'
    el.appendChild(ta)
    setTimeout(function () { ta.focus() }, 0)
    var cancelled = false
    function commit() {
      if (cancelled) return
      if (ta.value !== (n.text || '')) {
        pushUndo()
        n.text = ta.value
        persist()
      }
      renderScene()
    }
    ta.addEventListener('blur', commit)
    ta.addEventListener('keydown', function (ev) {
      if ((ev.metaKey || ev.ctrlKey) && ev.key === 'Enter') ta.blur()
      if (ev.key === 'Escape') { cancelled = true; renderScene() }
      ev.stopPropagation()
    })
  }

  /** Edit the underlying value of a file node ('file' path) or link node ('url') */
  function editCardValue(el, prop) {
    var n = nodeById[el.dataset.id]
    prompt2(el, n[prop] || '', function (v) {
      if (v === (n[prop] || '')) return
      pushUndo()
      n[prop] = v
      renderScene()
      persist()
    }, true)
  }

  /**
   * Link cards edit in a multiline textarea (Enter = newline, like text cards).
   * If the committed value is a bare URL the node stays a 'link'; anything richer
   * (prose, several lines, code) converts the node to a 'text' card, where URLs
   * autolink — so nothing gets painted as one giant hyperlink.
   */
  function editLinkCard(el) {
    if (el.querySelector('textarea')) return
    var n = nodeById[el.dataset.id]
    var ta = document.createElement('textarea')
    ta.value = n.url || ''
    el.appendChild(ta)
    setTimeout(function () { ta.focus() }, 0)
    var cancelled = false
    function commit() {
      if (cancelled) return
      var v = ta.value.trim()
      if (v !== (n.url || '') && v !== '') {
        pushUndo()
        if (/^https?:\/\/\S+$/.test(v)) {
          n.url = v
        } else {
          n.type = 'text'
          n.text = ta.value
          delete n.url
        }
        persist()
      }
      renderScene()
    }
    ta.addEventListener('blur', commit)
    ta.addEventListener('keydown', function (ev) {
      if ((ev.metaKey || ev.ctrlKey) && ev.key === 'Enter') ta.blur()
      if (ev.key === 'Escape') { cancelled = true; renderScene() }
      ev.stopPropagation()
    })
  }

  /** Edit the CONTENT of the note behind a file card; saves into the NotePlan note itself */
  function editNoteContent(el) {
    var n = nodeById[el.dataset.id]
    var fc = fileContents[n.id]
    if (!fc) {
      var base = String(n.file || '').split('/').pop()
      fc = fileContents[n.id] = { found: false, title: base.replace(/\.[^.]+$/, '') }
    }
    if (el.querySelector('textarea')) return
    console.log('canvasClient: editNoteContent open for ' + n.id)
    var ta = document.createElement('textarea')
    ta.value = fc.content || ''
    el.appendChild(ta)
    setTimeout(function () { ta.focus() }, 0)
    var cancelled = false
    function commit() {
      if (cancelled) return
      if (ta.value !== (fc.content || '')) {
        fc.content = ta.value
        fc.found = true // first write creates the note plugin-side
        toPlugin('saveNote', { title: fc.title, content: ta.value })
      }
      renderScene()
    }
    ta.addEventListener('blur', commit)
    ta.addEventListener('keydown', function (ev) {
      if ((ev.metaKey || ev.ctrlKey) && ev.key === 'Enter') ta.blur()
      if (ev.key === 'Escape') { cancelled = true; renderScene() }
      ev.stopPropagation()
    })
  }

  function editGroupLabel(el) {
    var n = nodeById[el.dataset.id]
    prompt2(el, n.label || '', function (v) {
      pushUndo()
      n.label = v
      renderScene()
      persist()
    })
  }

  function editEdgeLabel(edgeId) {
    var e = null
    canvas.edges.forEach(function (x) { if (x.id === edgeId) e = x })
    if (!e) return
    var from = nodeById[e.fromNode], to = nodeById[e.toNode]
    if (!from || !to) return
    var p1 = anchorPoint(from, e.fromSide || autoSides(from, to)[0])
    var p2 = anchorPoint(to, e.toSide || autoSides(from, to)[1])
    var input = document.createElement('input')
    input.className = 'label-input'
    input.value = e.label || ''
    input.style.left = (p1.x + p2.x) / 2 - 80 + 'px'
    input.style.top = (p1.y + p2.y) / 2 - 14 + 'px'
    world.appendChild(input)
    setTimeout(function () { input.focus() }, 0)
    function commit() {
      pushUndo()
      if (input.value.trim() === '') delete e.label
      else e.label = input.value
      input.remove()
      renderScene()
      persist()
    }
    input.addEventListener('blur', commit)
    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') input.blur()
      if (ev.key === 'Escape') { input.removeEventListener('blur', commit); input.remove() }
      ev.stopPropagation()
    })
  }

  function prompt2(anchorEl, initial, onCommit, inset) {
    var input = document.createElement('input')
    input.className = inset ? 'card-input' : 'label-input'
    input.value = initial
    anchorEl.appendChild(input)
    setTimeout(function () { input.focus() }, 0)
    function commit() {
      onCommit(input.value)
      input.remove()
    }
    input.addEventListener('blur', commit)
    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') input.blur()
      if (ev.key === 'Escape') { input.removeEventListener('blur', commit); input.remove() }
      ev.stopPropagation()
    })
  }

  // ---------- node creation ----------

  function createTextNode(wx, wy) {
    pushUndo()
    var n = { id: genId(), type: 'text', text: '', x: Math.round(wx - 125), y: Math.round(wy - 30), width: 250, height: 60 }
    canvas.nodes.push(n)
    clearSelection()
    selectedNodes.add(n.id)
    renderScene()
    persist()
    var el = world.querySelector('.node[data-id="' + CSS.escape(n.id) + '"]')
    if (el) editTextNode(el)
  }

  // ---------- drag / pan / marquee state machine ----------

  var mode = null // 'pan' | 'drag' | 'marquee' | 'resize' | 'link'
  var dragNodes = [] // [{node, ox, oy}]
  var px = 0, py = 0, moved = false
  var marqueeEl = null, marqueeStart = null

  viewport.addEventListener('mousedown', function (e) {
    if (e.target.closest('textarea, input, #toolbar')) return
    // inline links inside text content keep native click behavior and never start a drag;
    // card-level links (file/link nodes) fall through so the card can be selected/dragged
    if (e.target.closest('.content a')) return
    px = e.clientX
    py = e.clientY
    moved = false

    // Double-click routing lives here (not in a 'dblclick' listener): e.detail counts
    // rapid clicks by time/position, so it survives any DOM rebuild in between.
    if (e.detail >= 2) {
      // Without this, mousedown's default focus handling lands AFTER we focus the
      // editor textarea, blurring it in the same frame — the editor dies instantly.
      e.preventDefault()
      var tEl = e.target.closest('.node.text')
      if (tEl) { editTextNode(tEl); return }
      var fEl = e.target.closest('.node.file')
      if (fEl) {
        if (e.target.closest('.file-head')) editCardValue(fEl, 'file')
        else editNoteContent(fEl)
        return
      }
      var lEl = e.target.closest('.node.link')
      if (lEl) { editLinkCard(lEl); return }
      var gEl = e.target.closest('.node.group')
      if (gEl) { editGroupLabel(gEl); return }
      var eEl = e.target.closest('.edge-hit, .edge-line, .edge-label')
      if (eEl) { editEdgeLabel(eEl.dataset.edgeId); return }
      if (!e.target.closest('.node')) {
        var wpt = toWorld(e.clientX, e.clientY)
        createTextNode(wpt.x, wpt.y)
        return
      }
      return
    }

    var handle = e.target.closest('.handle')
    if (handle) {
      mode = 'resize'
      startResize(handle.parentElement, handle.dataset.handle, e)
      e.preventDefault()
      return
    }
    var anchor = e.target.closest('.anchor')
    if (anchor) {
      mode = 'link'
      startEdge(anchor.parentElement, anchor.dataset.side)
      e.preventDefault()
      return
    }
    var nodeEl = e.target.closest('.node')
    if (nodeEl) {
      var n = nodeById[nodeEl.dataset.id]
      if (!e.shiftKey && !selectedNodes.has(n.id)) {
        clearSelection()
        selectedNodes.add(n.id)
      } else if (e.shiftKey) {
        if (selectedNodes.has(n.id)) selectedNodes.delete(n.id)
        else selectedNodes.add(n.id)
      }
      selectedEdges.clear()
      updateSelectionUI()
      mode = 'drag'
      dragNodes = []
      var members = new Set(selectedNodes)
      // dragging a group carries every node fully inside it
      canvas.nodes.forEach(function (g) {
        if (g.type === 'group' && selectedNodes.has(g.id)) {
          canvas.nodes.forEach(function (m) { if (nodeInsideGroup(m, g)) members.add(m.id) })
        }
      })
      canvas.nodes.forEach(function (m) {
        if (members.has(m.id)) dragNodes.push({ node: m, ox: m.x, oy: m.y })
      })
      return
    }
    // background
    var edgeHit = e.target.closest && e.target.closest('.edge-hit, .edge-line, .edge-label')
    if (edgeHit) {
      var id = edgeHit.dataset.edgeId
      if (!e.shiftKey) clearSelection()
      if (selectedEdges.has(id)) selectedEdges.delete(id)
      else selectedEdges.add(id)
      updateSelectionUI()
      return
    }
    if (e.shiftKey) {
      mode = 'marquee'
      marqueeStart = { x: e.clientX, y: e.clientY }
      marqueeEl = document.createElement('div')
      marqueeEl.id = 'marquee'
      viewport.appendChild(marqueeEl)
    } else {
      mode = 'pan'
      viewport.classList.add('panning')
    }
  })

  window.addEventListener('mousemove', function (e) {
    if (!mode) return
    var dx = e.clientX - px, dy = e.clientY - py
    if (Math.abs(e.clientX - px) + Math.abs(e.clientY - py) > 2) moved = true
    if (mode === 'pan') {
      tx += dx
      ty += dy
      px = e.clientX
      py = e.clientY
      apply()
    } else if (mode === 'drag') {
      if (!moved) return
      if (!dragUndoPushed) { pushUndo(); dragUndoPushed = true }
      dragNodes.forEach(function (d) {
        d.node.x = Math.round(d.ox + (e.clientX - pxStart) / scale)
        d.node.y = Math.round(d.oy + (e.clientY - pyStart) / scale)
        var el = world.querySelector('.node[data-id="' + CSS.escape(d.node.id) + '"]')
        if (el) { el.style.left = d.node.x + 'px'; el.style.top = d.node.y + 'px' }
      })
      drawEdges()
    } else if (mode === 'resize') {
      doResize(e)
    } else if (mode === 'link') {
      updateEdgeDraft(e)
    } else if (mode === 'marquee') {
      var x1 = Math.min(marqueeStart.x, e.clientX), y1 = Math.min(marqueeStart.y, e.clientY)
      var x2 = Math.max(marqueeStart.x, e.clientX), y2 = Math.max(marqueeStart.y, e.clientY)
      marqueeEl.style.left = x1 + 'px'
      marqueeEl.style.top = y1 + 'px'
      marqueeEl.style.width = x2 - x1 + 'px'
      marqueeEl.style.height = y2 - y1 + 'px'
    }
  })

  // pointer position at drag start (used for cumulative node drags)
  var pxStart = 0, pyStart = 0, dragUndoPushed = false
  viewport.addEventListener('mousedown', function (e) {
    pxStart = e.clientX
    pyStart = e.clientY
  }, true)

  window.addEventListener('mouseup', function (e) {
    if (mode === 'drag' && moved) persist()
    if (mode === 'link' && edgeDraft) finishEdge(e)
    if (mode === 'marquee') {
      var r = marqueeEl.getBoundingClientRect()
      var w1 = toWorld(r.left, r.top), w2 = toWorld(r.right, r.bottom)
      canvas.nodes.forEach(function (n) {
        if (n.x < w2.x && n.x + n.width > w1.x && n.y < w2.y && n.y + n.height > w1.y) selectedNodes.add(n.id)
      })
      marqueeEl.remove()
      marqueeEl = null
      updateSelectionUI()
    }
    if (mode === 'pan' && !moved && !e.target.closest('.node, a, #toolbar, .edge-hit, .edge-line')) {
      clearSelection()
      updateSelectionUI()
    }
    dragUndoPushed = false
    viewport.classList.remove('panning')
    mode = null
  })

  // ---------- clicks: note links & toolbar ----------

  document.addEventListener('click', function (e) {
    var link = e.target.closest('a')
    if (link && link.closest('.node')) {
      var noteTitle = link.dataset.noteTitle
      var isInline = !!link.closest('.content')
      if (isInline) {
        // wikilinks / md-links inside a text card: plain click follows them
        if (noteTitle) { e.preventDefault(); toPlugin('openNote', { title: noteTitle }) }
        return
      }
      // card-level link (file/link node): plain click only selects; ⌘+click opens
      if (moved || (!e.metaKey && !e.ctrlKey)) { e.preventDefault(); return }
      if (noteTitle) { e.preventDefault(); toPlugin('openNote', { title: noteTitle }) }
      return // external URL cards keep the default ⌘+click open (target=_blank)
    }
    var openBtn = e.target.closest('.open-btn')
    if (openBtn && !moved) {
      toPlugin('openNote', { title: openBtn.closest('.node').dataset.noteTitle })
      return
    }
    var fileCard = e.target.closest('.node.file')
    if (fileCard && (e.metaKey || e.ctrlKey) && !moved) {
      toPlugin('openNote', { title: fileCard.dataset.noteTitle })
      return
    }
    var swatch = e.target.closest('#toolbar .swatch')
    if (swatch) { applyColor(swatch.dataset.color || null); return }
    if (e.target.closest('#toolbar .tb-delete')) deleteSelection()
  })

  // ---------- keyboard ----------

  window.addEventListener('keydown', function (e) {
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return
    var meta = e.metaKey || e.ctrlKey
    if (meta && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return }
    if (meta && (e.key === 'Z' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return }
    if (meta && e.key === 'd') { e.preventDefault(); duplicateSelection(); return }
    if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); deleteSelection(); return }
    if (e.key === 'Escape') { clearSelection(); updateSelectionUI(); return }
    if (/^[1-6]$/.test(e.key)) { applyColor(e.key); return }
    if (e.key === '0') applyColor(null)
  })

  window.addEventListener('resize', fit)

  // ---------- boot ----------
  console.log('canvasClient v0.4.4 booted: ' + canvas.nodes.length + ' nodes, ' + canvas.edges.length + ' edges')
  renderScene()
  fit()
})()
