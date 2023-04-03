// @flow

export { publish, unpublish } from './NPPluginMain'

// FETCH mocking for offline testing
// If you want to use external server calls in your plugin, it can be useful to mock the server responses
// while you are developing the plugin. This allows you to test the plugin without having to
// have a server running or having to have a network connection (or wait/pay for the server calls)
// Comment the following import line out if you want to use live fetch/server endpoints (normal operation)
// Uncomment it for using server mocks (fake/canned responses) you define in support/fetchOverrides.js
// import './support/fetchOverrides'

// eslint-disable-next-line import/order
export { editSettings } from '@helpers/NPSettings'
export { onUpdateOrInstall, init, onSettingsUpdated, versionCheck } from './NPTriggers-Hooks'
export { onOpen, onEditorWillSave } from './NPTriggers-Hooks'
export { onMessageFromHTMLView } from './NPMessagesFromHTMLWindow'
