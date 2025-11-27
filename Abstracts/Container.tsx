import React, { ReactNode } from 'react';
import { StyleSheet, View, StyleProp, ViewStyle } from 'react-native';
import Scale from '../Functions/Scale';

interface ContainerProps {
  style?: StyleProp<ViewStyle>;
  paddingHorizontal?: number;
  paddingVertical?: number;
  children?: ReactNode;
}

const Container: React.FC<ContainerProps> & { paddingsize?: { WIDTH: number; HEIGHT: number } } = ({
  style,
  paddingHorizontal,
  paddingVertical,
  children,
}) => {
  const paddingsize = Scale(375, 20, 20);
  Container.paddingsize = paddingsize;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: paddingHorizontal ?? paddingsize.WIDTH,
      paddingVertical: paddingVertical ?? 10,
    },
  });

  return <View style={[styles.container, style]}>{children}</View>;
};

export default Container;