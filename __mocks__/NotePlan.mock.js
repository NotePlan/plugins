/*
 * NotePlan mocks
 *
 * Note: nested object example data are there for reference only -- will need to be deleted or cleaned up before use (consider using a factory)
 * For functions: check whether async or not & add params & return value
 *
 */

export class NotePlan {
  environment = {
    languageCode: 'en',
    regionCode: 'US',
    is12hFormat: true,
    preferredLanguages: ['en-US'],
    secondsFromGMT: -25200,
    localTimeZoneAbbreviation: 'PDT',
    localTimeZoneIdentifier: 'America/Los_Angeles',
    isDaylightSavingTime: true,
    daylightSavingTimeOffset: 3600,
    nextDaylightSavingTimeTransition: '2022-11-06T09:00:00.000Z',
    platform: 'macOS',
    hasSettings: true,
    version: '3.6',
    versionNumber: 36,
    buildVersion: 1046, // = 3.9.2 mid-beta
    templateFolder: '@Templates',
  }
  // async openURL() { return null },
  // async resetCaches() { return null },
  selectedSidebarFolder = `SelectedFolder`
  // async showConfigurationView() { return null },
  constructor(data?: any = {}) {
    this.__update(data)
  }

  __update(data?: any = {}) {
    Object.keys(data).forEach((key) => {
      this[key] = data[key]
    })
    return this
  }
}
