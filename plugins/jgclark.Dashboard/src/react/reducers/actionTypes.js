// @flow
export const DASHBOARD_ACTIONS = {
  UPDATE_DASHBOARD_SETTINGS: 'dashboardSettingsChanged' /* do not change this because it needs to match the clickHandler name*/,
  // Add other dashboard-related actions here
}

export const PERSPECTIVE_ACTIONS = {
  SET_PERSPECTIVE_SETTINGS: 'perspectiveSettingsChanged' /* do not change this because it needs to match the clickHandler name*/,
  SET_ACTIVE_PERSPECTIVE: 'SET_ACTIVE_PERSPECTIVE',
  // Add other perspective-related actions here (like update etc because all we have is overwrite)
}
