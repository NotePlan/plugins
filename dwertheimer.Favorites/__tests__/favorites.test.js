/* globals describe, expect, it, test */
import * as f from '../src/favorites'
// const  _ = require('lodash')

const config = { favoriteIcon: '⭐️' }

// Jest suite
describe('dwertheimer.Favorites', () => {
  // getFavoriteDefault
  test('getFavoriteDefault', () => {
    // expect(pd.isTask(noteWithTasks.paragraphs[1])).toBe(true)
    // expect(pd.isTask(noteWithOutTasks.paragraphs[1])).toBe(false)
    expect(f.getFavoriteDefault()).toEqual('⭐️')
  })

  //filterForFaves
  describe('filterForFaves ', () => {
    test('should find favorites tag wherever it exists in a string', () => {
      const notes = [{ title: '⭐️ front' }, { title: 'back ⭐️' }, { title: 'mid ⭐️ dle' }, { title: 'none' }]
      const faves = f.filterForFaves(notes, config)
      expect(faves.length).toEqual(3)
      expect(faves[0].title).toEqual('⭐️ front')
      expect(faves[1].title).toEqual('back ⭐️')
      expect(faves[2].title).toEqual('mid ⭐️ dle')
    })
    test('should find no favorites if title is undefined', () => {
      expect(f.filterForFaves([{ title: undefined }], config)).toEqual([])
    })
  })

  // getFaveOptionsArray
  describe('getFaveOptionsArray ', () => {
    test('options creator function should return value/label for each favorite', () => {
      const notes = [
        { title: '⭐️ front', filename: 'f1' },
        { title: 'back ⭐️', filename: 'f2' },
        { title: 'mid ⭐️ dle', filename: 'f3' },
      ]
      const options = f.getFaveOptionsArray(notes)
      expect(options.length).toEqual(3)
      expect(options[0].label).toEqual('⭐️ front')
      expect(options[0].value).toEqual('f1')
    })
    test('options creator function should return empty array for undefined values', () => {
      expect(f.getFaveOptionsArray([{ title: undefined, filename: undefined }])).toEqual([])
    })
  })

  // Test f.removeFavorite
  describe('removeFavorite ', () => {
    test('should remove favorite marker wherever it is in the string', () => {
      expect(f.removeFavoriteFromTitle('⭐️ front', '⭐️')).toEqual('front')
      expect(f.removeFavoriteFromTitle('back ⭐️', '⭐️')).toEqual('back')
      expect(f.removeFavoriteFromTitle('not here', '⭐️')).toEqual('not here')
    })
  })

  //hasFavoriteIcon
  describe('hasFavoriteIcon ', () => {
    test('should return true if there is a favorite icon in the title', () => {
      expect(f.hasFavoriteIcon(`⭐️`, `⭐️`)).toEqual(true)
      expect(f.hasFavoriteIcon(`⭐️ yes`, `⭐️`)).toEqual(true)
      expect(f.hasFavoriteIcon(`test ⭐️`, `⭐️`)).toEqual(true)
      expect(f.hasFavoriteIcon(`test ⭐️ test`, `⭐️`)).toEqual(true)
    })
    test('should return false if there is no favorite icon in the title', () => {
      expect(f.hasFavoriteIcon(`test test`, `⭐️`)).toEqual(false)
      expect(f.hasFavoriteIcon(``, `⭐️`)).toEqual(false)
    })
  })

  //getFavoritedTitle
  describe('getFavoritedTitle ', () => {
    test('should insert favorite icon at front of string with prepend option', () => {
      expect(f.getFavoritedTitle(`test`, 'prepend', `⭐️`)).toEqual(`⭐️ test`)
    })
    test('should insert favorite icon at end of string with append option', () => {
      expect(f.getFavoritedTitle(`test`, 'append', `⭐️`)).toEqual(`test ⭐️`)
    })
  })
})
