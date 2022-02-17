'use strict'

/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

import * as eta from 'eta'
import helpers from './template-helpers' // eslint-disable-line

module.exports = {
  renderConfig: () => {
    return {
      varName: 'np',
      parse: {
        exec: '*',
        interpolate: '',
        raw: '',
      },
      autoTrim: false,
      globalAwait: true,
      useWith: true,
    }
  },

  render: async function (templateData = '', data = {}, options = { extended: false, tags: [] }) {
    const renderData = { ...helpers(), ...data }

    const renderOptions = this.renderConfig()

    if (options.extended) {
      delete renderOptions.parse
    }

    if (options?.tags?.length > 0) {
      renderOptions.tags = options.tags
    }

    try {
      return eta.render(templateData, renderData, renderOptions)
    } catch (err) {
      return { status: 'fail', message: err.message }
    }
  },
}
