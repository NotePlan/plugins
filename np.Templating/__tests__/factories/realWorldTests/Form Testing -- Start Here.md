---
title: Form Testing -- Start Here
receivingTemplateTitle: "Project Form Processing Template"
formTitle: "Foo Bar"
hideDependentItems: false
allowEmptySubmit: false
type: template-form 
launchLink: noteplan://x-callback-url/runPlugin?pluginID=np.Templating&command=Open%20Template%20Form&arg0=Form%20Testing%20--%20Start%20Here

---
```formfields
[
    {
      type: 'heading',
      label: 'heading: This is a heading',
    },
    {
      type: 'separator',
    },
    {
      key: 'textExample',
      label: 'text: This is just some explanatory text',
      type: 'text',
      textType: 'description',
    },
    {
      key: 'inputExample',
      label: 'input: Compact label and field',
      description: 'Display next to each other.',
      type: 'input',
      default: 'Default Value',
      compactDisplay: true,
    },
    {
      key: 'nonCompactInput',
      label: 'input: Non-Compact Section label and field',
      description: 'Display one above the other.',
      type: 'input',
      default: 'Default value',
    },
    {
      key: 'readOnlyExample',
      label: 'input-readonly: This is a read-only field',
      description: 'This displays an input box but is read-only',
      type: 'input-readonly',
      default: 'Default value',
      compactDisplay: true,
    },
    {
      key: 'numberType',
      label: 'number: This is a simple number input',
      description: 'compact+displays with increment/decrement buttons',
      type: 'number',
      default: '2',
      compactDisplay: true,
    },
    {
      key: 'numberType2',
      label: 'number: This is also a number input',
      description: 'but this one should increment/decrement by 5',
      type: 'number',
      default: '2',
		step: 5,
      compactDisplay: true,
    },
    {
      key: 'switchExample',
      label: 'This is a switch',
      description: 'this is a switch description',
      type: 'switch',
      default: false,
      compactDisplay: true,
    },
    {
      key: 'comboExample',
      label: 'combo: example of combo menu in compactDisplay',
      description:
        "this is my desc under the combo",
      type: 'combo',
      options: ['priority', 'earliest', 'most recent'],
      default: 'priority',
      compactDisplay: true,
    },
    {
      key: 'comboExample2',
      label: 'combo: example of combo menu with label/values',
      description:
        "array of objects not strings",
      type: 'combo',
      options: [{label: 'priority', value: 'prioValue'}, {label:'earliest', value: 'most recent'}],
      default: 'priority',
      compactDisplay: true,
    },
    {
      key: 'dropdownExample',
      label: 'dropdown: example of dropdown box',
      description:
        "my desc under dropdown",
      type: 'dropdown',
      options: ['priority', 'earliest', 'most recent'],
      default: 'priority',
    },
  {
    key: "dependencyExample",
    label: "Show dependent items?",
    description: "Turning this on shows dependent items.",
    type: 'switch',
    default: false,
    compactDisplay: true,
  },
  {
    key: "dependentItem",
    label: "This field is dependent on the one above.",
    type: 'input',
	 dependsOnKey: 'dependencyExample',
    default: "Should be disabled by default",
    compactDisplay: true,
  },
	{
		key: "jsonExample",
		type: "json",
		label: "my json label",
	   default: "{\"field1\":2,\"field2\":'boo'}",
		description: "this is my json description",
	}
  ]
```
