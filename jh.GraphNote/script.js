// @ts-nocheck
/* global DataStore, HTMLView, NotePlan */

const PLUGIN_ID = 'jh.GraphNote'
const WINDOW_CUSTOM_ID = 'graphnote'

/**
 * Public command: graphnote
 */
async function graphnote() {
  const BUILD_ID = `GN-D3-FULL-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}`
  console.log(`GraphNote: command started ${BUILD_ID}`)

  try {
    const settings = await getPluginSettingsSafe()
    const saved = await loadSavedSettingsSafe()
    if (saved) Object.assign(settings, saved)
    await openGraphWindow(BUILD_ID, settings)

    const { projectNotes, calendarNotes } = await getNotesSafe()
    console.log(`GraphNote: projectNotes=${projectNotes.length} calendarNotes=${calendarNotes.length}`)

    const graph = buildGraphIndex(projectNotes, calendarNotes, settings)
    console.log(`GraphNote: graph nodes=${graph.nodes.length} links=${graph.edges.length}`)

    await waitForWindowFunction('setGraphData', 12000)
    await pushGraphToWindow({
      buildId: BUILD_ID,
      settings,
      ...graph,
    })
    console.log('GraphNote: graph pushed to window')
  } catch (e) {
    console.log(`GraphNote: error: ${stringifyError(e)}`)
    try {
      await waitForWindowFunction('setGraphError', 3000)
      await pushErrorToWindow(e)
    } catch (_) {}
  }
}

/**
 * Public command: graphnote-rebuild
 */
async function rebuildGraphIndex(arg0) {
  const BUILD_ID = `GN-D3-REBUILD-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}`
  console.log(`GraphNote: rebuild started ${BUILD_ID}`)

  // Called from the HTML window to persist settings (via noteplan:// runPlugin)
  if (typeof arg0 === 'string' && arg0.trim().length) {
    try {
      const decoded = decodeURIComponent(arg0)
      const obj = JSON.parse(decoded)
      if (obj && typeof obj === 'object') {
        await saveSavedSettingsSafe(obj)
        console.log('GraphNote: settings saved')
        return
      }
    } catch (e) {
      console.log(`GraphNote: settings save arg parse failed: ${stringifyError(e)}`)
      // fall through to normal rebuild
    }
  }


  try {
    const settings = await getPluginSettingsSafe()
    await openGraphWindow(BUILD_ID, settings)

    const { projectNotes, calendarNotes } = await getNotesSafe()
    console.log(`GraphNote: projectNotes=${projectNotes.length} calendarNotes=${calendarNotes.length}`)

    const graph = buildGraphIndex(projectNotes, calendarNotes, settings)
    console.log(`GraphNote: graph nodes=${graph.nodes.length} links=${graph.edges.length}`)

    await waitForWindowFunction('setGraphData', 12000)
    await pushGraphToWindow({
      buildId: BUILD_ID,
      settings,
      ...graph,
    })
    console.log('GraphNote: rebuild - graph pushed')
  } catch (e) {
    console.log(`GraphNote: rebuild error: ${stringifyError(e)}`)
    try {
      await waitForWindowFunction('setGraphError', 3000)
      await pushErrorToWindow(e)
    } catch (_) {}
  }
}

/**
 * NotePlan calls this automatically after plugin settings are saved.
 */
async function onSettingsUpdated() {
  try {
    console.log('GraphNote: settings updated - refreshing graph')
    await graphnote()
  } catch (e) {
    console.log(`GraphNote: onSettingsUpdated failed: ${stringifyError(e)}`)
  }
}

/* -----------------------------
   Settings (from plugin.json)
----------------------------- */


async function loadSavedSettingsSafe() {
  try {
    if (typeof DataStore !== 'undefined' && DataStore && typeof DataStore.loadJSON === 'function') {
      const s = await DataStore.loadJSON('graphnote-settings.json')
      if (s && typeof s === 'object') return s
    }
  } catch (e) {
    // ignore (file may not exist)
  }
  return null
}

async function saveSavedSettingsSafe(settingsObj) {
  try {
    if (typeof DataStore !== 'undefined' && DataStore && typeof DataStore.saveJSON === 'function') {
      await DataStore.saveJSON(settingsObj, 'graphnote-settings.json')
    }
  } catch (e) {
    console.log(`GraphNote: save settings failed: ${stringifyError(e)}`)
  }
}

async function getPluginSettingsSafe() {
  const defaults = {
    defaultShowTags: 'Yes',
    defaultShowMentions: 'Yes',
    defaultShowExternal: 'Yes',
    defaultShowLabels: 'Yes',
    defaultLabelDensity: 'med',
    defaultViz: 'disjoint',
    ignoreCalendarNotesByDefault: 'No',
    forceMaxNodes: '2500',
    noteColor: '#fbbf24',
    tagColor: '#22c55e',
    mentionColor: '#5eead4',
    externalColor: '#ec4899',
  }

  try {
    if (typeof DataStore !== 'undefined' && DataStore && typeof DataStore.settings === 'object') {
      return Object.assign({}, defaults, DataStore.settings || {})
    }
  } catch (_) {}

  try {
    if (typeof DataStore !== 'undefined' && DataStore && typeof DataStore.loadSettings === 'function') {
      const s = await DataStore.loadSettings()
      if (s && typeof s === 'object') return Object.assign({}, defaults, s)
    }
  } catch (_) {}

  return defaultss
}

function ynToBool(v, fallback) {
  if (v === 'Yes') return true
  if (v === 'No') return false
  return !!fallback
}

function clampHexColor(s, fallback) {
  const v = String(s || '').trim()
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v
  return fallback
}

/* -----------------------------
   Note retrieval (robust across NP versions)
----------------------------- */

async function getNotesSafe() {
  let projectNotes = []
  let calendarNotes = []

  try {
    if (typeof DataStore !== 'undefined') {
      if (typeof DataStore.projectNotes === 'function') {
        const res = await DataStore.projectNotes()
        if (Array.isArray(res)) projectNotes = res
      } else if (Array.isArray(DataStore.projectNotes)) {
        projectNotes = DataStore.projectNotes
      }
    }
  } catch (e) {
    console.log(`GraphNote: projectNotes failed: ${stringifyError(e)}`)
  }

  try {
    if (typeof DataStore !== 'undefined') {
      if (typeof DataStore.calendarNotes === 'function') {
        const res = await DataStore.calendarNotes()
        if (Array.isArray(res)) calendarNotes = res
      } else if (Array.isArray(DataStore.calendarNotes)) {
        calendarNotes = DataStore.calendarNotes
      }
    }
  } catch (e) {
    console.log(`GraphNote: calendarNotes failed: ${stringifyError(e)}`)
  }

  return {
    projectNotes: Array.isArray(projectNotes) ? projectNotes : [],
    calendarNotes: Array.isArray(calendarNotes) ? calendarNotes : [],
  }
}

/* -----------------------------
   Window + injection (customId-safe)
----------------------------- */

let _usedCustomId = false

async function openGraphWindow(buildId, settings) {
  const html = buildHTMLShell(buildId, settings)
  _usedCustomId = false

  if (typeof HTMLView !== 'undefined' && typeof HTMLView.showWindowWithOptions === 'function') {
    await HTMLView.showWindowWithOptions(html, 'GraphNote', {
      width: 1200,
      height: 750,
      customId: WINDOW_CUSTOM_ID,
      shouldFocus: true,
    })
    _usedCustomId = true
    return
  }

  if (typeof HTMLView !== 'undefined' && typeof HTMLView.showWindow === 'function') {
    await HTMLView.showWindow(html, 'GraphNote', 1200, 750)
    _usedCustomId = false
    return
  }

  throw new Error('HTMLView is unavailable (cannot open GraphNote window).')
}

async function runJSInWindow(code) {
  if (typeof HTMLView === 'undefined' || typeof HTMLView.runJavaScript !== 'function') {
    throw new Error('HTMLView.runJavaScript is unavailable.')
  }
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
  const code =
    `(function(){` +
    ` try {` +
    `   if (window && typeof window.setGraphData === 'function') { window.setGraphData(${safe}); return 'ok'; }` +
    `   return 'setGraphData missing';` +
    ` } catch(e){ return 'error:' + (e && e.message ? e.message : String(e)); }` +
    `})();`
  const res = await runJSInWindow(code)
  const s = String(res)
  if (s.includes('missing') || s.startsWith('error:')) throw new Error('Graph injection failed: ' + s)
}

async function pushErrorToWindow(err) {
  const msg = stringifyError(err)
  const code =
    `(function(){` +
    ` try {` +
    `   if (window && typeof window.setGraphError === 'function') { window.setGraphError(${JSON.stringify(
      msg
    )}); return 'ok'; }` +
    `   return 'setGraphError missing';` +
    ` } catch(e){ return 'error:' + (e && e.message ? e.message : String(e)); }` +
    `})();`
  await runJSInWindow(code)
}

/* -----------------------------
   Sleep (NotePlan-safe)
----------------------------- */

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

  const end = Date.now() + ms
  while (Date.now() < end) {}
}

/* -----------------------------
   Graph build
----------------------------- */

function buildGraphIndex(projectNotes, calendarNotes, settings) {
  const notes = Array.isArray(projectNotes) ? projectNotes : []
  const cals = Array.isArray(calendarNotes) ? calendarNotes : []

  const ignoreCal = ynToBool(settings.ignoreCalendarNotesByDefault, false)

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

  for (const n of notes) {
    const fn = n && n.filename ? String(n.filename) : ''
    if (!fn) continue
    addNode({ id: `note:${fn}`, type: 'note', label: safeTitle(n) || fn, filename: fn })
  }

  if (!ignoreCal) {
    for (const n of cals) {
      const fn = n && n.filename ? String(n.filename) : ''
      if (!fn) continue
      addNode({ id: `cal:${fn}`, type: 'calendar', label: safeTitle(n) || fn, filename: fn })
    }
  }

  for (const n of notes) {
    const fromFilename = n && n.filename ? String(n.filename) : ''
    if (!fromFilename) continue
    const fromId = `note:${fromFilename}`
    const content = String((n && n.content) || '')

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

    for (const tok of tokens) {
      if (tok.startsWith('http://') || tok.startsWith('https://')) {
        const u = tok.replace(/[),.\]]+$/g, '')
        if (!u) continue
        const uid = `external:${u}`
        addNode({ id: uid, type: 'external', label: trimMiddle(u, 46) })
        addEdge(fromId, uid)
      }
    }
  }

  return { nodes, edges }
}

/* -----------------------------
   HTML Shell (settings applied)
----------------------------- */

function buildHTMLShell(buildId, settingsRaw) {
  const settings = Object.assign({}, settingsRaw || {})

  const init = {
    showTags: ynToBool(settings.defaultShowTags, true),
    showMentions: ynToBool(settings.defaultShowMentions, true),
    showExternal: ynToBool(settings.defaultShowExternal, true),
    showLabels: ynToBool(settings.defaultShowLabels, true),
    showCalendar: !ynToBool(settings.ignoreCalendarNotesByDefault, false),
    labelDensity: ['low', 'med', 'high'].includes(String(settings.defaultLabelDensity))
      ? String(settings.defaultLabelDensity)
      : 'med',
    viz: String(settings.defaultViz || 'disjoint'),
    forceMaxNodes: parseInt(String(settings.forceMaxNodes || '2500'), 10) || 2500,
    colors: {
      note: clampHexColor(settings.noteColor, '#fbbf24'),
      tag: clampHexColor(settings.tagColor, '#22c55e'),
      mention: clampHexColor(settings.mentionColor, '#5eead4'),
      external: clampHexColor(settings.externalColor, '#ec4899'),
    },
  }

  const rebuildURL =
    'noteplan://x-callback-url/runPlugin?pluginID=' +
    encodeURIComponent(PLUGIN_ID) +
    '&command=' +
    encodeURIComponent('graphnote-rebuild')

  const saveSettingsURL = rebuildURL + '&arg0=';

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

    --note:${escapeHTML(init.colors.note)};
    --tag:${escapeHTML(init.colors.tag)};
    --mention:${escapeHTML(init.colors.mention)};
    --external:${escapeHTML(init.colors.external)};
    --calendar:#60a5fa;
  }

  html,body{height:100%;margin:0;background:var(--bg);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial;}
  .app{height:100%;display:flex;flex-direction:column;}
  .topbar{
    display:flex;
    align-items:center;
    gap:10px;
    padding:10px 12px;
    border-bottom:1px solid var(--border);
    background:#fff;
    flex-wrap:wrap;
  }
  .search{
    flex:1;
    min-width:220px;
    background:#f3f4f6;
    border:1px solid var(--border);
    border-radius:14px;
    padding:7px 10px;
    outline:none;
    font-size:13px;
  }
  .select{
    max-width:260px;
    background:#f3f4f6;
    border:1px solid var(--border);
    border-radius:14px;
    padding:7px 10px;
    outline:none;
    font-size:13px;
    color:var(--text);
  }
  .toggles{
    display:flex;
    gap:8px;
    align-items:center;
    flex-wrap:wrap;
  }
  .pill{
    border:none;
    border-radius:14px;
    padding:8px 12px;
    font-weight:800;
    color:#fff;
    cursor:pointer;
    user-select:none;
    font-size:13px;
    line-height:1;
    white-space:nowrap;
  }
  .pill.on{background:var(--on);}
  .pill.off{background:var(--off);}
  .btn{
    border:none;
    border-radius:14px;
    padding:8px 12px;
    font-weight:900;
    background:var(--btn);
    color:var(--btnText);
    cursor:pointer;
    font-size:13px;
    line-height:1;
    white-space:nowrap;
  }

  .main{flex:1;display:flex;min-height:0;}
  #vizWrap{flex:1;position:relative;min-width:0;}
  #viz{position:absolute;inset:0;}
  .side{
    width:340px;
    border-left:1px solid var(--border);
    background:var(--panel);
    padding:16px;
    overflow:auto;
    box-sizing:border-box;
  }

  .card{
    background:#fff;
    border:1px solid var(--border);
    border-radius:16px;
    padding:12px 12px;
    box-shadow:0 8px 18px rgba(0,0,0,0.06);
    margin-bottom:12px;
  }
  .title{font-size:22px;font-weight:900;color:var(--text);margin:0 0 6px 0;}
  .kv{color:var(--muted);font-size:13px;margin:0 0 4px 0;word-break:break-word;}
  .sectionTitle{margin-top:12px;font-weight:900;color:var(--text);font-size:13px;}
  .list{margin-top:8px;display:flex;flex-direction:column;gap:8px;}

  .linkItem{
    display:block;
    padding:9px 10px;
    border-radius:14px;
    background:var(--panel2);
    border:1px solid var(--border);
    color:var(--text);
    text-decoration:none;
    font-weight:800;
    font-size:13px;
    overflow:hidden;
    white-space:nowrap;
    text-overflow:ellipsis;
  }

  .errorBox{margin-top:10px;padding:10px 12px;border-radius:14px;border:1px solid #fecaca;background:#fff1f2;color:#991b1b;font-weight:900;white-space:pre-wrap;}
  .loadingOverlay{
    position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
    background:#fff;border:1px solid var(--border);border-radius:16px;padding:16px 16px;
    box-shadow:0 10px 25px rgba(0,0,0,0.10);
    display:flex;gap:12px;align-items:center;min-width:320px;z-index:10;
  }
  .spinner{width:24px;height:24px;border-radius:999px;border:3px solid #e5e7eb;border-top-color:#6b7280;animation:spin 0.9s linear infinite;}
  @keyframes spin{to{transform:rotate(360deg)}}

  .toast{
    position:absolute;
    left:14px;
    bottom:14px;
    background:rgba(17,24,39,0.92);
    color:#fff;
    padding:8px 10px;
    border-radius:14px;
    font-size:12px;
    font-weight:900;
    z-index:12;
    display:none;
  }

  svg{width:100%;height:100%;}
  .node circle{stroke:#111827;stroke-width:0.5px;}
  .node text{fill:#111827;pointer-events:none;font-weight:800;}
  .link{stroke:#d1d5db;stroke-width:1.0px;fill:none;}
  .linkArrow{stroke:#d1d5db;fill:#d1d5db;}
  .selected circle{stroke:#111827;stroke-width:3px;}
  .smallLabel{font-size:10px;}
  .medLabel{font-size:11px;}
  .bigLabel{font-size:12px;}
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
      <option value="med">Labels: Medium</option>
      <option value="high">Labels: High</option>
    </select>

    <div class="toggles">
      <button id="toggleCalendar" class="pill on">Calendar</button>
      <button id="toggleTags" class="pill on">Tags</button>
      <button id="toggleMentions" class="pill on">Mentions</button>
      <button id="toggleExternal" class="pill on">External</button>
      <button id="toggleLabels" class="pill on">Labels</button>

      <button id="btnFit" class="btn">Fit</button>
      <button id="btnRelayout" class="btn">Relayout</button>
      <button id="btnRebuild" class="btn">Rebuild</button>
    </div>
  </div>

  <div class="main">
    <div id="vizWrap">
      <div id="viz"></div>
      <div id="loading" class="loadingOverlay">
        <div class="spinner"></div>
        <div>
          <div style="font-weight:900;font-size:15px;color:var(--text)">Loading graph...</div>
          <div style="font-size:12px;color:var(--muted);margin-top:2px">Building relationships</div>
        </div>
      </div>
      <div id="toast" class="toast"></div>
    </div>

    <div class="side">
      <div class="card">
        <div class="title">GraphNote</div>
        <div class="kv" id="buildLine">BUILD: ${escapeHTML(buildId)}</div>
        <div class="kv" id="countsLine">Notes/Nodes: 0 - Edges: 0</div>
        <div class="kv" id="settingsLine">Settings applied from NotePlan plugin settings.</div>
      </div>

      <div class="card">
        <div class="kv" style="font-weight:900;color:var(--muted);margin-bottom:6px;">Selected</div>
        <div class="title" id="selTitle" style="font-size:18px;margin:0 0 6px 0;cursor:default;">Click a node</div>
        <div class="kv" id="selMeta">-</div>
        <a id="openNoteBtn" class="linkItem" href="#" style="display:none;background:#111827;color:#fff;border-color:#111827;text-align:center;">Open note</a>

        <div class="sectionTitle">Outgoing</div>
        <div class="list" id="outList"></div>

        <div class="sectionTitle">Incoming</div>
        <div class="list" id="inList"></div>
      </div>

      <div id="err" class="errorBox" style="display:none;"></div>
    </div>
  </div>
</div>

<script>
  window.__GN_INIT__ = ${JSON.stringify(init).replace(/</g, '\\u003c')};
</script>

<script src="d3.v7.min.js"></script>

<script>
  const elErr = document.getElementById('err');
  const elLoading = document.getElementById('loading');
  const elViz = document.getElementById('viz');
  const elToast = document.getElementById('toast');
  const SAVE_SETTINGS_URL_PREFIX = ${JSON.stringify(saveSettingsURL)};

  function setError(msg){ elErr.style.display='block'; elErr.textContent = msg || 'Unknown error'; }
  function clearError(){ elErr.style.display='none'; elErr.textContent=''; }
  function setLoading(on){ elLoading.style.display = on ? 'flex' : 'none'; }

  function toast(msg, ms){
    elToast.textContent = msg;
    elToast.style.display = 'block';
    const t = ms || 900;
    setTimeout(() => { elToast.style.display = 'none'; }, t);
  }

  if (typeof d3 === 'undefined') {
    setLoading(false);
    setError("D3 failed to load. Ensure d3.v7.min.js is present (UMD build) in the plugin folder.");
  }

  const INIT = window.__GN_INIT__ || {};
  let showCalendar = !!INIT.showCalendar;
  let showTags = !!INIT.showTags;
  let showMentions = !!INIT.showMentions;
  let showExternal = !!INIT.showExternal;
  let showLabels = !!INIT.showLabels;
  let labelDensity = String(INIT.labelDensity || 'med');
  let currentMode = String(INIT.viz || 'disjoint');
  const FORCE_MAX = Number(INIT.forceMaxNodes || 2500);

  let graphData = null;
  let filtered = { nodes: [], edges: [] };

  let svg = null;
  let gRoot = null;
  let zoom = null;
  let simulation = null;

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
    if(type === 'mention') return rootCssVar('--mention', '#5eead4');
    if(type === 'external') return rootCssVar('--external', '#ec4899');
    if(type === 'calendar') return rootCssVar('--calendar', '#60a5fa');
    return '#9ca3af';
  }

  function setPill(id, on){
    const b = document.getElementById(id);
    b.classList.remove('on'); b.classList.remove('off');
    b.classList.add(on ? 'on' : 'off');
  }

  function updateToggleUI(){
    setPill('toggleCalendar', showCalendar);
    setPill('toggleTags', showTags);
    setPill('toggleMentions', showMentions);
    setPill('toggleExternal', showExternal);
    setPill('toggleLabels', showLabels);
  }

  function truncateLabel(s, maxChars){
    const str = String(s || '');
    if(str.length <= maxChars) return str;
    return str.slice(0, maxChars - 1) + '…';
  }

  function labelForNode(n){
    const full = (n && (n.label || n.id)) ? (n.label || n.id) : '';

    if(labelDensity === 'high') return truncateLabel(full, 80);

    if(labelDensity === 'med'){
      if(n.type === 'note' || n.type === 'tag') return truncateLabel(full, 34);
      if(n.type === 'mention') return truncateLabel(full, 22);
      if(n.type === 'external') return '';
      return truncateLabel(full, 22);
    }

    if(n.type === 'note') return truncateLabel(full, 22);
    if(n.type === 'tag') return truncateLabel(full, 16);
    return '';
  }

  function labelClass(){
    if(labelDensity === 'high') return 'bigLabel';
    if(labelDensity === 'med') return 'medLabel';
    return 'smallLabel';
  }

  function resetD3Canvas(){
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

  // More reliable than window.location.href in some WebViews: click an <a>
  function fireUrl(url){
    try{
      const a = document.createElement('a');
      a.href = url;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { try { a.remove(); } catch(e){} }, 50);
    } catch(e) {
      try { window.location.href = url; } catch(_) {}
    }
  }

  function tryOpenNote(filename){
    if(!filename) return;
    const enc = encodeURIComponent(filename);
    const urls = [
      'noteplan://x-callback-url/openNote?filename=' + enc,
      'noteplan://x-callback-url/openNote?noteFilename=' + enc,
      'noteplan://x-callback-url/openNote?file=' + enc,
    ];
    // try all variants with slight delays
    fireUrl(urls[0]);
    setTimeout(() => fireUrl(urls[1]), 220);
    setTimeout(() => fireUrl(urls[2]), 520);
  }

  function showSelection(nodeId){
    const selTitle = document.getElementById('selTitle');
    const selMeta = document.getElementById('selMeta');
    const outList = document.getElementById('outList');
    const inList = document.getElementById('inList');
    const openBtn = document.getElementById('openNoteBtn');

    outList.innerHTML = '';
    inList.innerHTML = '';

    selTitle.onclick = null;
    selTitle.style.cursor = 'default';

    if(!nodeId){
      selTitle.textContent = 'Click a node';
      selMeta.textContent = '-';
      openBtn.style.display = 'none';
      openBtn.onclick = null;
      return;
    }

    const n = nodeById.get(nodeId);
    const label = (n && n.label) ? n.label : nodeId;

    selTitle.textContent = label;
    selMeta.textContent = nodeId;

    if(n && n.type === 'note' && n.filename){
      // Make title clickable too (single click opens)
      selTitle.style.cursor = 'pointer';
      selTitle.onclick = () => { toast('Opening note...', 650); tryOpenNote(n.filename); };

      openBtn.style.display = 'block';
      openBtn.onclick = (e) => { e.preventDefault(); toast('Opening note...', 650); tryOpenNote(n.filename); };
    } else {
      openBtn.style.display = 'none';
      openBtn.onclick = null;
    }

    const out = outMap.get(nodeId) || [];
    const inn = inMap.get(nodeId) || [];

    // Single click lozenge: open if it's a note, else select
    function buildLozenge(targetId){
      const tn = nodeById.get(targetId);
      const a = document.createElement('a');
      a.className = 'linkItem';
      a.href = '#';
      a.title = (tn && tn.label) ? tn.label : targetId;
      a.textContent = (tn && tn.label) ? tn.label : targetId;

      a.onclick = (e) => {
        e.preventDefault();
        if(tn && tn.type === 'note' && tn.filename){
          toast('Opening note...', 650);
          tryOpenNote(tn.filename);
          return;
        }
        selectNode(targetId);
      };
      return a;
    }

    out.forEach(tid => outList.appendChild(buildLozenge(tid)));
    inn.forEach(sid => inList.appendChild(buildLozenge(sid)));
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
      if(n.type === 'calendar' && !showCalendar) return false;
      if(n.type === 'tag' && !showTags) return false;
      if(n.type === 'mention' && !showMentions) return false;
      if(n.type === 'external' && !showExternal) return false;

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

    renderCurrentViz(true);
  }

  function updateForceLabelsOnly(){
    if(!gRoot) return;
    gRoot.selectAll('.node text')
      .attr('class', () => labelClass())
      .style('display', showLabels ? null : 'none')
      .text(d => showLabels ? labelForNode(d) : '');
  }

  function renderDisjointForce(preservePositions){
    resetD3Canvas();
    currentMode = 'disjoint';

    const baseNodes = filtered.nodes.slice(0, FORCE_MAX).map(n => Object.assign({}, n));
    const idSet = new Set(baseNodes.map(n => n.id));
    const links = filtered.edges
      .filter(e => idSet.has(e.source) && idSet.has(e.target))
      .map(e => ({ source: e.source, target: e.target }));

    const w = elViz.clientWidth || 900;
    const h = elViz.clientHeight || 650;

    if(preservePositions){
      baseNodes.forEach(n => {
        n.x = (typeof n.x === 'number') ? n.x : (w/2 + (Math.random()-0.5)*40);
        n.y = (typeof n.y === 'number') ? n.y : (h/2 + (Math.random()-0.5)*40);
      });
    }

    const link = gRoot.append('g')
      .selectAll('path')
      .data(links)
      .join('path')
      .attr('class', 'link')
      .attr('marker-end', 'url(#arrow)');

    const node = gRoot.append('g')
      .selectAll('g')
      .data(baseNodes, d => d.id)
      .join('g')
      .attr('class', 'node')
      .on('click', (event, d) => { event.stopPropagation(); selectNode(d.id); })
      .on('dblclick', (event, d) => {
        event.stopPropagation();
        if(d.type === 'note' && d.filename){
          toast('Opening note...', 650);
          tryOpenNote(d.filename);
        }
      })
      .call(d3.drag()
        .on('start', (event, d) => { if(!event.active) simulation.alphaTarget(0.2).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
        .on('end', (event, d) => { if(!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; })
      );

    node.append('circle')
      .attr('r', d => (d.type === 'note' ? 10 : d.type === 'calendar' ? 9 : 7))
      .attr('fill', d => nodeColor(d.type));

    node.append('text')
      .attr('class', () => labelClass())
      .attr('x', 12)
      .attr('y', 3)
      .style('display', showLabels ? null : 'none')
      .text(d => showLabels ? labelForNode(d) : '');

    simulation = d3.forceSimulation(baseNodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(55).strength(0.6))
      .force('charge', d3.forceManyBody().strength(-120))
      .force('x', d3.forceX(w/2).strength(0.06))
      .force('y', d3.forceY(h/2).strength(0.06))
      .force('collide', d3.forceCollide().radius(d => (d.type === 'note' ? 14 : 11)))
      .on('tick', () => {
        link.attr('d', d => {
          const s = (typeof d.source === 'object') ? d.source : null;
          const t = (typeof d.target === 'object') ? d.target : null;
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

    // always fit after rendering
    setTimeout(() => { try { fitView(40); } catch(e){} }, 30);
  }







  function renderCurrentViz(preserve){
    if(typeof d3 === 'undefined') return;
    clearError();
    setLoading(false);

    if(!filtered || !filtered.nodes || filtered.nodes.length === 0){
      resetD3Canvas();
      return;
    }

    const mode = String(document.getElementById('vizSelect').value || 'disjoint');
    currentMode = mode;

    // Stop any running force simulation before switching modes
    if(simulation){
      try { simulation.stop(); } catch(e){}
      simulation = null;
    }

    if(mode === 'disjoint'){
      renderDisjointForce(!!preserve);
      return;
    }

    // Hierarchical views need a root tree. We'll build a simple 2-level tree:
    // root -> type buckets -> nodes (leafs sized by degree)
    if(mode === 'icicle'){
      renderIcicle();
      return;
    }
    if(mode === 'treemap'){
      renderTreemap();
      return;
    }
    if(mode === 'sunburst'){
      renderSunburst();
      return;
    }

    // If you pick a not-yet-implemented view, fallback safely
    toast('That view is not enabled yet - falling back to disjoint.', 1100);
    document.getElementById('vizSelect').value = 'disjoint';
    renderDisjointForce(false);
  }

  function buildHierarchyForNodes(){
    // degree map
    const deg = new Map();
    filtered.nodes.forEach(n => deg.set(n.id, 0));
    filtered.edges.forEach(e => {
      deg.set(e.source, (deg.get(e.source)||0) + 1);
      deg.set(e.target, (deg.get(e.target)||0) + 1);
    });

    const buckets = new Map(); // type -> children
    for(const n of filtered.nodes){
      const t = n.type || 'other';
      if(!buckets.has(t)) buckets.set(t, []);
      buckets.get(t).push({
        id: n.id,
        label: n.label || n.id,
        type: n.type,
        filename: n.filename || '',
        value: Math.max(1, deg.get(n.id) || 1),
      });
    }

    const children = [];
    for(const [type, kids] of buckets.entries()){
      // keep things stable by sorting
      kids.sort((a,b) => (b.value - a.value) || String(a.label).localeCompare(String(b.label)));
      children.push({ name: type, type, children: kids });
    }

    children.sort((a,b) => String(a.name).localeCompare(String(b.name)));

    return {
      name: 'GraphNote',
      children
    };
  }

  function renderIcicle(){
    resetD3Canvas();

    const w = elViz.clientWidth || 900;
    const h = elViz.clientHeight || 650;

    const rootData = buildHierarchyForNodes();
    const root = d3.hierarchy(rootData)
      .sum(d => d.value || 0)
      .sort((a,b) => (b.value - a.value));

    d3.partition()
      .size([w, h])
      .padding(1)(root);

    const nodes = root.descendants().filter(d => d.depth > 0);

    const g = gRoot.append('g');

    g.selectAll('rect')
      .data(nodes)
      .join('rect')
      .attr('x', d => d.x0)
      .attr('y', d => d.y0)
      .attr('width', d => Math.max(0, d.x1 - d.x0))
      .attr('height', d => Math.max(0, d.y1 - d.y0))
      .attr('fill', d => {
        const t = d.data.type || d.parent?.data?.type || 'other';
        return nodeColor(t);
      })
      .attr('stroke', '#ffffff')
      .on('click', (event, d) => {
        event.stopPropagation();
        if(d.data && d.data.id) selectNode(d.data.id);
      })
      .on('dblclick', (event, d) => {
        event.stopPropagation();
        if(d.data && d.data.filename) { toast('Opening note...', 650); tryOpenNote(d.data.filename); }
      });

    if(showLabels){
      g.selectAll('text')
        .data(nodes.filter(d => (d.x1 - d.x0) > 45 && (d.y1 - d.y0) > 16))
        .join('text')
        .attr('x', d => d.x0 + 6)
        .attr('y', d => d.y0 + 12)
        .attr('class', labelClass())
        .text(d => {
          // depth 1 = bucket
          if(d.depth === 1) return d.data.name;
          const n = { label: d.data.label, type: d.data.type };
          return labelForNode(n);
        });
    }

    setTimeout(() => { try { fitView(20); } catch(e){} }, 30);
  }

  function renderTreemap(){
    resetD3Canvas();

    const w = elViz.clientWidth || 900;
    const h = elViz.clientHeight || 650;

    const rootData = buildHierarchyForNodes();
    const root = d3.hierarchy(rootData)
      .sum(d => d.value || 0)
      .sort((a,b) => (b.value - a.value));

    d3.treemap()
      .size([w, h])
      .paddingInner(2)
      .paddingOuter(2)(root);

    const leaves = root.leaves();

    const g = gRoot.append('g');

    g.selectAll('rect')
      .data(leaves)
      .join('rect')
      .attr('x', d => d.x0)
      .attr('y', d => d.y0)
      .attr('width', d => Math.max(0, d.x1 - d.x0))
      .attr('height', d => Math.max(0, d.y1 - d.y0))
      .attr('fill', d => nodeColor(d.data.type))
      .attr('stroke', '#ffffff')
      .on('click', (event, d) => { event.stopPropagation(); selectNode(d.data.id); })
      .on('dblclick', (event, d) => {
        event.stopPropagation();
        if(d.data && d.data.filename){ toast('Opening note...', 650); tryOpenNote(d.data.filename); }
      });

    if(showLabels){
      g.selectAll('text')
        .data(leaves.filter(d => (d.x1 - d.x0) > 60 && (d.y1 - d.y0) > 18))
        .join('text')
        .attr('x', d => d.x0 + 6)
        .attr('y', d => d.y0 + 14)
        .attr('class', labelClass())
        .text(d => labelForNode({ label: d.data.label, type: d.data.type }));
    }

    setTimeout(() => { try { fitView(20); } catch(e){} }, 30);
  }

  function renderSunburst(){
    resetD3Canvas();

    const w = elViz.clientWidth || 900;
    const h = elViz.clientHeight || 650;
    const r = Math.min(w, h) / 2;

    const rootData = buildHierarchyForNodes();
    const root = d3.hierarchy(rootData)
      .sum(d => d.value || 0)
      .sort((a,b) => (b.value - a.value));

    d3.partition()
      .size([2 * Math.PI, r])
      .padding(0)(root);

    const arc = d3.arc()
      .startAngle(d => d.x0)
      .endAngle(d => d.x1)
      .innerRadius(d => d.y0)
      .outerRadius(d => d.y1);

    const g = gRoot.append('g')
      .attr('transform', 'translate(' + (w/2) + ',' + (h/2) + ')');

    const nodes = root.descendants().filter(d => d.depth > 0);

    g.selectAll('path')
      .data(nodes)
      .join('path')
      .attr('d', arc)
      .attr('fill', d => {
        const t = d.data.type || d.parent?.data?.type || 'other';
        return nodeColor(t);
      })
      .attr('stroke', '#ffffff')
      .on('click', (event, d) => {
        event.stopPropagation();
        if(d.data && d.data.id) selectNode(d.data.id);
      })
      .on('dblclick', (event, d) => {
        event.stopPropagation();
        if(d.data && d.data.filename){ toast('Opening note...', 650); tryOpenNote(d.data.filename); }
      });

    if(showLabels){
      g.selectAll('text')
        .data(nodes.filter(d => (d.x1 - d.x0) > 0.12 && (d.y1 - d.y0) > 14))
        .join('text')
        .attr('transform', d => {
          const angle = ((d.x0 + d.x1) / 2) * 180 / Math.PI - 90;
          const radius = (d.y0 + d.y1) / 2;
          return 'rotate(' + angle + ') translate(' + radius + ',0) rotate(' + (angle < 90 ? 0 : 180) + ')';
        })
        .attr('dy', '0.32em')
        .attr('text-anchor', d => (((d.x0 + d.x1) / 2) < Math.PI) ? 'start' : 'end')
        .attr('class', labelClass())
        .text(d => {
          if(d.depth === 1) return d.data.name;
          return labelForNode({ label: d.data.label, type: d.data.type });
        });
    }

    // for sunburst, fitting isn't as useful, but keep consistent
    setTimeout(() => { try { fitView(20); } catch(e){} }, 30);
  }



  
  // UI wiring
  document.getElementById('btnFit').onclick = () => { toast('Fitting...', 650); fitView(40); };
  document.getElementById('btnRelayout').onclick = () => { toast('Relayout...', 650); renderCurrentViz(false); };
  document.getElementById('btnRebuild').onclick = () => { toast('Rebuild requested...', 900); window.location.href = ${JSON.stringify(
    rebuildURL
  )}; };

  document.getElementById('toggleCalendar').onclick = () => { showCalendar = !showCalendar; updateToggleUI(); applyFilters(); persistSettings(); };
  document.getElementById('toggleTags').onclick = () => { showTags = !showTags; updateToggleUI(); applyFilters(); persistSettings(); };
  document.getElementById('toggleMentions').onclick = () => { showMentions = !showMentions; updateToggleUI(); applyFilters(); persistSettings(); };
  document.getElementById('toggleExternal').onclick = () => { showExternal = !showExternal; updateToggleUI(); applyFilters(); persistSettings(); };
  document.getElementById('toggleLabels').onclick = () => {
    showLabels = !showLabels;
    updateToggleUI();
    updateForceLabelsOnly();
    persistSettings();
    setTimeout(() => { try { fitView(40); } catch(e){} }, 60);
  };

  document.getElementById('labelDensity').addEventListener('change', (e) => {
    labelDensity = String(e.target.value || 'med');
    updateForceLabelsOnly();
    setTimeout(() => { try { fitView(40); } catch(e){} }, 60);
  });

  document.getElementById('filterInput').addEventListener('input', applyFilters);

  document.getElementById('vizSelect').addEventListener('change', () => {
    renderCurrentViz(false);
    persistSettings();
    setTimeout(() => { try { fitView(40); } catch(e){} }, 120);
  });

  // APPLY settings to UI controls on load
  (function applySettingsToControls(){
    const vs = document.getElementById('vizSelect');
    vs.value = currentMode;
    const ld = document.getElementById('labelDensity');
    ld.value = labelDensity;
    updateToggleUI();
  })();

  setLoading(true);
  updateToggleUI();

  window.setGraphData = function(payload){
    try{
      if(typeof d3 === 'undefined'){
        setLoading(false);
        setError("D3 failed to load. Confirm d3.v7.min.js exists and is the UMD build.");
        return;
      }

      clearError();

      const nodes = Array.isArray(payload.nodes) ? payload.nodes : [];
      const edges = Array.isArray(payload.edges) ? payload.edges : [];
      graphData = { nodes, edges };

      document.getElementById('buildLine').textContent = 'BUILD: ' + (payload.buildId || '-');
      document.getElementById('countsLine').textContent = 'Notes/Nodes: ' + nodes.length + ' - Edges: ' + edges.length;

      applyFilters();
      setLoading(false);
      setTimeout(() => { try { fitView(40); } catch(e){} }, 60);
    } catch(err){
      setLoading(false);
      setError('Failed to render graph: ' + (err && err.message ? err.message : String(err)));
    }
  };
</script>
</body>
</html>`
}

/* -----------------------------
   Helpers
----------------------------- */

function safeTitle(note) {
  const t = note && note.title ? String(note.title).trim() : ''
  if (t) return t
  const fn = note && note.filename ? String(note.filename) : ''
  if (!fn) return ''
  const base = fn.split('/').pop() || fn
  return base.replace(/\.md$/i, '').replace(/\.txt$/i, '')
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

function escapeHTML(s) {
  const str = String(s || '')
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/* -----------------------------
   Make commands visible to NotePlan
----------------------------- */
globalThis.graphnote = graphnote
globalThis.rebuildGraphIndex = rebuildGraphIndex
globalThis.onSettingsUpdated = onSettingsUpdated