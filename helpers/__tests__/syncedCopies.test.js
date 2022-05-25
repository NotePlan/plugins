import colors from 'chalk'
import * as sc from '../syncedCopies'

const FILE = `${colors.yellow('helpers/syncedCopies')}`
const section = colors.blue

describe(`${FILE}`, () => {
  describe(section('textWithoutSyncedCopyTag'), () => {
    test('should remove sync copy tag by itself ^x29vcq', () => {
      expect(sc.textWithoutSyncedCopyTag(' ^x29vcq')).toEqual('')
    })
    test('beginning of line also works with no space', () => {
      expect(sc.textWithoutSyncedCopyTag('^x29vcq')).toEqual('')
    })
    test('should remove sync copy tag and leave text', () => {
      expect(sc.textWithoutSyncedCopyTag('a ^x29vcq')).toEqual('a')
    })
    test('should not remove anything if tag does not match regex', () => {
      expect(sc.textWithoutSyncedCopyTag('a ^x29vc')).toEqual('a ^x29vc')
    })
    test('should remove anything if tag is in middle of line', () => {
      expect(sc.textWithoutSyncedCopyTag('a ^x29vcq xx')).toEqual('a xx')
    })
  })
})
