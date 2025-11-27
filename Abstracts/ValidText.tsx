import React from 'react';
import { Text, TextProps, StyleProp, TextStyle } from 'react-native';

interface ValidTextProps {
  text?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}

const ValidText: React.FC<ValidTextProps> = ({ text, style, numberOfLines }) => {
  return text ? (
    <Text style={style} numberOfLines={numberOfLines}>
      {text}
    </Text>
  ) : null;
};

export default ValidText;
