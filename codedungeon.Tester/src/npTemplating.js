// @flow

/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

import NPTemplating from 'NPTemplating'
import TemplatingEngine from 'TemplatingEngine'
import { getWeatherSummary } from '../../nmn.Templates/src/weather'
import { showError } from './lib/testerUtils'
import BiblePlugin from './plugins/templating/BiblePlugin'
import BiblePluginClass from './plugins/templating/BiblePluginClass'

const MAX_NOTE = 262144

const testTemplateFolder = '🧩 Templating Samples'

const templateFilenamePath = (templateName: string): string => {
  return `${testTemplateFolder}/${templateName}`
}

export async function templatingHelloWorld(): Promise<void> {
  try {
    const result = await NPTemplating.renderTemplate('Template (Hello World)', {})

    Editor.insertTextAtCursor(result)
  } catch (error) {
    showError('templateInstantiation', error)
  }
}

export async function templatingHeartbeat(): Promise<void> {
  try {
    const response = await NPTemplating.heartbeat()

    Editor.insertTextAtCursor(response)
  } catch (error) {
    showError('templateInstantiation', error)
  }
}

export async function templatingDateModule(): Promise<void> {
  try {
    const content: string = Editor.content || ''
    Editor.insertTextAtCursor('Please wait...')

    const result = await NPTemplating.renderTemplate(templateFilenamePath('Test (DateModule)'), {})

    Editor.replaceTextInCharacterRange(content + result, 0, MAX_NOTE)
  } catch (error) {
    showError('testTemplateStandard', error)
  }
}

export async function templatingCustom(): Promise<void> {
  try {
    const custom = {
      hello: function (str) {
        return `Hello ${str}`
      },
      name: 'John Doe',
      names: ['mike', 'kira', 'joelle', 'brady', 'bailey', 'trevor'],
    }

    const result = await NPTemplating.renderTemplate('Test (Custom)', custom)

    Editor.insertTextAtCursor(result)
  } catch (error) {
    showError('testTemplateCustom', error)
  }
}

export async function templatingTasks(): Promise<void> {
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

    const result = await NPTemplating.renderTemplate('Test (Tasks)', custom)

    Editor.insertTextAtCursor(result)
  } catch (error) {
    showError('testTemplateTask', error)
  }
}

export async function templatingKitchenSink(): Promise<void> {
  try {
    const content: string = Editor.content || ''
    Editor.insertTextAtCursor('Please wait...')

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

    const result = await NPTemplating.renderTemplate('Test (Kitchen Sink)', custom)

    Editor.replaceTextInCharacterRange(content + result, 0, MAX_NOTE)
  } catch (error) {
    showError('testTemplateExtended', error)
  }
}

export async function templatingBooks(): Promise<void> {
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

    const result = await NPTemplating.renderTemplate('Test (Books)', custom)

    Editor.insertTextAtCursor(result)
  } catch (error) {
    showError(error)
  }
}

export async function templatingArticWolf(): Promise<void> {
  try {
    const custom = {
      type: 'meeting',
    }

    const result = await NPTemplating.renderTemplate('Test (ArticWolf)', custom)

    Editor.insertTextAtCursor(result)
  } catch (error) {
    showError(error)
  }
}

export async function templatingFullTemplate(): Promise<void> {
  try {
    const content: string = Editor.content || ''
    Editor.insertTextAtCursor('Please wait...')

    const result = await NPTemplating.renderTemplate(templateFilenamePath('Test (Full Template)'), {})

    Editor.replaceTextInCharacterRange(content + result, 0, MAX_NOTE)
  } catch (error) {
    showError('testFullTemplate', error)
  }
}

export async function templatingMissingVariable(): Promise<void> {
  try {
    const result = await NPTemplating.renderTemplate('Test (Missing Variable)', {})

    Editor.insertTextAtCursor(result)
  } catch (error) {
    showError(error)
  }
}

export async function templatingFrontmatter(): Promise<void> {
  try {
    const result = await NPTemplating.renderTemplate(templateFilenamePath('Test (Frontmatter)'), {})

    Editor.insertTextAtCursor(result)
  } catch (error) {
    showError(error)
  }
}

export async function templatingAsync(): Promise<void> {
  try {
    const content: string = Editor.content || ''
    Editor.insertTextAtCursor('Please wait...')

    const result = await NPTemplating.renderTemplate('Test (Async)', {})

    Editor.replaceTextInCharacterRange(content + result, 0, MAX_NOTE)
  } catch (error) {
    showError(error)
  }
}

export async function templatingWeather(): Promise<void> {
  try {
    const content: string = Editor.content || ''
    Editor.insertTextAtCursor('Please wait...')

    const renderObj = {
      weather: async () => {
        return await getWeatherSummary('')
      },
    }
    const result = await NPTemplating.renderTemplate('Test (Weather)', renderObj)

    Editor.replaceTextInCharacterRange(content + result, 0, MAX_NOTE)
  } catch (error) {
    showError(error)
  }
}

export async function templatingVerse(): Promise<void> {
  try {
    const content: string = Editor.content || ''
    Editor.insertTextAtCursor('Please wait...')

    const result = await NPTemplating.renderTemplate('Test (Verse)')

    Editor.replaceTextInCharacterRange(content + result, 0, MAX_NOTE)
  } catch (error) {
    showError(error)
  }
}

export async function templatingRender(): Promise<void> {
  try {
    const tmpData = {
      data: {
        myVar: 'hello world',
      },
    }
    const result = await NPTemplating.render('Test <%= date.now("", -7) %>', tmpData, { prompt: true })

    Editor.insertTextAtCursor(result)
  } catch (error) {
    showError(error)
  }
}

export async function templatingPlugin(): Promise<void> {
  try {
    const templateInstance = new TemplatingEngine()
    const testPlugin = async (name: string = 'world', count: number = 0) => {
      return `hello ${name} w/ ${count}`
    }

    await templateInstance.register('testPlugin', testPlugin)

    // await templateInstance.register('testPlugin', (name: string = 'world', count: number = 0) => {
    //   return `hello ${name} w/ ${count}`
    // })

    const name = 'Miguel'
    const count = 5
    const result = await templateInstance.render('<%- await testPlugin(`${name}`,`${count}`) %>', { name, count })

    Editor.insertTextAtCursor(result)
  } catch (error) {
    showError(error)
  }
}

export async function templatingPrompt(): Promise<void> {
  try {
    const result = await NPTemplating.renderTemplate('Test (Prompt)', { lname: 'Erickson' }, { usePrompts: true })

    Editor.insertTextAtCursor(result)
  } catch (error) {
    showError(error)
  }
}

// NOTE: This example will use a custom Templating Plugin Module (standard JavaScript object)
export async function templatingPluginModule(): Promise<void> {
  try {
    // create TemplatingEngine instance, it will be used to register plugins
    const templateInstance = new TemplatingEngine()

    // register templating plugin
    await templateInstance.register('bible', BiblePlugin)

    // NOTE: This is included to demonstrate what happens whwen you use an ES6 class as Templating Plugin Module
    // INFO: Which is NOT supported at this time
    await templateInstance.register('bibleClass', BiblePluginClass)

    // TemplatingEngine does not have access to NotePlan API, thus we need to load template and pass to `.render` below
    const templateData: string = await NPTemplating.getTemplate('Test (Plugin Module)')

    // render template
    const result = await templateInstance.render(templateData)

    // write template rendered result
    Editor.insertTextAtCursor(result)
  } catch (error) {
    showError(error)
  }
}

class Test {}
