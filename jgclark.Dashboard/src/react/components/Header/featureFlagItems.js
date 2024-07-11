// @flow
// Last updated 2024-07-10 for v2.0.1 by @jgclark

import type { TDropdownItem, TDashboardConfig } from "../../../types.js"


const featureFlagSettingDefs = [
    { key: 'FFlag_ForceInitialLoadForBrowserDebugging', label: 'Force Full Initial Load', description: 'Rather than incremental section loading, force full initial load. Mostly useful for testing full data in a browser.' },
    { key: 'FFlag_LimitOverdues', label: 'Limit Overdues to Last 2w', description: 'Pull overdues from last 2 weeks only. Requires a refresh after setting.' },
    { key: 'FFlag_HardRefreshButton', label: 'Show Hard Refresh Button', description: 'Show button that does a full window reload with changed React components and data' },
]

export const createFeatureFlagItems = (dashboardSettings: TDashboardConfig): Array<TDropdownItem> => {
    return featureFlagSettingDefs.map(setting => ({
        label: setting.label,
        key: setting.key,
        type: 'switch',
        checked: (typeof dashboardSettings !== undefined && dashboardSettings[setting.key]) ?? false,
        description: setting.description,
    }))
}
