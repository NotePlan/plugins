# NPTemplating Refactoring Plan

## Overview
This plan outlines the steps to refactor the large `NPTemplating.js` and `TemplatingEngine.js` files into a more maintainable modular structure while ensuring backward compatibility.

## Directory Structure
- `np.Templating/lib/`
  - `core/` - Core functionality and classes
  - `utils/` - Utility functions
  - `config/` - Configuration handling
  - `handlers/` - Event and tag handlers
  - `modules/` - Template modules (calendar, date, etc.)
    - `pluginIntegration.js` - Plugin interaction functions
  - `rendering/` - Template rendering functionality
  - `support/modules/prompts/` - Prompt handling and registry

## Function Categorization

### Utility Functions (moved to utils/)
- [x] `dt()` - Date/time formatting
- [x] `normalizeToNotePlanFilename()`
- [x] `extractTitleFromMarkdown()`
- [x] `getProperyValue()`
- [x] `mergeMultiLineStatements()`
- [x] `protectTemplateLiterals()`
- [x] `restoreTemplateLiterals()`
- [x] `formatTemplateError()`
- [x] `selection()`

### Tag Handling Functions (moved to core/tagUtils.js)
- [x] `isCommentTag()`
- [x] `codeBlockHasComment()`
- [x] `blockIsJavaScript()`
- [x] `getCodeBlocks()`
- [x] `getIgnoredCodeBlocks()`
- [x] `convertJavaScriptBlocksToTags()`
- [x] `getTags()`
- [x] `isCode()`
- [x] `isTemplateModule()`
- [x] `isVariableTag()`
- [x] `isMethod()`

### Configuration Functions (moved to config/configManager.js)
- [x] `DEFAULT_TEMPLATE_CONFIG`
- [x] `getDefaultTemplateConfig()`
- [x] `TEMPLATE_CONFIG_BLOCK()`
- [x] `getTemplateFolder()`
- [x] `getSettings()`
- [x] `getSetting()`
- [x] `putSetting()`
- [x] `heartbeat()`
- [x] `updateOrInstall()`
- [x] `setup()`

### Template Management (moved to core/templateManager.js)
- [x] `getTemplateList()`
- [x] `getTemplateListByTags()`
- [x] `chooseTemplate()`
- [x] `getTemplate()`
- [x] `getTemplateAttributes()`
- [x] `getFilenameFromTemplate()`
- [x] `createTemplate()`
- [x] `templateExists()`
- [x] `getFolder()`
- [x] `getNote()`

### Template Processing (moved to rendering/templateProcessor.js)
- [x] `preProcess()`
- [x] `_processCommentTag()`
- [x] `_processNoteTag()`
- [x] `_processCalendarTag()`
- [x] `_processReturnTag()`
- [x] `_processCodeTag()`
- [x] `_processIncludeTag()`
- [x] `_processVariableTag()`
- [x] `processStatementForAwait()`
- [x] `_getValueType()`
- [x] `preProcessNote()`
- [x] `preProcessCalendar()`
- [x] `preRender()`
- [x] `importTemplates()`
- [x] `render()`
- [x] `renderTemplate()`
- [x] `validateTemplateTags()`
- [x] `_getErrorContextString()`
- [x] `postProcess()`
- [x] `_filterTemplateResult()`
- [x] `_frontmatterError()`
- [x] `_removeWhitespaceFromCodeBlocks()`
- [x] `execute()`

### User Input/Prompts (moved to support/modules/prompts/)
- [x] `promptDate()`
- [x] `promptDateInterval()`
- [x] `parsePromptKeyParameters()`
- [x] `prompt()`
- [x] `getPromptParameters()`

### Plugin Integration (moved to modules/pluginIntegration.js)
- [x] `isCommandAvailable()`
- [x] `invokePluginCommandByName()`
- [x] `templateErrorMessage()`

## Progress Tracking

### Completed
- [x] Created directory structure
- [x] Extracted string utility functions to utils/stringUtils.js
- [x] Extracted tag handling functions to core/tagUtils.js
- [x] Extracted configuration functions to config/configManager.js
- [x] Extracted template management functions to core/templateManager.js
- [x] Extracted template processing functions to rendering/templateProcessor.js
- [x] Updated imports in NPTemplating.js
- [x] Created wrapper methods for backward compatibility
- [x] Consolidated prompt handling via PromptRegistry
- [x] Centralized prompt functions in prompts/handlers
- [x] Extracted plugin integration functions to modules/pluginIntegration.js
- [x] Updated TemplatingEngine.js to use the new modular structure

### In Progress
- [✓] All refactoring tasks completed

### Next Steps
1. ✓ Extract tag handling functions
2. ✓ Extract configuration functions
3. ✓ Extract template management functions
4. ✓ Extract template processing functions
   - ✓ Add render and preRender functions to templateProcessor.js
   - ✓ Add importTemplates and execute functions
   - ✓ Add postProcess function
5. ✓ Update NPTemplating.js to use the new template processor functions
6. ✓ Extract prompt-related functions to a separate module
7. ✓ Extract plugin integration functions to a separate module
8. ✓ Update TemplatingEngine.js to use the new modular structure

### Technical Challenges
- Some template processing functions like render, preRender have complex dependencies and interrelationships
- Many functions reference this.constructor.templateConfig, which needs to be handled differently in the modular approach
- Complex stateful operations in original code that need careful refactoring to preserve behavior

## Backward Compatibility
NPTemplating.js will remain in the root lib directory and act as a facade, re-exporting functionality from the new modular structure to maintain backward compatibility with existing code that imports from the original location. 

## Refactoring Complete
The refactoring of the NPTemplating codebase is now complete. The system has been restructured into a more maintainable modular architecture with clear separation of concerns:

1. **Core functionality** has been organized into distinct modules
2. **Utility functions** have been extracted to utils/
3. **Configuration handling** has been centralized in config/
4. **Prompt handling** has been unified through the PromptRegistry pattern
5. **Plugin integration** functions have been moved to a dedicated module
6. **Template processing** has been reorganized into the rendering module
7. **NPTemplating.js** now acts as a facade with wrapper methods for backward compatibility
8. **TemplatingEngine.js** has been updated to use the new modular structure

This refactoring improves maintainability, testability, and extensibility while preserving backward compatibility. 