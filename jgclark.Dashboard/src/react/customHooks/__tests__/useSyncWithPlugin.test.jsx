// @flow
/* global jest, describe, it, expect, beforeEach */
import { renderHook, act } from '@testing-library/react-hooks';
import { useSyncWithPlugin } from '../useSyncWithPlugin';

describe('useSyncWithPlugin', () => {
  let dispatchMock;
  let sendActionToPluginMock;
  let compareFnMock;

  beforeEach(() => {
    dispatchMock = jest.fn();
    sendActionToPluginMock = jest.fn();
    compareFnMock = jest.fn((a, b) => JSON.stringify(a) !== JSON.stringify(b) ? a : null);
  });

  it('should dispatch action when pluginSettings change', () => {
    const initialLocalSettings = { theme: 'light' };
    const newPluginSettings = { theme: 'dark' };
    const actionType = 'UPDATE_SETTINGS';

    const { rerender } = renderHook(({ localSettings, pluginSettings }) =>
      useSyncWithPlugin(localSettings, pluginSettings, dispatchMock, actionType, sendActionToPluginMock, compareFnMock), {
      initialProps: { localSettings: initialLocalSettings, pluginSettings: initialLocalSettings }
    });

    act(() => {
      rerender({ localSettings: initialLocalSettings, pluginSettings: newPluginSettings });
    });

    expect(dispatchMock).toHaveBeenCalledWith({
      type: actionType,
      payload: newPluginSettings,
      reason: `${actionType} changed from plugin: ${JSON.stringify(newPluginSettings)}`,
    });
  });

  it('should send action to plugin when localSettings change', () => {
    const initialLocalSettings = { theme: 'light' };
    const newLocalSettings = { theme: 'dark' };
    const actionType = 'UPDATE_SETTINGS';

    const { rerender } = renderHook(({ localSettings, pluginSettings }) =>
      useSyncWithPlugin(localSettings, pluginSettings, dispatchMock, actionType, sendActionToPluginMock, compareFnMock), {
      initialProps: { localSettings: initialLocalSettings, pluginSettings: initialLocalSettings }
    });

    act(() => {
      rerender({ localSettings: newLocalSettings, pluginSettings: initialLocalSettings });
    });

    expect(sendActionToPluginMock).toHaveBeenCalledWith(
      actionType,
      {
        actionType: actionType,
        settings: newLocalSettings,
        logMessage: `${actionType} changed`,
      },
      `${actionType} updated`,
      true
    );
  });

  it('should not dispatch or send action if there is no difference', () => {
    const initialLocalSettings = { theme: 'light' };
    const actionType = 'UPDATE_SETTINGS';

    renderHook(() =>
      useSyncWithPlugin(initialLocalSettings, initialLocalSettings, dispatchMock, actionType, sendActionToPluginMock, compareFnMock)
    );

    expect(dispatchMock).not.toHaveBeenCalled();
    expect(sendActionToPluginMock).not.toHaveBeenCalled();
  });

  it('should handle complex settings objects', () => {
    const initialLocalSettings = { theme: 'light', layout: { sidebar: true } };
    const newPluginSettings = { theme: 'dark', layout: { sidebar: false } };
    const actionType = 'UPDATE_SETTINGS';

    const { rerender } = renderHook(({ localSettings, pluginSettings }) =>
      useSyncWithPlugin(localSettings, pluginSettings, dispatchMock, actionType, sendActionToPluginMock, compareFnMock), {
      initialProps: { localSettings: initialLocalSettings, pluginSettings: initialLocalSettings }
    });

    act(() => {
      rerender({ localSettings: initialLocalSettings, pluginSettings: newPluginSettings });
    });

    expect(dispatchMock).toHaveBeenCalledWith({
      type: actionType,
      payload: newPluginSettings,
      reason: `${actionType} changed from plugin: ${JSON.stringify(newPluginSettings)}`,
    });
  });
});