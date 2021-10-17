// @flow

import { debug } from '../../helpers/general'
import { alert } from '../../helpers/userInput'

import { getOrMakeTemplateFolder } from '../../nmn.Templates/src/template-folder'
import Templating from './support/Templating'

export async function templateRender(templateTitle: string = '', data: mixed = {}, options: mixed = {}): Promise<void> {
  const templateFolder = await getOrMakeTemplateFolder()

  const templateData = await DataStore.projectNoteByTitle(templateTitle, true, false)?.[0]

  const renderedData = await Templating.render(templateData, data, options)

  console.log(renderedData)

  Editor.insertTextAtCursor(renderedData)
}

export async function testFullTemplate(): Promise<void> {
  const templateName = 'np.Templating (Full Template)'

  const templateContent = await Templating.getTemplate(templateName)

  const result = await Templating.render(templateContent, {}, { extended: false })

  Editor.insertTextAtCursor(result)
}

export async function testTemplateStandard(): Promise<void> {
  const templateName = 'np.Templating (Standard)'

  const templateContent = await Templating.getTemplate(templateName)

  const result = await Templating.render(templateContent, {}, { extended: false })

  Editor.insertTextAtCursor(result)
}

export async function testTemplateKitchenSink(): Promise<void> {
  try {
    const currentNote = Editor.content || ''
    const noteLength = currentNote.length
    console.log(noteLength)

    Editor.insertTextAtCursor('Please wait...')

    const templateName = 'np.Templating (Kitchen Sink)'

    const templateContent = await Templating.getTemplate(templateName)

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

    // const result = await Templating.render(templateContent, custom, { extended: true })
    const result = await Templating.render(templateContent, custom, { extended: true })

    Editor.replaceTextInCharacterRange(result, noteLength - 5, 16384)
  } catch (error) {
    debug('testTemplateExtended', error)
  }
}

export async function testTemplateCustom(): Promise<void> {
  const templateName = 'np.Templating (Custom)'

  const templateContent = await Templating.getTemplate(templateName)

  const custom = {
    hello: function (str) {
      return `Hello ${str}`
    },
    name: 'John Doe',
    names: ['mike', 'kira', 'joelle', 'brady', 'bailey', 'trevor'],
  }

  const result = await Templating.render(templateContent, custom, { extended: true })

  Editor.insertTextAtCursor(result)
}

export async function testTemplateTasks(): Promise<void> {
  const templateName = 'np.Templating (Tasks)'

  const templateContent = await Templating.getTemplate(templateName)

  const custom = {
    tasks: [
      { name: 'Item 1', completed: true },
      { name: 'Item 2', completed: false },
      { name: 'Item 3', completed: true },
      { name: 'Item 4', completed: false },
      { name: 'Item 5', completed: true },
    ],
  }

  const result = await Templating.render(templateContent, custom, { extended: true })

  Editor.insertTextAtCursor(result)
}

export async function testTemplateBooks(): Promise<void> {
  const templateName = 'np.Templating (Books)'

  const templateContent = await Templating.getTemplate(templateName)

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

  const result = await Templating.render(templateContent, custom, { extended: true })

  Editor.insertTextAtCursor(result)
}

export async function testArticWolf(): Promise<void> {
  const templateName = 'np.Templating (ArticWolf)'

  const templateContent = await Templating.getTemplate(templateName)

  console.log(templateContent)

  const custom = {
    type: 'meeting',
  }

  const result = await Templating.render(templateContent, custom, { extended: true })

  // Editor.insertTextAtCursor(result)
  Editor.insertTextAtCursor(templateContent)
}
