// @flow

import { alert } from '../../helpers/userInput'
import { getOrMakeTemplateSection } from './support/configuration'
import Templating from './Templating'
import { DEFAULT_TEMPLATE_CONFIG } from './Templating'

const testTemplateFolder = '🧩 Templating Samples'
const templateFilenamePath = (templateName: string): string => {
  return `${testTemplateFolder}/${templateName}`
}

async function showError(method: string = '', message: string = ''): Promise<void> {
  const line = '*'.repeat(message.length + 30)
  console.log(line)
  console.log(`   ERROR`)
  console.log(`   Method: ${method}:`)
  console.log(`   Message: ${message}`)
  console.log(line)
  console.log('\n')
  Editor.insertTextAtCursor(`**Error: ${method}**\n- **${message}**`)
}

export async function templateInsatiation(): Promise<void> {
  try {
    const templating = new Templating(await getOrMakeTemplateSection())

    const response = await templating.heartbeat()

    Editor.insertTextAtCursor(response)
  } catch (error) {
    showError('templateInstantiation', error)
  }
}

export async function testFullTemplate(): Promise<void> {
  try {
    const templateInstance = new Templating(await getOrMakeTemplateSection())
    const result = await templateInstance.renderTemplate(templateFilenamePath('Test (Full Template)'), {})

    Editor.insertTextAtCursor(result)
  } catch (error) {
    showError('testFullTemplate', error)
  }
}

export async function testTemplateStandard(): Promise<void> {
  try {
    const templateInstance = new Templating(await getOrMakeTemplateSection())
    const result = await templateInstance.renderTemplate(templateFilenamePath('Test (Standard)'), {})

    Editor.insertTextAtCursor(result)
  } catch (error) {
    showError('testTemplateStandard', error)
  }
}

export async function testTemplateKitchenSink(): Promise<void> {
  try {
    // const currentNote = Editor.content || ''
    // const noteLength = currentNote.length
    // Editor.insertTextAtCursor('Please wait...')

    const custom = {
      data: {
        firstBorn: 'Joelle',
      },
      methods: {
        hello: function (str) {
          return `Hello ${str}`
        },
        hello2: async function (str) {
          return `Hello ${str} (async)`
        },
      },
    }

    const templateInstance = new Templating(await getOrMakeTemplateSection())
    const result = await templateInstance.renderTemplate('Test (Kitchen Sink)', custom)

    // Editor.replaceTextInCharacterRange(result, noteLength, 16384)
    Editor.insertTextAtCursor(result)
  } catch (error) {
    showError('testTemplateExtended', error)
  }
}

export async function testTemplateCustom(): Promise<void> {
  try {
    const custom = {
      hello: function (str) {
        return `Hello ${str}`
      },
      name: 'John Doe',
      names: ['mike', 'kira', 'joelle', 'brady', 'bailey', 'trevor'],
    }

    const templateInstance = new Templating(await getOrMakeTemplateSection())
    const result = await templateInstance.renderTemplate('Test (Custom)', custom)

    Editor.insertTextAtCursor(result)
  } catch (error) {
    showError('testTemplateCustom', error)
  }
}

export async function testTemplateTasks(): Promise<void> {
  try {
    const custom = {
      tasks: [
        { name: 'Item 1', completed: true },
        { name: 'Item 2', completed: false },
        { name: 'Item 3', completed: true },
        { name: 'Item 4', completed: false },
        { name: 'Item 5', completed: true },
      ],
    }

    const templateInstance = new Templating(await getOrMakeTemplateSection())
    const result = await templateInstance.renderTemplate('Test (Tasks)', custom)

    Editor.insertTextAtCursor(result)
  } catch (error) {
    showError('testTemplateTask', error)
  }
}

export async function testTemplateBooks(): Promise<void> {
  try {
    const custom = {
      books: [
        { TITLE: 'The Sobbing School: Poems', AUTHOR: 'Joshua Bennett' },
        { TITLE: `Ain't No Mo'`, AUTHOR: 'Jordan E. Cooper' },
        { TITLE: 'A Particular Kind of Black Man', AUTHOR: 'Tope Folarin' },
        { TITLE: 'Where We Stand', AUTHOR: 'Donnetta Lavinia Grays' },
        { TITLE: 'Invasive species', AUTHOR: 'Marwa Helal' },
        { TITLE: 'The Sirens of Mars', AUTHOR: 'Sarah Stewart Johnson' },
        { TITLE: 'The NotePlan Templating Guide', AUTHOR: 'Mike Erickson' },
      ],
    }

    const templateInstance = new Templating(await getOrMakeTemplateSection())
    const result = await templateInstance.renderTemplate('Test (Books)', custom)

    Editor.insertTextAtCursor(result)
  } catch (error) {
    showError(error)
  }
}

export async function testArticWolf(): Promise<void> {
  try {
    const custom = {
      type: 'meeting',
    }

    const templateInstance = new Templating(await getOrMakeTemplateSection())
    const result = await templateInstance.renderTemplate('Test (ArticWolf)', custom)

    Editor.insertTextAtCursor(result)
  } catch (error) {
    showError(error)
  }
}

export async function testMissingVariable(): Promise<void> {
  try {
    const templateInstance = new Templating(await getOrMakeTemplateSection())
    const result = await templateInstance.renderTemplate('Test (Missing Variable)', {})

    Editor.insertTextAtCursor(result)
  } catch (error) {
    showError(error)
  }
}

export async function testFrontmatter(): Promise<void> {
  try {
    const templateInstance = new Templating(await getOrMakeTemplateSection())
    const result = await templateInstance.renderTemplate(templateFilenamePath('Test (Frontmatter)'), {})

    Editor.insertTextAtCursor(result)
  } catch (error) {
    showError(error)
  }
}

export async function testTemplateAsync(): Promise<void> {
  try {
    const templateInstance = new Templating(await getOrMakeTemplateSection())
    const result = await templateInstance.renderTemplate('Test (Async)', {})

    Editor.insertTextAtCursor(result)
  } catch (error) {
    showError(error)
  }
}
