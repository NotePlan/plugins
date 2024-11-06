// @noflow
/* global jest, describe, it, expect, beforeEach */

/**
 * @fileoverview Test suite for the useSyncWithPlugin custom hook.
 */

import * as React from 'react'
import { render, act, waitFor } from '@testing-library/react'
import { useSyncWithPlugin } from '../useSyncWithPlugin'
import { compareObjects } from '@helpers/dev'
import { logDebug } from '@helpers/react/reactDev.js'

describe('useSyncWithPlugin', () => {
  let dispatchMock
  let sendActionToPluginMock

  /**
   * A test component that uses the custom hook with localSettings and pluginSettings.
   * @param {Object} props Component props.
   * @returns {null}
   */
  const TestComponent = ({ localSettings, pluginSettings }) => {
    useSyncWithPlugin(localSettings, pluginSettings, dispatchMock, 'UPDATE_SETTINGS', sendActionToPluginMock, compareObjects)
    return null
  }

  /**
   * A test component for dashboard settings.
   * @param {Object} props Component props.
   * @returns {null}
   */
  const DashboardTestComponent = ({ dashboardSettings, pluginSettings }) => {
    useSyncWithPlugin(dashboardSettings, pluginSettings, dispatchMock, 'UPDATE_DASHBOARD_SETTINGS', sendActionToPluginMock, compareObjects)
    return null
  }

  /**
   * A test component for perspective settings.
   * @param {Object} props Component props.
   * @returns {null}
   */
  const PerspectiveTestComponent = ({ perspectiveSettings, pluginSettings }) => {
    useSyncWithPlugin(perspectiveSettings, pluginSettings, dispatchMock, 'UPDATE_PERSPECTIVE_SETTINGS', sendActionToPluginMock, compareObjects)
    return null
  }

  beforeEach(() => {
    dispatchMock = jest.fn()
    sendActionToPluginMock = jest.fn()
    global.DataStore = { settings: { _logLevel: 'none' } }
  })

  it('should not dispatch or send action if settings are the same (object)', () => {
    const initialSettings = { theme: 'light' }

    render(<TestComponent localSettings={initialSettings} pluginSettings={initialSettings} />)

    expect(dispatchMock).not.toHaveBeenCalled()
    expect(sendActionToPluginMock).not.toHaveBeenCalled()
  })

  it('should not dispatch or send action if settings are the same (array)', () => {
    const initialSettings = ['item1', 'item2']

    render(<TestComponent localSettings={initialSettings} pluginSettings={initialSettings} />)

    expect(dispatchMock).not.toHaveBeenCalled()
    expect(sendActionToPluginMock).not.toHaveBeenCalled()
  })

  it('should dispatch action when pluginSettings change', async () => {
    const initialLocalSettings = { theme: 'light' }
    const newPluginSettings = { theme: 'dark' }

    const { rerender } = render(<TestComponent localSettings={initialLocalSettings} pluginSettings={initialLocalSettings} />)

    // Update pluginSettings prop
    await act(async () => {
      rerender(<TestComponent localSettings={initialLocalSettings} pluginSettings={newPluginSettings} />)
    })

    // Wait for the dispatch to occur
    await waitFor(() => expect(dispatchMock).toHaveBeenCalled())

    /** Calculate the expected diff */
    const expectedDiff = compareObjects(newPluginSettings, initialLocalSettings)

    expect(dispatchMock).toHaveBeenCalledWith({
      type: 'UPDATE_SETTINGS',
      payload: newPluginSettings,
      reason: `UPDATE_SETTINGS changed from plugin: ${JSON.stringify(expectedDiff)}`,
    })
  })

  it('should send action to plugin when localSettings change', async () => {
    const initialLocalSettings = { theme: 'light' }
    const newLocalSettings = { theme: 'dark' }
    const pluginSettings = initialLocalSettings

    const { rerender } = render(<TestComponent localSettings={initialLocalSettings} pluginSettings={pluginSettings} />)

    // Update localSettings prop
    await act(async () => {
      rerender(<TestComponent localSettings={newLocalSettings} pluginSettings={pluginSettings} />)
    })

    // Wait for the action to be sent to the plugin
    await waitFor(() => expect(sendActionToPluginMock).toHaveBeenCalled())

    expect(sendActionToPluginMock).toHaveBeenCalledWith(
      'UPDATE_SETTINGS',
      {
        actionType: 'UPDATE_SETTINGS',
        settings: newLocalSettings,
        logMessage: 'UPDATE_SETTINGS changed',
      },
      'UPDATE_SETTINGS updated',
      true,
    )
  })

  it('should handle array settings correctly (dispatch when pluginSettings change)', async () => {
    const initialLocalSettings = ['item1', 'item2']
    const newPluginSettings = ['item2', 'item3']

    const { rerender } = render(<TestComponent localSettings={initialLocalSettings} pluginSettings={initialLocalSettings} />)

    // Update pluginSettings prop
    await act(async () => {
      rerender(<TestComponent localSettings={initialLocalSettings} pluginSettings={newPluginSettings} />)
    })

    // Wait for the dispatch to occur
    await waitFor(() => expect(dispatchMock).toHaveBeenCalled())

    /** Calculate the expected diff */
    const expectedDiff = compareObjects(newPluginSettings, initialLocalSettings)

    expect(dispatchMock).toHaveBeenCalledWith({
      type: 'UPDATE_SETTINGS',
      payload: newPluginSettings,
      reason: `UPDATE_SETTINGS changed from plugin: ${JSON.stringify(expectedDiff)}`,
    })
  })

  it('should handle array settings correctly (send action when localSettings change)', async () => {
    const initialLocalSettings = ['item1', 'item2']
    const newLocalSettings = ['item2', 'item3']
    const pluginSettings = initialLocalSettings

    const { rerender } = render(<TestComponent localSettings={initialLocalSettings} pluginSettings={pluginSettings} />)

    // Update localSettings prop
    await act(async () => {
      rerender(<TestComponent localSettings={newLocalSettings} pluginSettings={pluginSettings} />)
    })

    // Wait for the action to be sent to the plugin
    await waitFor(() => expect(sendActionToPluginMock).toHaveBeenCalled())

    expect(sendActionToPluginMock).toHaveBeenCalledWith(
      'UPDATE_SETTINGS',
      {
        actionType: 'UPDATE_SETTINGS',
        settings: newLocalSettings,
        logMessage: 'UPDATE_SETTINGS changed',
      },
      'UPDATE_SETTINGS updated',
      true,
    )
  })

  describe('with dashboardSettings (object)', () => {
    it('should not dispatch or send action if settings are the same', () => {
      const initialSettings = { layout: 'grid' }

      render(<DashboardTestComponent dashboardSettings={initialSettings} pluginSettings={initialSettings} />)

      expect(dispatchMock).not.toHaveBeenCalled()
      expect(sendActionToPluginMock).not.toHaveBeenCalled()
    })

    it('should dispatch action when pluginSettings change', async () => {
      const initialLocalSettings = { layout: 'grid' }
      const newPluginSettings = { layout: 'list' }

      const { rerender } = render(<DashboardTestComponent dashboardSettings={initialLocalSettings} pluginSettings={initialLocalSettings} />)

      // Update pluginSettings prop
      await act(async () => {
        rerender(<DashboardTestComponent dashboardSettings={initialLocalSettings} pluginSettings={newPluginSettings} />)
      })

      // Wait for the dispatch to occur
      await waitFor(() => expect(dispatchMock).toHaveBeenCalled())

      /** Calculate the expected diff */
      const expectedDiff = compareObjects(newPluginSettings, initialLocalSettings)

      expect(dispatchMock).toHaveBeenCalledWith({
        type: 'UPDATE_DASHBOARD_SETTINGS',
        payload: newPluginSettings,
        reason: `UPDATE_DASHBOARD_SETTINGS changed from plugin: ${JSON.stringify(expectedDiff)}`,
      })
    })

    it('should send action to plugin when dashboardSettings change', async () => {
      const initialLocalSettings = { layout: 'grid' }
      const newLocalSettings = { layout: 'list' }
      const pluginSettings = initialLocalSettings

      const { rerender } = render(<DashboardTestComponent dashboardSettings={initialLocalSettings} pluginSettings={pluginSettings} />)

      // Update dashboardSettings prop
      await act(async () => {
        rerender(<DashboardTestComponent dashboardSettings={newLocalSettings} pluginSettings={pluginSettings} />)
      })

      // Wait for the action to be sent to the plugin
      await waitFor(() => expect(sendActionToPluginMock).toHaveBeenCalled())

      expect(sendActionToPluginMock).toHaveBeenCalledWith(
        'UPDATE_DASHBOARD_SETTINGS',
        {
          actionType: 'UPDATE_DASHBOARD_SETTINGS',
          settings: newLocalSettings,
          logMessage: 'UPDATE_DASHBOARD_SETTINGS changed',
        },
        'UPDATE_DASHBOARD_SETTINGS updated',
        true,
      )
    })
  })

  describe('with perspectiveSettings (array of objects)', () => {
    it('should not dispatch or send action if settings are the same', () => {
      const initialSettings = [
        { id: 1, view: 'default' },
        { id: 2, view: 'advanced' },
      ]

      render(<PerspectiveTestComponent perspectiveSettings={initialSettings} pluginSettings={initialSettings} />)

      expect(dispatchMock).not.toHaveBeenCalled()
      expect(sendActionToPluginMock).not.toHaveBeenCalled()
    })

    it('should dispatch action when pluginSettings change', async () => {
      const initialLocalSettings = [
        { id: 1, view: 'default' },
        { id: 2, view: 'advanced' },
      ]
      const newPluginSettings = [
        { id: 1, view: 'default' },
        { id: 2, view: 'expert' },
      ]

      const { rerender } = render(<PerspectiveTestComponent perspectiveSettings={initialLocalSettings} pluginSettings={initialLocalSettings} />)

      // Update pluginSettings prop
      await act(async () => {
        rerender(<PerspectiveTestComponent perspectiveSettings={initialLocalSettings} pluginSettings={newPluginSettings} />)
      })

      // Wait for the dispatch to occur
      await waitFor(() => expect(dispatchMock).toHaveBeenCalled())

      /** Calculate the expected diff */
      const expectedDiff = compareObjects(newPluginSettings, initialLocalSettings)

      expect(dispatchMock).toHaveBeenCalledWith({
        type: 'UPDATE_PERSPECTIVE_SETTINGS',
        payload: newPluginSettings,
        reason: `UPDATE_PERSPECTIVE_SETTINGS changed from plugin: ${JSON.stringify(expectedDiff)}`,
      })
    })

    it('should send action to plugin when perspectiveSettings change', async () => {
      const initialLocalSettings = [
        { id: 1, view: 'default' },
        { id: 2, view: 'advanced' },
      ]
      const newLocalSettings = [
        { id: 1, view: 'default' },
        { id: 2, view: 'expert' },
      ]
      const pluginSettings = initialLocalSettings

      const { rerender } = render(<PerspectiveTestComponent perspectiveSettings={initialLocalSettings} pluginSettings={pluginSettings} />)

      // Update perspectiveSettings prop
      await act(async () => {
        rerender(<PerspectiveTestComponent perspectiveSettings={newLocalSettings} pluginSettings={pluginSettings} />)
      })

      // Wait for the action to be sent to the plugin
      await waitFor(() => expect(sendActionToPluginMock).toHaveBeenCalled())

      expect(sendActionToPluginMock).toHaveBeenCalledWith(
        'UPDATE_PERSPECTIVE_SETTINGS',
        {
          actionType: 'UPDATE_PERSPECTIVE_SETTINGS',
          settings: newLocalSettings,
          logMessage: 'UPDATE_PERSPECTIVE_SETTINGS changed',
        },
        'UPDATE_PERSPECTIVE_SETTINGS updated',
        true,
      )
    })
  })
})

/**
 * Test suite for useSyncWithPlugin when using fieldsToIgnore in compareObjects.
 */

describe('useSyncWithPlugin with fieldsToIgnore in compareObjects', () => {
  let dispatchMock
  let sendActionToPluginMock

  /**
   * A test component that uses the custom hook with fieldsToIgnore in compareObjects.
   * @param {Object} props Component props.
   * @returns {null}
   */
  const TestComponentWithIgnoreFields = ({ localSettings, pluginSettings, fieldsToIgnore }) => {
    const compareFn = (a, b) => compareObjects(a, b, fieldsToIgnore)
    useSyncWithPlugin(localSettings, pluginSettings, dispatchMock, 'UPDATE_SETTINGS', sendActionToPluginMock, compareFn)
    return null
  }

  beforeEach(() => {
    dispatchMock = jest.fn()
    sendActionToPluginMock = jest.fn()
    global.DataStore = { settings: { _logLevel: 'none' } }
  })

  it('should not dispatch or send action if only ignored fields change', async () => {
    const initialSettings = { theme: 'light', lastUpdated: '2021-01-01' }
    const newPluginSettings = { theme: 'light', lastUpdated: '2021-02-01' }
    const fieldsToIgnore = ['lastUpdated']

    const { rerender } = render(<TestComponentWithIgnoreFields localSettings={initialSettings} pluginSettings={initialSettings} fieldsToIgnore={fieldsToIgnore} />)

    // Update pluginSettings prop with a change in the ignored field
    await act(async () => {
      rerender(<TestComponentWithIgnoreFields localSettings={initialSettings} pluginSettings={newPluginSettings} fieldsToIgnore={fieldsToIgnore} />)
    })

    // Wait for any effects to run
    await waitFor(() => expect(true).toBe(true))

    expect(dispatchMock).not.toHaveBeenCalled()
    expect(sendActionToPluginMock).not.toHaveBeenCalled()
  })

  it('should dispatch action when a non-ignored field changes', async () => {
    const initialSettings = { theme: 'light', lastUpdated: '2021-01-01' }
    const newPluginSettings = { theme: 'dark', lastUpdated: '2021-02-01' }
    const fieldsToIgnore = ['lastUpdated']

    const { rerender } = render(<TestComponentWithIgnoreFields localSettings={initialSettings} pluginSettings={initialSettings} fieldsToIgnore={fieldsToIgnore} />)

    // Update pluginSettings prop with a change in a non-ignored field
    await act(() => {
      rerender(<TestComponentWithIgnoreFields localSettings={initialSettings} pluginSettings={newPluginSettings} fieldsToIgnore={fieldsToIgnore} />)
    })

    // Wait for the dispatch to occur
    await waitFor(() => expect(dispatchMock).toHaveBeenCalled())

    /** Calculate the expected diff */
    const compareFn = (a, b) => compareObjects(a, b, fieldsToIgnore)
    const expectedDiff = compareFn(newPluginSettings, initialSettings)

    expect(dispatchMock).toHaveBeenCalledWith({
      type: 'UPDATE_SETTINGS',
      payload: newPluginSettings,
      reason: `UPDATE_SETTINGS changed from plugin: ${JSON.stringify(expectedDiff)}`,
    })
  })

  it('should send action to plugin when a non-ignored field in localSettings changes', async () => {
    const initialLocalSettings = { theme: 'light', lastUpdated: '2021-01-01' }
    const newLocalSettings = { theme: 'dark', lastUpdated: '2021-01-01' }
    const pluginSettings = initialLocalSettings
    const fieldsToIgnore = ['lastUpdated']

    const { rerender } = render(<TestComponentWithIgnoreFields localSettings={initialLocalSettings} pluginSettings={pluginSettings} fieldsToIgnore={fieldsToIgnore} />)

    // Update localSettings prop with a change in a non-ignored field
    await act(async () => {
      rerender(<TestComponentWithIgnoreFields localSettings={newLocalSettings} pluginSettings={pluginSettings} fieldsToIgnore={fieldsToIgnore} />)
    })

    // Wait for the action to be sent to the plugin
    await waitFor(() => expect(sendActionToPluginMock).toHaveBeenCalled())

    expect(sendActionToPluginMock).toHaveBeenCalledWith(
      'UPDATE_SETTINGS',
      {
        actionType: 'UPDATE_SETTINGS',
        settings: newLocalSettings,
        logMessage: 'UPDATE_SETTINGS changed',
      },
      'UPDATE_SETTINGS updated',
      true,
    )
  })

  it('should not send action to plugin when only an ignored field in localSettings changes', async () => {
    const initialLocalSettings = { theme: 'light', lastUpdated: '2021-01-01' }
    const newLocalSettings = { theme: 'light', lastUpdated: '2021-02-01' }
    const pluginSettings = initialLocalSettings
    const fieldsToIgnore = ['lastUpdated']

    const { rerender } = render(<TestComponentWithIgnoreFields localSettings={initialLocalSettings} pluginSettings={pluginSettings} fieldsToIgnore={fieldsToIgnore} />)

    // Update localSettings prop with a change in the ignored field
    await act(async () => {
      rerender(<TestComponentWithIgnoreFields localSettings={newLocalSettings} pluginSettings={pluginSettings} fieldsToIgnore={fieldsToIgnore} />)
    })

    // Wait for any effects to run
    await waitFor(() => expect(true).toBe(true))

    expect(sendActionToPluginMock).not.toHaveBeenCalled()
    expect(dispatchMock).not.toHaveBeenCalled()
  })
})
