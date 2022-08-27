import { logDebug } from '@helpers/dev'

function createConfigOptions() {}

/**
 * Presets have a label and other properties which overwrite the default config
 * @param {*} config  - the config object
 * @param {*} preset - the preset object
 */
export function setConfigForPreset(config, preset) {
  if (preset) {
    Object.keys(preset).forEach((key) => {
      if (key !== 'label') {
        config[key] = preset[key]
      }
    })
  }
  return config
}

export const getPresetOptions = (presets) => {
  return presets.map((p, i) => {
    return { label: p.label, value: i }
  })
}

function getPreset(config) {
  if (config.preset && config.preset.length) {
  } else {
    return null
  }
}
