/* global describe, expect, test, toEqual */
import { sortByCalendarNameAndStartTime } from '../src/eventsToNotes'

describe('eventsToNotes.js tests', () => {

  describe('sortByCalendarNameAndStartTime()', () => {
    let sortedMap: { cal: string, start: string, text: string }[] = []
    sortedMap.push({cal:'calA',start:'10:00', text:'event string 2'})
    sortedMap.push({cal:'calA',start:'23:00', text:'event string 5'})
    sortedMap.push({cal:'calB',start:'09:00', text:'event string 1'})
    sortedMap.push({cal:'calB',start:'12:00', text:'event string 4'})
    sortedMap.push({cal:'calC',start:'11:00', text:'event string 3'})

    let mapForSorting: { cal: string, start: string, text: string }[] = []
    mapForSorting.push({cal:'calB',start:'09:00', text:'event string 1'})
    mapForSorting.push({cal:'calA',start:'10:00', text:'event string 2'})
    mapForSorting.push({cal:'calC',start:'11:00', text:'event string 3'})
    mapForSorting.push({cal:'calB',start:'12:00', text:'event string 4'})
    mapForSorting.push({cal:'calA',start:'23:00', text:'event string 5'})
    mapForSorting.push({cal:'calC',start:'11:00', text:'event string 6'})

    test('should sort by calendar name then start time test 1', () => {
      const result = mapForSorting.sort(sortByCalendarNameAndStartTime())
      console.log(result)
      expect(result).toEqual(sortedMap)
    })
  })

})
