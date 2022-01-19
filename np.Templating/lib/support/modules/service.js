// @flow

// TODO: Check status on `dot-prop` to see if supported yet (as of 2021-10-15 it was still WIP)
// INFO: This is a test

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

const formatData = (obj: any) => {
  return JSON.stringify(obj, null, 2)
    .replace(/\\/g, ' ')
    .replace(/, /g, ',\n   ')
    .replace(/"{/g, '{\n  ')
    .replace(/}"/g, '\n}')
    .replace(/ ",/g, '",')
    .replace(/ ":/g, '":')
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
    if (!isURL(section) && !serviceConfig.hasOwnProperty(section)) {
      return `**invalid section "${section}"**`
    }

    let URL = isURL(section) ? section : serviceConfig[section]
    let dataKey = key
    try {
      // this will the case when service object contains object with URL and Key
      if (typeof URL === 'object') {
        dataKey = URL.keys
        URL = URL.url
      }

      const response: any = await fetch(URL)
      if (!isJson(response)) {
        if (response.indexOf('error') >= 0) {
          const endpoint = isURL(section) ? ' API' : ' service'
          throw new Error(`Accessing ${section}${endpoint}`)
        }
        return response.replace('\n', '')
      }

      const data = JSON.parse(response)
      if (dataKey === '*') {
        return formatData(data)
      }
      // $FlowF8ixMe
      let result = ''
      if (Array.isArray(dataKey)) {
        dataKey.forEach((item) => {
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
        return Object.arrayReference(data, `${dataKey}`)
      }
    } catch (error) {
      return error
    }
  }
  return ''
}
