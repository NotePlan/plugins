// @flow

export function getBaseDomain()
{
  return 'https://sharednote.space';
}

export function apiUrl(path)
{
  return getBaseDomain() + '/api/' + path;
}

export function noteBaseUrl()
{
  return getBaseDomain() + '/n/';
}

export function getPreviewUrl(apiResponse, config)
{
  if (config.appendSecret) {
    return apiResponse.viewUrl;
  } else {
    return apiResponse.promptUrl;
  }
}

function generateRandomKey(length)
{
  let charSet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = '', pos = -1;
  for (let i = 0; i < length; i++) {
    pos = Math.floor(Math.random() * charSet.length);
    key += charSet.substring(pos, pos + 1);
  }
  return key;
}

export function getOrSetupSettings()
{
  let config = DataStore.settings;
  let changed = false;
  if (!config.accessKey) {
    config.accessKey = generateRandomKey(32);
    changed = true;
  }
  if (!config.secret) {
    config.secret = generateRandomKey(32);
    changed = true;
  }
  if (changed) {
    DataStore.settings = config;
  }
  return config;
}
