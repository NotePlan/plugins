// @flow
// Last updated 2026-09-15 for v2.4.4 by @jgclark

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
  { key: 'FFlag_ShowSearchPanel', label: 'Show Search Panel', description: 'Show more advanced search panel with search bar and controls' },
  { key: 'FFlag_ShowSectionTimings', label: 'Show Section Timings', description: 'Show timings for how long it took to generate sections' },
  { key: 'FFlag_DynamicAddToAnywhere', label: 'Dynamic Add To Anywhere', description: 'Use new DynamicDialog-based add task dialog instead of QuickCapture plugin' },
]

export const createFeatureFlagItems = (dashboardSettings: TDashboardSettings): Array<TSettingItem> => {
  return featureFlagSettingDefs.map((setting) => ({
    label: setting.label,
    key: setting.key,
    type: 'switch',
    checked: Boolean(dashboardSettings[setting.key]),
    description: setting.description,
  }))
}
