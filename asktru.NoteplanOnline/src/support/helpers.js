// @flow

export function getPreviewUrl(url, config)
{
  url = url.split('?')[0];
  if (config.appendSecret) {
    url += '?password=' + config.secret;
  }
  return url;
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
