/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

// @flow

// Temporary Implementation until `dot-prop` is ready
// https://github.com/sindresorhus/dot-prop/issues/87

// The shape of the `arrayReference` helper this file bolts onto the global `Object`.
type ArrayReferenceFn = (o: { [string]: any }, s: string) => any

// `Object` is a global declared in Flow's core libdef, so the extra static cannot be declared here; the cast is the
// narrowest way to write "we are adding a property Flow does not know about".
;(Object: any).arrayReference = function (o: { [string]: any }, s: string): any {
  // Params are effectively const under `experimental.const_params`, so walk over locals instead of reassigning them.
  const normalizedPath = s.replace(/\[(\w+)\]/g, '.$1').replace(/^\./, '') // convert indexes to properties, then strip a leading dot
  const a = normalizedPath.split('.')
  let current = o
  for (let i = 0, n = a.length; i < n; ++i) {
    const k = a[i]
    if (k in current) {
      current = current[k]
    } else {
      return
    }
  }
  return current
}

const formatData = (obj: any) => {
  return JSON.stringify(obj, null, 2).replace(/\\/g, ' ').replace(/, /g, ',\n   ').replace(/"{/g, '{\n  ').replace(/}"/g, '\n}').replace(/ ",/g, '",').replace(/ ":/g, '":')
}

// Utilities
const isJson = (str: string) => {
  try {
    JSON.parse(str)
  } catch (e) {
    return false
  }
  return true
}

const isURL = (str: string) => {
  return str.indexOf('http') >= 0
}

export async function getService(templateConfig: any, section: string = '', key: string | Array<string> = ''): Promise<string> {
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
      let result = ''
      if (Array.isArray(dataKey)) {
        dataKey.forEach((item) => {
          const value = ((Object: any).arrayReference: ArrayReferenceFn)(data, item)
          result += value ? value : item
        })

        return result
      } else {
        if (data.hasOwnProperty('error')) {
          return JSON.stringify(data.error, null, 1)
        }
        return ((Object: any).arrayReference: ArrayReferenceFn)(data, `${dataKey}`)
      }
    } catch (error) {
      return error
    }
  }
  return ''
}
