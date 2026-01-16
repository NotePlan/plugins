# Options for Providing Templating Context to TemplateJS Blocks

## Current Architecture

### How np.Templating Creates Render Context

1. **`TemplatingEngine.getRenderDataWithMethods()`** - Main function that builds context
   - Creates module instances: `date`, `time`, `note`, `tasks`, `frontmatter`, `helpers`, `web`, `utility`, `system`
   - Merges globals from `loadGlobalHelpers()` (which loads from `globals.js`)
   - Merges userData
   - Adds prompt error handlers
   - Applies custom plugin modules
   - Returns full renderData object

2. **`loadGlobalHelpers()`** - Adds globals to sessionData.methods
   - Loads from `globals.js` (moment, affirmation, advice, etc.)
   - Not exported (private function)

3. **Dependencies:**
   - `TemplatingEngine` needs `templateConfig` (from settings)
   - Module constructors need `templateConfig` for initialization
   - Custom plugin modules are registered per instance

## Options

### Option 1: Import and Create Minimal Context (Recommended)
**Pros:**
- Reuses templating code (globals, modules)
- No changes to np.Templating
- Full access to all templating features

**Cons:**
- Need to import module classes and create instances
- Need templateConfig (can duplicate minimal config or get via command)
- Some complexity in setup

**Implementation:**
```javascript
// Import what we can
import TemplatingEngine from '../../np.Templating/lib/TemplatingEngine'
import globals from '../../np.Templating/lib/globals'
// Or get templateConfig via invokePluginCommandByName if available
// Create minimal TemplatingEngine instance
const engine = new TemplatingEngine(templateConfig, '', [])
const renderContext = await engine.getRenderDataWithMethods('', context)
// Use renderContext in Function constructor
```

### Option 2: Add New Command to np.Templating
**Pros:**
- Clean API
- No duplication
- Always uses latest templating logic

**Cons:**
- Requires editing np.Templating (user said not to)
- Adds new command to maintain

**Implementation:**
```javascript
// In np.Templating, add:
export async function getRenderContext(userData: any = {}): Promise<Object> {
  await NPTemplating.setup()
  const engine = new TemplatingEngine(NPTemplating.templateConfig, '', [])
  return await engine.getRenderDataWithMethods('', userData)
}

// In Forms:
const renderContext = await DataStore.invokePluginCommandByName('getRenderContext', 'np.Templating', [context])
```

### Option 3: Duplicate Context Building Logic
**Pros:**
- No dependencies on np.Templating internals
- Full control

**Cons:**
- Lots of code to duplicate (~100+ lines)
- Must keep in sync with templating changes
- Risk of divergence

### Option 4: Use render() with JSON Wrapper (What We Tried)
**Pros:**
- Uses full templating system
- No duplication

**Cons:**
- Returns strings, need to parse JSON
- More complex error handling
- Performance overhead of full render pipeline

## Recommendation

**Option 1** - Import and create minimal context:
1. Import `TemplatingEngine` and `globals` directly
2. Get or create minimal `templateConfig` (can duplicate minimal config)
3. Create `TemplatingEngine` instance
4. Call `getRenderDataWithMethods()` to get full context
5. Merge into Function constructor parameters

This reuses the templating code without requiring changes to np.Templating.
