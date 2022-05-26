// @Flow

import FrontmatterModule from '@templatingModules/FrontmatterModule'
import pluginJson from '../../plugin.json'
import { log, logError, clo, timer, JSP, copyObject } from '../../../helpers/dev'

export function getFrontMatter(note: TEditor | TNote) {
  const { frontmatterAttributes, frontmatterBody } = new FrontmatterModule().parse(note.content)
  clo(frontmatterAttributes, `frontmatterAttributes`)
  clo(frontmatterBody, `frontmatterBody`)
  return frontmatterAttributes
}
