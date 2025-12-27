// @flow
//--------------------------------------------------------------------------
// Test command to open SimpleDialog test component
// Usage: Add this to your plugin.json and call it from NotePlan
//--------------------------------------------------------------------------

import { DataStore } from '@helpers/NPNotePlan'
import { logDebug } from '@helpers/dev'

const pluginJson = {
  'plugin.id': 'helpers',
  'plugin.name': 'helpers',
  'plugin.version': '1.0.0',
}

/**
 * Test SimpleDialog component
 * Opens a React window with the SimpleDialog test component
 */
export async function testSimpleDialog(): Promise<void> {
  try {
    logDebug(pluginJson, 'testSimpleDialog: Starting')
    
    // Make sure np.Shared is available
    await DataStore.installOrUpdatePluginsByID(['np.Shared'], false, false, true)
    
    const data = {
      pluginData: {},
      title: 'SimpleDialog Test',
      logProfilingMessage: false,
      debug: false,
      ENV_MODE: 'development',
      returnPluginCommand: { id: 'helpers', command: 'testSimpleDialog' },
      componentPath: '../helpers/react/SimpleDialog.test.bundle.dev.js',
      startTime: new Date(),
    }
    
    const windowOptions = {
      savedFilename: '../../helpers/simpledialog_test_output.html',
      headerTags: `
        <link rel="stylesheet" href="../np.Shared/css.w3.css">
        <link href="../np.Shared/fontawesome.css" rel="stylesheet">
        <link href="../np.Shared/regular.min.flat4NP.css" rel="stylesheet">
        <link href="../np.Shared/solid.min.flat4NP.css" rel="stylesheet">
        <link href="../np.Shared/light.min.flat4NP.css" rel="stylesheet">
      `,
      windowTitle: 'SimpleDialog Test',
      width: 800,
      height: 600,
      x: 'center',
      y: 'center',
      customId: 'simpledialog-test-window',
      shouldFocus: true,
      generalCSSIn: '', // You may want to add theme CSS here
      postBodyScript: `
        <script type="text/javascript">
        let DataStore = { settings: {_logLevel: "${DataStore.settings._logLevel}" } };
        </script>
      `,
    }
    
    await DataStore.invokePluginCommandByName('openReactWindow', 'np.Shared', [data, windowOptions])
    logDebug(pluginJson, 'testSimpleDialog: Window opened successfully')
  } catch (error) {
    logDebug(pluginJson, `testSimpleDialog: Error: ${error.message || String(error)}`)
    throw error
  }
}

