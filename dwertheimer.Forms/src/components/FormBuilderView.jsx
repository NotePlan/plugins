// @flow
//--------------------------------------------------------------------------
// FormBuilderView - React WebView wrapper for FormBuilder
//--------------------------------------------------------------------------

import React, { useEffect, type Node } from 'react'
import { type PassedData } from '../NPTemplateForm.js'
import { AppProvider } from './AppContext.jsx'
import FormBuilder from './FormBuilder.jsx'
import { clo, logDebug } from '@helpers/react/reactDev.js'
import './FormBuilder.css'

type Props = {
  data: any,
  dispatch: Function,
  reactSettings: any,
  setReactSettings: Function,
  onSubmitOrCancelCallFunctionNamed: string,
}

/**
 * Root element for the FormBuilder's React Tree
 * NOTE: Even though we have named this FormBuilderView.jsx, it is exported as WebView because that is what Root expects to load dynamically
 */
export function WebView({
  data,
  dispatch,
  reactSettings,
  setReactSettings,
  onSubmitOrCancelCallFunctionNamed = 'onFormBuilderAction',
}: Props): Node {
  const { pluginData } = data
  const formFields = pluginData.formFields || []
  const receivingTemplateTitle = pluginData.receivingTemplateTitle || ''
  const windowTitle = pluginData.windowTitle || ''
  const formTitle = pluginData.formTitle || ''
  const allowEmptySubmit = pluginData.allowEmptySubmit || false
  const hideDependentItems = pluginData.hideDependentItems || false
  const width = pluginData.width
  const height = pluginData.height
  const isNewForm = pluginData.isNewForm || false
  const templateTitle = pluginData.templateTitle || ''

  const sendActionToPlugin = (command: string, dataToSend: any) => {
    logDebug('FormBuilderView', `sendActionToPlugin: command="${command}"`)
    clo(dataToSend, `FormBuilderView: sendActionToPlugin dataToSend`)
    dispatch('SEND_TO_PLUGIN', [command, dataToSend], `FormBuilderView: ${command}`)
  }

  const handleSave = (fields: Array<any>, frontmatter: any) => {
    clo(fields, 'FormBuilderView: handleSave fields')
    clo(frontmatter, 'FormBuilderView: handleSave frontmatter')
    sendActionToPlugin(onSubmitOrCancelCallFunctionNamed, {
      type: 'save',
      fields,
      frontmatter,
      templateFilename: pluginData.templateFilename || '',
      templateTitle: pluginData.templateTitle || '',
    })
  }

  const handleCancel = () => {
    sendActionToPlugin(onSubmitOrCancelCallFunctionNamed, { type: 'cancel' })
  }

  const handleOpenForm = (templateTitle: string) => {
    sendActionToPlugin(onSubmitOrCancelCallFunctionNamed, {
      type: 'openForm',
      templateTitle: templateTitle,
    })
  }

  return (
    <AppProvider
      sendActionToPlugin={sendActionToPlugin}
      sendToPlugin={sendActionToPlugin}
      dispatch={dispatch}
      pluginData={pluginData}
      updatePluginData={(newData) => {
        const newFullData = { ...data, pluginData: newData }
        dispatch('UPDATE_DATA', newFullData)
      }}
      reactSettings={reactSettings}
      setReactSettings={setReactSettings}
    >
      <div className={`webview ${pluginData.platform || ''}`}>
        <div style={{ maxWidth: '100vw', width: '100vw', height: '100vh' }}>
          <FormBuilder
            initialFields={formFields}
            receivingTemplateTitle={receivingTemplateTitle}
            windowTitle={windowTitle}
            formTitle={formTitle}
            allowEmptySubmit={allowEmptySubmit}
            hideDependentItems={hideDependentItems}
            width={width}
            height={height}
            isNewForm={isNewForm}
            templateTitle={templateTitle}
            onSave={handleSave}
            onCancel={handleCancel}
            onOpenForm={handleOpenForm}
          />
        </div>
      </div>
    </AppProvider>
  )
}

export default WebView
