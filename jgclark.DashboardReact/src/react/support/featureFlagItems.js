// @flow
import type { TDropdownItem, TSharedSettings } from "../../types.js"


const featureFlagSettings = [
    { key: 'FFlag_AutoRefresh', label: 'Auto Refresh', tooltip: 'Enable Automatic Refreshing' },
    { key: 'FFlag_DashboardSettings', label: 'Dashboard Settings', tooltip: 'Show ReactDashboard Settings' },
    { key: 'FFlag_OverdueProcessing', label: 'Overdue Processing', tooltip: 'Toggle processing of overdue items' },
    { key: 'FFlag_MetaTooltips', label: 'Meta Tooltips', tooltip: 'Show tooltips for meta information' },
    { key: 'FFlag_ForceInitialLoad', label: 'Force Full Initial Load', tooltip: 'Rather than incremental section loading, force full initial load. Mostly useful for testing full data in a browser.' },
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
