// @flow

// Note: Eduard's regex looks for a trailing space or end of line. I can't use that part because it will remove space we need if
// the sync copy tag is in the middle of the line.
export const textWithoutSyncedCopyTag = (text: string): string => text.replace(new RegExp('(?:^|\\s)(\\^[a-z0-9]{6})', 'mg'), '').trim()
