import React from 'react';
import { Text as RNText } from 'react-native';

const Text = (props: React.ComponentProps<typeof RNText>) => {
  return <RNText style={[{ color: 'white' }, props.style]}>{props.children}</RNText>;
};
export default Text;
