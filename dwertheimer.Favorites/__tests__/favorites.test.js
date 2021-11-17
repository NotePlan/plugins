/* globals describe, expect, it, test */
import * as f from '../src/favorites'
const _ = require('lodash')

const config = { favoriteIcon: '⭐️' }

// Jest suite
describe('favorites', () => {
  // getFavoriteDefault
  test('dwertheimer.Favorites - getFavoriteDefault', () => {
    // expect(pd.isTask(noteWithTasks.paragraphs[1])).toBe(true)
    // expect(pd.isTask(noteWithOutTasks.paragraphs[1])).toBe(false)
    expect(f.getFavoriteDefault()).toEqual('⭐️')
  })

  //filterForFaves
  test('dwertheimer.Favorites - filterForFaves ', () => {
    const notes = [{ title: '⭐️ front' }, { title: 'back ⭐️' }, { title: 'mid ⭐️ dle' }, { title: 'none' }]
    const faves = f.filterForFaves(notes, config)
    expect(faves.length).toEqual(3)
    expect(faves[0].title).toEqual('⭐️ front')
    expect(faves[1].title).toEqual('back ⭐️')
    expect(faves[2].title).toEqual('mid ⭐️ dle')
    expect(f.filterForFaves([{ title: undefined }], config)).toEqual([])
  })

  // getFaveOptionsArray
  test('dwertheimer.Favorites - getFaveOptionsArray ', () => {
    const notes = [
      { title: '⭐️ front', filename: 'f1' },
      { title: 'back ⭐️', filename: 'f2' },
      { title: 'mid ⭐️ dle', filename: 'f3' },
    ]
    const options = f.getFaveOptionsArray(notes)
    expect(options.length).toEqual(3)
    expect(options[0].label).toEqual('⭐️ front')
    expect(options[0].value).toEqual('f1')
    expect(f.getFaveOptionsArray([{ title: undefined, filename: undefined }])).toEqual([])
  })

  // Test f.removeFavorite
  test('dwertheimer.Favorites - removeFavorite ', () => {
    expect(f.removeFavoriteFromTitle('⭐️ front', '⭐️')).toEqual('front')
    expect(f.removeFavoriteFromTitle('front ⭐️', '⭐️')).toEqual('front')
    expect(f.removeFavoriteFromTitle('front', '⭐️')).toEqual('front')
  })

  //hasFavoriteIcon
  test('dwertheimer.Favorites - hasFavoriteIcon ', () => {
    expect(f.hasFavoriteIcon(`⭐️`, `⭐️`)).toEqual(true)
    expect(f.hasFavoriteIcon(`test ⭐️`, `⭐️`)).toEqual(true)
    expect(f.hasFavoriteIcon(`test ⭐️ test`, `⭐️`)).toEqual(true)
    expect(f.hasFavoriteIcon(`test test`, `⭐️`)).toEqual(false)
    expect(f.hasFavoriteIcon(``, `⭐️`)).toEqual(false)
  })

  //getFavoritedTitle
  test('dwertheimer.Favorites - getFavoritedTitle ', () => {
    expect(f.getFavoritedTitle(`test`, 'prepend', `⭐️`)).toEqual(`⭐️ test`)
    expect(f.getFavoritedTitle(`test`, 'append', `⭐️`)).toEqual(`test ⭐️`)
  })
})
