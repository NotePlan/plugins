'use strict'

/**
 * Checks plugin.dependsOn minVersion values against published GitHub releases.
 * Used by the npc release script before a plugin is published.
 * Written by @CursorAI for @jgclark, 2026-10-31.
 */

/**
 * Leading numeric version parts (major, minor, patch).
 * Stops at a pre-release suffix such as "-beta" or ".b6".
 * @param {string} version
 * @returns {[number, number, number]|null}
 */
function numericVersionParts(version) {
  const match = String(version).match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/)
  if (!match) return null
  return [Number(match[1]), Number(match[2] || 0), Number(match[3] || 0)]
}

/**
 * True when publishedVersion is the same numeric version as minVersion, or newer.
 * Pre-release suffixes are ignored, matching NotePlan's minVersion check.
 * @param {string} publishedVersion
 * @param {string} minVersion
 * @returns {boolean}
 */
function versionMeetsMinimum(publishedVersion, minVersion) {
  const published = numericVersionParts(publishedVersion)
  const minimum = numericVersionParts(minVersion)
  if (!published || !minimum) return false
  for (let i = 0; i < 3; i++) {
    if (published[i] > minimum[i]) return true
    if (published[i] < minimum[i]) return false
  }
  return true
}

/**
 * @param {Array<string>} versions
 * @returns {string|null}
 */
function highestPublishedVersion(versions) {
  let best = null
  for (const version of versions) {
    if (!numericVersionParts(version)) continue
    if (best === null || compareNumericVersions(version, best) > 0) {
      best = version
    }
  }
  return best
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function compareNumericVersions(a, b) {
  const partsA = numericVersionParts(a)
  const partsB = numericVersionParts(b)
  if (!partsA || !partsB) return 0
  for (let i = 0; i < 3; i++) {
    if (partsA[i] !== partsB[i]) return partsA[i] - partsB[i]
  }
  return 0
}

/**
 * Entries that name a plugin id and a minVersion. String ids and entries
 * without minVersion are skipped.
 * @param {Array<Object>|Object|undefined|null} dependsOn
 * @returns {Array<{id: string, name: string, minVersion: string}>}
 */
function normalizeDependsOn(dependsOn) {
  if (!dependsOn) return []
  const list = Array.isArray(dependsOn) ? dependsOn : [dependsOn]
  const deps = []
  for (const dep of list) {
    if (!dep || typeof dep !== 'object') continue
    const id = dep.id
    const minVersion = dep.minVersion
    if (!id || minVersion == null || String(minVersion).trim() === '') continue
    deps.push({
      id: String(id),
      name: dep.name || dep.title || '',
      minVersion: String(minVersion).trim(),
    })
  }
  return deps
}

/**
 * @param {{id: string, name: string, minVersion: string, latest: string|null, fetchFailed: boolean}} problem
 * @returns {string}
 */
function formatDependsOnReleaseError(problem) {
  const label = problem.name ? `${problem.name} (${problem.id})` : problem.id
  if (problem.fetchFailed) {
    return `${label} requires minVersion ${problem.minVersion}, but published releases could not be read, so that version could not be confirmed.`
  }
  if (!problem.latest) {
    return `${label} requires minVersion ${problem.minVersion}, but there are no published releases for ${problem.id}.`
  }
  return `${label} requires minVersion ${problem.minVersion}, but no published release is ${problem.minVersion} or newer. Latest published release is ${problem.latest}.`
}

/**
 * plugin.dependsOn entries whose minVersion is not met by any published release.
 * @param {Array<Object>|Object|undefined|null} dependsOn
 * @param {(pluginId: string) => Promise<Array<{version: string}>|null>} fetchReleases
 * @returns {Promise<Array<{id: string, name: string, minVersion: string, latest: string|null, fetchFailed: boolean}>>}
 */
async function findDependsOnBelowPublished(dependsOn, fetchReleases) {
  const problems = []
  for (const dep of normalizeDependsOn(dependsOn)) {
    const releases = await fetchReleases(dep.id)
    if (releases == null) {
      problems.push({ id: dep.id, name: dep.name, minVersion: dep.minVersion, latest: null, fetchFailed: true })
      continue
    }
    const versions = releases.map((release) => release && release.version).filter(Boolean)
    const satisfied = versions.some((version) => versionMeetsMinimum(version, dep.minVersion))
    if (!satisfied) {
      problems.push({
        id: dep.id,
        name: dep.name,
        minVersion: dep.minVersion,
        latest: highestPublishedVersion(versions),
        fetchFailed: false,
      })
    }
  }
  return problems
}

module.exports = {
  versionMeetsMinimum,
  normalizeDependsOn,
  formatDependsOnReleaseError,
  findDependsOnBelowPublished,
}
