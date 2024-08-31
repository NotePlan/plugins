// @flow

declare var NP_THEME: {
  editor: {
    backgroundColor: string,
    altBackgroundColor: string,
  },
}

import React, { useState } from 'react'
// import { howDifferentAreTheseColors, getAltColor } from '../../../helpers/colors'
import { filterCommands } from './support/filterFunctions.jsx'

/****************************************************************************************************************************
 *                             CONSOLE LOGGING
 ****************************************************************************************************************************/
// color this component's output differently in the console
const consoleStyle = 'background: #222; color: #bada55' //lime green
const logDebug = (msg, ...args) => console.log(`${window.webkit ? '' : '%c'}${msg}`, consoleStyle, ...args)
const logSubtle = (msg, ...args) => console.log(`${window.webkit ? '' : '%c'}${msg}`, 'color: #6D6962', ...args)
const logTemp = (msg, ...args) => console.log(`${window.webkit ? '' : '%c'}${msg}`, 'background: #fff; color: #000', ...args)

/****************************************************************************************************************************/

type Option = {
  value: string,
  label: string,
}

type DropdownProps = {
  options: Array<Option>,
  selectedValue: string,
  onValueChange: (value: string) => void,
}

const Dropdown = ({ options, selectedValue, onValueChange }: DropdownProps) => {
  return (
    <select value={selectedValue} onChange={(e) => onValueChange(e.target.value)}>
      {options.map((option, index) => (
        <option key={index} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

/**
 * TOP LEVEL FILTERS (in "sticky" div)
 */
const categoryFilterOptions = [
  { label: 'Show Plugins which contain...', value: '' },
  { label: 'Tools for Events', value: 'event' },
  { label: 'Tools for Timeblocks / Day Planning', value: 'time blocks,timeblocks,planning' },
  { label: 'Tools for Projects', value: 'projects' },
  { label: 'Tools for Tracking Habits', value: 'habits' },
  { label: 'Getting Stats', value: 'stats,statistics' },
]

const installationOptions = [
  { label: 'Show All Plugins', value: 'all' },
  { label: 'Show Installed Plugins Only', value: 'installed' },
  { label: 'Show Not Installed Plugins', value: 'notInstalled' },
  { label: 'Show Installed with Updates', value: 'updatesAvailable' },
]

const viewOptions = [
  { label: 'Full Detail', value: 'all' },
  { label: 'Hide Plugin Details', value: 'hideDetails' },
  { label: 'Commands Only', value: 'commandsOnly' },
]

// commenting out for now because I think we will make it static styling
// const colorDiff = howDifferentAreTheseColors(NP_THEME.editor.backgroundColor, NP_THEME.editor.altBackgroundColor)
// logDebug(`PluginSection: howDifferentAreTheseColors background vs altBackground:${howDifferentAreTheseColors(NP_THEME.editor.backgroundColor, NP_THEME.editor.altBackgroundColor)}`)
// const altColor = !colorDiff || colorDiff < 5 ? getAltColor(NP_THEME.editor.backgroundColor) : NP_THEME.editor.altBackgroundColor

/**
 * HTML OUTPUT FOR EACH COMMAND
 */

type CommandTableProps = {
  commands: Array<Command>,
  viewOption: string,
}

function CommandTable({ commands, viewOption }: CommandTableProps): React$Node {
  return (
    <table className="w3-table">
      {viewOption !== 'commandsOnly' && (
        <thead>
          <tr>
            <th style={{ width: '40%' }}>Command</th>
            <th className="w3-rest">Description</th>
          </tr>
        </thead>
      )}
      <tbody>
        {commands.map((command, index) => (
          <tr key={index}>
            <td>/{command.name}</td>
            <td>{command.desc}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

type PluginSectionProps = {
  plugin: Plugin,
  viewOption: string,
  index: number,
}

/**
 * HTML OUTPUT FOR EACH PLUGIN
 */
function PluginSection({ plugin, viewOption, index }: PluginSectionProps): React$Node {
  const installedDisplayString = plugin.isInstalled ? (
    '(installed)'
  ) : (
    <a href={plugin.installLink} className="install-btn button">
      Install
    </a>
  )

  const docsString = plugin.documentation ? (
    <a href={plugin.documentation} className="documentation-link button">
      Documentation
    </a>
  ) : (
    ''
  )

  const updateIsAvailableString = plugin.updateIsAvailable ? '(update available)' : ''

  const pluginSectionStyle = {
    /* backgroundColor: index % 2 === 0 ? altColor : 'inherit', */
  }
  return (
    <div className="plugin-section" style={pluginSectionStyle}>
      <h3>
        <span className="pluginName">{plugin.name}</span>
        <span className="pluginVersion">v{plugin.version}</span>
        {updateIsAvailableString && <span className="updateIsAvailable">{updateIsAvailableString}</span>}
        <span className="pluginBy">by: </span>
        <span className="pluginAuthor">{plugin.author}</span>
        {docsString}
        <span className={plugin.isInstalled ? 'installed' : 'install'}>{installedDisplayString}</span>
      </h3>
      {viewOption === 'all' && (
        <>
          <p className="aboutPlugin">About this plugin: {plugin.desc}</p>
          {false && plugin.lastUpdateInfo && <p className="lastUpdate">Last update info: {plugin.lastUpdateInfo}</p>}
        </>
      )}
      {/* why is the following line not rendering */}
      <CommandTable commands={plugin.commands} viewOption={viewOption} />
    </div>
  )
}

type Command = {
  name: string,
  desc: string,
}

type Plugin = {
  name: string,
  version: string,
  author: string,
  isInstalled: boolean,
  updateIsAvailable: boolean,
  installLink?: string,
  documentation?: string,
  desc?: string,
  lastUpdateInfo?: string,
  commands: Array<Command>,
}

type Props = {
  data?: any,
  dispatch?: Function,
  pluginList?: Array<Plugin>,
}

function PluginListingPage(props: Props): React$Node {
  const { pluginList } = props
  // console.log('PluginListingPage props', props)

  const [filter, setFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState(categoryFilterOptions[0].value)
  const [installationFilter, setInstallationFilter] = useState(installationOptions[0].value)
  const [viewOption, setViewOption] = useState(viewOptions[0].value)

  const resetFilters = () => {
    setFilter('')
    setCategoryFilter(categoryFilterOptions[0].value)
    setInstallationFilter(installationOptions[0].value)
    setViewOption(viewOptions[0].value)
  }

  const filteredPlugins = pluginList?.filter((plugin) => {
    switch (installationFilter) {
      case 'installed':
        return plugin.isInstalled
      case 'notInstalled':
        return !plugin.isInstalled
      case 'updatesAvailable':
        return plugin.isInstalled && plugin.updateIsAvailable
      default:
        return true
    }
  })
  const filteredPluginsAndCommands = filterCommands({ pluginList: filteredPlugins ?? [], filter: filter, categoryFilter: categoryFilter, returnOnlyMatchingCommands: true })
  const filterDivStyle = {
    /* backgroundColor: NP_THEME.editor.backgroundColor */
  }
  return (
    <>
      <div className="sticky" style={filterDivStyle}>
        <input type="text" placeholder="Filter commands..." value={filter} onChange={(e) => setFilter(e.target.value)} />
        <Dropdown options={installationOptions} selectedValue={installationFilter} onValueChange={setInstallationFilter} />
        <Dropdown options={viewOptions} selectedValue={viewOption} onValueChange={setViewOption} />
        <Dropdown options={categoryFilterOptions} selectedValue={categoryFilter} onValueChange={setCategoryFilter} />
      </div>
      <div className="PluginListingPage">
        {filteredPluginsAndCommands?.length ? (
          filteredPluginsAndCommands.map((plugin, index) => <PluginSection key={index} plugin={plugin} viewOption={viewOption} index={index} />)
        ) : (
          <div className="noPluginsFound">
            <h3>No plugins found</h3>
            <p>
              Try{' '}
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  resetFilters()
                }}
              >
                resetting
              </a>{' '}
              /changing your filters.
            </p>
          </div>
        )}
      </div>
    </>
  )
}

export default PluginListingPage
