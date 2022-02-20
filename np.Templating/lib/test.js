import { get8601String } from '../../dwertheimer.DateAutomations/src/dateFunctions'

const test = {
  hello: () => {
    return 'hello world'
  },
  date8601: async (): Promise<string> => {
    // return await get8601String()
    return 'hello world'
  },
}

export default test
