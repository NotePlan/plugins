/* eslint-disable */
// @flow

import { processPrompts } from '../lib/support/modules/prompts/PromptRegistry'
import NPTemplating from '../lib/NPTemplating'
import { getTags } from '../lib/core'
import '../lib/support/modules/prompts' // Import to register all prompt handlers

/* global describe, test, expect, jest, beforeEach, beforeAll */

describe('Template Variable Assignment Integration Tests', () => {
  beforeEach(() => {
    // Setup the necessary global mocks
    global.DataStore = {
      settings: { logLevel: 'none' },
    }

    // Mock CommandBar for consistent responses across all prompt types
    // This ensures all prompt types return 'Work' regardless of implementation
    global.CommandBar = {
      textPrompt: jest.fn(() => Promise.resolve('Work')),
      showOptions: jest.fn((options, message) => {
        return Promise.resolve({ value: 'Work' })
      }),
    }
  })

  test('should correctly process template with variable assignment', async () => {
    const template = `
# Project Template
<% const category = promptKey("category") -%>
<% if (category === 'Work') { -%>
Work project: foo
<% } else { -%>
Personal project: bar
<% } -%>

Project status: <% const status = promptKey("status") -%><%- status %>

Tags: <% const selectedTag = promptTag("Select a tag:") -%><%- selectedTag %>
`

    // Process the template
    const { sessionTemplateData, sessionData } = await processPrompts(template, {})

    // Verify the session data contains our variables
    expect(sessionData).toHaveProperty('category')
    expect(sessionData).toHaveProperty('status')
    expect(sessionData).toHaveProperty('selectedTag')

    // Verify that the prompt tags were correctly replaced with their variable references
    expect(sessionTemplateData).not.toContain('promptKey("category")')
    expect(sessionTemplateData).not.toContain('promptKey("status")')
    expect(sessionTemplateData).not.toContain('promptTag("Select a tag:")')

    // Verify the session data values match our mock responses
    expect(sessionData.category).toBe('Work')
    expect(sessionData.status).toBe('Work')
    expect(sessionData.selectedTag).toBe('#Work')
  })

  test('should handle multiple variable assignments in a complex template', async () => {
    const template = `
# Complex Project Template
<% const projectType = promptKey("projectType") -%>
<% const priority = promptKey("priority") -%>
<% const dueDate = promptDate("When is this due?") -%>
<% let assignee = promptMention("Who is assigned?") -%>

**Project Type:** <%- projectType %>
**Priority:** <%- priority %>
**Due Date:** <%- dueDate %>
**Assigned To:** <%- assignee %>

<% if (priority === 'High') { -%>
## Urgent Follow-up Required
<% } -%>

## Tasks
<% const task1 = promptKey("firstTask") -%>
- [ ] <%- task1 %>
<% if (projectType === 'Development') { -%>
- [ ] Create pull request
- [ ] Request code review
<% } -%>
`

    // Process the template
    const { sessionTemplateData, sessionData } = await processPrompts(template, {})

    // Verify all variables were set in the session data
    expect(sessionData).toHaveProperty('projectType')
    expect(sessionData).toHaveProperty('priority')
    expect(sessionData).toHaveProperty('dueDate')
    expect(sessionData).toHaveProperty('assignee')
    expect(sessionData).toHaveProperty('task1')

    // Verify that all prompt tags were replaced with variable references
    expect(sessionTemplateData).not.toContain('promptKey("projectType")')
    expect(sessionTemplateData).not.toContain('promptKey("priority")')
    expect(sessionTemplateData).not.toContain('promptDate("When is this due?")')
    expect(sessionTemplateData).not.toContain('promptMention("Who is assigned?")')
    expect(sessionTemplateData).not.toContain('promptKey("firstTask")')

    // Verify the variables were interpolated correctly
    expect(sessionTemplateData).toContain(`**Project Type:** <%- projectType %>`)
    expect(sessionTemplateData).toContain(`**Priority:** <%- priority %>`)
    expect(sessionTemplateData).toContain(`**Due Date:** <%- dueDate %>`)
    expect(sessionTemplateData).toContain(`**Assigned To:** <%- assignee %>`)
    expect(sessionTemplateData).toContain(`- [ ] <%- task1 %>`)
  })
})
