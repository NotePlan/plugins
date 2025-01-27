// @flow
import React from 'react'
import { createRoot } from 'react-dom/client'
import DynamicDialog, { type TDynamicDialogProps, type TSettingItem } from './DynamicDialog/DynamicDialog'
import { logDebug, logError } from './reactDev'

/**
 * Shows a React modal dialog and returns the user input or null if canceled.
 * The user input object is returned from the onSave callback from an enter or save button click.
 * The object returned holds the form field values (keys specified in formFields), and is passed to the onSave callback.
 * See DynamicDialog.jsx for more details, including TSettingItem types for the formFields in the items array.
 * @param {TDynamicDialogProps} dialogProps - The properties to pass to the DynamicDialog component.
 * @returns {Promise<Object|null>} The user input object or null if canceled.
 */
export function showDialog(dialogProps: TDynamicDialogProps): Promise<TAnyObject | null> {
  return new Promise((resolve) => {
    const container = document.createElement('div')
    if (document.body) {
      document.body.appendChild(container)
      logDebug('showDialog', 'container appended to document.body')
    }

    const root = createRoot(container)
    logDebug('showDialog', 'root created')

    const closeDialog = () => {
      try {
        if (root) {
          root.unmount()
          logDebug('showDialog', 'root.unmount() called')
        }
        if (document.body && container.parentNode === document.body) {
          document.body.removeChild(container)
          logDebug('showDialog', 'container removed from document.body')
        }
      } catch (error) {
        logError('showDialog', 'Error during closeDialog', error)
      }
    }

    const handleClose = () => {
      logDebug('showDialog', 'handleClose called')
      closeDialog()
      resolve(null)
    }

    const handleCancel = () => {
      logDebug('showDialog', 'handleCancel called')
      dialogProps.onCancel?.()
      closeDialog()
      resolve(null)
    }

    const handleSave = (userInputObj: Object) => {
      closeDialog()
      resolve(userInputObj)
    }

    const handleButtonClick = (key: string, value: string) => {
      logDebug('showDialog', 'handleButtonClick', key, value)
      dialogProps.handleButtonClick && dialogProps.handleButtonClick(key, value)
      handleClose()
    }

    root.render(
      <DynamicDialog
        title={dialogProps.title}
        items={dialogProps.items}
        className={dialogProps.className}
        labelPosition={dialogProps.labelPosition}
        allowEmptySubmit={dialogProps.allowEmptySubmit}
        submitButtonText={dialogProps.submitButtonText}
        isOpen={dialogProps.isOpen}
        style={dialogProps.style}
        isModal={dialogProps.isModal}
        onSave={handleSave}
        onCancel={handleCancel}
        hideDependentItems={dialogProps.hideDependentItems}
        submitOnEnter={dialogProps.submitOnEnter}
        hideHeaderButtons={dialogProps.hideHeaderButtons}
        handleButtonClick={handleButtonClick}
      >
        {dialogProps.children}
      </DynamicDialog>,
    )
  })
}

/**
 * Shows a confirmation dialog with customizable buttons.
 * @param {Object} options - Options to customize the confirmation dialog.
 * @param {string} options.title - The title of the dialog.
 * @param {string} options.message - The message to display in the dialog.
 * @param {Function} options.onConfirm - Callback when a button is clicked.
 * @param {Function} options.onCancel - Callback when "No" is clicked.
 * @param {Array<string>} [options.options] - Array of button labels/values.
 * @returns {Promise<string|false>} Resolves to the chosen string or false if canceled.
 */
export function showConfirmationDialog({
  title = 'Confirmation',
  message = 'Are you sure?',
  onConfirm,
  onCancel,
  options,
}: {
  title?: string,
  message?: string,
  onConfirm?: (choice: string) => void,
  onCancel?: () => void,
  options?: Array<string>,
}): Promise<string | false> {
  logDebug('showConfirmationDialog', 'Opening dialog')
  return new Promise((resolve) => {
    const defaultOptions = ['No', 'Yes']
    const initialOptions = options || defaultOptions
    const defaultOption = initialOptions[initialOptions.length - 1] // default option is the last one
    const finalOptions = initialOptions.map((option) => ({
      label: option,
      value: option,
      isDefault: option === defaultOption,
    }))
    const dialogItems: Array<TSettingItem> = [
      {
        type: 'text',
        key: 'confirmationMessage',
        label: message,
        textType: 'title',
      },
      {
        type: 'button-group',
        key: 'confirmationButtons',
        options: finalOptions,
      },
    ]

    const handleButtonClick = (key: string, value: string) => {
      logDebug('showConfirmationDialog', 'handleButtonClick', key, value)
      onConfirm?.(value)
      resolve(value)
      closeDialog()
    }

    const handleEnterKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        handleButtonClick('confirmationButtons', defaultOption)
      }
    }

    const closeDialog = () => {
      document.removeEventListener('keydown', handleEnterKey)
    }

    document.addEventListener('keydown', handleEnterKey)

    showDialog({
      title,
      className: 'confirmation',
      items: dialogItems,
      isOpen: true,
      hideHeaderButtons: true,
      handleButtonClick,
      onCancel: () => {
        logDebug('showConfirmationDialog', 'onCancel called')
        onCancel?.()
        resolve(false)
        closeDialog()
      },
    }).finally(() => {
      closeDialog()
    })
  })
}

/**
 * Show a simple yes/no/cancel (or OK/No/Cancel, etc.) React dialog.
 * @param {string} message - text to display to user
 * @param {?Array<string>} choicesArray - an array of the choices to give (default: ['Yes', 'No', 'Cancel'])
 * @param {?string} dialogTitle - title for the dialog (default: empty)
 * @param {?boolean} useCommandBar - force use NP CommandBar instead of native prompt (default: false)
 * @returns {Promise<string|cancel>} - returns the user's choice - the actual *text* choice from the input array provided or false if 'Cancel' or is canceled using escape or clicking outside
 */
export async function showMessageYesNoCancel(message: string, choicesArray: Array<string> = ['Cancel', 'Yes', 'No'], dialogTitle: string = ''): Promise<string | false> {
  const answer = await showConfirmationDialog({
    title: dialogTitle,
    message,
    options: choicesArray,
    onConfirm: (choice: string) => {
      logDebug('showMessageYesNoCancel', `User confirmed with choice: ${choice}`)
    },
    onCancel: () => {
      logDebug('showMessageYesNoCancel', 'User canceled')
    },
  })
  return answer === 'Cancel' ? false : answer
}

/**
 * WARNING: Not yet tested.
 * Shows a message dialog with just an "OK" button.
 * @param {Object} options - Options to customize the confirmation dialog.
 * @param {string} options.title - The title of the dialog.
 * @param {string} options.message - The message to display in the dialog.
 * @param {Function} options.onOK - Callback when "OK" is clicked.
 */
export function showMessageDialog({ title = 'Confirmation', message = 'Are you sure?', onOK }: { title?: string, message?: string, onOK?: () => void }): void {
  logDebug('showMessageDialog', 'Opening dialog')
  const dialogItems: Array<TSettingItem> = [
    {
      type: 'text',
      key: 'message',
      label: message,
      textType: 'title',
    },
    {
      type: 'button-group',
      key: 'messageButton',
      options: [{ label: 'OK', value: 'ok', isDefault: true }],
    },
  ]

  const handleButtonClick = (key: string, value: string) => {
    logDebug('showMessageDialog', 'handleButtonClick', key, value)
    if (value === 'ok') {
      onOK?.()
    }
  }

  const handleEnterKey = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleButtonClick('messageButton', 'yes')
    }
  }

  document.addEventListener('keydown', handleEnterKey)

  showDialog({
    title,
    className: 'confirmation',
    items: dialogItems,
    isOpen: true,
    hideHeaderButtons: true,
    handleButtonClick,
    onCancel: () => {},
  }).finally(() => {
    document.removeEventListener('keydown', handleEnterKey)
  })
}
