// @flow

import { getOrMakeTemplateFolder } from '../../nmn.Templates/src/template-folder'
import Templating from './support/Templating'

export async function templateRender(templateTitle: string = '', data: mixed = {}, options: mixed = {}): Promise<void> {
  const templateFolder = await getOrMakeTemplateFolder()

  const templateData = await DataStore.projectNoteByTitle(templateTitle, true, false)?.[0]

  const renderedData = await Templating.render(templateData, data, options)

  console.log(renderedData)

  Editor.insertTextAtCursor(renderedData)
}

export async function testTemplateStandard(): Promise<void> {
  const templateName = 'np.Templating Tester (Standard)'

  const templateContent = await Templating.getTemplate(templateName)

  const result = await Templating.render(templateContent, {}, { extended: false })

  Editor.insertTextAtCursor(result)
}

export async function testTemplateExtended(): Promise<void> {
  const templateName = 'np.Templating Tester (Extended)'

  const templateContent = await Templating.getTemplate(templateName)

  const custom = {
    hello: function (str) {
      return `Hello ${str}`
    },
  }

  const result = await Templating.render(templateContent, custom, { extended: true })

  Editor.insertTextAtCursor(result)
}

export async function testTemplateCustom(): Promise<void> {
  const templateName = 'np.Templating Tester (Custom)'

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
  const templateName = 'np.Templating Tester (Tasks)'

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
  const templateName = 'np.Templating Tester (Books)'

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
