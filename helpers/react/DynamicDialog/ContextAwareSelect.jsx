// ContextAwareSelect.jsx
// @flow
import React, { useContext, useEffect, useState, useMemo } from 'react';
import Select from 'react-select';
import isEqual from 'lodash/isEqual';

type OptionType = {|
  value: string | number,
  label: string,
|};

type Props = {|
  /** Context getter function that returns options */
  getContextOptions: () => OptionType[],
  /** Initial options to populate before context loads */
  initialOptions?: OptionType[],
  /** Default selected value (must exist in options) */
  defaultValue?: OptionType,
  /** Callback when new options are detected in context */
  onNewOptions?: (newOptions: OptionType[]): void,
  /** Standard react-select props */
  ...$Exact<React.ElementConfig<typeof Select>>,
|};

/**
 * ContextAwareSelect component that:
 * 1. Accepts initial options
 * 2. Watches context for updates
 * 3. Only updates when options actually change
 */
const ContextAwareSelect = ({
  getContextOptions,
  initialOptions = [],
  defaultValue,
  onNewOptions,
  ...selectProps
}: Props) => {
  // State for current options
  const [options, setOptions] = useState<OptionType[]>(initialOptions);
  
  // Get current context values
  const contextOptions = getContextOptions();
  
  // Deep comparison of options to prevent unnecessary updates
  useEffect(() => {
    if (!isEqual(contextOptions, options)) {
      setOptions(contextOptions);
      if (onNewOptions) onNewOptions(contextOptions);
    }
  }, [contextOptions, options, onNewOptions]);

  // Memoized default value to prevent recreation on every render
  const memoizedDefaultValue = useMemo(() => {
    if (!defaultValue) return undefined;
    return options.find(opt => isEqual(opt, defaultValue));
  }, [defaultValue, options]);

  return (
    <Select
      {...selectProps}
      options={options}
      defaultValue={memoizedDefaultValue}
    />
  );
};

export default ContextAwareSelect; 