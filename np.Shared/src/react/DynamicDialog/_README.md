# DynamicDialog Component

## Overview

The `DynamicDialog` component is a flexible React component designed to render a dialog with various UI elements based on dynamic field definitions. It supports a variety of input types, including text, input, number, switch, combo, and dropdown, and allows for customization of display properties such as compactness and dependencies between fields.

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

## Adding a New UI Element
1. **Define the Element Type**: Add a new type to the `TSettingItemType` union in `DynamicDialog.jsx`.

   ```javascript
   export type TSettingItemType = 'switch' | 'input' | 'combo' | 'dropdown' | 'number' | 'text' | 'separator' | 'heading' | 'newType';
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
"type": "dropdown",
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

This README provides a comprehensive overview of the `DynamicDialog` component, its data flow, and instructions for extending its functionality with new UI elements.