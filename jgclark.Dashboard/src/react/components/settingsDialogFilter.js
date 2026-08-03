// @flow
//--------------------------------------------------------------------------
// Pure filter for Dashboard Settings dialog items.
// Last updated 2026-07-29 for v2.4.0.b57 by @CursorAI
//--------------------------------------------------------------------------

import type { TSettingItem } from '../../types.js'

const MIN_FILTER_CHARS = 3

/**
 * Whether an item's label or description contains the query (case-insensitive).
 * @param {TSettingItem} item
 * @param {string} qLower - already lowercased trimmed query
 * @returns {boolean}
 */
function itemMatchesQuery(item: TSettingItem, qLower: string): boolean {
  const label = (item.label || '').toLowerCase()
  const description = (item.description || '').toLowerCase()
  return label.includes(qLower) || description.includes(qLower)
}

/**
 * Controlling key for a dependent setting (requiresKey preferred over dependsOnKey).
 * @param {TSettingItem} item
 * @returns {?string}
 */
function getDependsOnKey(item: TSettingItem): ?string {
  return item.requiresKey || item.dependsOnKey || null
}

/**
 * Filter settings items by label/description. Active only when trimmed query length >= 3.
 * Keeps matches, their dependsOn/requiresKey dependents, parents of matching dependents,
 * and nearest preceding heading/separator for context.
 * @param {Array<TSettingItem>} items
 * @param {string} query
 * @returns {Array<TSettingItem>}
 */
export function filterSettingsItems(items: Array<TSettingItem>, query: string): Array<TSettingItem> {
  const q = query.trim().toLowerCase()
  if (q.length < MIN_FILTER_CHARS) {
    return items
  }

  const matchedKeys: Set<string> = new Set()
  for (const item of items) {
    if (item.key && itemMatchesQuery(item, q)) {
      // Cast: `item.key` is refined non-null by the guard, but the intervening call invalidates the property refinement.
      matchedKeys.add((item.key: any))
    }
  }

  // Include dependents of matches
  for (const item of items) {
    const dependsOn = getDependsOnKey(item)
    if (item.key && dependsOn && matchedKeys.has(dependsOn)) {
      // Cast: as above -- the guard refines `item.key`, but the intervening calls invalidate the refinement.
      matchedKeys.add((item.key: any))
    }
  }

  // Include parents of matching dependents
  for (const item of items) {
    if (!item.key || !matchedKeys.has(item.key)) continue
    const dependsOn = getDependsOnKey(item)
    if (dependsOn) {
      matchedKeys.add(dependsOn)
    }
  }

  // Mark which non-heading items are kept
  const keepContent: Array<boolean> = items.map((item) => {
    if (item.type === 'heading' || item.type === 'separator') return false
    if (item.key && matchedKeys.has(item.key)) return true
    // Match without a key (e.g. unlabeled structural items) still by label/description
    if (!item.key && itemMatchesQuery(item, q)) return true
    return false
  })

  // Keep heading/separator if any following content item is kept until next heading/separator
  const keep: Array<boolean> = keepContent.slice()
  let lastHeadingIndex = -1
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item.type === 'heading' || item.type === 'separator') {
      lastHeadingIndex = i
      continue
    }
    if (keepContent[i] && lastHeadingIndex >= 0) {
      keep[lastHeadingIndex] = true
    }
  }

  return items.filter((_, i) => keep[i])
}
