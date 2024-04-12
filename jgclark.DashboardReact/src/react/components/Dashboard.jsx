// @flow

import React from 'react'
import Header from './Header.jsx'
import Section from './Section.jsx'
// import { useAppContext } from './AppContext.jsx'

type Props = {
  pluginData: Object /* the data that was sent from the plugin in the field "pluginData" */,
}

/**
 * Dashboard component aggregating data and layout for the dashboard.
 */
function Dashboard({ pluginData }: Props): React$Node {
  //   const { sendActionToPlugin, sendToPlugin, dispatch, pluginData }  = useAppContext()
  const { sections, lastUpdated } = pluginData
  const dashboardContainerStyle = {
    maxWidth: '100vw',
    width: '100vw',
  }
  return (
    <div style={dashboardContainerStyle}>
      {/* CSS for this part is in dashboard.css */}
      <div className="dashboard">
        <Header lastUpdated={lastUpdated} />
        {/* Assuming sections data is fetched or defined elsewhere and passed as props */}
        {sections.map((section, index) => (
          <Section key={index} section={section} />
        ))}
      </div>

      {/* CSS for this part is in dashboardDialog.css */}
      {/*----------- Single dialog that can be shown for any task-based item -----------*/}
      <dialog id="itemControlDialog" className="itemControlDialog" aria-labelledby="Actions Dialog"
        aria-describedby="Actions that can be taken on items">
        <div className="dialogTitle">From <i className="pad-left pad-right fa-regular fa-file-lines"></i><b><span id="dialogItemNote">?</span></b></div>
        <div className="dialogBody">
          <div className="buttonGrid" id="itemDialogButtons">
            <div>For</div>
            <div className="dialogDescription">
              <input type="text" id="dialogItemContent" className="fullTextInput" />
              <button className="updateItemContentButton" data-control-str="update">Update</button>
            </div>
            <div>Move to</div>
            <div id="itemControlDialogMoveControls">
              <button className="PCButton" data-control-str="t">today</button>
              <button className="PCButton" data-control-str="+1d">+1d</button>
              <button className="PCButton" data-control-str="+1b">+1b</button>
              <button className="PCButton" data-control-str="+2d">+2d</button>
              <button className="PCButton" data-control-str="+0w">this week</button>
              <button className="PCButton" data-control-str="+1w">+1w</button>
              <button className="PCButton" data-control-str="+2w">+2w</button>
              <button className="PCButton" data-control-str="+0m">this month</button>
              <button className="PCButton" data-control-str="+0q">this quarter</button>
            </div>
            <div>Other controls</div>
            <div id="itemControlDialogOtherControls">
              <button className="PCButton" data-control-str="cancel">Cancel</button>{/* mainly for iOS */}
              <button className="PCButton" data-control-str="movetonote">Move to <i className="fa-regular fa-file-lines"></i></button>
              <button className="PCButton" data-control-str="priup"><i className="fa-regular fa-arrow-up"></i> Priority</button>
              <button className="PCButton" data-control-str="pridown"><i className="fa-regular fa-arrow-down"></i> Priority</button>
              <button className="PCButton" data-control-str="tog">Toggle Type</button>
              <button className="PCButton" data-control-str="ct">Complete Then</button>
              <button className="PCButton" data-control-str="unsched">Unschedule</button>
            </div>
            <div></div>
            <div><form><button id="closeButton" className="mainButton">Close</button></form></div>
          </div>
        </div>
      </dialog>

      {/*----------- Single dialog that can be shown for any project item -----------*/}
      <dialog id="projectControlDialog" className="projectControlDialog" aria-labelledby="Actions Dialog"
        aria-describedby="Actions that can be taken on projects">
        <div className="dialogTitle">For <i className="pad-left pad-right fa-regular fa-file-lines"></i><b><span id="dialogProjectNote">?</span></b></div>
        <div className="dialogBody">
          <div className="buttonGrid" id="projectDialogButtons">
            <div>Project Reviews</div>
            <div id="projectControlDialogProjectControls">
              <button data-control-str="finish"><i className="fa-regular fa-calendar-check"></i> Finish Review</button>
              <button data-control-str="nr+1w"><i className="fa-solid fa-forward"></i> Skip 1w</button>
              <button data-control-str="nr+2w"><i className="fa-solid fa-forward"></i> Skip 2w</button>
              <button data-control-str="nr+1m"><i className="fa-solid fa-forward"></i> Skip 1m</button>
              <button data-control-str="nr+1q"><i className="fa-solid fa-forward"></i> Skip 1q</button>
            </div>
            <div></div>
            <div><form><button id="closeButton" className="mainButton">Close</button></form></div>
          </div>
        </div>
      </dialog >

    </div >
  )
}

export default Dashboard
