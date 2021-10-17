// @flow

import { debug } from '../../helpers/general'
import { alert } from '../../helpers/userInput'

import { getOrMakeTemplateFolder } from '../../nmn.Templates/src/template-folder'
import { getOrMakeConfigurationSection } from './support/configuration'

import Templating from './Templating'

async function templateConfig(): Promise<any> {
  return await getOrMakeConfigurationSection('templates')
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
    const templating = new Templating(await templateConfig())

    const response = await templating.heartbeat()

    Editor.insertTextAtCursor(response)
  } catch (error) {
    showError('templateInstantiation', error)
  }
}

export async function testFullTemplate(): Promise<void> {
  try {
    const templateConfig: any = await getOrMakeConfigurationSection('templates')

    const templateInstance = new Templating(templateConfig)
    const templateContent = await templateInstance.getTemplate('np.Templating (Full Template)')

    const result = await templateInstance.render(templateContent, {}, { extended: false })

    Editor.insertTextAtCursor(result)
  } catch (error) {
    showError('testFullTemplate', error)
  }
}

export async function testTemplateStandard(): Promise<void> {
  try {
    const templateConfig: any = await getOrMakeConfigurationSection('templates')

    const templateInstance = new Templating(templateConfig)
    const templateContent = await templateInstance.getTemplate('np.Templating (Standard)')

    const result = await templateInstance.render(templateContent, {}, { extended: false })

    Editor.insertTextAtCursor(result)
  } catch (error) {
    showError('testTemplateStandard', error)
  }
}

export async function testTemplateKitchenSink(): Promise<void> {
  try {
    const templateConfig: any = await getOrMakeConfigurationSection('templates')

    // const currentNote = Editor.content || ''
    // const noteLength = currentNote.length

    // Editor.insertTextAtCursor('Please wait...')

    const templateInstance = new Templating(templateConfig)
    const templateContent = await templateInstance.getTemplate('np.Templating (Kitchen Sink)')

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

    const result = await templateInstance.render(templateContent, custom, { extended: true })

    // Editor.replaceTextInCharacterRange(result, noteLength, 16384)
    Editor.insertTextAtCursor(result)
  } catch (error) {
    debug('testTemplateExtended', error)
  }
}

export async function testTemplateCustom(): Promise<void> {
  try {
    const templateConfig: any = await getOrMakeConfigurationSection('templates')

    const templateInstance = new Templating(templateConfig)
    const templateContent = await templateInstance.getTemplate('np.Templating (Custom)')

    const custom = {
      hello: function (str) {
        return `Hello ${str}`
      },
      name: 'John Doe',
      names: ['mike', 'kira', 'joelle', 'brady', 'bailey', 'trevor'],
    }

    const result = await templateInstance.render(templateContent, custom, { extended: true })

    Editor.insertTextAtCursor(result)
  } catch (error) {
    showError('testTemplateCustom', error)
  }
}

export async function testTemplateTasks(): Promise<void> {
  try {
    const templateConfig: any = await getOrMakeConfigurationSection('templates')

    const templateInstance = new Templating(templateConfig)
    const templateContent = await templateInstance.getTemplate('np.Templating (Tasks)')

    const custom = {
      tasks: [
        { name: 'Item 1', completed: true },
        { name: 'Item 2', completed: false },
        { name: 'Item 3', completed: true },
        { name: 'Item 4', completed: false },
        { name: 'Item 5', completed: true },
      ],
    }

    const result = await templateInstance.render(templateContent, custom, { extended: true })

    Editor.insertTextAtCursor(result)
  } catch (error) {
    showError('testTemplateTask', error)
  }
}

export async function testTemplateBooks(): Promise<void> {
  try {
    const templateConfig: any = await getOrMakeConfigurationSection('templates')

    const templateInstance = new Templating(templateConfig)
    const templateContent = await templateInstance.getTemplate('np.Templating (Books)')

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

    const result = await templateInstance.render(templateContent, custom, { extended: true })

    Editor.insertTextAtCursor(result)
  } catch (error) {
    showError(error)
  }
}

export async function testArticWolf(): Promise<void> {
  try {
    const templateConfig: any = await getOrMakeConfigurationSection('templates')

    const templateInstance = new Templating(templateConfig)
    const templateContent = await templateInstance.getTemplate('np.Templating (ArticWolf)')

    const custom = {
      type: 'meeting',
    }

    const result = await templateInstance.render(templateContent, custom)

    // Editor.insertTextAtCursor(result)
    Editor.insertTextAtCursor(result)
  } catch (error) {
    showError(error)
  }
}
