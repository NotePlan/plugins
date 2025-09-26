/**
 * SHARED RELEASE MANAGEMENT UTILITIES
 *
 * This module provides intelligent release management functions that can be used
 * by both the CLI system and the standalone releases.js script.
 *
 * PRUNING HEURISTICS:
 * 1. SAFETY NET: Keep at least 3 releases minimum
 * 2. LATEST STABLE: Always keep the highest version number without pre-release identifiers
 * 3. RECENT ACTIVITY: Keep all releases from the last 6 months regardless of version
 * 4. PRE-RELEASE MANAGEMENT: Keep the latest 2-3 pre-release versions if they're recent
 * 5. OBSOLETE PRE-RELEASES: Prune pre-release versions of a version that has been published as stable for more than 3 months
 * 6. AGE-BASED PRUNING: Prune releases older than 2 years (unless they're the latest stable)
 * 7. PRE-RELEASE LIMITS: Prune excess pre-release versions (more than 5 total pre-releases)
 * 8. VOLUME LIMITS: Prune non-recent, non-latest-stable releases when more than 5 total releases
 */

const { system } = require('@codedungeon/gunner')

/**
 * Check if a version is a pre-release version (alpha, beta, rc, etc.)
 * @param {string} version - Version string
 * @returns {boolean} - True if pre-release
 */
function isPreRelease(version) {
  return /-(alpha|beta|rc|pre|dev|snapshot)/i.test(version)
}

/**
 * Get the base version from a pre-release version (removes pre-release identifier)
 * @param {string} version - Version string (e.g., "2.1.0-alpha.1")
 * @returns {string} - Base version (e.g., "2.1.0")
 */
function getBaseVersion(version) {
  return version.replace(/-.*$/, '')
}

/**
 * Compare two version strings for sorting (semantic versioning)
 * @param {string} a - First version
 * @param {string} b - Second version
 * @returns {number} - Comparison result
 */
function compareVersions(a, b) {
  // Remove pre-release identifiers for comparison
  const cleanA = a.replace(/-.*$/, '')
  const cleanB = b.replace(/-.*$/, '')

  const partsA = cleanA.split('.').map(Number)
  const partsB = cleanB.split('.').map(Number)

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
 * Check if a pre-release version has an obsolete stable counterpart
 * @param {string} preReleaseVersion - The pre-release version to check
 * @param {Array<{name: string, tag: string, version: string, publishedAt: string}>} allReleases - All releases
 * @param {number} monthsThreshold - Number of months after which stable version makes pre-release obsolete
 * @returns {boolean} - True if the pre-release is obsolete
 */
function isPreReleaseObsolete(preReleaseVersion, allReleases, monthsThreshold = 3) {
  const baseVersion = getBaseVersion(preReleaseVersion)
  const now = new Date()
  const thresholdDate = new Date(now.getTime() - monthsThreshold * 30 * 24 * 60 * 60 * 1000)

  // Find the stable version of the same base version
  const stableVersion = allReleases.find((release) => !isPreRelease(release.version) && getBaseVersion(release.version) === baseVersion)

  if (!stableVersion) {
    return false // No stable version found, keep the pre-release
  }

  // Check if the stable version was published more than the threshold ago
  const stablePublishedDate = new Date(stableVersion.publishedAt)
  return stablePublishedDate < thresholdDate
}

/**
 * Get all existing releases for a specific plugin using GitHub CLI
 * @param {string} pluginName - The plugin name to search for
 * @returns {Promise<Array<{name: string, tag: string, version: string, publishedAt: string}> | null>}
 */
async function getExistingReleases(pluginName) {
  try {
    const result = await system.exec('gh', ['release', 'list', '--limit', '1000', '--json', 'tagName,publishedAt'], { quiet: true })
    const releases = JSON.parse(result)

    // Filter releases for this plugin and extract version info
    const pluginReleases = releases
      .filter((release) => release.tagName.includes(pluginName))
      .map((release) => {
        const version = release.tagName.replace(`${pluginName}-v`, '')
        return {
          name: pluginName,
          tag: release.tagName,
          version,
          publishedAt: release.publishedAt,
        }
      })
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()) // Sort by newest first

    return pluginReleases
  } catch (error) {
    console.error(`Error fetching releases: ${error.message}`)
    return null
  }
}

/**
 * Identify releases that should be pruned based on heuristics
 * @param {Array<{name: string, tag: string, version: string, publishedAt: string}>} releases - Array of releases
 * @returns {Array<{name: string, tag: string, version: string, publishedAt: string}>} - Releases to prune
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

  // Keep the latest 2-3 pre-release versions if they're recent
  const recentPreReleases = preReleaseReleases.filter((r) => new Date(r.publishedAt) >= sixMonthsAgo).slice(0, 3)

  // Identify releases to prune
  for (const release of releases) {
    const isRecent = new Date(release.publishedAt) >= sixMonthsAgo
    const isOld = new Date(release.publishedAt) < twoYearsAgo
    const isLatestStable = release === latestStable
    const isRecentPreRelease = recentPreReleases.includes(release)
    const isObsoletePreRelease = isPreRelease(release.version) && isPreReleaseObsolete(release.version, releases)

    // Prune if:
    // 1. It's old (2+ years) AND not the latest stable
    // 2. It's a pre-release that's obsolete (stable version published 3+ months ago)
    // 3. It's a pre-release that's not recent and we have more than 5 pre-releases
    // 4. It's not recent and not the latest stable and we have more than 5 total releases
    // 5. When there are many releases (>6), prune older ones keeping only the latest 5

    if (isOld && !isLatestStable) {
      toPrune.push(release)
    } else if (isObsoletePreRelease) {
      toPrune.push(release)
    } else if (isPreRelease(release.version) && !isRecentPreRelease && preReleaseReleases.length > 5) {
      toPrune.push(release)
    } else if (!isRecent && !isLatestStable && releases.length > 5) {
      toPrune.push(release)
    } else if (releases.length > 6 && !isLatestStable) {
      // For many releases, keep only the latest 5 (including latest stable)
      const sortedByDate = [...releases].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
      const keepCount = 5
      const releasesToKeep = sortedByDate.slice(0, keepCount)
      if (!releasesToKeep.includes(release)) {
        toPrune.push(release)
      }
    }
  }

  return toPrune
}

/**
 * Generate prune commands for identified releases
 * @param {Array<{name: string, tag: string, version: string, publishedAt: string}>} releasesToPrune - Releases to prune
 * @returns {string} - Commands to run for pruning
 */
function generatePruneCommands(releasesToPrune) {
  if (releasesToPrune.length === 0) {
    return 'No releases recommended for pruning.'
  }

  const commands = releasesToPrune.map((release) => `gh release delete "${release.tag}" -y`)

  if (releasesToPrune.length === 1) {
    return `Recommended prune command:\n${commands[0]}`
  }

  return `Recommended prune commands:\n${commands.join('\n')}`
}

/**
 * Get intelligent delete commands for CLI system (replaces buildDeleteCommands)
 * @param {string} pluginId - Plugin identifier
 * @param {string} currentVersion - Current version being released
 * @returns {Promise<Array<string>>} - Array of delete commands
 */
async function getIntelligentDeleteCommands(pluginId, currentVersion) {
  const releases = await getExistingReleases(pluginId)
  if (!releases || releases.length === 0) {
    return []
  }

  // Use our intelligent pruning logic
  const releasesToPrune = identifyReleasesToPrune(releases)

  // Convert to delete commands
  return releasesToPrune.map((release) => `gh release delete "${release.tag}" -y`)
}

/**
 * Get relative time string (e.g., "3+ years ago", "2+ months ago", "today")
 * @param {string} publishedAt - ISO date string
 * @returns {string} - Human-readable relative time
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

module.exports = {
  isPreRelease,
  getBaseVersion,
  compareVersions,
  isPreReleaseObsolete,
  getExistingReleases,
  identifyReleasesToPrune,
  generatePruneCommands,
  getIntelligentDeleteCommands,
  getRelativeTime,
}
