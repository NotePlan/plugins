// @flow
// Here's an example function that can be imported and used in the plugin code
// More importantly, this function is pure (no NotePlan API calls), which means it can be tested
// This is a good way to do much of your plugin work in isolation, with tests, and then the NPxxx files can be smaller
// And just focus on NotePlan input/output, with the majority of the work happening here
// Reminder:
// About Flow: https://flow.org/en/docs/usage/#toc-write-flow-code
// Getting started with Flow in NotePlan: https://github.com/NotePlan/plugins/blob/main/Flow_Guide.md
export function uppercase(str: string = ''): string {
  return str.toUpperCase()
}
