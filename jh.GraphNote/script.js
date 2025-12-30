// @ts-nocheck
/* global DataStore, HTMLView, NotePlan */

const PLUGIN_ID = 'jh.GraphNote'
const WINDOW_CUSTOM_ID = 'graphnote'
const CACHE_FILE = 'graphnote-index.json'

let _usedCustomId = false

// -----------------------------
// NotePlan-safe sleep (NO Promise constructor usage)
// -----------------------------
async function npSleep(ms) {
  try {
    if (typeof NotePlan !== 'undefined' && typeof NotePlan.sleep === 'function') {
      await NotePlan.sleep(ms)
      return
    }
  } catch (_) {}

  try {
    if (typeof DataStore !== 'undefined' && typeof DataStore.sleep === 'function') {
      await DataStore.sleep(ms)
      return
    }
  } catch (_) {}

  // Final fallback (busy wait)
  const end = Date.now() + ms
  while (Date.now() < end) {}
}

// -----------------------------
// Public commands
// -----------------------------
async function graphnote() {
  try {
    await openGraphWindow()

    let graph = await loadCache()
    if (!isValidGraph(graph)) {
      graph = await buildGraphIndex()
      await saveCache(graph)
    }

    console.log('GraphNote: window opened, waiting for setGraphData...')
    await waitForWindowFunction('setGraphData', 12000)
    await pushGraphToWindow(graph)
    console.log('GraphNote: graph pushed to window')
  } catch (e) {
    console.log(`GraphNote error: ${stringifyError(e)}`)
    try {
      await waitForWindowFunction('setGraphError', 3000)
      await pushErrorToWindow(e)
    } catch (_) {}
  }
}

async function rebuildGraphIndex() {
  try {
    await openGraphWindow()
    const graph = await buildGraphIndex()
    await saveCache(graph)

    console.log('GraphNote: rebuild - waiting for setGraphData...')
    await waitForWindowFunction('setGraphData', 12000)
    await pushGraphToWindow(graph)
    console.log('GraphNote: rebuild - graph pushed')
  } catch (e) {
    console.log(`GraphNote rebuild error: ${stringifyError(e)}`)
    try {
      await waitForWindowFunction('setGraphError', 3000)
      await pushErrorToWindow(e)
    } catch (_) {}
  }
}

// -----------------------------
// Window + Injection
// -----------------------------
async function openGraphWindow() {
  const html = buildHTMLShell()
  _usedCustomId = false

  if (typeof HTMLView.showWindowWithOptions === 'function') {
    await HTMLView.showWindowWithOptions(html, 'GraphNote', {
      width: 1200,
      height: 750,
      customId: WINDOW_CUSTOM_ID,
      shouldFocus: true,
    })
    _usedCustomId = true
    return
  }

  await HTMLView.showWindow(html, 'GraphNote', 1200, 750)
}

async function runJSInWindow(code) {
  if (_usedCustomId) return await HTMLView.runJavaScript(code, WINDOW_CUSTOM_ID)
  return await HTMLView.runJavaScript(code)
}

async function waitForWindowFunction(fnName, timeoutMs) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await runJSInWindow(
        `(function(){ return (typeof window.${fnName} === 'function') ? 'yes' : 'no'; })();`
      )
      if (String(res).trim() === 'yes') return true
    } catch (_) {}
    await npSleep(150)
  }
  throw new Error(`Timed out waiting for window.${fnName} to be ready`)
}

async function pushGraphToWindow(graph) {
  const safe = JSON.stringify(graph).replace(/</g, '\\u003c')
  const code = `
    (function(){
      try {
        if (window && typeof window.setGraphData === 'function') {
          window.setGraphData(${safe});
          return 'ok';
        }
        return 'setGraphData missing';
      } catch (e) {
        return 'error:' + (e && e.message ? e.message : String(e));
      }
    })();
  `
  const res = await runJSInWindow(code)
  const s = String(res)
  if (s.includes('missing') || s.startsWith('error:')) {
    throw new Error('Graph injection failed: ' + s)
  }
}

// NO backtick templating inside injected code (prevents VS Code/template literal breakage)
async function pushErrorToWindow(err) {
  const msg = stringifyError(err)
  const code = `
    (function(){
      try {
        if (window && typeof window.setGraphError === 'function') {
          window.setGraphError(${JSON.stringify(msg)});
          return 'ok';
        }
        return 'setGraphError missing';
      } catch (e) {
        return 'error:' + (e && e.message ? e.message : String(e));
      }
    })();
  `
  await runJSInWindow(code)
}

// -----------------------------
// HTML Shell (loads local d3.v7.min.js)
// -----------------------------
function buildHTMLShell() {
  const rebuildURL =
    'noteplan://x-callback-url/runPlugin?pluginID=' +
    encodeURIComponent(PLUGIN_ID) +
    '&command=' +
    encodeURIComponent('graphnote-rebuild')

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>GraphNote</title>
  <style>
    :root{
      --bg:#ffffff;
      --panel:#f4f5f7;
      --panel2:#f7f8fa;
      --text:#111827;
      --muted:#6b7280;
      --border:#e5e7eb;
      --btn:#111827;
      --btnText:#ffffff;
      --on:#22c55e;
      --off:#9ca3af;

      --note:#fbbf24;
      --tag:#22c55e;
      --mention:#5EEAD4;
      --external:#EC4899;
    }
    html,body{height:100%;margin:0;background:var(--bg);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial;}
    .app{height:100%;display:flex;flex-direction:column;}
    .topbar{display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid var(--border);background:#fff;}
    .search{flex:1;max-width:320px;background:#f3f4f6;border:1px solid var(--border);border-radius:999px;padding:6px 10px;outline:none;font-size:13px;color:var(--text);}
    .select{max-width:260px;background:#f3f4f6;border:1px solid var(--border);border-radius:999px;padding:6px 10px;outline:none;font-size:13px;color:var(--text);}
    .toggles{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}
    .control{appearance:none;border:1px solid var(--border);background:#fff;color:var(--text);border-radius:999px;padding:4px 10px;font-weight:600;color:var(--text);cursor:pointer;user-select:none;font-size:12px;line-height:1.2;white-space:nowrap;}
    .control:hover{background:var(--panel2);}
    .control.on{background:#111827;color:#fff;border-color:#111827;}
    .control.off{background:#fff;color:var(--muted);}
    .main{flex:1;display:flex;min-height:0;}
    #vizWrap{flex:1;position:relative;min-width:0;}
    #viz{position:absolute;inset:0;}
    .side{width:340px;border-left:1px solid var(--border);background:var(--panel);padding:16px;overflow:auto;}
    .title{font-size:26px;font-weight:800;color:var(--text);margin:4px 0 8px 0;}
    .kv{color:var(--muted);font-size:14px;margin-bottom:8px;}
    .sectionTitle{margin-top:18px;font-weight:800;color:var(--text);}
    .list{margin-top:8px;display:flex;flex-direction:column;gap:6px;}
    .linkItem{display:block;padding:10px 12px;border-radius:12px;background:var(--panel2);border:1px solid var(--border);color:var(--text);text-decoration:none;font-weight:600;font-size:14px;}
    .errorBox{margin-top:10px;padding:10px 12px;border-radius:12px;border:1px solid #fecaca;background:#fff1f2;color:#991b1b;font-weight:700;white-space:pre-wrap;}
    .loadingOverlay{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:#fff;border:1px solid var(--border);border-radius:16px;padding:18px 18px;box-shadow:0 10px 25px rgba(0,0,0,0.10);display:flex;gap:12px;align-items:center;min-width:320px;z-index:10;}
    .spinner{width:26px;height:26px;border-radius:999px;border:3px solid #e5e7eb;border-top-color:#6b7280;animation:spin 0.9s linear infinite;}
    @keyframes spin{to{transform:rotate(360deg)}}
    svg{width:100%;height:100%;}
    .node circle{stroke:#111827;stroke-width:0.5px;}
    .node text{font-size:10px;fill:#111827;pointer-events:none;}
    .link{stroke:#d1d5db;stroke-width:1.0px;fill:none;}
    .linkArrow{stroke:#d1d5db;fill:#d1d5db;}
    .selected circle{stroke:#111827;stroke-width:3px;}

    .crumbs{position:absolute;left:14px;top:14px;display:flex;gap:6px;flex-wrap:wrap;z-index:9;pointer-events:none;}
    .crumb{background:rgba(255,255,255,0.95);border:1px solid var(--border);border-radius:12px;padding:6px 10px;font-weight:800;font-size:12px;color:var(--text);box-shadow:0 6px 16px rgba(0,0,0,0.08);}
    .hint{position:absolute;left:14px;bottom:14px;background:rgba(255,255,255,0.92);border:1px solid var(--border);border-radius:12px;padding:6px 10px;font-weight:800;font-size:12px;color:var(--muted);box-shadow:0 6px 16px rgba(0,0,0,0.08);z-index:9;pointer-events:none;}
    .tooltip{position:absolute;pointer-events:none;background:rgba(17,24,39,0.92);color:#fff;padding:8px 10px;border-radius:10px;font-size:12px;max-width:380px;line-height:1.3;z-index:11;display:none;}
  </style>
</head>
<body>
<div class="app">
  <div class="topbar">
    <input id="filterInput" class="search" placeholder="Filter nodes..." />

    <select id="vizSelect" class="select" title="Visualisation">
      <option value="disjoint">Disjoint force-directed graph</option>
      <option value="forceTree">Force-directed tree</option>
      <option value="radialCluster">Radial cluster</option>
      <option value="tangled">Tangled tree</option>
      <option value="icicle">Icicle</option>
      <option value="treemap">Cascaded treemap</option>
      <option value="sunburst">Sequences sunburst</option>
    </select>

    <select id="labelDensity" class="select" title="Label density" style="max-width:160px">
      <option value="low">Labels: Low</option>
      <option value="med" selected>Labels: Medium</option>
      <option value="high">Labels: High</option>
    </select>

    <div class="toggles">
      <button id="toggleTags" class="control on">Tags</button>
      <button id="toggleMentions" class="control on">Mentions</button>
      <button id="toggleExternal" class="control on">External</button>
      <button id="toggleLabels" class="control on">Labels</button>

      <button id="toggleCalendars" class="control on" title="Include Calendar notes">Calendars</button>

      <button id="btnFit" class="control">Fit</button>
      <button id="btnRelayout" class="control">Relayout</button>
      <button id="btnRebuild" class="control">Rebuild</button>
      <button id="btnClear" class="control">Clear</button>
      <button id="btnReset" class="control">Reset</button>
    </div>
  </div>

  <div class="main">
    <div id="vizWrap">
      <div id="viz"></div>
      <div id="crumbs" class="crumbs" style="display:none;"></div>
      <div id="hint" class="hint" style="display:none;">Hover slices to see path</div>
      <div id="tooltip" class="tooltip"></div>

      <div id="loading" class="loadingOverlay">
        <div class="spinner"></div>
        <div>
          <div style="font-weight:800;font-size:16px;color:var(--text)">Loading graph...</div>
          <div style="font-size:13px;color:var(--muted);margin-top:2px">Indexing notes and building relationships</div>
        </div>
      </div>
    </div>

    <div class="side">
      <div class="title" id="selTitle">Nothing selected</div>
      <div class="kv" id="selMeta">ID -</div>
      <div class="kv" id="selCounts">Out 0 - In 0</div>

      <div class="sectionTitle">Outgoing</div>
      <div class="list" id="outList"></div>

      <div class="sectionTitle">Incoming</div>
      <div class="list" id="inList"></div>

      <div id="err" class="errorBox" style="display:none;"></div>
    </div>
  </div>
</div>

<script src="d3.v7.min.js"></script>
<script>
  const elErr = document.getElementById('err');
  const elLoading = document.getElementById('loading');
  const elViz = document.getElementById('viz');
  const elCrumbs = document.getElementById('crumbs');
  const elHint = document.getElementById('hint');
  const elTooltip = document.getElementById('tooltip');

  function setError(msg){ elErr.style.display='block'; elErr.textContent = msg || 'Unknown error'; }
  function clearError(){ elErr.style.display='none'; elErr.textContent=''; }
  function setLoading(on){ elLoading.style.display = on ? 'flex' : 'none'; }
  function setCrumbs(items){
    if(!items || items.length === 0){
      elCrumbs.style.display = 'none';
      elCrumbs.innerHTML = '';
      return;
    }
    elCrumbs.style.display = 'flex';
    elCrumbs.innerHTML = '';
    items.forEach(t => {
      const d = document.createElement('div');
      d.className = 'crumb';
      d.textContent = t;
      elCrumbs.appendChild(d);
    });
  }
  function setHint(on){ elHint.style.display = on ? 'block' : 'none'; }
  function showTooltip(x,y,html){
    elTooltip.style.display = 'block';
    elTooltip.style.left = (x + 12) + 'px';
    elTooltip.style.top = (y + 12) + 'px';
    elTooltip.textContent = html;
  }
  function hideTooltip(){ elTooltip.style.display = 'none'; elTooltip.textContent=''; }

  if (typeof d3 === 'undefined') {
    setLoading(false);
    setError("D3 failed to load. Ensure d3.v7.min.js is present (UMD build from d3js.org) in the plugin folder.");
  }

  let showTags = true, showMentions = true, showExternal = true;
  let showLabels = true;
  let showCalendars = true;
  let labelDensity = 'med';

  let graphData = null;
  let filtered = { nodes: [], edges: [] };

  // D3 state
  let svg = null;
  let gRoot = null;
  let zoom = null;
  let simulation = null;

  // fast lookup
  let nodeById = new Map();
  let outMap = new Map();
  let inMap  = new Map();

  let selectedId = null;

  window.setGraphError = function(msg){
    setLoading(false);
    setError(msg);
  };

  function rootCssVar(name, fallback){
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  function nodeColor(type){
    if(type === 'note') return rootCssVar('--note', '#fbbf24');
    if(type === 'tag') return rootCssVar('--tag', '#22c55e');
    if(type === 'mention') return rootCssVar('--mention', '#5EEAD4');
    if(type === 'external') return rootCssVar('--external', '#EC4899');
    return '#9ca3af';
  }

  function openNote(filename){
    if(!filename) return;
    window.location.href = 'noteplan://x-callback-url/openNote?filename=' + encodeURIComponent(filename);
  }

  function resetD3Canvas(){
    setCrumbs(null);
    setHint(false);
    hideTooltip();

    if(typeof d3 === 'undefined') return;

    if(simulation){
      try { simulation.stop(); } catch(e){}
      simulation = null;
    }
    elViz.innerHTML = '';
    svg = d3.select(elViz).append('svg');
    gRoot = svg.append('g');

    zoom = d3.zoom()
      .scaleExtent([0.05, 8])
      .on('zoom', (event) => gRoot.attr('transform', event.transform));

    svg.call(zoom);

    const defs = svg.append('defs');
    defs.append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 14)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('class', 'linkArrow');
  }

  function resetView(){
    if(!svg) return;
    svg.transition().duration(200).call(zoom.transform, d3.zoomIdentity);
  }

  function fitView(padding){
    if(!svg || !gRoot) return;
    const p = (typeof padding === 'number') ? padding : 30;

    let bounds;
    try { bounds = gRoot.node().getBBox(); } catch(e){ bounds = null; }
    const width = elViz.clientWidth || 800;
    const height = elViz.clientHeight || 600;

    if(!bounds || bounds.width <= 0 || bounds.height <= 0){
      svg.transition().duration(200).call(zoom.transform, d3.zoomIdentity);
      return;
    }

    const scale = Math.min((width - p*2) / bounds.width, (height - p*2) / bounds.height);
    const tx = (width / 2) - scale * (bounds.x + bounds.width / 2);
    const ty = (height / 2) - scale * (bounds.y + bounds.height / 2);

    svg.transition().duration(250).call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
  }

  function setPill(id, on){
    const b = document.getElementById(id);
    b.classList.remove('on'); b.classList.remove('off');
    b.classList.add(on ? 'on' : 'off');
  }

  function updateToggleUI(){
    setPill('toggleTags', showTags);
    setPill('toggleMentions', showMentions);
    setPill('toggleExternal', showExternal);
    setPill('toggleLabels', showLabels);
    setPill('toggleCalendars', showCalendars);
  }

  function labelRules(){
    // Tuned for your screenshots: low/med/high behave noticeably differently
    if(labelDensity === 'high') return { arcPx: 14, rectW: 40, rectH: 14, radialEvery: 10, forceMax: 99999 };
    if(labelDensity === 'low')  return { arcPx: 40, rectW: 140, rectH: 18, radialEvery: 55, forceMax: 500 };
    return { arcPx: 24, rectW: 80, rectH: 16, radialEvery: 25, forceMax: 2500 };
  }

  function buildAdjacency(nodes, edges){
    nodeById = new Map();
    outMap = new Map();
    inMap = new Map();

    nodes.forEach(n => nodeById.set(n.id, n));
    edges.forEach(e => {
      if(!outMap.has(e.source)) outMap.set(e.source, []);
      if(!inMap.has(e.target)) inMap.set(e.target, []);
      outMap.get(e.source).push(e.target);
      inMap.get(e.target).push(e.source);
    });
  }

  function makeNodeLink(text, nodeId){
    const a = document.createElement('a');
    a.className = 'linkItem';
    a.href = '#';
    a.textContent = text;
    a.onclick = (e) => { e.preventDefault(); selectNode(nodeId); };
    return a;
  }

  function showSelection(nodeId){
    const selTitle = document.getElementById('selTitle');
    const selMeta = document.getElementById('selMeta');
    const selCounts = document.getElementById('selCounts');
    const outList = document.getElementById('outList');
    const inList = document.getElementById('inList');

    outList.innerHTML = '';
    inList.innerHTML = '';

    if(!nodeId){
      selTitle.textContent = 'Nothing selected';
      selMeta.textContent = 'ID -';
      selCounts.textContent = 'Out 0 - In 0';
      return;
    }

    const n = nodeById.get(nodeId);
    const label = (n && n.label) ? n.label : nodeId;

    selTitle.textContent = label;
    selMeta.textContent = 'ID ' + nodeId;

    const out = outMap.get(nodeId) || [];
    const inn = inMap.get(nodeId) || [];
    selCounts.textContent = 'Out ' + out.length + ' - In ' + inn.length;

    // "Open note" shortcut
    if(n && n.type === 'note' && n.filename){
      const open = document.createElement('a');
      open.className = 'linkItem';
      open.style.fontWeight = '800';
      open.textContent = 'Open note';
      open.href = 'noteplan://x-callback-url/openNote?filename=' + encodeURIComponent(n.filename);
      outList.appendChild(open);
    }

    out.forEach(tid => {
      const tn = nodeById.get(tid);
      outList.appendChild(makeNodeLink((tn && tn.label) ? tn.label : tid, tid));
    });
    inn.forEach(sid => {
      const sn = nodeById.get(sid);
      inList.appendChild(makeNodeLink((sn && sn.label) ? sn.label : sid, sid));
    });
  }

  function selectNode(nodeId){
    selectedId = nodeId;
    showSelection(nodeId);

    if(!gRoot) return;
    gRoot.selectAll('.node').classed('selected', d => {
      if(d && d.id) return d.id === nodeId;
      if(d && d.data && d.data.id) return d.data.id === nodeId;
      return false;
    });
  }

  function applyFilters(){
    if(!graphData || typeof d3 === 'undefined') return;

    const q = String(document.getElementById('filterInput').value || '').trim().toLowerCase();

    const nodes = (graphData.nodes || []).filter(n => {
      if(n.type === 'tag' && !showTags) return false;
      if(n.type === 'mention' && !showMentions) return false;
      if(n.type === 'external' && !showExternal) return false;

      // Optionally ignore Calendar notes (best-effort heuristic)
      if(!showCalendars && n.type === 'note' && n.filename && String(n.filename).startsWith('Calendar/')) return false;

      if(q){
        const hay = (String(n.label || '') + ' ' + String(n.id || '')).toLowerCase();
        if(!hay.includes(q)) return false;
      }
      return true;
    });

    const allowed = new Set(nodes.map(n => n.id));
    const edges = (graphData.edges || []).filter(e => allowed.has(e.source) && allowed.has(e.target));

    filtered = { nodes, edges };
    buildAdjacency(nodes, edges);

    if(selectedId && !allowed.has(selectedId)){
      selectedId = null;
      showSelection(null);
    }

    renderCurrentViz();
  }

  // -----------------------------
  // Hierarchy helpers for icicle/treemap/sunburst/radial/forceTree
  // -----------------------------
  function buildUndirectedAdjacency(nodes, edges){
    const adj = new Map();
    nodes.forEach(n => adj.set(n.id, []));
    edges.forEach(e => {
      if(!adj.has(e.source)) adj.set(e.source, []);
      if(!adj.has(e.target)) adj.set(e.target, []);
      adj.get(e.source).push(e.target);
      adj.get(e.target).push(e.source);
    });
    return adj;
  }

  function computeComponents(nodes, edges){
    const adj = buildUndirectedAdjacency(nodes, edges);
    const seen = new Set();
    const comps = [];

    for(const n of nodes){
      if(seen.has(n.id)) continue;
      const q = [n.id];
      seen.add(n.id);
      const comp = [];
      while(q.length){
        const cur = q.shift();
        comp.push(cur);
        const nbrs = adj.get(cur) || [];
        for(const nb of nbrs){
          if(!seen.has(nb)){
            seen.add(nb);
            q.push(nb);
          }
        }
      }
      comps.push(comp);
    }
    return comps;
  }

  function pickComponentRoot(componentIds){
    // Prefer a note with highest degree
    let best = null;
    let bestScore = -1;
    for(const id of componentIds){
      const n = nodeById.get(id);
      if(!n) continue;
      const out = (outMap.get(id) || []).length;
      const inn = (inMap.get(id) || []).length;
      const deg = out + inn;
      const typeBonus = (n.type === 'note') ? 100000 : 0;
      const score = typeBonus + deg;
      if(score > bestScore){
        bestScore = score;
        best = id;
      }
    }
    return best || componentIds[0];
  }

  function makeTreeNode(id){
    const n = nodeById.get(id) || { id:id, label:id, type:'note', filename:'' };
    return { id: n.id, label: n.label || n.id, type: n.type || 'note', filename: n.filename || '', children: [] };
  }

  function buildSpanningTreeFromRoot(rootId, allowedSet){
    // BFS spanning tree across component (ensures every node appears exactly once)
    const undAdj = new Map();
    for(const id of allowedSet) undAdj.set(id, []);
    for(const e of filtered.edges){
      if(allowedSet.has(e.source) && allowedSet.has(e.target)){
        undAdj.get(e.source).push(e.target);
        undAdj.get(e.target).push(e.source);
      }
    }

    const seen = new Set([rootId]);
    const q = [rootId];

    const root = makeTreeNode(rootId);
    const treeNodeById = new Map([[rootId, root]]);

    while(q.length){
      const cur = q.shift();
      const parent = treeNodeById.get(cur);
      const nbrs = undAdj.get(cur) || [];
      for(const nb of nbrs){
        if(!allowedSet.has(nb) || seen.has(nb)) continue;
        seen.add(nb);
        q.push(nb);
        const child = makeTreeNode(nb);
        treeNodeById.set(nb, child);
        parent.children.push(child);
      }
    }
    return root;
  }

  function buildForestHierarchy(){
    const nodes = filtered.nodes || [];
    const edges = filtered.edges || [];
    if(nodes.length === 0) return { id:'__root__', label:'(empty)', type:'note', filename:'', children:[] };

    const comps = computeComponents(nodes, edges);
    const forestRoot = { id:'__root__', label:'All Notes', type:'note', filename:'', children:[] };

    for(const compIds of comps){
      const compSet = new Set(compIds);
      const rootId = pickComponentRoot(compIds);
      const tree = buildSpanningTreeFromRoot(rootId, compSet);
      forestRoot.children.push(tree);
    }
    return forestRoot;
  }

  function hierarchyWithValues(){
    const rootData = buildForestHierarchy();
    const root = d3.hierarchy(rootData);
    root.sum(d => (d && d.type === 'note') ? 5 : 1);
    root.sort((a,b) => (b.value||0) - (a.value||0));
    return root;
  }

  // -----------------------------
  // Renderers
  // -----------------------------
  function renderDisjointForce(){
    setHint(false);
    resetD3Canvas();

    const rules = labelRules();

    const nodes = filtered.nodes.slice(0, rules.forceMax).map(n => Object.assign({}, n));
    const idSet = new Set(nodes.map(n => n.id));
    const links = filtered.edges.filter(e => idSet.has(e.source) && idSet.has(e.target))
      .map(e => ({ source: e.source, target: e.target }));

    const w = elViz.clientWidth || 900;
    const h = elViz.clientHeight || 650;

    const nodeLocal = new Map(nodes.map(n => [n.id, n]));

    const link = gRoot.append('g')
      .selectAll('path')
      .data(links)
      .join('path')
      .attr('class', 'link')
      .attr('marker-end', 'url(#arrow)');

    const node = gRoot.append('g')
      .selectAll('g')
      .data(nodes, d => d.id)
      .join('g')
      .attr('class', 'node')
      .on('click', (event, d) => { event.stopPropagation(); selectNode(d.id); })
      .on('dblclick', (event, d) => { event.stopPropagation(); if(d.type === 'note' && d.filename) openNote(d.filename); })
      .call(d3.drag()
        .on('start', (event, d) => { if(!event.active) simulation.alphaTarget(0.2).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
        .on('end', (event, d) => { if(!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; })
      );

    node.append('circle')
      .attr('r', d => (d.type === 'note' ? 10 : 7))
      .attr('fill', d => nodeColor(d.type));

    node.append('text')
      .attr('x', 12)
      .attr('y', 3)
      .style('display', showLabels ? null : 'none')
      .text(d => (d.label || d.id));

    simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(55).strength(0.6))
      .force('charge', d3.forceManyBody().strength(-120))
      .force('x', d3.forceX(w/2).strength(0.06))
      .force('y', d3.forceY(h/2).strength(0.06))
      .force('collide', d3.forceCollide().radius(d => (d.type === 'note' ? 14 : 11)))
      .on('tick', () => {
        link.attr('d', d => {
          const s = (typeof d.source === 'object') ? d.source : nodeLocal.get(d.source);
          const t = (typeof d.target === 'object') ? d.target : nodeLocal.get(d.target);
          if(!s || !t) return '';
          return 'M' + s.x + ',' + s.y + ' L' + t.x + ',' + t.y;
        });
        node.attr('transform', d => 'translate(' + d.x + ',' + d.y + ')');
      });

    svg.on('click', () => {
      selectedId = null;
      showSelection(null);
      gRoot.selectAll('.node').classed('selected', false);
    });

    fitView(40);
  }

  function renderForceDirectedTree(){
    setHint(false);
    resetD3Canvas();

    const root = hierarchyWithValues();
    const nodes = root.descendants();
    const links = root.links();

    const w = elViz.clientWidth || 900;
    const h = elViz.clientHeight || 650;

    // Map hierarchy nodes to flat nodes for simulation
    const simNodes = nodes.map(d => ({
      id: d.data.id,
      label: d.data.label,
      type: d.data.type,
      filename: d.data.filename,
      _h: d
    }));

    const nodeLocal = new Map(simNodes.map(n => [n.id, n]));
    const simLinks = links.map(l => ({ source: l.source.data.id, target: l.target.data.id }));

    const link = gRoot.append('g')
      .selectAll('path')
      .data(simLinks)
      .join('path')
      .attr('class','link')
      .attr('marker-end','url(#arrow)');

    const node = gRoot.append('g')
      .selectAll('g')
      .data(simNodes, d => d.id)
      .join('g')
      .attr('class','node')
      .on('click', (event, d) => { event.stopPropagation(); selectNode(d.id); })
      .on('dblclick', (event, d) => { event.stopPropagation(); if(d.type === 'note' && d.filename) openNote(d.filename); })
      .call(d3.drag()
        .on('start', (event, d) => { if(!event.active) simulation.alphaTarget(0.2).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
        .on('end', (event, d) => { if(!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; })
      );

    node.append('circle')
      .attr('r', d => (d.type === 'note' ? 10 : 7))
      .attr('fill', d => nodeColor(d.type));

    node.append('text')
      .attr('x', 12)
      .attr('y', 3)
      .style('display', showLabels ? null : 'none')
      .text(d => d.label || d.id);

    simulation = d3.forceSimulation(simNodes)
      .force('link', d3.forceLink(simLinks).id(d => d.id).distance(45).strength(0.9))
      .force('charge', d3.forceManyBody().strength(-110))
      .force('center', d3.forceCenter(w/2, h/2))
      .force('collide', d3.forceCollide().radius(d => (d.type === 'note' ? 14 : 11)))
      .on('tick', () => {
        link.attr('d', d => {
          const s = (typeof d.source === 'object') ? d.source : nodeLocal.get(d.source);
          const t = (typeof d.target === 'object') ? d.target : nodeLocal.get(d.target);
          if(!s || !t) return '';
          return 'M' + s.x + ',' + s.y + ' L' + t.x + ',' + t.y;
        });
        node.attr('transform', d => 'translate(' + d.x + ',' + d.y + ')');
      });

    fitView(40);
  }

  function renderRadialCluster(){
    setHint(false);
    resetD3Canvas();

    const rules = labelRules();
    const root = hierarchyWithValues();
    const w = elViz.clientWidth || 900;
    const h = elViz.clientHeight || 650;
    const radius = Math.min(w, h) * 0.42;

    const cluster = d3.cluster().size([2 * Math.PI, radius]);
    cluster(root);

    // Links
    const link = gRoot.append('g')
      .selectAll('path')
      .data(root.links())
      .join('path')
      .attr('class','link')
      .attr('d', d3.linkRadial()
        .angle(d => d.x)
        .radius(d => d.y)
      );

    // Nodes
    const node = gRoot.append('g')
      .selectAll('g')
      .data(root.descendants())
      .join('g')
      .attr('class','node')
      .attr('transform', d => {
        const a = d.x - Math.PI / 2;
        const r = d.y;
        return 'translate(' + (Math.cos(a)*r) + ',' + (Math.sin(a)*r) + ')';
      })
      .on('click', (event, d) => { event.stopPropagation(); selectNode(d.data.id); })
      .on('dblclick', (event, d) => { event.stopPropagation(); if(d.data.type === 'note' && d.data.filename) openNote(d.data.filename); });

    node.append('circle')
      .attr('r', d => (d.data.type === 'note' ? 6 : 4))
      .attr('fill', d => nodeColor(d.data.type));

    // Labels: only show every N leaves to avoid “black donut”
    const leaves = root.leaves();
    const leafIndex = new Map();
    leaves.forEach((d,i) => leafIndex.set(d, i));

    node.append('text')
      .style('display', showLabels ? null : 'none')
      .attr('dy','0.31em')
      .attr('x', d => d.x < Math.PI ? 8 : -8)
      .attr('text-anchor', d => d.x < Math.PI ? 'start' : 'end')
      .attr('transform', d => d.x >= Math.PI ? 'rotate(180)' : null)
      .text(d => {
        if(!d.parent) return '';
        if(d.children && d.children.length) return ''; // internal nodes hidden
        const idx = leafIndex.get(d) || 0;
        if(labelDensity === 'high') return d.data.label || d.data.id;
        if(labelDensity === 'med')  return (idx % rules.radialEvery === 0) ? (d.data.label || d.data.id) : '';
        return (idx % rules.radialEvery === 0) ? (d.data.label || d.data.id) : '';
      });

    // Center
    gRoot.attr('transform', 'translate(' + (w/2) + ',' + (h/2) + ')');

    fitView(30);
  }

  // Tangled tree (simple layered DAG layout)
  function renderTangledTree(){
    setHint(false);
    resetD3Canvas();

    const w = elViz.clientWidth || 900;
    const h = elViz.clientHeight || 650;

    const nodes = filtered.nodes.map(n => Object.assign({}, n));
    const links = filtered.edges.map(e => ({ source: e.source, target: e.target }));

    const byId = new Map(nodes.map(n => [n.id, n]));
    const indeg = new Map(nodes.map(n => [n.id, 0]));
    links.forEach(l => { indeg.set(l.target, (indeg.get(l.target)||0) + 1); });

    // Kahn-style layering (best-effort)
    const layer = new Map();
    const q = [];
    nodes.forEach(n => { if((indeg.get(n.id)||0) === 0) q.push(n.id); });
    // if no sources, seed with a few notes
    if(q.length === 0) nodes.slice(0, Math.min(10, nodes.length)).forEach(n => q.push(n.id));

    q.forEach(id => layer.set(id, 0));

    const outAdj = new Map();
    nodes.forEach(n => outAdj.set(n.id, []));
    links.forEach(l => { if(outAdj.has(l.source)) outAdj.get(l.source).push(l.target); });

    // propagate layers
    const visited = new Set(q);
    const qq = q.slice();
    while(qq.length){
      const cur = qq.shift();
      const curL = layer.get(cur) || 0;
      const outs = outAdj.get(cur) || [];
      for(const t of outs){
        const nextL = Math.max(layer.get(t) || 0, curL + 1);
        layer.set(t, nextL);
        if(!visited.has(t)){
          visited.add(t);
          qq.push(t);
        }
      }
    }

    // group nodes by layer
    const maxL = Math.max(0, ...Array.from(layer.values()));
    const columns = [];
    for(let i=0;i<=maxL;i++) columns.push([]);
    nodes.forEach(n => {
      const L = layer.has(n.id) ? layer.get(n.id) : 0;
      columns[Math.min(L, maxL)].push(n);
    });

    // assign positions
    const colGap = (maxL <= 0) ? 1 : maxL;
    columns.forEach((col, i) => {
      col.sort((a,b) => (a.type === 'note' ? 0 : 1) - (b.type === 'note' ? 0 : 1));
      const x = 80 + (i * (Math.max(200, (w - 160) / colGap)));
      const step = Math.max(14, (h - 100) / Math.max(1, col.length));
      col.forEach((n, j) => {
        n.x = x;
        n.y = 50 + j * step;
      });
    });

    // links as smooth curves
    const link = gRoot.append('g')
      .selectAll('path')
      .data(links)
      .join('path')
      .attr('class','link')
      .attr('d', d => {
        const s = byId.get(d.source);
        const t = byId.get(d.target);
        if(!s || !t) return '';
        const x0 = s.x, y0 = s.y;
        const x1 = t.x, y1 = t.y;
        const mx = (x0 + x1) / 2;
        return 'M' + x0 + ',' + y0 + ' C' + mx + ',' + y0 + ' ' + mx + ',' + y1 + ' ' + x1 + ',' + y1;
      });

    const node = gRoot.append('g')
      .selectAll('g')
      .data(nodes, d => d.id)
      .join('g')
      .attr('class','node')
      .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')')
      .on('click', (event, d) => { event.stopPropagation(); selectNode(d.id); })
      .on('dblclick', (event, d) => { event.stopPropagation(); if(d.type === 'note' && d.filename) openNote(d.filename); });

    node.append('circle')
      .attr('r', d => (d.type === 'note' ? 8 : 6))
      .attr('fill', d => nodeColor(d.type));

    node.append('text')
      .attr('x', 12)
      .attr('y', 4)
      .style('display', showLabels ? null : 'none')
      .text(d => d.label || d.id);

    fitView(40);
  }

  // Icicle (zoomable-ish by click focus)
  function renderIcicle(){
    setHint(false);
    resetD3Canvas();

    const rules = labelRules();
    const root = hierarchyWithValues();

    const w = elViz.clientWidth || 900;
    const h = elViz.clientHeight || 650;

    const partition = d3.partition().size([w, h]).padding(1);
    partition(root);

    const color = d => nodeColor(d.data.type);

    const g = gRoot.append('g');

    const rects = g.selectAll('rect')
      .data(root.descendants())
      .join('rect')
      .attr('x', d => d.x0)
      .attr('y', d => d.y0)
      .attr('width', d => Math.max(0, d.x1 - d.x0))
      .attr('height', d => Math.max(0, d.y1 - d.y0))
      .attr('fill', d => color(d))
      .attr('opacity', d => d.depth === 0 ? 0 : 0.85)
      .on('mousemove', (event, d) => {
        showTooltip(event.clientX, event.clientY, (d.data.label || d.data.id));
      })
      .on('mouseleave', hideTooltip)
      .on('click', (event, d) => { event.stopPropagation(); selectNode(d.data.id); })
      .on('dblclick', (event, d) => { event.stopPropagation(); if(d.data.type === 'note' && d.data.filename) openNote(d.data.filename); });

    // labels only if box is big enough
    g.selectAll('text')
      .data(root.descendants())
      .join('text')
      .style('display', showLabels ? null : 'none')
      .attr('x', d => d.x0 + 6)
      .attr('y', d => d.y0 + 14)
      .attr('fill', '#111827')
      .attr('font-size', 11)
      .text(d => {
        const w0 = d.x1 - d.x0;
        const h0 = d.y1 - d.y0;
        if(d.depth === 0) return '';
        if(w0 < rules.rectW || h0 < rules.rectH) return '';
        return d.data.label || d.data.id;
      });

    fitView(30);
  }

  // Cascaded treemap
  function renderCascadedTreemap(){
    setHint(false);
    resetD3Canvas();

    const rules = labelRules();
    const root = hierarchyWithValues();

    const w = elViz.clientWidth || 900;
    const h = elViz.clientHeight || 650;

    d3.treemap()
      .size([w, h])
      .paddingInner(1)
      .paddingOuter(1)
      .round(true)(root);

    const g = gRoot.append('g');

    const cells = g.selectAll('g')
      .data(root.descendants().filter(d => d.depth > 0))
      .join('g')
      .attr('transform', d => 'translate(' + d.x0 + ',' + d.y0 + ')')
      .on('mousemove', (event, d) => showTooltip(event.clientX, event.clientY, d.data.label || d.data.id))
      .on('mouseleave', hideTooltip)
      .on('click', (event, d) => { event.stopPropagation(); selectNode(d.data.id); })
      .on('dblclick', (event, d) => { event.stopPropagation(); if(d.data.type === 'note' && d.data.filename) openNote(d.data.filename); });

    cells.append('rect')
      .attr('width', d => Math.max(0, d.x1 - d.x0))
      .attr('height', d => Math.max(0, d.y1 - d.y0))
      .attr('fill', d => nodeColor(d.data.type))
      .attr('opacity', 0.85);

    cells.append('text')
      .style('display', showLabels ? null : 'none')
      .attr('x', 6)
      .attr('y', 14)
      .attr('fill', '#111827')
      .attr('font-size', 11)
      .text(d => {
        const w0 = d.x1 - d.x0;
        const h0 = d.y1 - d.y0;
        if(w0 < rules.rectW || h0 < rules.rectH) return '';
        return d.data.label || d.data.id;
      });

    fitView(25);
  }

  // Sequences sunburst (hover highlight + breadcrumbs)
  function renderSequencesSunburst(){
    setHint(true);
    resetD3Canvas();

    const rules = labelRules();
    const root = hierarchyWithValues();

    const w = elViz.clientWidth || 900;
    const h = elViz.clientHeight || 650;
    const radius = Math.min(w, h) * 0.40;

    const partition = d3.partition()
      .size([2 * Math.PI, radius]);

    partition(root);

    const arc = d3.arc()
      .startAngle(d => d.x0)
      .endAngle(d => d.x1)
      .innerRadius(d => d.y0)
      .outerRadius(d => d.y1);

    const g = gRoot.append('g')
      .attr('transform', 'translate(' + (w/2) + ',' + (h/2) + ')');

    // build ancestor set highlight behaviour
    const path = g.selectAll('path')
      .data(root.descendants().filter(d => d.depth > 0))
      .join('path')
      .attr('d', arc)
      .attr('fill', d => nodeColor(d.data.type))
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 0.5)
      .attr('fill-opacity', 0.55)
      .on('mousemove', (event, d) => {
        const names = d.ancestors().reverse().map(x => x.data.label || x.data.id).filter(Boolean);
        setCrumbs(names.slice(0, 7)); // keep it tidy
        showTooltip(event.clientX, event.clientY, (d.data.label || d.data.id));
        const ancestors = new Set(d.ancestors());
        path.attr('fill-opacity', p => ancestors.has(p) ? 0.95 : 0.12);
      })
      .on('mouseleave', () => {
        hideTooltip();
        setCrumbs(null);
        path.attr('fill-opacity', 0.55);
      })
      .on('click', (event, d) => { event.stopPropagation(); selectNode(d.data.id); })
      .on('dblclick', (event, d) => { event.stopPropagation(); if(d.data.type === 'note' && d.data.filename) openNote(d.data.filename); });

    // Labels (only if arc is large enough)
    g.append('g')
      .style('display', showLabels ? null : 'none')
      .selectAll('text')
      .data(root.descendants().filter(d => d.depth > 0))
      .join('text')
      .attr('dy', '0.35em')
      .attr('fill', '#111827')
      .attr('font-size', 10)
      .attr('pointer-events', 'none')
      .attr('transform', d => {
        // compute angle and rotate to readable
        const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
        const y = (d.y0 + d.y1) / 2;
        return 'rotate(' + (x - 90) + ') translate(' + y + ',0) rotate(' + (x < 180 ? 0 : 180) + ')';
      })
      .attr('text-anchor', d => ((d.x0 + d.x1)/2) < Math.PI ? 'start' : 'end')
      .text(d => {
        const a = d.x1 - d.x0;
        const arcPx = a * (d.y1);
        if(arcPx < rules.arcPx) return '';
        return d.data.label || d.data.id;
      });

    fitView(30);
  }

  // -----------------------------
  // Visualisation switch
  // -----------------------------
  function renderCurrentViz(){
    if(typeof d3 === 'undefined') return;

    clearError();
    setLoading(false);

    if(!filtered || !filtered.nodes || filtered.nodes.length === 0){
      resetD3Canvas();
      return;
    }

    const mode = String(document.getElementById('vizSelect').value || 'disjoint');

    if(mode === 'disjoint') return renderDisjointForce();
    if(mode === 'forceTree') return renderForceDirectedTree();
    if(mode === 'radialCluster') return renderRadialCluster();
    if(mode === 'tangled') return renderTangledTree();
    if(mode === 'icicle') return renderIcicle();
    if(mode === 'treemap') return renderCascadedTreemap();
    if(mode === 'sunburst') return renderSequencesSunburst();

    return renderDisjointForce();
  }

  // -----------------------------
  // UI wiring
  // -----------------------------
  document.getElementById('btnFit').onclick = () => fitView(40);
  document.getElementById('btnRelayout').onclick = () => renderCurrentViz();
  document.getElementById('btnClear').onclick = () => {
    selectedId = null;
    showSelection(null);
    if(gRoot) gRoot.selectAll('.node').classed('selected', false);
    setCrumbs(null);
  };
  document.getElementById('btnReset').onclick = () => resetView();
  document.getElementById('btnRebuild').onclick = () => { window.location.href = ${JSON.stringify(rebuildURL)}; };

  document.getElementById('toggleTags').onclick = () => { showTags = !showTags; updateToggleUI(); applyFilters(); };
  document.getElementById('toggleMentions').onclick = () => { showMentions = !showMentions; updateToggleUI(); applyFilters(); };
  document.getElementById('toggleExternal').onclick = () => { showExternal = !showExternal; updateToggleUI(); applyFilters(); };
  document.getElementById('toggleLabels').onclick = () => { showLabels = !showLabels; updateToggleUI(); renderCurrentViz(); };
  document.getElementById('toggleCalendars').onclick = () => { showCalendars = !showCalendars; updateToggleUI(); applyFilters(); };

  document.getElementById('labelDensity').addEventListener('change', (e) => {
    labelDensity = String(e.target.value || 'med');
    renderCurrentViz();
  });

  document.getElementById('filterInput').addEventListener('input', applyFilters);
  document.getElementById('vizSelect').addEventListener('change', renderCurrentViz);

  setLoading(true);
  updateToggleUI();

  window.setGraphData = function(graph){
    try{
      if(typeof d3 === 'undefined'){
        setLoading(false);
        setError("D3 failed to load. Confirm d3.v7.min.js is present and is the UMD build from d3js.org.");
        return;
      }

      clearError();
      const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
      const edges = Array.isArray(graph.edges) ? graph.edges : [];
      graphData = { nodes, edges };

      applyFilters();
      setLoading(false);
      try { fitView(40); } catch(e){}
    } catch(err){
      setLoading(false);
      setError('Failed to render graph: ' + (err && err.message ? err.message : String(err)));
    }
  };
</script>
</body>
</html>`
}

// -----------------------------
// Cache helpers
// -----------------------------
function isValidGraph(g) {
  return g && Array.isArray(g.nodes) && Array.isArray(g.edges)
}

async function loadCache() {
  try {
    if (typeof DataStore.loadJSON === 'function') return await DataStore.loadJSON(CACHE_FILE)
  } catch (_) {}
  try {
    if (typeof DataStore.loadData === 'function') {
      const raw = await DataStore.loadData(CACHE_FILE)
      if (raw) return JSON.parse(String(raw))
    }
  } catch (_) {}
  return null
}

async function saveCache(graph) {
  try {
    if (typeof DataStore.saveJSON === 'function') {
      await DataStore.saveJSON(graph, CACHE_FILE)
      return
    }
  } catch (_) {}
  try {
    if (typeof DataStore.saveData === 'function') {
      await DataStore.saveData(JSON.stringify(graph), CACHE_FILE)
    }
  } catch (e) {
    console.log(`GraphNote: failed to save cache: ${stringifyError(e)}`)
  }
}

// -----------------------------
// Graph build (regex-safe, no dynamic regex construction)
// -----------------------------
async function buildGraphIndex() {
  const notes = await getProjectNotesSafe()

  // map title -> filename to resolve [[Wiki Links]]
  const titleToFilename = new Map()
  for (const n of notes) {
    const title = safeTitle(n)
    const fn = n && n.filename ? String(n.filename) : ''
    if (title && fn) titleToFilename.set(title, fn)
  }

  const nodes = []
  const edges = []
  const nodeSeen = new Set()
  const edgeSeen = new Set()

  const addNode = (node) => {
    if (!node || !node.id) return
    if (nodeSeen.has(node.id)) return
    nodeSeen.add(node.id)
    nodes.push(node)
  }

  const addEdge = (source, target) => {
    if (!source || !target) return
    const id = `e:${source}=>${target}`
    if (edgeSeen.has(id)) return
    edgeSeen.add(id)
    edges.push({ id, source, target })
  }

  // Note nodes
  for (const n of notes) {
    const fn = n && n.filename ? String(n.filename) : ''
    if (!fn) continue
    addNode({ id: `note:${fn}`, type: 'note', label: safeTitle(n) || fn, filename: fn })
  }

  for (const n of notes) {
    const fromFilename = n && n.filename ? String(n.filename) : ''
    if (!fromFilename) continue
    const fromId = `note:${fromFilename}`
    const content = String(n.content || '')

    // Wiki links: [[Title]]
    const reWiki = /\[\[([^\]]+)\]\]/g
    let m
    while ((m = reWiki.exec(content)) !== null) {
      const raw = String(m[1] || '').trim()
      if (!raw) continue
      const targetFilename = titleToFilename.get(raw) || ''
      if (targetFilename) {
        addEdge(fromId, `note:${targetFilename}`)
      } else {
        const dangId = `noteTitle:${raw}`
        addNode({ id: dangId, type: 'note', label: raw, filename: '' })
        addEdge(fromId, dangId)
      }
    }

    const tokens = content.split(/\s+/).filter(Boolean)

    // #tags and @mentions
    for (const tok of tokens) {
      if (tok[0] === '#') {
        const t = tok.slice(1).replace(/[^A-Za-z0-9_\-\/]/g, '')
        if (!t) continue
        const tid = `tag:${t}`
        addNode({ id: tid, type: 'tag', label: `#${t}` })
        addEdge(fromId, tid)
      }
      if (tok[0] === '@') {
        const mm = tok.slice(1).replace(/[^A-Za-z0-9_\-\/]/g, '')
        if (!mm) continue
        const mid = `mention:${mm}`
        addNode({ id: mid, type: 'mention', label: `@${mm}` })
        addEdge(fromId, mid)
      }
    }

    // URLs
    for (const tok of tokens) {
      if (tok.startsWith('http://') || tok.startsWith('https://')) {
        const u = tok.replace(/[),.\]]+$/g, '')
        if (!u) continue
        const uid = `external:${u}`
        addNode({ id: uid, type: 'external', label: trimMiddle(u, 38) })
        addEdge(fromId, uid)
      }
    }
  }

  return { nodes, edges }
}

async function getProjectNotesSafe() {
  try {
    if (typeof DataStore.projectNotes === 'function') {
      const res = await DataStore.projectNotes()
      return Array.isArray(res) ? res : []
    }
    if (Array.isArray(DataStore.projectNotes)) return DataStore.projectNotes
  } catch (e) {
    console.log(`GraphNote: projectNotes failed: ${stringifyError(e)}`)
  }
  return []
}

function safeTitle(note) {
  const t = note && note.title ? String(note.title).trim() : ''
  if (t) return t
  const fn = note && note.filename ? String(note.filename) : ''
  if (!fn) return ''
  const base = fn.split('/').pop() || fn
  return base.replace(/\.md$/i, '')
}

function trimMiddle(s, max) {
  if (!s || s.length <= max) return s
  const keep = Math.max(10, Math.floor((max - 3) / 2))
  return s.slice(0, keep) + '...' + s.slice(s.length - keep)
}

function stringifyError(e) {
  try {
    if (!e) return 'Unknown error'
    if (typeof e === 'string') return e
    if (e.message) return String(e.message)
    return JSON.stringify(e)
  } catch (_) {
    return String(e)
  }
}

// Make commands discoverable by NotePlan (NO module.exports)
globalThis.graphnote = graphnote
globalThis.rebuildGraphIndex = rebuildGraphIndex
