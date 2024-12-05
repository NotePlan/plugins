/**
 * Support functions for PURE functions that can be tested via Jest
 * NOTE: this file is not actually a JSX file but for some reason, it needs to be JSX
 * for the file to work in rollup
 */

// @flow

const CATEGORY_FILTER_APPLIES_TO_COMMANDS = false

type FilterCommandsProps = {
  pluginList: Array<Plugin>,
  filter?: string,
  categoryFilter?: string,
  returnOnlyMatchingCommands?: boolean,
}

/**
 * Filter plugin list down to only plugins and (optionally only commands) that include the filter list
 */
export function filterCommands({ pluginList, filter = '', categoryFilter = '', returnOnlyMatchingCommands = false }: FilterCommandsProps): Array<Plugin> {
  // console.log('Variables passed to filterCommands:', { pluginList, filter, returnOnlyMatchingCommands, categoryFilter })
  const filters = filter
    ? filter
        .toLowerCase()
        .split(',')
        .map((str) => str.trim())
    : []

  const categoryFilters = categoryFilter
    ? categoryFilter
        .toLowerCase()
        .split(',')
        .map((str) => str.trim())
    : []

  const pluginsMatchingCategoryFilters = categoryFilters.length
    ? pluginList.filter((plugin) =>
        categoryFilters.some((categoryFilter) => plugin.name.toLowerCase().includes(categoryFilter) || plugin.desc.toLowerCase().includes(categoryFilter)),
      )
    : pluginList
  const pluginsMatchingFilters = pluginsMatchingCategoryFilters
    ?.map((plugin) => {
      const filteredCommands = plugin.commands.filter((command) => {
        // logDebug(`command.name: ${command.name} command.desc: ${command.desc}`)
        const commandMatchesFilter = filters.some((filter) => command.name.toLowerCase().includes(filter) || command.desc.toLowerCase().includes(filter))

        const commandMatchesCategoryFilter = CATEGORY_FILTER_APPLIES_TO_COMMANDS
          ? categoryFilter
            ? categoryFilters.some((categoryFilter) => command.name.toLowerCase().includes(categoryFilter))
            : false
          : false
        // logDebug(
        //   `filter:${filter} categoryFilter=${categoryFilter} commandMatchesFilter:${commandMatchesFilter} categoryFilter:${categoryFilter} commandMatchesCategoryFilter:${commandMatchesCategoryFilter}`,
        // )

        if (filter && CATEGORY_FILTER_APPLIES_TO_COMMANDS && categoryFilter) {
          return commandMatchesFilter && commandMatchesCategoryFilter
        } else if (filter) {
          // console.log('filter', filter, 'commandMatchesFilter', commandMatchesFilter)
          return commandMatchesFilter
        } else if (CATEGORY_FILTER_APPLIES_TO_COMMANDS && categoryFilter) {
          return commandMatchesCategoryFilter
        } else {
          return true
        }
      })
      // filteredCommands.length ? console.log('filteredCommands', filteredCommands.length, plugin.name, filteredCommands) : null
      // logDebug(`filteredCommands.length: ${filteredCommands.length}`)
      if (returnOnlyMatchingCommands) {
        // return only commands in this plugin which match criteria
        if (filteredCommands.length > 0) {
          // console.log('returning filtered', 'filteredCommands.length', filteredCommands.length, 'plugin.name', plugin.name)
          return { ...plugin, commands: filteredCommands }
        } else {
          return null
        }
      } else {
        // return all commands in this plugin if one or more match criteria, otherwise return null
        // console.log('returning all', 'filteredCommands.length', filteredCommands.length, 'plugin.name', plugin.name)
        return filteredCommands.length > 0 ? plugin : null // Return plugin with filtered commands if any, otherwise return the original plugin
      }
    })
    .filter(Boolean)
  // console.log(`filterFunctions: pluginsMatchingFilters: ${pluginsMatchingFilters}`)
  return pluginsMatchingFilters
}
