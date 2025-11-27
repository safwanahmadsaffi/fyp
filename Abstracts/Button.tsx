import React from 'react';
import {
  GestureResponderEvent,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
  DimensionValue,
} from 'react-native';

type IconComponent = React.ComponentType<{
  width?: number;
  height?: number;
  color?: string;
}>;

interface ButtonProps {
  delayPressIn?: number;
  style?: StyleProp<ViewStyle>;
  onPress?: (event: GestureResponderEvent) => void;
  disabled?: boolean;
  Leading_icon?: IconComponent;
  Tailing_icon?: IconComponent;
  TextIcon?: IconComponent;
  leadingcolor?: string;
  tailingcolor?: string;
  elevation?: number;
  backgroundColor?: string;
  fontSize?: number;
  color?: string;
  text?: string;
  width?: DimensionValue;
  height?: DimensionValue;
  paddingVertical?: number;
  paddingHorizontal?: number;
  textspacing?: number;
  texticoncolor?: string;
  texticonsize?: number;
  borderColor?: string;
  borderRadius?: number;
  borderWidth?: number;
  leadingsize?: number;
  tailingsize?: number;
  btncardname?: string;
  justifyContent?: ViewStyle['justifyContent'];
  textStyle?: StyleProp<TextStyle>;
}

const Button: React.FC<ButtonProps> = ({
  delayPressIn,
  style,
  onPress,
  disabled,
  Leading_icon,
  Tailing_icon,
  TextIcon,
  leadingcolor,
  tailingcolor,
  elevation,
  backgroundColor,
  fontSize,
  color,
  text,
  width,
  height,
  paddingVertical,
  paddingHorizontal,
  textspacing,
  texticoncolor,
  texticonsize,
  borderColor,
  borderRadius,
  borderWidth,
  leadingsize,
  tailingsize,
  btncardname,
  justifyContent,
}) => {
  const dynamicBtnStyle: ViewStyle = {
    width: width ?? '90%',
    height: height ?? 50,
    elevation: elevation ?? 2,
    paddingVertical: paddingVertical ?? 12,
    paddingHorizontal: paddingHorizontal ?? 16,
    justifyContent: justifyContent ?? 'center',
    alignItems: 'center',
    borderRadius: borderRadius ?? 15,
    borderWidth: borderWidth ?? 0,
    backgroundColor: backgroundColor ?? '#007AFF', // iOS blue
    borderColor: borderColor ?? 'transparent',
    flexDirection: 'row', // <--- IMPORTANT (content inside row)
  };

  const styles = StyleSheet.create({
    center: { alignSelf: 'center' } as ViewStyle,
    leading: { position: 'absolute', left: 13 } as ViewStyle,
    tailing: { position: 'absolute', right: 13 } as ViewStyle,
    textRow: {
      flexDirection: 'row', // text + icon in row
      alignItems: 'center',
      justifyContent: 'center',
    } as ViewStyle,
    text: {
      color: color ?? '#fff',
      fontSize: fontSize ?? 18,
      fontWeight: '600',
      paddingLeft: textspacing ?? 0,
    } as TextStyle,
  });

  return (
    <TouchableOpacity
      delayPressIn={delayPressIn}
      activeOpacity={disabled ? 1 : 0.7}
      onPress={!disabled ? onPress : undefined}
      style={[dynamicBtnStyle, styles.center, style]}
    >
      {Leading_icon ? (
        <View style={[styles.center, styles.leading]}>
          <Leading_icon
            width={leadingsize}
            height={leadingsize}
            color={leadingcolor}
          />
        </View>
      ) : null}

      {/* Text + Icon in one row */}
      <View style={styles.textRow}>
        {TextIcon ? (
          <TextIcon
            width={texticonsize}
            height={texticonsize}
            color={texticoncolor}
          />
        ) : null}

        {text ? (
          <Text style={[styles.text, { marginLeft: TextIcon ? 6 : 0 }]}>
            {text}
          </Text>
        ) : null}
      </View>

      {Tailing_icon ? (
        <View style={[styles.center, styles.tailing]}>
          <Tailing_icon
            width={tailingsize}
            height={tailingsize}
            color={tailingcolor}
          />
        </View>
      ) : null}
    </TouchableOpacity>
  );
};

export default Button;
