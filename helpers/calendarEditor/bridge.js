/* eslint-env browser */
/** Adapter for the versioned native editor API, with safe legacy behavior. */
function createCalendarEditorBridge(config) {
  let capabilitiesPromise
  async function capabilities() {
    if (!capabilitiesPromise) {
      capabilitiesPromise = Promise.resolve()
        .then(() => Calendar.eventEditorCapabilities())
        .catch(() => null)
    }
    const result = await capabilitiesPromise
    return result && result.version === 1 ? result : null
  }
  function identity(event) {
    return { id: event.id, originalStartDate: event.originalStartDate || event.date || event.startDate, originalCalendarID: event.calendarID }
  }
  return {
    calendars: config.calendars,
    capabilities,
    async load(event) {
      if (await capabilities()) return Calendar.eventForEditing(identity(event))
      // Legacy eventByID may return the series master. Keep recurring snapshots read-only.
      if (event.isRecurring) return event
      try {
        return await Calendar.eventByID(event.id)
      } catch (_) {
        return Object.assign({}, event, { editorReadOnly: true })
      }
    },
    async save(data, original) {
      if (await capabilities()) return Calendar.saveEvent(Object.assign({}, data, original ? identity(original) : {}))
      if (original && original.isRecurring) throw new Error('Update NotePlan to edit recurring events here.')
      return original ? Calendar.update(data) : Calendar.add(data)
    },
    async remove(event, scope) {
      if (await capabilities()) return Calendar.removeEvent(Object.assign(identity(event), { scope }))
      if (event.isRecurring) throw new Error('Update NotePlan to edit recurring events here.')
      return Calendar.remove(event)
    },
    refresh: config.refresh,
    onClose: config.onClose,
    onRefreshError: config.onRefreshError,
  }
}
if (typeof module !== 'undefined') module.exports = { createCalendarEditorBridge }
