# DynamicDialog Component

## Overview

The `DynamicDialog` component is a flexible React component designed to render a modal dialog with various UI elements based on dynamic field definitions. It supports a variety of input types, including text, input, number, switch, combo, and dropdown, and allows for customization of display properties such as compactness and dependencies between fields. It can be used with "await" to get user input and returns a promise that resolves to the userInputObj, or null if the dialog is closed without saving, or it can be invoked in an asynchronous way without "await" using setReactSettings.

## Using DynamicDialog

There are two methods of invoking DynamicDialog:

1. `showDialog()` (in @helpers/react/userInput.jsx)

```js
export function showDialog(dialogProps: TDynamicDialogProps): Promise<TAnyObject|null> {
```

This pops up a dialog with the items defined in dialogProps.
It returns a promise that resolves to the userInputObj, or null if the dialog is closed without saving. In this regard, it works somewhat like NotePlan's `CommandBar.showInput()`, but more flexible. The goal is eventually to use showDialog to build all the same types of dialogs that are used in the native NotePlan Command Bar.

The simplest dialog:

```js
  const formFields = [{ type: 'input', label: 'Task:', key: 'text' }]
  const userInputObj = await showDialog({ items: formFields, title: "Dialog Title" })
```

This would display a dialog with a single input field for a task with "Save" and "Cancel" buttons. Hitting cancel would return null. Hitting 'Save' would return an object like:

```js
  { text: 'A task' }
```

1. The other method to invoke DynamicDialog is using reactSettings to open a dialog in a more asynchronous way (not await). It assumes you have access to setReactSettings via useAppContext. [Note: this was the original way to open a dialog, but I think you will find showDialog() easier to use and understand/debug.]

```js
  const formFields = [{ type: 'input', label: 'Task:', key: 'text' }]
    setReactSettings((prev) => ({
      ...prev,
      dynamicDialog: {
        isOpen: true,
        items: formFields,
        title: "Dialog Title",
        onSave: (userInputObj) => {
          // handle the userInputObj
        },
        onCancel: () => {
          // handle cancel (e.g. close dialog)
          setReactSettings((prev) => ({
            ...prev,
            dynamicDialog: {
              isOpen: false,
            },
          }))
        }
      }
    }))
```

> **NOTE:** See all the fields in TDynamicDialogProps in DynamicDialog.jsx. These can be used to customize the dialog in both methods.

## Data Flow

### Rendering Items

1. **Input Data**: The component receives an array of items, each defined by a type and additional properties such as label, description, options, and default values.
2. **Item Rendering**: Each item is rendered using the `renderItem` function, which selects the appropriate UI component (e.g., `InputBox`, `Switch`, `ThemedSelect`) based on the item's type.
3. **UI Components**: The UI components are responsible for rendering the visual elements and handling user interactions. They receive props such as `label`, `value`, `options`, and event handlers for changes.

### Handling Changes

1. **User Interaction**: When a user interacts with a UI element (e.g., changes a value, toggles a switch), the corresponding event handler is triggered.
2. **State Update**: The event handler calls `handleFieldChange`, which updates the component's state with the new value.
3. **Callback Execution**: If provided, the `onSave` callback is executed with the updated settings when the user submits the dialog.

### Dependency Management

- **`dependsOn` Property**: The `dependsOn` property allows for conditional rendering of UI elements based on the state of another field. If a field has a `dependsOn` key, it will only be enabled and visible when the field it depends on is in a specific state (e.g., a switch is turned on).
- **Indentation**: When a field has a `dependsOn` property, it is automatically indented to visually indicate its dependency on another field.

## Adding a New UI Element to DynamicDialog

To add a new UI element to the `DynamicDialog` component, follow these steps:

1. **Define the Element Type**: Add a new type to the `TSettingItemType` union in `DynamicDialog.jsx`.

   ```javascript
   export type TSettingItemType = 'switch' | 'input' | 'combo' | 'dropdown-select' | 'number' | 'text' | 'separator' | 'heading' | 'json';
   ```

2. **Create the Component**: Implement a new React component for the UI element, ensuring it accepts necessary props such as `label`, `value`, `onChange`, and any specific options.

3. **Update `renderItem`**: Modify the `renderItem` function in `dialogElementRenderer.js` to include a case for the new type. Use the new component to render the item.

   ```javascript
   case 'newType':
     return (
       <NewComponent
         key={`new${index}`}
         label={item.label || ''}
         value={item.value || ''}
         onChange={(newValue) => {
           item.key && handleFieldChange(item.key, newValue)
         }}
         // Add any additional props needed
       />
     );
   ```

4. **Test the Component**: Add test data for the new element type and verify that it renders correctly and handles user interactions as expected.

## Test Data

The following test data can be used to render the `DynamicDialog` and verify its functionality:

```json
[
  {
    "type": "heading",
    "label": "heading: This is a heading"
  },
  {
    "type": "separator"
  },
  {
    "key": "textExample",
    "label": "text: This is just some explanatory text",
    "type": "text",
    "textType": "description"
  },
  {
    "key": "inputExample",
    "label": "input: Compact label and field",
    "description": "Display next to each other.",
    "type": "input",
    "default": "Default Value",
    "compactDisplay": true
  },
  {
    "key": "nonCompactInput",
    "label": "input: Non-Compact Section label and field",
    "description": "Display one above the other.",
    "type": "input",
    "default": "Default value"
  },
  {
    "key": "readOnlyExample",
    "label": "input-readonly: This is a read-only field",
    "description": "This displays an input box but is read-only",
    "type": "input-readonly",
    "default": "Default value",
    "compactDisplay": true
  },
  {
    "key": "numberType",
    "label": "number: This is a number input",
    "description": "compact+displays with increment/decrement buttons",
    "type": "number",
    "default": "2",
    "compactDisplay": true
  },
  {
    "key": "switchExample",
    "label": "This is a switch",
    "description": "this is a switch",
    "type": "switch",
    "default": false,
    "compactDisplay": true
  },
  {
    "key": "comboExample",
    "label": "combo: example of combo menu in compactDisplay",
    "description": "this is my desc under the combo",
    "type": "combo",
    "options": ["priority", "earliest", "most recent"],
    "default": "priority",
    "compactDisplay": true
  },
  {
    "key": "dropdownExample",
    "label": "dropdown: example of dropdown box",
    "description": "my desc under dropdown",
    "type": 'dropdown-select',
    "options": ["priority", "earliest", "most recent"],
    "default": "priority"
  },
  {
    "key": "dependencyExample",
    "label": "Show dependent items?",
    "description": "Turning this on shows dependent items.",
    "type": "switch",
    "default": false,
    "compactDisplay": true
  },
  {
    "key": "dependentItem",
    "label": "This field is dependent on the one above.",
    "type": "input",
    "dependsOnKey": "dependencyExample",
    "default": "Should be disabled by default",
    "compactDisplay": true
  }
]
```

---

## Use in Dashboard

- In `dataGeneration.js`, add formFields to the button definition, like this:

```javascript
getTodaySectionData()
...
    const formFields: Array<TSettingItem> = [{ type: 'input', label: 'Task:', key: 'text' }]

    const headings = currentDailyNote ? getHeadingsFromNote(currentDailyNote, false, true, true, true): []

    if (headings.length) {
      formFields.push({ type: 'dropdown-select', label: 'Under Heading:', key: 'heading', fixedWidth: 300,  options: headings, noWrapOptions: true, value: config.newTaskSectionHeading })
    }
  ...
        actionButtons: [
        {
          actionName: 'addTask',
          actionParam: thisFilename,
          actionPluginID: `${pluginJson["plugin.id"]}`,
          display: '<i class= "fa-regular fa-circle-plus sidebarDaily" ></i> ',
          tooltip: "Add a new task to today's note",
          postActionRefresh: ['DT'],
          formFields: formFields, // <---
        },

```

Then CommandButton.jsx will use the formFields to create the dialog when clicked:

```js
  const handleButtonClick = () => {
    ...
     button.formFields && openDialog(button)

```

this opens the dialog by setting the reactSettings state.

```js
  const openDialog = (button: TActionButton) => {
    setReactSettings((prev) => ({
      ...prev,
      dynamicDialog: {
        isOpen: true,
        submitOnEnter: button.submitOnEnter ?? true,
        title: button.tooltip,
        items: button.formFields,
        onSave: (userInputObj) => sendButtonAction(button,userInputObj),
        onCancel: ()=>closeDialog(),
        allowEmptySubmit: false,
        hideDependentItems: true,
      },
    }))
  }
```

When the user clicks 'Save', the `sendButtonAction` is called with the object from the dialog:

```js
  const sendButtonAction = (button: TActionButton, userInputObj: Object) => {
    sendActionToPlugin(button.actionPluginID, {
      actionType: button.actionName,
      toFilename: button.actionParam,
      sectionCodes: button.postActionRefresh,
      userInputObj: userInputObj,
    })
    closeDialog()
    onClick(button)
  }
```

And userInputObj is passed to the plugin action.
The keys/props in userInputObj are the keys in the formFields array.
