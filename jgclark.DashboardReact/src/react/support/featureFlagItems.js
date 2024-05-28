// @flow
import type { TDropdownItem, TSharedSettings } from "../../types.js"


const featureFlagSettings = [
    { key: 'FFlag_AutoRefresh', label: 'Auto Refresh', tooltip: 'Enable Automatic Refreshing' },
    { key: 'FFlag_DashboardSettings', label: 'Dashboard Settings', tooltip: 'Show ReactDashboard Settings' },
    { key: 'FFlag_InteractiveProcessing', label: 'Interactive Processing', tooltip: 'Toggle interactive processing of items...brings up Dialog for each in sequence.' },
    { key: 'FFlag_MetaTooltips', label: 'Meta Tooltips', tooltip: 'Show tooltips for meta information' },
    { key: 'FFlag_ForceInitialLoad', label: 'Force Full Initial Load', tooltip: 'Rather than incremental section loading, force full initial load. Mostly useful for testing full data in a browser.' },
    { key: 'FFlag_LimitOverdues', label: 'Limit Overdues to Last 2w', tooltip: 'Pull overdues from last 2 weeks only. Requires a refresh after setting.' },
    { key: 'FFlag_HardRefreshButton', label: 'Show Hard Refresh Button', tooltip: 'Show button that does a full window reload with changed React components and data' },
]

export const createFeatureFlagItems = (sharedSettings: TSharedSettings, pluginSettings: TAnyObject): Array<TDropdownItem> => {
    return featureFlagSettings.map(setting => ({
        label: setting.label,
        key: setting.key,
        type: 'switch',
        checked: (typeof sharedSettings !== undefined && sharedSettings[setting.key]) ?? pluginSettings[setting.key] ?? false,
        tooltip: setting.tooltip,
    }))
}
