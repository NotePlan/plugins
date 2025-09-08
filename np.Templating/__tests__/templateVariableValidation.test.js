/**
 * @jest-environment node
 */

import { render } from '../lib/rendering/templateProcessor.js'
import { DataStore, Editor, CommandBar, NotePlan } from '@mocks/index'

// Jest globals
/* global describe, beforeEach, test, expect */

describe('Meeting Note Template Validation', () => {
  beforeEach(() => {
    global.DataStore = DataStore
    global.Editor = Editor
    global.CommandBar = CommandBar
    global.NotePlan = NotePlan
  })

  test('should pass validation when all meeting variables are available', async () => {
    const template = 'Meeting: <%= eventTitle %> at <%= eventLocation %>'
    const userData = {
      data: {
        eventTitle: 'Team Standup',
        eventLocation: 'Conference Room A',
      },
    }

    const result = await render(template, userData)
    expect(result).toBe('Meeting: Team Standup at Conference Room A')
  })

  test('should fail validation when meeting variables are missing', async () => {
    const template = 'Meeting: <%= eventTitle %> at <%= eventLocation %>'
    const userData = {
      data: {
        eventTitle: 'Team Standup',
        // Missing 'eventLocation' variable
      },
    }

    await expect(render(template, userData)).rejects.toThrow(/^STOPPING RENDER: Render Step 3\.5 stopped execution/)
  })

  test('should handle multiple meeting note variables', async () => {
    const template = `
# Meeting Notes: <%= eventTitle %>
**Date:** <%= eventDateValue %>
**Location:** <%= eventLocation %>
**Attendees:** <%= eventAttendees %>
    `
    const userData = {
      data: {
        eventTitle: 'Team Standup',
        eventDateValue: '2024-01-15',
        eventLocation: 'Conference Room A',
        // Missing 'eventAttendees' variable
      },
    }

    await expect(render(template, userData)).rejects.toThrow(/^STOPPING RENDER: Render Step 3\.5 stopped execution/)
  })

  test('should not validate non-meeting note templates', async () => {
    const template = 'Hello <%= name %>, your meeting is at <%= time %>'
    const userData = {
      data: {
        name: 'John',
        // Missing 'time' variable but this is not a meeting note template
      },
    }

    const result = await render(template, userData)
    // Should not fail validation since this is not a meeting note template
    expect(result).not.toContain('Template validation failed: The template you ran is designed to run on calendar events')
  })

  test('should ignore control structures and function calls', async () => {
    const template = `
<% if (condition) { %>
  Meeting: <%= eventTitle %>
<% } %>
<% for (let i = 0; i < attendees.length; i++) { %>
  Attendee <%= i %>: <%= attendees[i] %>
<% } %>
<%= someFunction() %>
    `
    const userData = {
      data: {
        condition: true,
        eventTitle: 'Team Meeting',
        attendees: ['John', 'Jane'],
        someFunction: () => 'function result',
      },
    }

    const result = await render(template, userData)
    // Should not fail validation since we're only checking for meeting note variables
    expect(result).not.toContain('Template validation failed: The template you ran is designed to run on calendar events')
  })

  test('should handle empty session data for meeting note template', async () => {
    const template = 'Meeting: <%= eventTitle %>'
    const userData = {
      data: {},
    }

    await expect(render(template, userData)).rejects.toThrow(/^STOPPING RENDER: Render Step 3\.5 stopped execution/)
  })

  test('should provide helpful error message for meeting notes', async () => {
    const template = 'Meeting: <%= eventTitle %>'
    const userData = {
      data: {},
    }

    await expect(render(template, userData)).rejects.toThrow(/^STOPPING RENDER: Render Step 3\.5 stopped execution/)
  })

  test('should detect all meeting note variables', async () => {
    const template = `
# <%= eventTitle %>
Notes: <%= eventNotes %>
Link: <%= eventLink %>
Calendar: <%= calendarItemLink %>
Attendees: <%= eventAttendees %>
Names: <%= eventAttendeeNames %>
Location: <%= eventLocation %>
Calendar: <%= eventCalendar %>
Date: <%= eventDateValue %>
End: <%= eventEndDateValue %>
    `
    const userData = {
      data: {
        eventTitle: 'Test Meeting',
        // Missing all other variables
      },
    }

    await expect(render(template, userData)).rejects.toThrow(/^STOPPING RENDER: Render Step 3\.5 stopped execution/)
  })

  test('should detect meeting note variables used as functions', async () => {
    const template = `
# <%= eventTitle %>
Date: <%= eventDate('YYYY-MM-DD') %>
Location: <%= eventLocation %>
    `
    const userData = {
      data: {
        eventTitle: 'Test Meeting',
        // Missing eventDate and eventLocation
      },
    }

    await expect(render(template, userData)).rejects.toThrow(/^STOPPING RENDER: Render Step 3\.5 stopped execution/)
  })
})
