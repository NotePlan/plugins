// @flow
//----------------------------------------------------------
// Dashboard React component to show the Perspectives settings
// Called by SettingsDialog component.
// Last updated 2024-08-22 for v2.1.0.a9 by @jgclark
//----------------------------------------------------------

// TODO: try and use SF Symbols 'perspective' icon

//----------------------------------------------------------
// Imports
//----------------------------------------------------------
import React from 'react'
import { JsonEditor } from 'json-edit-react'
import TextComponent from '../components/TextComponent.jsx'
import InputBox from '../components/InputBox.jsx'
import { useAppContext } from './AppContext.jsx'
import { clo, logDebug, logError } from '@helpers/react/reactDev.js'
import '../css/PerspectiveSettings.css'

//----------------------------------------------------------
// Type Definitions
//----------------------------------------------------------
// type Settings = { [key: string]: string | boolean };

type PerspectiveSettingsProps = {
  handleFieldChange: (key: string, value: any) => void,
  className: string,
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

//----------------------------------------------------------
// PerspectiveSettings Component Definition
//----------------------------------------------------------

const PerspectiveSettings = ({
  handleFieldChange,
  className = ''
}: PerspectiveSettingsProps): React$Node => {
  try {
    const { dashboardSettings, perspectiveSettings } = useAppContext()
    // only continue if we have Perspectives turned on
    if (!dashboardSettings.showPerspectives) return

    //----------------------------------------------------------------------
    // Context
    //----------------------------------------------------------------------

    const activePerspectiveName = dashboardSettings.activePerspectiveName || ''
    logDebug('PerspectiveSettings', `starting with '${activePerspectiveName}' active from ${String(perspectiveSettings.length)} perspectives: ${perspectiveSettings.map(p => `${p.name} (${Object.keys(p.dashboardSettings).length} settings)`).join(', ')}`)


    //----------------------------------------------------------------------
    // State
    //----------------------------------------------------------------------

    //----------------------------------------------------------------------
    // Handlers
    //----------------------------------------------------------------------

    const setJsonData = (updatedData: any) => {
      clo(updatedData, `PerspectiveSettings updated; but wont' be saved until user clicks Save:`)
      // Note that JSON was updated but dispatchDashboardSettings should not be called until the user clicks "Save on the window" 
      // so we don't set it here, we just pass it back to the parent component (SettingsDialog) to handle as if it was any other field
      // TODO: check this is working
      handleFieldChange('perspectiveSettings', updatedData)
    }

    //----------------------------------------------------------------------
    // Effects
    //----------------------------------------------------------------------

    //----------------------------------------------------------------------
    // Render
    //----------------------------------------------------------------------

    return (
      <div className={className}>
        {/* Add Heading and Description at start of Perspective section */}
        {/* <div className="ui-heading">{heading}</div> */}
        {/* <TextComponent
          textType={'header'}
          label={'Perspectives'}
          description={`A 'Perspective' is a named set of all your Dashboard settings, including which folders to include/ignore, and which sections to show.`}
        /> */}
        <InputBox
          readOnly={true}
          label={'Active Perspective'}
          onChange={() => { }}
          value={activePerspectiveName}
          compactDisplay={true}
        />
        <TextComponent
          textType='description'
          key='aPN'
          // label={"The currently active Perspective (read-only: to change this use the dropdown on the main window). A '*' following indicates that the settings have been changed but not saved. The '-' Perspective is the default when no Perspective is active."}
          label="The currently active Perspective (read-only: to change this use the dropdown on the main window). The '-' Perspective is the default when no Perspective is active."
        />
        <label className="input-box-label">Perspective Definitions</label>
        <TextComponent
          textType='description'
          key='json-description'
          label="The underlying JSON definitions of the Perspective(s):"
        />

        {/* TODO: Have a nice Editable Table with Add/Delete/Update buttons. Perhaps from https://codesandbox.io/s/react-table-add-edit-delete-v2-gmhuc */}
        {/* Or the component at https://react-table-library.com/?path=/docs/crud--delete */}

        {/* JSON Editor for now to view/udpate. From https://github.com/CarlosNZ/json-edit-react */}
        {/* TODO: use a dark theme where necessary */}
        <JsonEditor
          data={perspectiveSettings ?? {}}
          rootName={"perspectiveSettings"}
          setData={setJsonData}
          rootFontSize={"10pt"}
          collapse={2} // earlier: false
          className={"ui-perspective-container"}
          showArrayIndices={true}
          showStringQuotes={true}
          showCollectionCount={"when-closed"}
        />
      </div>
    )
  } catch (error) {
    logError('PerspectiveSettings', error.message)
  }
}

export default PerspectiveSettings
