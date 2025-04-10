// @flow
import React, { useState } from 'react'
import Switch from './Switch'

/**
 * Demo component to showcase the different labelPosition options of the Switch component
 * @returns {React$Node} The SwitchDemo component
 */
const SwitchDemo = (): React$Node => {
  const [stateLeft, setStateLeft] = useState(false)
  const [stateRight, setStateRight] = useState(false)
  const [stateBoth, setStateBoth] = useState(false)

  return (
    <div className="switch-demo-container" style={{ padding: '20px', maxWidth: '400px' }}>
      <h2>Switch Component Demo</h2>

      <div style={{ marginBottom: '20px' }}>
        <h3>1. Label on the left</h3>
        <Switch
          label="Left Label"
          checked={stateLeft}
          onChange={(e) => setStateLeft(e.target.checked)}
          labelPosition="left"
          description="This switch has its label on the left side"
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3>2. Label on the right (default)</h3>
        <Switch
          label="Right Label"
          checked={stateRight}
          onChange={(e) => setStateRight(e.target.checked)}
          labelPosition="right"
          description="This switch has its label on the right side (default behavior)"
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3>3. Labels on both sides</h3>
        <Switch
          label={['OFF', 'ON']}
          checked={stateBoth}
          onChange={(e) => setStateBoth(e.target.checked)}
          labelPosition="both"
          description="This switch has different labels on both sides, changing with the state"
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3>4. Disabled state</h3>
        <Switch label="Disabled Switch" checked={true} onChange={() => {}} disabled={true} description="This switch is disabled and cannot be toggled" />
      </div>

      <div>
        <h3>Current States:</h3>
        <pre>
          {JSON.stringify(
            {
              leftLabelSwitch: stateLeft,
              rightLabelSwitch: stateRight,
              bothLabelsSwitch: stateBoth,
            },
            null,
            2,
          )}
        </pre>
      </div>
    </div>
  )
}

export default SwitchDemo
