// @flow
/* eslint-disable flowtype/require-valid-file-annotation */
/* globals describe, it, expect */

import { removeStaleTagSections } from '../src/dashboardSettingsClean'

describe('removeStaleTagSections', () => {
  const baseSettings = {
    tagsToShow: '@friend',
    showTagSection_friend: true,
  }

  it('removes TAG sections whose name is not in tagsToShow', () => {
    const sections = [
      { ID: 'TAG_0', sectionCode: 'TAG', name: '@father', sectionItems: [] },
      { ID: 'DT', sectionCode: 'DT', name: 'Today', sectionItems: [] },
    ]
    const result = removeStaleTagSections(sections, baseSettings)
    expect(result.map((s) => s.ID)).toEqual(['DT'])
  })

  it('keeps TAG sections listed in tagsToShow', () => {
    const sections = [
      { ID: 'TAG_0', sectionCode: 'TAG', name: '@friend', sectionItems: [] },
      { ID: 'DT', sectionCode: 'DT', name: 'Today', sectionItems: [] },
    ]
    const result = removeStaleTagSections(sections, baseSettings)
    expect(result.map((s) => s.ID)).toEqual(['TAG_0', 'DT'])
  })

  it('removes all TAG sections when tagsToShow is empty', () => {
    const sections = [{ ID: 'TAG_0', sectionCode: 'TAG', name: '@friend', sectionItems: [] }]
    const result = removeStaleTagSections(sections, { tagsToShow: '' })
    expect(result).toEqual([])
  })
})
