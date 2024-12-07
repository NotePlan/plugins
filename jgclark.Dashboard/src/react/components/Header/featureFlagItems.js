// @flow
// Last updated 2024-08-22 for v2.1.0.a9 by @jgclark

import type { TSettingItem, TDashboardSettings } from '../../../types.js'

const featureFlagSettingDefs = [
  {
    key: 'FFlag_ForceInitialLoadForBrowserDebugging',
    label: 'Force Full Initial Load',
    description: 'Rather than incremental section loading, force full initial load. Mostly useful for testing full data in a browser.',
  },
  { key: 'FFlag_HardRefreshButton', label: 'Show Hard Refresh Button', description: 'Show button that does a full window reload with changed React components and data' },
  { key: 'FFlag_DebugPanel', label: 'Show Debug Panel', description: 'Show debug pane with test runner and console log viewer at the bottom of the page' },
  { key: 'FFlag_ShowTestingPanel', label: 'Show Testing Pane', description: 'Show testing panel with end-to-end testing buttons (requires Debug Panel)' },
]

export const createFeatureFlagItems = (dashboardSettings: TDashboardSettings): Array<TSettingItem> => {
  return featureFlagSettingDefs.map((setting) => ({
    label: setting.label,
    key: setting.key,
    type: 'switch',
    checked: (typeof dashboardSettings !== undefined && dashboardSettings[setting.key]) ?? false,
    description: setting.description,
  }))
}
