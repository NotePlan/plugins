# Using Flow in this repo

Notes from the upgrade of `flow-bin` from 0.245.2 to 0.286.0 (September 2026).
The project typechecks clean on 0.286.0 after the changes described here.

## Why 0.286.0

The pre-push hook runs `npx --no-install flow`. That resolves to
`node_modules/flow-bin`. `flow-bin` 0.245.2 shipped only an x86_64 macOS
binary. On Apple Silicon, Node is arm64, so spawning that binary fails with
errno -86. The hook treats any non-zero exit as type errors.

0.286.0 is the first `flow-bin` release with an arm64 macOS binary
(`flow-osx-arm64-v0.286.0/flow`). From 0.286 onward the macOS package is
arm64 only. We pinned the smallest arm64 version, not the latest, to limit
typechecker drift:

```json
"flow-bin": "^0.286.0"
```

The caret on `0.x` only allows 0.286.x.

Confirm the binary before a long check:

```bash
npx --no-install flow version
```

## How to run a check

Save indented JSON so a human can read it. A shell redirect of
`flow check --json` has failed to create the output file even when Flow
exited non-zero. Capture stdout in Python, then pretty-print:

```bash
python3 - << 'PY'
import json, subprocess
proc = subprocess.run(
    ['npx', '--no-install', 'flow', 'check', '--json'],
    capture_output=True,
)
data = json.loads(proc.stdout)
open('/tmp/flow-check-now.json', 'w').write(json.dumps(data, indent=2) + '\n')
print('exit', proc.returncode, 'errors', len(data.get('errors') or []), 'passed', data.get('passed'))
PY
```

A clean check on this machine has finished in about 90 seconds. A cold check,
or one with more than a thousand errors, has taken 11 to 13 minutes. Wait at
least 12 minutes before treating a run as hung. Flow can also throw
`ECheckTimeout` on very large files and still finish with JSON.

`flow check` exit 2 means type errors. Exit 8 with `Invalid_flowconfig` means
the config was rejected and nothing was typechecked.

Do not run `npm run build` for plugins as part of a typecheck.

## What `[ignore]` does and does not do

`.flowconfig` ignores `flow-typed/**/*.*` as source files, and lists
`flow-typed` under `[libs]`. Library files are still typechecked. There is no
setting that keeps a libdef loaded and hides errors inside it. Dropping a
libdef turns its imports into untyped-import errors, because
`module.use_strict=true`.

`[declarations]` applies to source files, not to `[libs]`.

## Bundled libraries that Flow stopped shipping

Flow 0.245's `lib/` directory included `dom.js`, `bom.js`, `node.js`,
`cssom.js`, `intl.js`, `react-dom.js`, and others. Flow 0.262 stopped
maintaining most of those. Flow 0.270's `lib/` directory is only `core.js`
and `react.js`. The built-in `react.js` keeps a stub `$JSXIntrinsics`
(`[string]: { instance: any, props: any }`). It does not declare `window`,
`document`, `process`, HTML element classes, or the old `Synthetic*` event
globals.

The official replacement is the flow-typed environment definitions for
`flow_v0.261.x-` (that range covers 0.286). They live in this repo at
`flow-typed/environments/`, so `[libs] flow-typed` loads them:

- `dom.js`, `bom.js`, `html.js`, `cssom.js`, `geometry.js`
- `node.js`, `intl.js`, `indexeddb.js`, `serviceworkers.js`
- `streams.js`, `web-animations.js`, `webassembly.js`

Source: `definitions/environments/<name>/flow_v0.261.x-` on
`flow-typed/flow-typed`, branch `main`.

Do not also copy `jsx.js` from that set. It redeclares `$JSXIntrinsics`,
which the bundled `react.js` already declares, and that is a
`libdef-override` error. The stub intrinsics are enough for this repo. The
`Synthetic*` classes that used to live in that file are copied into
`flow-typed/npmLibdefShims.js` instead.

`flow-typed.config.json` is only read by the `flow-typed` CLI. Flow itself
does not need it. These files are vendored so a check does not depend on that
CLI.

### Names NotePlan must keep

`flow-typed/Noteplan.js` declares the plugin globals `fetch`, `Range`, and
`Clipboard`. The environment files declare different types with the same
names (browser `fetch` returns `Promise<Response>`, DOM `Range` is a
selection, DOM `Clipboard` extends `EventTarget`). Two `declare`s of the same
name are a `libdef-override` error.

The environment copies of those three names are removed or not referenced:

- `bom.js` does not declare `fetch` or `class Clipboard`. `navigator.clipboard` is `any`.
- `dom.js` does not declare `class Range`.

Plugin code keeps NotePlan's `fetch` (`Promise<string>` and `FetchOptions`), character-offset `Range`, and static `Clipboard`.

### `flow-typed/npmLibdefShims.js`

Small globals the npm libdefs still name, which 0.286 does not provide:

- `React$Component`, because `flow-typed/npm/react-dom_v18.x.x.js` still uses it. Application code should use `React.Component`.
- `SyntheticEvent`, `SyntheticInputEvent`, `SyntheticKeyboardEvent`, `SyntheticMouseEvent`, `SyntheticDragEvent`, `SyntheticFocusEvent`, and the other `Synthetic*` classes.

Class bodies in a libdef need a separator between members. Use a trailing comma. A newline alone is a parse error: `Unexpected identifier, expected the token ","`.

Do not redeclare `window`, `document`, `Element`, `Buffer`, `http`, `fs`, or `https` in the shim. The environment files already declare them. A second declaration is `libdef-override`. An incomplete stand-in (for example an empty `HTMLElement`) also hides real properties such as `style` and `querySelector` and creates `prop-missing` errors in app code.

`node.js` declares `Buffer`, `stream$Readable`, `http$ClientRequest`, and the `fs`, `http`, `https`, and `path` modules. That is what the axios, webpack, node-fetch, and Jest libdefs need.

## Flow 0.280 through 0.286 breaks

These are the changes that produced errors in this repo.

### Removed utility types

`$PropertyType` and `$ElementType` are gone. Use indexed access.

```javascript
// before
filename: $PropertyType<Project, 'filename'>

// after
filename: Project['filename']
```

`lodash-es_v4.x.x.js` and `webpack_v4.x.x.js` were updated the same way. There is no newer published lodash-es libdef. The installed package is already 4.17.21.

### Suppressions

`suppress_type` in `.flowconfig` is rejected. `$FlowFixMe` is built in.

`$FlowIgnore` is not a suppression comment as of 0.281. A comment that still says `$FlowIgnore` does nothing, so the error comes back. Replace it with `$FlowFixMe`, and use the error code Flow is reporting now. Several old `[incompatible-return]` and `[prop-missing]` codes are `[incompatible-type]` on 0.286.

A suppression must include the code. `$FlowFixMe` with no code does not apply. One `$FlowFixMe[incompatible-type]` covers every `incompatible-type` error on the next line.

The comment has to be a real JavaScript comment on the previous line. A `//` line placed in JSX children does not suppress the following expression. In JSX, put the comment in a JSX comment immediately above the expression:

```jsx
{/* $FlowFixMe[constant-condition] debug flag is false in the type and true when the plugin passes it */}
{(ROOT_DEBUG || debug) && (
```

### `React$Node` and other internal types

Outside libdefs, `React$Node` is an `internal-type` error. Use `React.Node`.

`React$ComponentType` does not resolve. Use `React.ComponentType`. That type does not include `ref`. A `forwardRef` component that is rendered with a `ref` cannot be annotated as `React.ComponentType<Props>`. `EditableInputBox` is annotated `any` so callers can still pass `ref`.

`React.AbstractComponent` is not on the `React` namespace in 0.286.

`React$Node` inside `flow-typed/npm/react-dom_v18.x.x.js` is left alone. Internal types are still allowed in libdefs.

### Optional properties are invariant

Exact object properties are invariant. An optional property is invariant too. Passing a fresh object literal fails when:

- an optional field is omitted, or
- a field is a narrower type than the declared one (`false` vs `boolean`, `null` vs `null | Array<...>`).

Flow's message says the property is "invariantly typed" and suggests either annotating the literal with the target type, or making the property readonly.

For option bags that are only read, mark the fields covariant with `+`:

```javascript
export type OverdueSearchOptions = {
  +openOnly: boolean,
  +noteFolder: ?string | false,
  +overdueAsOf?: string,
}
```

The same change is on `FetchOptions` in `flow-typed/Noteplan.js` and on `HtmlWindowOptions` in `helpers/HTMLView.js`. Code that assigns to those fields after creation has to go through a cast, because a `+` field is not writable:

```javascript
;(winOptions: any).width = screenWidth - defaultBorderWidth * 2
```

`validateConfigProperties` takes `$ReadOnly<{ [string]: mixed }>` for the validations argument. A writable `{ [string]: mixed }` indexer will not accept an object whose values are strings, regexes, and small objects.

`Intl$NumberFormatOptions` lives in Flow's bundled `core.js` and has the same invariant optional fields. Annotate the literal:

```javascript
const IntlOpts: Intl$NumberFormatOptions = {
  maximumFractionDigits: 1,
  minimumSignificantDigits: 2,
  maximumSignificantDigits: 3,
}
```

### Constant conditions and invalid comparisons

0.286 reports these as errors, not as lints. `.flowconfig` rejects
`constant-condition=off` and `invalid-compare=off` with
`Invalid lint rule`. They cannot be disabled.

They fire on checks that are intentional at runtime but redundant in the type:

- `if (DEBUG_FLAG)` when the flag is inferred as the literal `true` or `false`
- `if (isObject(x))` when Flow thinks the call is always truthy
- `x === null` when the type does not include `null`
- `value || ''` when `value` is already a non-empty string

Existing guards are suppressed with `$FlowFixMe[constant-condition]` or `$FlowFixMe[invalid-compare]`. Do not delete the runtime check just to satisfy Flow. When a flag is a `const` literal `false` but the real value comes from untyped plugin data, widen it at the use site or suppress that one condition. `(ROOT_DEBUG: boolean)` is not enough: Flow still sees the literal `false`.

### `unsafe-object-assign`

This one is a lint, and it is on by default since 0.285. `.flowconfig` sets `unsafe-object-assign=off`. The existing `Object.assign` calls are copies. The older commented-out lints stay commented out. Turning the whole `[lints]` section on has crashed the VS Code Flow extension before.

### `invalid-computed-prop`

Bracket access with a general `string` on an object that has no indexer is an error, even when the string is a known key written as `obj['key']`. Prefer `obj.key`. If the key really is a string, give the object an indexer:

```javascript
const formats: { [string]: string } = { withDay: ' (EEE, yyyy-MM-dd)' }
```

`console[methodName]` needs a cast. `console`'s methods are declared read-only and the object has no indexer. `PatchableConsole` in `helpers/react/DebugPanel.jsx` is the type used for that cast.

### Parser

Flow 0.286 rejects an expression statement that starts with `!`.

```javascript
// rejected
!hasFeature && logWarn('missing')

// accepted
if (!hasFeature) logWarn('missing')
```

In a `declare` method, the parameter list is a type position. `function` is reserved there. Write `fn: () => any`, not `(function)` and not a bare name with no type.

### Libdef duplicates

`browserify_vx.x.x.js` had two `declare module` blocks for some test modules. Deleting the duplicates left `$Exports<'browserify/test/...'>` pointing at a module that no longer exists. Those exports are `any`.

Stub libdefs that only existed to override a real one were deleted: `fuse.js_vx.x.x.js` (keep `fuse.js_v6.x.x.js`) and `js-yaml_vx.x.x.js` (keep `js-yaml_v4.x.x.js`).

## Pre-push hook

`.githooks/pre-push` runs `npx --no-install flow`. The hook path comes from `package.json` `"prepare": "git config core.hooksPath .githooks"`. Any non-zero exit blocks the push, including a bad binary or an invalid `.flowconfig`. Bypass only when someone explicitly asks: `git push --no-verify`.
