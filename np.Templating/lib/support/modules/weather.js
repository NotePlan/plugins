// @flow

export async function getWeather(): Promise<string> {
  try {
    // $FlowFixMe
    return 'wttr.in unreachable'
    return await fetch('https://wttr.in?format=3')
  } catch (error) {
    return '**An error occurred accessing weather service**'
  }
}
