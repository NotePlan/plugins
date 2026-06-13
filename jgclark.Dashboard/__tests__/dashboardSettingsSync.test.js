// @flow
/* eslint-disable flowtype/require-valid-file-annotation */
/* globals describe, it, expect */

import { applyDerivedDashboardSettings } from '../src/dashboardSettings'
import { prepareDashboardSettingsForSave } from '../src/dashboardSettingsClean'

describe('applyDerivedDashboardSettings', () => {
  it('turns showWinsSection off when treatTopPriorityAsWins is newly turned off', () => {
    const prior = { treatTopPriorityAsWins: true, showWinsSection: true }
    const next = { treatTopPriorityAsWins: false, showWinsSection: true }
    expect(applyDerivedDashboardSettings(prior, next)).toEqual({
      treatTopPriorityAsWins: false,
      showWinsSection: false,
    })
  })

  it('turns showWinsSection on when treatTopPriorityAsWins is newly turned on', () => {
    const prior = { treatTopPriorityAsWins: false, showWinsSection: false }
    const next = { treatTopPriorityAsWins: true, showWinsSection: false }
    expect(applyDerivedDashboardSettings(prior, next)).toEqual({
      treatTopPriorityAsWins: true,
      showWinsSection: true,
    })
  })

  it('leaves settings unchanged when treatTopPriorityAsWins is unchanged', () => {
    const prior = { treatTopPriorityAsWins: true, showWinsSection: false }
    const next = { treatTopPriorityAsWins: true, showWinsSection: false, filterPriorityItems: true }
    expect(applyDerivedDashboardSettings(prior, next)).toBe(next)
  })
})

describe('prepareDashboardSettingsForSave', () => {
  it('applies derived rules after normalize and tag cleanup', () => {
    const prior = { treatTopPriorityAsWins: false, showWinsSection: false, tagsToShow: '' }
    const next = { treatTopPriorityAsWins: true, showWinsSection: false, tagsToShow: '', showTagSection_orphan: true }
    const prepared = prepareDashboardSettingsForSave(prior, next, { mergeDefaults: false })
    expect(prepared.treatTopPriorityAsWins).toBe(true)
    expect(prepared.showWinsSection).toBe(true)
    expect(prepared.showTagSection_orphan).toBeUndefined()
  })
})
