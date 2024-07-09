// @flow
// Last updated 2024-07-09 for v2.0.1 by @jgclark

import type { TDropdownItem, TDashboardConfig } from "../../../types.js"


const featureFlagSettingDefs = [
    { key: 'FFlag_ForceInitialLoadForBrowserDebugging', label: 'Force Full Initial Load', tooltip: 'Rather than incremental section loading, force full initial load. Mostly useful for testing full data in a browser.' },
    { key: 'FFlag_LimitOverdues', label: 'Limit Overdues to Last 2w', tooltip: 'Pull overdues from last 2 weeks only. Requires a refresh after setting.' },
    { key: 'FFlag_HardRefreshButton', label: 'Show Hard Refresh Button', tooltip: 'Show button that does a full window reload with changed React components and data' },
]

export const createFeatureFlagItems = (dashboardSettings: TDashboardConfig /*, pluginSettings: TAnyObject */): Array<TDropdownItem> => {
    return featureFlagSettingDefs.map(setting => ({
        label: setting.label,
        key: setting.key,
        type: 'switch',
        checked: (typeof dashboardSettings !== undefined && dashboardSettings[setting.key]) ?? /* pluginSettings[setting.key] ?? */ false,
        tooltip: setting.tooltip,
    }))
}
