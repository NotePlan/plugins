# React / HTML / WebView conventions

Canonical reference for NotePlan React and HTML plugin UI. Cursor injects a short
always-on reminder via `.cursor/rules/html-react-rules.mdc` -- this file is the
full text.

## Imports and build

- Never use `require` or dynamic/inline imports -- static `import` at the top of
  the file only. Rollup will not process dynamic imports correctly.
- Do not run `npm run build`. Leave building to the programmer (Rollup /
  `npc plugin:dev`). Tooling is described in the root `README.md`.

## Globals

`DataStore`, `CommandBar`, `Editor`, `NotePlan`, and other NotePlan globals are
available without importing.

## DIV class names

Any DIV you create or edit must have a human-understandable class name so
debugging is easier.

## Promise polyfills

Do not use raw `Promise.resolve`, `Promise.all`, or `Promise.race` in plugin
code -- NotePlan's JSContext may not have them. Use polyfills from
`@helpers/promisePolyfill.js`:

- `initPromisePolyfills()`
- `promiseResolve()`, `promiseAll()`, `promiseRace()`
- `waitForCondition()`, `setTimeoutPolyfill()`

After creating or modifying notes, call `DataStore.updateCache(note, true)`.

## React function memoization (critical)

**Always** wrap functions passed to React Context or child components in
`useCallback`. Unstable references cause infinite render loops that crash the app.

```javascript
// Wrong -- causes infinite loops
const requestFromPlugin = (command: string, dataToSend: any = {}) => { ... }

// Correct -- stable function reference
const requestFromPlugin = useCallback((command: string, dataToSend: any = {}) => {
  // ...
}, [dispatch])
```

Functions that must be memoized:

- `requestFromPlugin`, `sendActionToPlugin`, `sendToPlugin`
- Any function passed to `AppProvider` props
- Any function used in `useEffect` dependency arrays

AppContext must use `useMemo`:

```javascript
const contextValue = useMemo(() => ({
  sendActionToPlugin, sendToPlugin, requestFromPlugin, dispatch, pluginData
}), [sendActionToPlugin, sendToPlugin, requestFromPlugin, dispatch, pluginData])
```

This has caused infinite loops many times. Verify memoization before considering
React work complete.

Detailed examples: `dwertheimer.ReactSkeleton/REACT_COMMUNICATION_PATTERNS.md`

## DynamicDialog

Use `DynamicDialog` instead of custom dialog components. Handlers must be wrapped
in `useCallback`. Guide:
`helpers/react/DynamicDialog/CREATING_NEW_DYNAMICDIALOG_FIELD_TYPES.md`

## NotePlan theme colours

Use these CSS variables with default fallbacks. **Do not invent new CSS variables.**

```css
--bg-main-color: #eff1f5;
--fg-sidebar-color: #242E32;
--bg-sidebar-color: #ECECEC;
--divider-color: #CDCFD0;
--block-id-color: #79A0B5;
--fg-main-color: #4c4f69;
--h1-color: #5c5f77;
--h2-color: #5c5f77;
--h3-color: #5c5f77;
--bg-alt-color: #e6e9ef;
--tint-color: #dc8a78;
--bg-mid-color: #ebedf2;
--bg-apple-input-color: #fbfbfb;
--bg-apple-switch-color: #dadada;
--fg-apple-switch-color: #ffffff;
--bg-apple-button-color: #fcfcfc;
--item-icon-color: #1e66f5;
--fg-done-color: #04a5e5;
--fg-canceled-color: #4F57A0E0;
--hashtag-color: inherit;
--attag-color: inherit;
--code-color: #0091f8;
--fg-placeholder-color: rgba(76, 79, 105, 0.7);
--fg-error-color: #b85450;
--bg-error-color: #f5e6e6;
--fg-disabled-color: #999999;
--bg-disabled-color: #f5f5f5;
```

Example: `background: var(--bg-main-color, #eff1f5);`
