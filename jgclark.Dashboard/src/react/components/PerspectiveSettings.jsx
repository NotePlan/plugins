// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show the Perspectives settings
// Called by DashboardSettings component.
// Last updated 2024-08-03 for v2.1.0.a3 by @jgclark
//--------------------------------------------------------------------------

//--------------------------------------------------------------------------
// Imports
//--------------------------------------------------------------------------
import React from 'react'
// import { useEffect, useRef, useState, type ElementRef } from 'react'
// import type { perspectiveSettingDefaults, perspectiveSettingDefinitions } from '../../dashboardSettings.js'
import { JsonEditor } from 'json-edit-react'
// import type { TPerspectiveDef } from '../../types'
// import ComboBox from '../components/ComboBox.jsx'
// import PerspectiveDefinitionSettings from '../components/PerspectiveDefinitionSettings.jsx'
import TextComponent from '../components/TextComponent.jsx'
import { useAppContext } from './AppContext.jsx'
import { clo, logDebug, logError } from '@helpers/react/reactDev.js'
import '../css/PerspectiveSettings.css'

//--------------------------------------------------------------------------
// Type Definitions
//--------------------------------------------------------------------------
type Settings = { [key: string]: string | boolean };

type PerspectiveSettingsProps = {
  values: any
};

// type JsonEditorReturnData = {
//   newData: any,      // data state after update
//   currentData: any,  // data state before update 
//   newValue: any,     // the new value of the property being updated
//   currentValue: any, // the current value of the property being updated
//   name: string,         // name of the property being updated
//   path: Array<string>,          // full path to the property being updated, as an array of property keys
//   // (e.g. [ "user", "friends", 1, "name" ] ) (equivalent to "user.friends[1].name")
// }

//--------------------------------------------------------------------------
// PerspectiveSettings Component Definition
//--------------------------------------------------------------------------

const PerspectiveSettings = ({
  values
}: PerspectiveSettingsProps): React$Node => {
  try {
    const { dashboardSettings, setDashboardSettings } = useAppContext()
    // only continue if we have this Feature Flag turned on
    if (!dashboardSettings.FFlag_Perspectives) return

    // clo(values, 'PerspectiveSettings starting with values:')

    //----------------------------------------------------------------------
    // Context
    //----------------------------------------------------------------------

    // const perspectiveDefs: Array<TPerspectiveDef> = values || []
    // clo(perspectiveDefs, 'perspectiveDefs')
    // const activePerspectiveName = dashboardSettings.activePerspectiveName || ''
    // logDebug('PerspectiveSettings', `perspectiveDef names: ${perspectiveDefs.map((pd) => pd.name).sort().join(' / ')}`)
    // logDebug('PerspectiveSettings', `activePerspectiveName: '${activePerspectiveName}'`)
    clo(dashboardSettings.perspectives, 'Perspective settings at start:')

    //----------------------------------------------------------------------
    // State
    //----------------------------------------------------------------------

    //----------------------------------------------------------------------
    // Handlers
    //----------------------------------------------------------------------

    const setJsonData = (updatedData: any) => {
      clo(updatedData, 'PerspectiveSettings updated')
      // TODO: HELP: why is this apparently not working?
      setDashboardSettings(prev => ({ ...prev, ...{ dashboardSettings: updatedData }, lastChange: 'Perspective Settings updated' }))
    }

    //----------------------------------------------------------------------
    // Effects
    //----------------------------------------------------------------------

    //----------------------------------------------------------------------
    // Render
    //----------------------------------------------------------------------

    return (
      <>
        {/* Add Heading and Description at start of Perspective section */}
        {/* <div className="ui-heading">{heading}</div> */}
        <TextComponent
          textType={'header'}
          label={'Perspective Definitions'}
        />
        <TextComponent
          textType={'description'}
          label={"A 'Perspective' is a named settings set applied to the Dashboard view."}
        />
        <TextComponent
          textType={'description'}
          label={"The following is the underlying JSON definitions of the Perspective(s):"}
        />

        {/* TODO: Have a nice Editable Table with Add/Delete/Update buttons. Perhaps from https://codesandbox.io/s/react-table-add-edit-delete-v2-gmhuc */}
        {/* Or the component at https://react-table-library.com/?path=/docs/crud--delete */}

        {/* JSON Editor for now to view/udpate. From https://github.com/CarlosNZ/json-edit-react */}
        <JsonEditor
          data={dashboardSettings.perspectives ?? {}}
          rootName={"perspectives"}
          setData={setJsonData}
          rootFontSize={"10pt"}
          collapse={false}
          className={"ui-perspective-container"}
          showArrayIndices={true}
          showStringQuotes={true}
          showCollectionCount={"when-closed"}
        />

        {/* Finally add a Separator */}
        <TextComponent
          textType={'separator'}
          label=''
        />
      </>
    )
  } catch (error) {
    logError('PerspectiveSettings', error.message)
  }
}

export default PerspectiveSettings
