/* global describe, it, expect, beforeAll */
import colors from 'chalk'
import * as tt from '../src/tagTasks'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan /*, Note, Paragraph */ } from '@mocks/index'

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = NotePlan
  DataStore.settings['_logLevel'] = 'none' //change this to DEBUG to get more logging
})

/*
  describe(section('copyTagsFromLineAbove'), () => {
    it(`should render default date object`, () => {})
  })
  */

// Jest codedungeon bersion
const PLUGIN_NAME = `${colors.yellow('dwertheimer.TaskAutomations')}`
const section = colors.blue
describe(`${PLUGIN_NAME}`, () => {
  describe(section('getTagsFromString'), () => {
    it(`should not find anything if no tags`, () => {
      const text = `word something nothing`
      const tags = tt.getTagsFromString(text)
      expect(tags).toEqual({ hashtags: [], mentions: [] })
    })
    it(`should find tags/mentions and return them in an object`, () => {
      const text = `text1 #tag1 #tag2 text2 @mention1 @mention2 text3`
      const tags = tt.getTagsFromString(text)
      expect(tags).toEqual({
        hashtags: ['#tag1', '#tag2'],
        mentions: ['@mention1', '@mention2'],
      })
    })
  })
  describe(section('getUnduplicatedMergedTagArray'), () => {
    it(`should return nothing if there are no tags`, () => {
      const existingTags = []
      const newTags = []
      const tags = tt.getUnduplicatedMergedTagArray(existingTags, newTags)
      expect(tags).toEqual(newTags)
    })
    it(`should return newTags if there are no oldTags`, () => {
      const existingTags = []
      const newTags = ['@foo']
      const tags = tt.getUnduplicatedMergedTagArray(existingTags, newTags)
      expect(tags).toEqual(newTags)
    })
    it(`should return oldTags if there are no newTags`, () => {
      const existingTags = ['@foo']
      const newTags = []
      const tags = tt.getUnduplicatedMergedTagArray(existingTags, newTags)
      expect(tags).toEqual(existingTags)
    })
    it(`should return merged if both have tags`, () => {
      const existingTags = ['#tag1', '#tag2']
      const newTags = ['#tag3', '#tag4']
      const tags = tt.getUnduplicatedMergedTagArray(existingTags, newTags)
      expect(tags).toEqual([...existingTags, ...newTags])
    })
  })
  describe(section('removeTagsFromLine'), () => {
    const text = `text1 #tag1 #tag2 text2 @mention1 @mention2 text3`
    const toRemove = ['#tag1', '@mention2']
    it(`should remove tags from text`, () => {
      const revisedText = tt.removeTagsFromLine(text, toRemove)
      expect(revisedText).toEqual(`text1 #tag2 text2 @mention1 text3`)
    })
    it(`should do nothing if no tags to remove`, () => {
      const revisedText = tt.removeTagsFromLine(text, [])
      expect(revisedText).toEqual(text)
    })
  })

  describe(section('appendTagsToText'), () => {
    it(`should reorder tags mentions first then hashtags`, () => {
      const text = `test #bar @foo #yo`
      const newTags = { hashtags: [], mentions: [] }
      const ret = tt.appendTagsToText(text, newTags)
      expect(ret).toEqual(`test #bar #yo @foo`)
    })
    it(`should add a tag if one is new`, () => {
      const text = `word something nothing #bar #faz @foo`
      const newTags = { hashtags: ['#far'], mentions: [] }
      const ret = tt.appendTagsToText(text, newTags)
      expect(ret).toEqual(`word something nothing #bar #faz #far @foo`)
    })
  })
})
