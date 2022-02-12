/* eslint-disable */

import utils from '../../utils/general'

describe('NotePlan Plugins Utils: general', () => {
  test('quote', async () => {
    const result = await utils.quote(null, 'config string')

    expect(result).not.toContain('Invalid "quote configuration" in `Templates/_configuration`')
    expect(result).not.toContain('Error in Quote lookup')
  })
})
