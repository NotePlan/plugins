# Chart.js local fallback

The chart summary view loads Chart.js from the CDN first and falls back to a local copy when offline or when the CDN fails.

**One-time setup:** Add the Chart.js UMD bundle so the fallback works:

1. Download: https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js  
2. Save it in this folder as: `chart.umd.min.js`

Or from the terminal (from repo root):

```bash
curl -sL "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js" -o "jgclark.Summaries/requiredFiles/chart.umd.min.js"
```

The plugin lists `chart.umd.min.js` and `chartStats.css` in `plugin.requiredFiles` so NotePlan copies them when installing/updating. The chart summary HTML loads `chartStats.css` at runtime via a `<link>` tag; chart heights are still set from CONFIG via inline CSS variables.
