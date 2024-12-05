// @flow

/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

import { sprintf } from 'sprintf-js'

export default class UtilityModule {
  config: any
  constructor(config: any = {}) {
    // $FlowFixMe
    this.config = config
  }

  // https://github.com/alexei/sprintf.js
  format(formatter: any = '', ...input: string): string {
    if (formatter.length > 0) {
      return sprintf(formatter, ...input)
    }
    return input
  }

  concat(...params: any): string {
    return params.join(' ').replace(/\s\s+/g, ' ')
  }

  lowercase(str: string = ''): string {
    return str.toLowerCase()
  }

  uppercase(str: string = ''): string {
    return str.toUpperCase()
  }

  titleCase(str: string = ''): string {
    return str.replace(/(^|\s)\S/g, function (t) {
      return t.toUpperCase()
    })
  }

  camelize(str: string = ''): string {
    return str.replace(/(?:^\w|[A-Z]|\b\w|\s+)/g, function (match, index) {
      if (+match === 0) return '' // or if (/\s+/.test(match)) for white spaces
      return index === 0 ? match.toLowerCase() : match.toUpperCase()
    })
  }

  slug(inStr: string = ''): string {
    let str: string = inStr
    str = str.replace(/^\s+|\s+$/g, '') // trim
    str = str.toLowerCase()

    // remove accents, swap ñ for n, etc
    const from = 'àáãäâèéëêìíïîòóöôùúüûñç·/_,:;'
    const to = 'aaaaaeeeeiiiioooouuuunc------'

    for (let i = 0, l = from.length; i < l; i++) {
      str = str.replace(new RegExp(from.charAt(i), 'g'), to.charAt(i))
    }

    str = str
      .replace(/[^a-z0-9 -]/g, '') // remove invalid chars
      .replace(/\s+/g, '-') // collapse whitespace and replace by -
      .replace(/-+/g, '-') // collapse dashes

    return str
  }

  // alias for slug (because I am used to using slugify)
  slugify(inStr: string = ''): string {
    return this.slug(inStr)
  }
}
