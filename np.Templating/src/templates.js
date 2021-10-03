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

  const custom = {
    format: function (str) {
      return str
    },
  }
  const result = await Templating.render(templateContent, custom, { extended: false })

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
