// @flow
import { debug } from '../../../../helpers/general'
import { getOrMakeConfigurationSection } from '../configuration'

// $FlowFixMe
Object.byString = function (o, s) {
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

export async function getService(section: string = '', key: string = ''): Promise<string> {
  const templateConfig = await getOrMakeConfigurationSection('templates')
  const serviceConfig = templateConfig?.services
  if (serviceConfig) {
    // $FlowFixMe
    const URL = serviceConfig[section]
    try {
      const response: any = await fetch(URL)
      const data = JSON.parse(response)
      // $FlowFixMe
      return Object.byString(data, `${key}`)
    } catch (error) {
      return error
    }
  }
  return ''
}
