# TemplateJS-Block Freeze — Diagnostic Throw Locations

Add **one** `throw new Error('DIAG-N: ...')` at a time at these spots. Run the form with a non-empty templatejs block. If you see the error, the freeze is **after** that spot; if the app freezes before the error, the freeze is **at or before** that spot. Move to the next N.

All locations are in **`dwertheimer.Forms/src/formSubmission.js`**.

---

## 1. processCreateNew — before getTemplatingContext

**Function:** `processCreateNew`  
**Place:** Right before `const templatingContext = await getTemplatingContext(formValuesForRendering)` (around line 1028)

```js
  logDebug(pluginJson, `processCreateNew: [DIAG] about to getTemplatingContext`)
  throw new Error('DIAG-1: before getTemplatingContext')
  const templatingContext = await getTemplatingContext(formValuesForRendering)
```

**If you see DIAG-1:** Freeze is in or after `getTemplatingContext`. Try spot 2 next.

---

## 2. processCreateNew — after getTemplatingContext

**Function:** `processCreateNew`  
**Place:** Right after `getTemplatingContext` returns (around line 1029)

```js
  const templatingContext = await getTemplatingContext(formValuesForRendering)
  throw new Error('DIAG-2: after getTemplatingContext')
  logDebug(pluginJson, `processCreateNew: [DIAG] getTemplatingContext done`)
```

**If you see DIAG-2:** Freeze is after getTemplatingContext (e.g. in extract/execute). Try spot 3.

---

## 3. processCreateNew — before extractTemplateJSBlocks

**Function:** `processCreateNew`  
**Place:** Right before `const templateJSBlocks = extractTemplateJSBlocks(...)` (around line 1064)

```js
  // Step 5: Extract and execute templatejs blocks
  throw new Error('DIAG-3: before extractTemplateJSBlocks')
  const templateJSBlocks = extractTemplateJSBlocks(formFields, 'after')
```

**If you see DIAG-3:** Freeze is in extractTemplateJSBlocks or executeTemplateJSBlocks. Try spot 4.

---

## 4. extractTemplateJSBlocks — first line inside function

**Function:** `extractTemplateJSBlocks`  
**Place:** First line inside the function (around line 296)

```js
function extractTemplateJSBlocks(formFields: Array<Object>, executeTiming?: string): ... {
  throw new Error('DIAG-4: inside extractTemplateJSBlocks start')
  const blocks: Array<...> = []
```

**If you see DIAG-4:** Freeze is in extractTemplateJSBlocks (forEach/sanitize/sort). Try spot 5.

---

## 5. extractTemplateJSBlocks — after forEach, before return

**Function:** `extractTemplateJSBlocks`  
**Place:** After the `formFields.forEach(...)`, before `blocks.sort` (around line 311)

```js
  })
  throw new Error('DIAG-5: extractTemplateJSBlocks after forEach before sort')
  blocks.sort((a, b) => a.order - b.order)
  return blocks
```

**If you see DIAG-5:** Freeze is in the forEach (or sanitizeTemplateJSCode used there). If you never see DIAG-5, freeze is inside the forEach.

---

## 6. processCreateNew — after extractTemplateJSBlocks, before executeTemplateJSBlocks

**Function:** `processCreateNew`  
**Place:** Right after `extractTemplateJSBlocks` returns, before `executeTemplateJSBlocks` (around line 1066)

```js
  const templateJSBlocks = extractTemplateJSBlocks(formFields, 'after')
  throw new Error('DIAG-6: after extract before executeTemplateJSBlocks')
  logDebug(pluginJson, `processCreateNew: [DIAG] about to executeTemplateJSBlocks`)
  const fullContext = await executeTemplateJSBlocks(templateJSBlocks, templatingContext, reactWindowData)
```

**If you see DIAG-6:** Freeze is in executeTemplateJSBlocks. Try spot 7.

---

## 7. executeTemplateJSBlocks — first line inside function

**Function:** `executeTemplateJSBlocks`  
**Place:** First line inside the function (around line 435)

```js
async function executeTemplateJSBlocks(blocks: Array<...>, initialContext: Object, reactWindowData: PassedData): Promise<Object | null> {
  throw new Error('DIAG-7: executeTemplateJSBlocks entry')
  const templatejsBlockKeys = new Set(blocks.map((b) => b.field?.key).filter(Boolean))
```

**If you see DIAG-7:** Freeze is in context copy or the block loop. Try spot 8.

---

## 8. executeTemplateJSBlocks — after templatejsBlockKeys, before try (context copy)

**Function:** `executeTemplateJSBlocks`  
**Place:** After `const templatejsBlockKeys = ...`, before the `try { const keys = Object.keys(initialContext) ...` (around line 440)

```js
  const templatejsBlockKeys = new Set(blocks.map((b) => b.field?.key).filter(Boolean))
  throw new Error('DIAG-8: before initialContext copy')
  let context: { [string]: any } = {}
  try {
    const keys = Object.keys(initialContext)
```

**If you see DIAG-8:** Freeze is in the `Object.keys(initialContext)` / for-loop copy. Try spot 9.

---

## 9. executeTemplateJSBlocks — after try/catch copy, before for-loop

**Function:** `executeTemplateJSBlocks`  
**Place:** After the try/catch that builds `context`, before `for (let blockIndex = ...)` (around line 449)

```js
  } catch (e) {
    logError(pluginJson, `executeTemplateJSBlocks: failed to copy initialContext keys: ...`)
    return null
  }
  throw new Error('DIAG-9: after context copy before block loop')
  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
```

**If you see DIAG-9:** Freeze is in the loop or inside executeTemplateJSBlock. Try spot 10.

---

## 10. executeTemplateJSBlocks — inside for-loop, before executeTemplateJSBlock call

**Function:** `executeTemplateJSBlocks`  
**Place:** Inside the for-loop, right before `executeTemplateJSBlock(...)` (around line 451)

```js
  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
    const { field, code } = blocks[blockIndex]
    throw new Error('DIAG-10: before executeTemplateJSBlock call')
    const result = await executeTemplateJSBlock(field, code, context, blockIndex, reactWindowData)
```

**If you see DIAG-10:** Freeze is inside executeTemplateJSBlock. Try spot 11.

---

## 11. executeTemplateJSBlock — first line inside try

**Function:** `executeTemplateJSBlock`  
**Place:** First line inside the `try {` (around line 361)

```js
  try {
    throw new Error('DIAG-11: executeTemplateJSBlock try start')
    logDebug(pluginJson, `executeTemplateJSBlock: Executing templatejs block from field "${fieldIdentifier}"`)
```

**If you see DIAG-11:** Freeze is in logDebug, sanitize, contextVars, functionBody, or Function.apply. Try spot 12.

---

## 12. executeTemplateJSBlock — after sanitizeTemplateJSCode

**Function:** `executeTemplateJSBlock`  
**Place:** Right after `const sanitizedCode = sanitizeTemplateJSCode(code)` (around line 364)

```js
    const sanitizedCode = sanitizeTemplateJSCode(code)
    throw new Error('DIAG-12: after sanitizeTemplateJSCode')
    if (sanitizedCode !== code) {
```

**If you see DIAG-12:** Freeze is in sanitizeTemplateJSCode. If you never see DIAG-12, freeze is in sanitize.

---

## 13. executeTemplateJSBlock — after contextVars build

**Function:** `executeTemplateJSBlock`  
**Place:** Right after `const contextVars = Object.keys(context)...join('\n')` (around line 368)

```js
    const contextVars = Object.keys(context)
      .map((key) => { ... })
      .join('\n')
    throw new Error('DIAG-13: after contextVars build')
    const functionBody = `
```

**If you see DIAG-13:** Freeze is in Object.keys(context) or the .map. If you never see DIAG-13, freeze is there.

---

## 14. executeTemplateJSBlock — after functionBody, before Function.apply

**Function:** `executeTemplateJSBlock`  
**Place:** Right after the `const functionBody = \`...\``, before `Function.apply` (around line 386)

```js
    const functionBody = `
      ${contextVars}
      ...
    `
    throw new Error('DIAG-14: after functionBody before Function.apply')
    const fn = Function.apply(null, ['params', functionBody])
```

**If you see DIAG-14:** Freeze is in Function.apply or fn(context). Try spot 15.

---

## 15. executeTemplateJSBlock — after Function.apply, before fn(context)

**Function:** `executeTemplateJSBlock`  
**Place:** Right after `const fn = Function.apply(...)`, before `const result = fn(context)` (around line 388)

```js
    const fn = Function.apply(null, ['params', functionBody])
    throw new Error('DIAG-15: after Function.apply before fn(context)')
    const result = fn(context)
```

**If you see DIAG-15:** Freeze is in fn(context) — i.e. when the user's block code runs.

---

## 16. executeTemplateJSBlock — after fn(context)

**Function:** `executeTemplateJSBlock`  
**Place:** Right after `const result = fn(context)` (around line 389)

```js
    const result = fn(context)
    throw new Error('DIAG-16: after fn(context)')
    if (result && typeof result === 'object' && !Array.isArray(result)) {
```

**If you see DIAG-16:** Block ran; freeze is in result handling or later in processCreateNew.

---

## Suggested order to try

1. Start with **DIAG-1** (before getTemplatingContext). If you see it → freeze is in or after getTemplatingContext.
2. Then **DIAG-2**. If you see it → freeze is in extract or execute.
3. Then **DIAG-3**. If you see it → freeze is in extractTemplateJSBlocks or executeTemplateJSBlocks.
4. Then **DIAG-6**. If you see it → freeze is in executeTemplateJSBlocks.
5. Then **DIAG-7**. If you see it → freeze is in context copy or block loop.
6. Then **DIAG-8** and **DIAG-9** to see if it’s the context copy.
7. Then **DIAG-10**. If you see it → freeze is inside executeTemplateJSBlock.
8. Then **DIAG-11** → **DIAG-12** → **DIAG-13** → **DIAG-14** → **DIAG-15** → **DIAG-16** to narrow it to a single section.

Remove each throw before adding the next so only one is active at a time.
