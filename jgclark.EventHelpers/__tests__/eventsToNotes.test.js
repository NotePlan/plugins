/* global describe, expect, test, toEqual */
import { sortByCalendarNameThenStartTime } from '../src/eventsToNotes'
import { clo } from '../../helpers/dev'

describe('eventsToNotes.js tests', () => {

  describe('sortByCalendarNameThenStartTime() using HH:MM-strings as times', () => {
    let mapForSorting: { cal: string, start: string, text: string }[] = []
    mapForSorting.push({cal:'calB', start:'09:00', text:'event string 1'})
    mapForSorting.push({cal:'calA', start:'10:00', text:'event string 2'})
    mapForSorting.push({cal:'calC', start:'11:00', text:'event string 3'})
    mapForSorting.push({cal:'calB', start:'11:00', text:'event string 4'})
    mapForSorting.push({cal:'calA', start:'23:00', text:'event string 5'})
    mapForSorting.push({cal:'calC', start:'00:00', text:'event string 6'})

    let sortedMap: { cal: string, start: string, text: string }[] = []
    sortedMap.push({cal:'calA', start:'10:00', text:'event string 2'})
    sortedMap.push({cal:'calA', start:'23:00', text:'event string 5'})
    sortedMap.push({cal:'calB', start:'09:00', text:'event string 1'})
    sortedMap.push({cal:'calB', start:'11:00', text:'event string 4'})
    sortedMap.push({cal:'calC', start:'00:00', text:'event string 6'})
    sortedMap.push({cal:'calC', start:'11:00', text:'event string 3'})
    
    test('should sort by calendar name then start time test for HH:MM style times', () => {
      const result = mapForSorting.sort(sortByCalendarNameThenStartTime())
      // clo(result)
      expect(result).toEqual(sortedMap)
    })
  })

  describe('sortByCalendarNameThenStartTime() using Dates', () => {
    let mapForSorting: { cal: string, start: Date, text: string }[] = []
    mapForSorting.push({cal:'calB', start:new Date(2021,0,1,9,0,0), text:'event string 1'})
    mapForSorting.push({cal:'calA', start:new Date(2021,0,1,10,0,0), text:'event string 2'})
    mapForSorting.push({cal:'calC', start:new Date(2021,0,1,11,0,0), text:'event string 3'})
    mapForSorting.push({cal:'calB', start:new Date(2021,0,1,11,0,0), text:'event string 4'})
    mapForSorting.push({cal:'calA', start:new Date(2021,0,1,23,0,0), text:'event string 5'})
    mapForSorting.push({cal:'calC', start:new Date(2021,0,1,0,0,0), text:'event string 6'})

    let sortedMap: { cal: string, start: Date, text: string }[] = []
    sortedMap.push({cal:'calA', start:new Date(2021,0,1,10,0,0), text:'event string 2'})
    sortedMap.push({cal:'calA', start:new Date(2021,0,1,23,0,0), text:'event string 5'})
    sortedMap.push({cal:'calB', start:new Date(2021,0,1,9,0,0), text:'event string 1'})
    sortedMap.push({cal:'calB', start:new Date(2021,0,1,11,0,0), text:'event string 4'})
    sortedMap.push({cal:'calC', start:new Date(2021,0,1,0,0,0), text:'event string 6'})
    sortedMap.push({cal:'calC', start:new Date(2021,0,1,11,0,0), text:'event string 3'})
    
    test('should sort by calendar name then start time test H:MM A style times', () => {
      const result = mapForSorting.sort(sortByCalendarNameThenStartTime())
      // clo(result)
      expect(result).toEqual(sortedMap)
    })
  })

})
