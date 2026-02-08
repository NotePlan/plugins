// @flow
//--------------------------------------------------------------------------
// ConditionalValues Component
// A derived field that sets its value based on another field's value using
// matchTerm/value pairs. When the source field matches a matchTerm, this
// field's value is set to the corresponding value (e.g. "Trip" -> "red-500",
// "Beach" -> "yellow-500").
//--------------------------------------------------------------------------

import React, { useEffect, useCallback } from 'react'
import { logDebug, logError } from '@helpers/react/reactDev.js'
import './ConditionalValues.css'

export type ConditionalValueCondition = {
  matchTerm: string,
  value: string,
}

export type ConditionalValuesProps = {
  label?: string,
  value?: string,
  onChange: (value: string) => void,
  sourceFieldKey?: string,
  sourceValue?: string,
  conditions?: Array<ConditionalValueCondition>,
  matchMode?: 'regex' | 'string',
  caseSensitive?: boolean,
  defaultWhenNoMatch?: string,
  trimSourceBeforeMatch?: boolean,
  showResolvedValue?: boolean,
  disabled?: boolean,
  compactDisplay?: boolean,
}

/**
 * Resolve the output value from source value and conditions.
 * First match wins. For string mode: exact match. For regex: test pattern.
 *
 * @param {string} sourceVal - Raw value from the watched field
 * @param {Array<ConditionalValueCondition>} conds - matchTerm/value pairs
 * @param {'regex'|'string'} mode - Match mode
 * @param {boolean} caseSens - Case-sensitive matching
 * @param {boolean} trim - Trim source before matching
 * @param {string} [defaultVal] - Value when no condition matches
 * @returns {{ value: string, matched: boolean }}
 */
function resolveValue(
  sourceVal: string,
  conds: Array<ConditionalValueCondition>,
  mode: 'regex' | 'string',
  caseSens: boolean,
  trim: boolean,
  defaultVal?: string,
): { value: string, matched: boolean } {
  const toMatch = trim ? (typeof sourceVal === 'string' ? sourceVal : String(sourceVal ?? '')).trim() : String(sourceVal ?? '')
  if (!Array.isArray(conds) || conds.length === 0) {
    return { value: defaultVal ?? '', matched: false }
  }
  for (let i = 0; i < conds.length; i++) {
    const c = conds[i]
    const term = c?.matchTerm ?? ''
    const outVal = c?.value ?? ''
    if (mode === 'regex') {
      try {
        const flags = caseSens ? 'u' : 'iu'
        const re = new RegExp(term, flags)
        if (re.test(toMatch)) {
          return { value: outVal, matched: true }
        }
      } catch (e) {
        logError('ConditionalValues', `Invalid regex matchTerm "${term}": ${(e: any).message}`)
        continue
      }
    } else {
      const eq = caseSens ? toMatch === term : toMatch.toLowerCase() === term.toLowerCase()
      if (eq) {
        return { value: outVal, matched: true }
      }
    }
  }
  return { value: defaultVal ?? '', matched: false }
}

/**
 * ConditionalValues – sets this field's value based on another field's value.
 * Uses an array of { matchTerm, value } pairs; first match wins.
 *
 * @param {ConditionalValuesProps} props
 * @returns {React$Node}
 */
export function ConditionalValues({
  label = '',
  value = '',
  onChange,
  sourceFieldKey = '',
  sourceValue = '',
  conditions = [],
  matchMode = 'string',
  caseSensitive = false,
  defaultWhenNoMatch,
  trimSourceBeforeMatch = true,
  showResolvedValue = true,
  disabled = false,
  compactDisplay = false,
}: ConditionalValuesProps): React$Node {
  const computeResolved = useCallback(() => {
    return resolveValue(
      sourceValue,
      conditions,
      matchMode,
      caseSensitive,
      trimSourceBeforeMatch,
      defaultWhenNoMatch,
    )
  }, [
    sourceValue,
    conditions,
    matchMode,
    caseSensitive,
    trimSourceBeforeMatch,
    defaultWhenNoMatch,
  ])

  useEffect(() => {
    if (!sourceFieldKey) {
      return
    }
    const { value: resolved } = computeResolved()
    if (resolved !== value) {
      logDebug('ConditionalValues', `sourceFieldKey=${sourceFieldKey} resolved "${String(sourceValue)}" -> "${resolved}"`)
      onChange(resolved)
    }
  }, [sourceFieldKey, sourceValue, conditions, matchMode, caseSensitive, trimSourceBeforeMatch, defaultWhenNoMatch, computeResolved, value, onChange])

  const resolved = computeResolved()

  return (
    <div
      className={`conditional-values-wrapper ${compactDisplay ? 'conditional-values-compact' : ''}`}
      data-field-type="conditional-values"
    >
      {showResolvedValue ? (
        <div className="conditional-values-display">
          {label ? (
            <label className="conditional-values-label" htmlFor={`conditional-values-${sourceFieldKey}-display`}>
              {label}
            </label>
          ) : null}
          <div
            id={`conditional-values-${sourceFieldKey}-display`}
            className="conditional-values-resolved"
            title={resolved.matched ? `Matched: ${resolved.value}` : 'No match'}
          >
            {resolved.value || '—'}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default ConditionalValues
