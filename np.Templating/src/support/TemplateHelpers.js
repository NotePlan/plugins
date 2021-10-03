import dayjs from 'dayjs'

export default class TemplateHelpers {
  constructor() {
    console.log('TemplateHelpers.constructor')
  }
  now(format = 'YYYY-MM-DD') {
    return dayjs().format(format)
  }
}
