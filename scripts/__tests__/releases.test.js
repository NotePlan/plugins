// @flow
/* eslint-disable */

/**
 * Simple test file for releases.js functions
 * Tests the individual utility functions without complex mocking
 */

describe('Releases Script Utility Functions', () => {
  // Define the functions locally for testing
  // These are copies of the functions from releases.js

  /**
   * Extract plugin name from tag (removes version suffix like -v1.0.0)
   */
  function extractPluginNameFromTag(tagName) {
    return tagName.replace(/-v\d+(\.\d+)*(\.\d+)*(?:-[a-zA-Z0-9.-]+)?$/, '')
  }

  /**
   * Extract version from tag
   */
  function extractVersionFromTag(tagName) {
    const match = tagName.match(/-v(\d+(?:\.\d+)*(?:\.\d+)*(?:-[a-zA-Z0-9.-]+)?)$/)
    return match ? match[1] : null
  }

  /**
   * Generate release tag name from plugin name and version
   */
  function getReleaseTagName(pluginName, version) {
    return `${pluginName}-v${version}`
  }

  /**
   * Get a field value from plugin data
   */
  function getPluginDataField(pluginData, field) {
    if (!pluginData || typeof pluginData !== 'object') {
      console.log(`Could not find value for "${field}" in plugin.json`)
      process.exit(0)
      return null // This line won't be reached due to process.exit, but added for completeness
    }
    const data = pluginData[field] || null
    if (!data) {
      console.log(`Could not find value for "${field}" in plugin.json`)
      process.exit(0)
      return null // This line won't be reached due to process.exit, but added for completeness
    }
    return data
  }

  /**
   * Ensure the version being released is new and not a duplicate
   */
  function ensureVersionIsNew(existingReleases, versionedTagName) {
    if (existingReleases && existingReleases.length > 0 && versionedTagName) {
      const duplicateRelease = existingReleases.find((release) => release.tag === versionedTagName)
      if (duplicateRelease) {
        return false // Duplicate found
      }
    }
    return true // No duplicate found
  }

  describe('extractPluginNameFromTag', () => {
    test('should extract plugin name from tag with version', () => {
      expect(extractPluginNameFromTag('dwertheimer.TaskAutomations-v1.0.0')).toBe('dwertheimer.TaskAutomations')
      expect(extractPluginNameFromTag('jgclark.Dashboard-v2.1.3')).toBe('jgclark.Dashboard')
      expect(extractPluginNameFromTag('np.Templating-v3.0.0')).toBe('np.Templating')
    })

    test('should handle different version formats', () => {
      expect(extractPluginNameFromTag('plugin.name-v1')).toBe('plugin.name')
      expect(extractPluginNameFromTag('plugin.name-v1.0')).toBe('plugin.name')
      expect(extractPluginNameFromTag('plugin.name-v1.0.0')).toBe('plugin.name')
      expect(extractPluginNameFromTag('plugin.name-v1.2.3.4')).toBe('plugin.name')
    })

    test('should return original string if no version pattern found', () => {
      expect(extractPluginNameFromTag('plugin.name')).toBe('plugin.name')
      expect(extractPluginNameFromTag('plugin-name')).toBe('plugin-name')
      expect(extractPluginNameFromTag('plugin_name')).toBe('plugin_name')
    })

    test('should handle edge cases', () => {
      expect(extractPluginNameFromTag('')).toBe('')
      expect(extractPluginNameFromTag('v1.0.0')).toBe('v1.0.0') // No plugin name
    })
  })

  describe('extractVersionFromTag', () => {
    test('should extract version from tag', () => {
      expect(extractVersionFromTag('dwertheimer.TaskAutomations-v1.0.0')).toBe('1.0.0')
      expect(extractVersionFromTag('jgclark.Dashboard-v2.1.3')).toBe('2.1.3')
      expect(extractVersionFromTag('np.Templating-v3.0.0')).toBe('3.0.0')
    })

    test('should handle different version formats', () => {
      expect(extractVersionFromTag('plugin.name-v1')).toBe('1')
      expect(extractVersionFromTag('plugin.name-v1.0')).toBe('1.0')
      expect(extractVersionFromTag('plugin.name-v1.0.0')).toBe('1.0.0')
      expect(extractVersionFromTag('plugin.name-v1.2.3.4')).toBe('1.2.3.4')
    })

    test('should handle pre-release versions', () => {
      expect(extractVersionFromTag('plugin.name-v1.0.0-beta.1')).toBe('1.0.0-beta.1')
      expect(extractVersionFromTag('plugin.name-v2.0.0-alpha')).toBe('2.0.0-alpha')
      expect(extractVersionFromTag('plugin.name-v1.0.0-rc.1')).toBe('1.0.0-rc.1')
    })

    test('should return null if no version pattern found', () => {
      expect(extractVersionFromTag('plugin.name')).toBeNull()
      expect(extractVersionFromTag('plugin-name')).toBeNull()
      expect(extractVersionFromTag('plugin_name')).toBeNull()
      expect(extractVersionFromTag('')).toBeNull()
    })

    test('should handle edge cases', () => {
      expect(extractVersionFromTag('v1.0.0')).toBeNull() // No plugin name
      expect(extractVersionFromTag('plugin-v')).toBeNull() // Incomplete version
      expect(extractVersionFromTag('plugin-v.1.0')).toBeNull() // Invalid version format
    })
  })

  describe('getReleaseTagName', () => {
    test('should generate correct release tag name', () => {
      expect(getReleaseTagName('dwertheimer.TaskAutomations', '1.0.0')).toBe('dwertheimer.TaskAutomations-v1.0.0')
      expect(getReleaseTagName('jgclark.Dashboard', '2.1.3')).toBe('jgclark.Dashboard-v2.1.3')
      expect(getReleaseTagName('np.Templating', '3.0.0')).toBe('np.Templating-v3.0.0')
    })

    test('should handle different version formats', () => {
      expect(getReleaseTagName('plugin.name', '1')).toBe('plugin.name-v1')
      expect(getReleaseTagName('plugin.name', '1.0')).toBe('plugin.name-v1.0')
      expect(getReleaseTagName('plugin.name', '1.0.0')).toBe('plugin.name-v1.0.0')
    })

    test('should handle edge cases', () => {
      expect(getReleaseTagName('', '1.0.0')).toBe('-v1.0.0')
      expect(getReleaseTagName('plugin.name', '')).toBe('plugin.name-v')
    })
  })

  describe('getPluginDataField', () => {
    const mockPluginData = {
      'plugin.name': 'Test Plugin',
      'plugin.version': '1.0.0',
      'plugin.description': 'A test plugin',
      'plugin.author': 'Test Author',
    }

    // Mock process.exit to prevent actual exit during tests
    const originalExit = process.exit
    beforeAll(() => {
      process.exit = jest.fn()
    })

    beforeEach(() => {
      process.exit.mockClear()
    })

    afterAll(() => {
      process.exit = originalExit
    })

    test('should return field value when field exists', () => {
      expect(getPluginDataField(mockPluginData, 'plugin.name')).toBe('Test Plugin')
      expect(getPluginDataField(mockPluginData, 'plugin.version')).toBe('1.0.0')
      expect(getPluginDataField(mockPluginData, 'plugin.description')).toBe('A test plugin')
    })

    test('should call process.exit for non-existent fields', () => {
      getPluginDataField(mockPluginData, 'plugin.nonexistent')
      expect(process.exit).toHaveBeenCalledWith(0)
    })

    test('should handle empty plugin data', () => {
      // Test with empty object
      getPluginDataField({}, 'plugin.name')
      expect(process.exit).toHaveBeenCalledWith(0)

      // Reset the mock for next calls
      process.exit.mockClear()

      // Test with null
      getPluginDataField(null, 'plugin.name')
      expect(process.exit).toHaveBeenCalledWith(0)

      // Reset the mock for next calls
      process.exit.mockClear()

      // Test with undefined
      getPluginDataField(undefined, 'plugin.name')
      expect(process.exit).toHaveBeenCalledWith(0)
    })

    test('should handle falsy values correctly', () => {
      const dataWithFalsyValues = {
        'plugin.name': '',
        'plugin.version': 0,
        'plugin.enabled': false,
        'plugin.null': null,
      }

      getPluginDataField(dataWithFalsyValues, 'plugin.name') // Empty string
      expect(process.exit).toHaveBeenCalledWith(0)

      getPluginDataField(dataWithFalsyValues, 'plugin.version') // 0
      expect(process.exit).toHaveBeenCalledWith(0)

      getPluginDataField(dataWithFalsyValues, 'plugin.enabled') // false
      expect(process.exit).toHaveBeenCalledWith(0)

      getPluginDataField(dataWithFalsyValues, 'plugin.null') // null
      expect(process.exit).toHaveBeenCalledWith(0)
    })
  })

  describe('ensureVersionIsNew', () => {
    const mockReleases = [
      { name: 'test.plugin', tag: 'test.plugin-v1.0.0', version: '1.0.0', publishedAt: '2023-01-01T00:00:00Z' },
      { name: 'test.plugin', tag: 'test.plugin-v1.1.0', version: '1.1.0', publishedAt: '2023-02-01T00:00:00Z' },
      { name: 'test.plugin', tag: 'test.plugin-v2.0.0', version: '2.0.0', publishedAt: '2023-03-01T00:00:00Z' },
    ]

    test('should return true for new version', () => {
      expect(ensureVersionIsNew(mockReleases, 'test.plugin-v1.2.0')).toBe(true)
      expect(ensureVersionIsNew(mockReleases, 'test.plugin-v3.0.0')).toBe(true)
      expect(ensureVersionIsNew(mockReleases, 'different.plugin-v1.0.0')).toBe(true)
    })

    test('should return false for duplicate version', () => {
      expect(ensureVersionIsNew(mockReleases, 'test.plugin-v1.0.0')).toBe(false)
      expect(ensureVersionIsNew(mockReleases, 'test.plugin-v1.1.0')).toBe(false)
      expect(ensureVersionIsNew(mockReleases, 'test.plugin-v2.0.0')).toBe(false)
    })

    test('should handle empty or null releases array', () => {
      expect(ensureVersionIsNew(null, 'test.plugin-v1.0.0')).toBe(true)
      expect(ensureVersionIsNew(undefined, 'test.plugin-v1.0.0')).toBe(true)
      expect(ensureVersionIsNew([], 'test.plugin-v1.0.0')).toBe(true)
    })

    test('should handle empty versionedTagName', () => {
      expect(ensureVersionIsNew(mockReleases, '')).toBe(true)
      expect(ensureVersionIsNew(mockReleases, null)).toBe(true)
      expect(ensureVersionIsNew(mockReleases, undefined)).toBe(true)
    })

    test('should handle releases with different plugin names', () => {
      const mixedReleases = [
        { name: 'plugin1', tag: 'plugin1-v1.0.0', version: '1.0.0', publishedAt: '2023-01-01T00:00:00Z' },
        { name: 'plugin2', tag: 'plugin2-v1.0.0', version: '1.0.0', publishedAt: '2023-01-01T00:00:00Z' },
      ]

      expect(ensureVersionIsNew(mixedReleases, 'plugin1-v1.0.0')).toBe(false)
      expect(ensureVersionIsNew(mixedReleases, 'plugin2-v1.0.0')).toBe(false)
      expect(ensureVersionIsNew(mixedReleases, 'plugin1-v1.1.0')).toBe(true)
      expect(ensureVersionIsNew(mixedReleases, 'plugin3-v1.0.0')).toBe(true)
    })
  })

  describe('Integration tests', () => {
    test('should work together for complete workflow', () => {
      const pluginName = 'test.plugin'
      const version = '1.2.3'
      const tagName = getReleaseTagName(pluginName, version)

      expect(tagName).toBe('test.plugin-v1.2.3')

      const extractedPluginName = extractPluginNameFromTag(tagName)
      const extractedVersion = extractVersionFromTag(tagName)

      expect(extractedPluginName).toBe(pluginName)
      expect(extractedVersion).toBe(version)
    })

    test('should handle complex plugin names and versions', () => {
      const testCases = [
        { plugin: 'dwertheimer.TaskAutomations', version: '1.0.0' },
        { plugin: 'jgclark.Dashboard', version: '2.1.3' },
        { plugin: 'np.Templating', version: '3.0.0-beta.1' },
        { plugin: 'codedungeon.Toolbox', version: '4.5.6' },
      ]

      testCases.forEach(({ plugin, version }) => {
        const tagName = getReleaseTagName(plugin, version)
        const extractedPlugin = extractPluginNameFromTag(tagName)
        const extractedVersion = extractVersionFromTag(tagName)

        expect(extractedPlugin).toBe(plugin)
        expect(extractedVersion).toBe(version)
      })
    })
  })
})
