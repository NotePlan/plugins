// This is a context provider for the app. You should generally not need to edit this file.
// It provides a way to pass functions and data to any component that needs it
// without having to pass from parent to child to grandchild etc.
//
// Any React component that needs access to the AppContext can use the useAppContext hook with these 2 lines
// import { useAppContext } from './AppContext.jsx'
// ...
// const {sendActionToPlugin, sendToPlugin, dispatch, pluginData}  = useAppContext() // MUST BE inside the React component/function code, cannot be at the top of a file

// @flow
import React, { createContext, useContext, type Node } from 'react'

export type AppContextType = {
  sendActionToPlugin: (command: string, dataToSend: any) => void,
  sendToPlugin: (command: string, dataToSend: any) => void,
  dispatch: (command: string, dataToSend: any) => void,
  pluginData: Object,
}

const AppContext = createContext<AppContextType>({
  sendActionToPlugin: () => {}, // all these will be set by AppProvider instantiation
  sendToPlugin: () => {},
  dispatch: () => {},
  pluginData: {},
})

type Props = {
  sendActionToPlugin: (command: string, dataToSend: any) => void,
  sendToPlugin: (command: string, dataToSend: any) => void,
  dispatch: (command: string, dataToSend: any) => void,
  pluginData: Object,
  children: Node, // React component children
}

// Explicitly annotate the return type of AppProvider as a React element
export const AppProvider = ({ children, sendActionToPlugin, sendToPlugin, dispatch, pluginData }: Props): Node => {
  return <AppContext.Provider value={{ sendActionToPlugin, sendToPlugin, dispatch, pluginData }}>{children}</AppContext.Provider>
}

// Explicitly annotate the return type of useAppContext
export const useAppContext = (): AppContextType => useContext(AppContext)
