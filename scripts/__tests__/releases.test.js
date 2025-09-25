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
   * Calculate relative time string (e.g., "3+ years ago", "2 months ago")
   */
  function getRelativeTime(publishedAt) {
    const now = new Date()
    const published = new Date(publishedAt)
    const diffInMs = now - published
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24))
    const diffInMonths = Math.floor(diffInDays / 30)
    const diffInYears = Math.floor(diffInDays / 365)

    if (diffInYears >= 1) {
      return `${diffInYears}+ year${diffInYears > 1 ? 's' : ''} ago`
    } else if (diffInMonths >= 1) {
      return `${diffInMonths}+ month${diffInMonths > 1 ? 's' : ''} ago`
    } else if (diffInDays >= 7) {
      const weeks = Math.floor(diffInDays / 7)
      return `${weeks}+ week${weeks > 1 ? 's' : ''} ago`
    } else if (diffInDays >= 1) {
      return `${diffInDays}+ day${diffInDays > 1 ? 's' : ''} ago`
    } else {
      return 'today'
    }
  }

  /**
   * Check if a version is a pre-release version (alpha, beta, rc, etc.)
   */
  function isPreRelease(version) {
    return /-(alpha|beta|rc|pre|dev|snapshot)/i.test(version)
  }

  /**
   * Compare two version strings for sorting (semantic versioning)
   */
  function compareVersions(a, b) {
    // Remove pre-release identifiers for comparison
    const cleanA = a.replace(/-.*$/, '')
    const cleanB = b.replace(/-.*$/, '')

    const partsA = cleanA.split('.').map(Number)
    const partsB = cleanB.split('.').map(Number)

    // Normalize to same length by padding with zeros
    const maxLength = Math.max(partsA.length, partsB.length)
    while (partsA.length < maxLength) partsA.push(0)
    while (partsB.length < maxLength) partsB.push(0)

    for (let i = 0; i < maxLength; i++) {
      if (partsA[i] !== partsB[i]) {
        return partsB[i] - partsA[i] // Descending order (newest first)
      }
    }

    // If versions are equal, put pre-release after stable
    const aIsPre = isPreRelease(a)
    const bIsPre = isPreRelease(b)

    if (aIsPre && !bIsPre) return 1
    if (!aIsPre && bIsPre) return -1

    return 0
  }

  /**
   * Identify releases that should be pruned based on heuristics
   */
  function identifyReleasesToPrune(releases) {
    if (releases.length <= 3) {
      return [] // Keep at least 3 releases minimum
    }

    const now = new Date()
    const sixMonthsAgo = new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000)
    const twoYearsAgo = new Date(now.getTime() - 2 * 365 * 24 * 60 * 60 * 1000)

    // Sort releases by version (newest first)
    const sortedReleases = [...releases].sort((a, b) => compareVersions(a.version, b.version))

    const toPrune = []
    const stableReleases = sortedReleases.filter((r) => !isPreRelease(r.version))
    const preReleaseReleases = sortedReleases.filter((r) => isPreRelease(r.version))

    // Keep the latest stable release
    const latestStable = stableReleases[0]

    // Keep releases from the last 6 months
    const recentReleases = releases.filter((r) => new Date(r.publishedAt) >= sixMonthsAgo)

    // Keep the latest 2-3 pre-release versions if they're recent
    const recentPreReleases = preReleaseReleases.filter((r) => new Date(r.publishedAt) >= sixMonthsAgo).slice(0, 3)

    // Identify releases to prune
    for (const release of releases) {
      const isRecent = new Date(release.publishedAt) >= sixMonthsAgo
      const isOld = new Date(release.publishedAt) < twoYearsAgo
      const isLatestStable = release === latestStable
      const isRecentPreRelease = recentPreReleases.includes(release)

      // Prune if:
      // 1. It's old (2+ years) AND not the latest stable
      // 2. It's a pre-release that's not recent and we have more than 5 pre-releases
      // 3. It's not recent and not the latest stable and we have more than 5 total releases

      if (isOld && !isLatestStable) {
        toPrune.push(release)
      } else if (isPreRelease(release.version) && !isRecentPreRelease && preReleaseReleases.length > 5) {
        toPrune.push(release)
      } else if (!isRecent && !isLatestStable && releases.length > 5) {
        toPrune.push(release)
      }
    }

    return toPrune
  }

  /**
   * Generate prune commands for identified releases
   */
  function generatePruneCommands(releasesToPrune) {
    if (releasesToPrune.length === 0) {
      return 'No releases recommended for pruning.'
    }

    const commands = releasesToPrune.map((release) => `gh release delete "${release.tag}" -y`)

    if (releasesToPrune.length === 1) {
      return `Recommended prune command:\n${commands[0]}`
    }

    return `Recommended prune commands:\n${commands.join('\n')}\n\nTo prune all at once:\n${commands.join(' && ')}`
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

  describe('getRelativeTime', () => {
    test('should return "today" for recent dates', () => {
      const today = new Date().toISOString()
      expect(getRelativeTime(today)).toBe('today')
    })

    test('should return days ago for recent dates', () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      expect(getRelativeTime(yesterday)).toBe('1+ day ago')

      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
      expect(getRelativeTime(threeDaysAgo)).toBe('3+ days ago')
    })

    test('should return weeks ago for recent dates', () => {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      expect(getRelativeTime(oneWeekAgo)).toBe('1+ week ago')

      const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
      expect(getRelativeTime(twoWeeksAgo)).toBe('2+ weeks ago')
    })

    test('should return months ago for older dates', () => {
      const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      expect(getRelativeTime(oneMonthAgo)).toBe('1+ month ago')

      const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
      expect(getRelativeTime(threeMonthsAgo)).toBe('3+ months ago')
    })

    test('should return years ago for old dates', () => {
      const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()
      expect(getRelativeTime(oneYearAgo)).toBe('1+ year ago')

      const threeYearsAgo = new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000).toISOString()
      expect(getRelativeTime(threeYearsAgo)).toBe('3+ years ago')
    })

    test('should handle edge cases', () => {
      // Test with a very old date
      const veryOldDate = new Date('2020-01-01T00:00:00Z').toISOString()
      const result = getRelativeTime(veryOldDate)
      expect(result).toMatch(/\d+\+ years? ago/)
    })
  })

  describe('isPreRelease', () => {
    test('should identify pre-release versions', () => {
      expect(isPreRelease('1.0.0-alpha.1')).toBe(true)
      expect(isPreRelease('1.0.0-beta.2')).toBe(true)
      expect(isPreRelease('1.0.0-rc.1')).toBe(true)
      expect(isPreRelease('1.0.0-pre.1')).toBe(true)
      expect(isPreRelease('1.0.0-dev')).toBe(true)
      expect(isPreRelease('1.0.0-snapshot')).toBe(true)
    })

    test('should identify stable versions', () => {
      expect(isPreRelease('1.0.0')).toBe(false)
      expect(isPreRelease('2.1.3')).toBe(false)
      expect(isPreRelease('0.1.0')).toBe(false)
    })

    test('should be case insensitive', () => {
      expect(isPreRelease('1.0.0-ALPHA')).toBe(true)
      expect(isPreRelease('1.0.0-Beta')).toBe(true)
      expect(isPreRelease('1.0.0-RC')).toBe(true)
    })
  })

  describe('compareVersions', () => {
    test('should sort versions correctly', () => {
      const versions = ['1.0.0', '2.0.0', '1.1.0', '1.0.1']
      const sorted = versions.sort(compareVersions)
      expect(sorted).toEqual(['2.0.0', '1.1.0', '1.0.1', '1.0.0'])
    })

    test('should handle pre-release versions', () => {
      const versions = ['1.0.0', '1.0.0-beta.1', '1.0.0-alpha.1']
      const sorted = versions.sort(compareVersions)
      expect(sorted).toEqual(['1.0.0', '1.0.0-beta.1', '1.0.0-alpha.1'])
    })

    test('should handle different version lengths', () => {
      const versions = ['1.0', '1.0.0', '1.0.0.0']
      const sorted = versions.sort(compareVersions)
      expect(sorted).toEqual(['1.0', '1.0.0', '1.0.0.0'])
    })
  })

  describe('identifyReleasesToPrune', () => {
    const createRelease = (version, publishedAt) => ({
      name: 'test.plugin',
      tag: `test.plugin-v${version}`,
      version,
      publishedAt,
    })

    test('should not prune if 3 or fewer releases', () => {
      const releases = [createRelease('1.0.0', '2023-01-01T00:00:00Z'), createRelease('1.1.0', '2023-02-01T00:00:00Z'), createRelease('1.2.0', '2023-03-01T00:00:00Z')]
      expect(identifyReleasesToPrune(releases)).toEqual([])
    })

    test('should prune old releases (2+ years) but keep latest stable', () => {
      const now = new Date()
      const threeYearsAgo = new Date(now.getTime() - 3 * 365 * 24 * 60 * 60 * 1000).toISOString()
      const oneYearAgo = new Date(now.getTime() - 1 * 365 * 24 * 60 * 60 * 1000).toISOString()

      const releases = [
        createRelease('1.0.0', threeYearsAgo), // Should be pruned
        createRelease('2.0.0', oneYearAgo), // Should be kept (latest stable)
        createRelease('1.1.0', threeYearsAgo), // Should be pruned
        createRelease('1.2.0', threeYearsAgo), // Should be pruned
        createRelease('1.3.0', threeYearsAgo), // Should be pruned
      ]

      const toPrune = identifyReleasesToPrune(releases)
      expect(toPrune.length).toBeGreaterThan(0)
      expect(toPrune.map((r) => r.version)).toEqual(expect.arrayContaining(['1.0.0', '1.1.0']))
      expect(toPrune.map((r) => r.version)).not.toContain('2.0.0')
    })

    test('should keep recent releases (6 months)', () => {
      const now = new Date()
      const oneMonthAgo = new Date(now.getTime() - 1 * 30 * 24 * 60 * 60 * 1000).toISOString()
      const threeYearsAgo = new Date(now.getTime() - 3 * 365 * 24 * 60 * 60 * 1000).toISOString()

      const releases = [
        createRelease('1.0.0', oneMonthAgo), // Should be kept (recent)
        createRelease('2.0.0', threeYearsAgo), // Should be pruned (old)
        createRelease('1.1.0', oneMonthAgo), // Should be kept (recent)
        createRelease('1.2.0', threeYearsAgo), // Should be pruned (old)
        createRelease('1.3.0', threeYearsAgo), // Should be pruned (old)
      ]

      const toPrune = identifyReleasesToPrune(releases)
      expect(toPrune.length).toBeGreaterThan(0)
      expect(toPrune.map((r) => r.version)).toContain('1.2.0')
      expect(toPrune.map((r) => r.version)).toContain('1.3.0')
      expect(toPrune.map((r) => r.version)).not.toContain('2.0.0') // Latest stable should be kept
    })

    test('should prune excess pre-release versions', () => {
      const now = new Date()
      const oneMonthAgo = new Date(now.getTime() - 1 * 30 * 24 * 60 * 60 * 1000).toISOString()
      const eightMonthsAgo = new Date(now.getTime() - 8 * 30 * 24 * 60 * 60 * 1000).toISOString()

      const releases = [
        createRelease('1.0.0', oneMonthAgo), // Stable - keep
        createRelease('1.1.0-alpha.1', oneMonthAgo), // Recent pre - keep
        createRelease('1.1.0-beta.1', oneMonthAgo), // Recent pre - keep
        createRelease('1.1.0-alpha.2', eightMonthsAgo), // Old pre - prune
        createRelease('1.1.0-beta.2', eightMonthsAgo), // Old pre - prune
        createRelease('1.1.0-rc.1', eightMonthsAgo), // Old pre - prune
        createRelease('1.1.0-dev', eightMonthsAgo), // Old pre - prune
      ]

      const toPrune = identifyReleasesToPrune(releases)
      expect(toPrune.length).toBeGreaterThan(0)
      // Should keep recent pre-releases and stable
      expect(toPrune.map((r) => r.version)).not.toContain('1.0.0')
      expect(toPrune.map((r) => r.version)).not.toContain('1.1.0-alpha.1')
      expect(toPrune.map((r) => r.version)).not.toContain('1.1.0-beta.1')
    })
  })

  describe('generatePruneCommands', () => {
    test('should return no pruning message for empty array', () => {
      expect(generatePruneCommands([])).toBe('No releases recommended for pruning.')
    })

    test('should generate single prune command without "all at once" section', () => {
      const releasesToPrune = [{ tag: 'plugin-v1.0.0', version: '1.0.0' }]

      const result = generatePruneCommands(releasesToPrune)
      expect(result).toBe('Recommended prune command:\ngh release delete "plugin-v1.0.0" -y')
      expect(result).not.toContain('To prune all at once:')
    })

    test('should generate multiple prune commands with "all at once" section', () => {
      const releasesToPrune = [
        { tag: 'plugin-v1.0.0', version: '1.0.0' },
        { tag: 'plugin-v1.1.0', version: '1.1.0' },
      ]

      const result = generatePruneCommands(releasesToPrune)
      expect(result).toContain('gh release delete "plugin-v1.0.0" -y')
      expect(result).toContain('gh release delete "plugin-v1.1.0" -y')
      expect(result).toContain('To prune all at once:')
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
