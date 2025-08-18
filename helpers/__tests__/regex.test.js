/* globals describe, expect, test */

import { RE_BARE_URI_MATCH_G, RE_TEAMSPACE_NOTE_UUID } from '../regex'

describe('Tests for RE_BARE_URI_MATCH_G', () => {
  test('should match standard protocols', () => {
    const text = 'Check out https://example.com/ and http://test.org'
    const matches = Array.from(text.matchAll(RE_BARE_URI_MATCH_G))
    expect(matches).toHaveLength(2)
    expect(matches[0][1]).toBe('https://example.com/')
    expect(matches[1][1]).toBe('http://test.org')
  })

  test('should match sftp protocol', () => {
    const text = 'Check out sftp://example.com.'
    const matches = Array.from(text.matchAll(RE_BARE_URI_MATCH_G))
    expect(matches).toHaveLength(1)
    expect(matches[0][1]).toContain('sftp://example.com')
  })

  test('match strange URI-like protocols', () => {
    const text = 'Contact mailto:user_bob@example.com or tel:+123-456-7890'
    const matches = Array.from(text.matchAll(RE_BARE_URI_MATCH_G))
    expect(matches).toHaveLength(2)
    expect(matches[0][1]).toBe('mailto:user_bob@example.com')
    expect(matches[1][1]).toBe('tel:+123-456-7890')
  })

  test('should match URIs with paths and query parameters', () => {
    const text = 'Go to https://example.com/path?query=value&other=123'
    const matches = Array.from(text.matchAll(RE_BARE_URI_MATCH_G))
    expect(matches).toHaveLength(1)
    expect(matches[0][1]).toBe('https://example.com/path?query=value&other=123')
  })

  test('should NOT match URIs in markdown links', () => {
    const text = 'Check [this link](https://example.com) [or this link](https://test.org)'
    const matches = Array.from(text.matchAll(RE_BARE_URI_MATCH_G))
    expect(matches).toHaveLength(0)
  })

  test('should NOT match this markdown link either', () => {
    const text = 'this has [a valid MD link](https://www.something.com/with?various&chars%20ok)'
    const matches = Array.from(text.matchAll(RE_BARE_URI_MATCH_G))
    expect(matches).toHaveLength(0)
  })

  test('should match multiple URIs in text', () => {
    const text = 'Links: https://a.com, http://b.org, www.c.net'
    const matches = Array.from(text.matchAll(RE_BARE_URI_MATCH_G))
    expect(matches).toHaveLength(3)
    expect(matches[0][1]).toContain('https://a.com')
    expect(matches[1][1]).toContain('http://b.org')
    expect(matches[2][1]).toBe('www.c.net')
  })

  test('should match URIs with special characters', () => {
    const text = 'Visit https://example.com/path-with-hyphens/and_underscores?param=value#section ok'
    const matches = Array.from(text.matchAll(RE_BARE_URI_MATCH_G))
    expect(matches).toHaveLength(1)
    expect(matches[0][1]).toBe('https://example.com/path-with-hyphens/and_underscores?param=value#section')
  })

  test('should match www domains', () => {
    const text = 'Visit www.example.com for more info'
    const matches = Array.from(text.matchAll(RE_BARE_URI_MATCH_G))
    expect(matches).toHaveLength(1)
    expect(matches[0][1]).toBe('www.example.com')
  })

  test('should match URIs at start of text', () => {
    const text = 'https://example.com is a website'
    const matches = Array.from(text.matchAll(RE_BARE_URI_MATCH_G))
    expect(matches).toHaveLength(1)
    expect(matches[0][1]).toBe('https://example.com')
  })

  test('should match URIs after punctuation', () => {
    const text = 'See: https://example.com and https://test.org'
    const matches = Array.from(text.matchAll(RE_BARE_URI_MATCH_G))
    expect(matches).toHaveLength(2)
    expect(matches[0][1]).toBe('https://example.com')
    expect(matches[1][1]).toBe('https://test.org')
  })

  test('should match mixed bare URIs and avoid markdown links', () => {
    const text = 'Visit https://example.com but not [this](https://hidden.com) or https://another.com'
    const matches = Array.from(text.matchAll(RE_BARE_URI_MATCH_G))
    expect(matches).toHaveLength(2)
    expect(matches[0][1]).toBe('https://example.com')
    expect(matches[1][1]).toBe('https://another.com')
  })

  test('should handle URIs in sentences with punctuation', () => {
    const text = 'Visit https://example.com. Also check www.test.org, okay?'
    const matches = Array.from(text.matchAll(RE_BARE_URI_MATCH_G))
    expect(matches).toHaveLength(2)
    expect(matches[0][1]).toContain('https://example.com')
    expect(matches[1][1]).toContain('www.test.org')
  })

  // Note: Ideally would exclude trailing punctuation from URIs, but this hasn't proved possible yet
  test.skip('should exclude trailing punctuation from URIs', () => {
    const text = 'Links: https://example.com, www.test.org; and https://another.com!'
    const matches = Array.from(text.matchAll(RE_BARE_URI_MATCH_G))
    expect(matches).toHaveLength(3)
    expect(matches[0][1]).toBe('https://example.com')
    expect(matches[1][1]).toBe('www.test.org')
    expect(matches[2][1]).toBe('https://another.com')
  })
})

describe('Tests for RE_TEAMSPACE_NOTE_UUID', () => {
  test('should match a Teamspace note UUID', () => {
    const text = '%%NotePlanCloud%%/1b91b194-4c76-4a48-8d4d-4c499d64a919/9972af6a-ec7a-4fe5-87b9-9005aa0d122c'
    const matches = text.match(RE_TEAMSPACE_NOTE_UUID)
    expect(matches[1]).toBe('9972af6a-ec7a-4fe5-87b9-9005aa0d122c')
  })
  test('should match a Teamspace note UUID in a folder', () => {
    const text = '%%NotePlanCloud%%/c484b190-77dd-4d40-a05c-e7d7144f24e1/test folder/5a31e9ea-732f-45ba-8464-11260522e0de'
    const matches = text.match(RE_TEAMSPACE_NOTE_UUID)
    expect(matches[1]).toBe('5a31e9ea-732f-45ba-8464-11260522e0de')
  })
  test('should not match a non-Teamspace note UUID', () => {
    const text = '/TEST/teamspace testing.md'
    const matches = text.match(RE_TEAMSPACE_NOTE_UUID)
    expect(matches).toBeNull()
  })
  test('should not match a Teamspace folder path only', () => {
    const text = '%%NotePlanCloud%%/c484b190-77dd-4d40-a05c-e7d7144f24e1/test folder'
    const matches = text.match(RE_TEAMSPACE_NOTE_UUID)
    expect(matches).toBeNull()
  })
})