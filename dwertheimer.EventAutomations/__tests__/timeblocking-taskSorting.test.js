/* globals describe, expect, it, test, DataStore */
import { exportAllDeclaration } from '@babel/types'
import { differenceInCalendarDays, endOfDay, startOfDay, eachMinuteOfInterval, formatISO9075 } from 'date-fns'
import * as tb from '../src/timeblocking-helpers'
import { getTasksByType } from '../../dwertheimer.TaskAutomations/src/taskHelpers'
import { sortListBy } from '../../helpers/sorting'
const _ = require('lodash')
// import { isNullableTypeAnnotation } from '@babel/types'

// Jest suite
describe('taskSorting', () => {
  // testing this here because i am using it here and want to be sure it works
  // and the signatures don't change
  // TODO: Maybe move this to dwertheimer.TaskAutomations?
  test('dwertheimer.TaskAutomations - getTasksByType ', () => {
    const paragraphs = [
      {
        type: 'open',
        indents: 0,
        content: 'test content',
        rawContent: '* test content',
      },
      {
        type: 'scheduled',
        indents: 0,
        content: 'test content',
        rawContent: '* test content',
      },
    ]
    let taskList = getTasksByType(paragraphs)
    expect(taskList['open'].length).toEqual(1)
    expect(taskList['scheduled'].length).toEqual(1)
    expect(taskList['open'][0].content).toEqual(paragraphs[0].content)
  })

  test('dwertheimer.TaskAutomations - sortListBy alphabetical', () => {
    const paragraphs = [
      {
        type: 'open',
        indents: 0,
        content: 'test content',
        rawContent: '* test content',
      },
    ]
    let taskList = getTasksByType(paragraphs)
    let sorted = sortListBy(taskList['open'], 'content')
    expect(sorted[0].content).toEqual(paragraphs[0].content)
    //
    paragraphs.push({
      type: 'open',
      indents: 0,
      content: 'a test content',
      rawContent: '* a test content',
    })
    taskList = getTasksByType(paragraphs)
    sorted = sortListBy(taskList['open'], 'content')
    expect(sorted[0].content).toEqual(paragraphs[1].content)
  })
  test('dwertheimer.TaskAutomations - sortListBy -priority (!!!,!!,!)', () => {
    const paragraphs = [
      {
        type: 'open',
        indents: 0,
        content: 'test content !',
        rawContent: '* test content !',
      },
    ]
    paragraphs.push({
      type: 'open',
      indents: 0,
      content: 'a test content !!!',
      rawContent: '* a test content !!!',
    })
    paragraphs.push({
      type: 'open',
      indents: 0,
      content: 'a test content !!',
      rawContent: '* a test content !!',
    })
    const taskList = getTasksByType(paragraphs)
    const sorted = sortListBy(taskList['open'], '-priority')
    expect(sorted[0].content).toEqual(paragraphs[1].content)
    expect(sorted[1].content).toEqual(paragraphs[2].content)
  })
  test('dwertheimer.TaskAutomations - sortListBy priority (!,!!,!!!)', () => {
    const paragraphs = [
      {
        type: 'open',
        indents: 0,
        content: 'test content !',
        rawContent: '* test content !',
      },
    ]
    paragraphs.push({
      type: 'open',
      indents: 0,
      content: 'a test content !!!',
      rawContent: '* a test content !!!',
    })
    paragraphs.push({
      type: 'open',
      indents: 0,
      content: 'a test content !!',
      rawContent: '* a test content !!',
    })
    const taskList = getTasksByType(paragraphs)
    const sorted = sortListBy(taskList['open'], 'priority')
    expect(sorted[0].content).toEqual(paragraphs[0].content)
    expect(sorted[1].content).toEqual(paragraphs[2].content)
  })
})
