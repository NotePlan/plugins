// @flow

// TODO: Check status on `dot-prop` to see if supported yet (as of 2021-10-15 it was still WIP)
// Temporary Implementation until `dot-prop` is ready
// https://github.com/sindresorhus/dot-prop/issues/87
// $FlowFixMe
Object.arrayReference = function (o, s) {
  // $FlowFixMe
  s = s.replace(/\[(\w+)\]/g, '.$1') // convert indexes to properties
  // $FlowFixMe
  s = s.replace(/^\./, '') // strip a leading dot
  const a = s.split('.')
  for (let i = 0, n = a.length; i < n; ++i) {
    const k = a[i]
    if (k in o) {
      // $FlowFixMe
      o = o[k]
    } else {
      return
    }
  }
  return o
}

// Utilities
const isJson = (str) => {
  try {
    JSON.parse(str)
  } catch (e) {
    return false
  }
  return true
}

const isURL = (str) => {
  return str.indexOf('http') >= 0
}

export async function getService(templateConfig: any, section: string = '', key: mixed = ''): Promise<string> {
  const serviceConfig = templateConfig?.services
  if (serviceConfig) {
    // $FlowFixMe
    const URL = isURL(section) ? section : serviceConfig[section]
    try {
      const response: any = await fetch(URL)
      if (!isJson(response)) {
        return response.replace('\n', '')
      }

      const data = JSON.parse(response)
      // $FlowFixMe
      let result = ''
      if (Array.isArray(key)) {
        key.forEach((item) => {
          // $FlowFixMe
          const value = Object.arrayReference(data, item)
          // $FlowFixMe
          result += value ? value : item
        })

        return result
      } else {
        if (data.hasOwnProperty('error')) {
          return JSON.stringify(data.error, null, 1)
        }
        // $FlowFixMe
        return Object.arrayReference(data, `${key}`)
      }
    } catch (error) {
      return error
    }
  }
  return ''
}
