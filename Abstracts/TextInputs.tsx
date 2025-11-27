import React from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  ViewStyle,
  StyleProp,
  DimensionValue,
  TextInputProps,
} from 'react-native';

type IconComponent = React.ComponentType<{
  width?: number | null;
  height?: number | null;
  color?: string;
}>;

type ButtonWrapperComponent = React.ComponentType<{
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  width?: number | null;
  TextIcon: IconComponent;
  texticonsize?: number;
  texticoncolor?: string;
}>;

interface InputProps extends TextInputProps {
  width?: DimensionValue;
  height?: DimensionValue;
  value?: string;
  setValue?: (text: string) => void;
  style?: StyleProp<ViewStyle>;
  placeholder?: string;
  elevation?: number;
  onFocus?: () => void;
  backgroundColor?: string;
  color?: string;
  placeholderTextColor?: string;
  seperator?: number;
  seperatorHeight?: DimensionValue;
  seperatorColor?: string;
  fontSize?: number;
  paddingVertical?: number;
  paddingHorizontal?: number;
  Leading_icon?: IconComponent;
  onPress?: () => void;
  Tailing_icon?: IconComponent;
  leadingcolor?: string;
  LeadingButton?: ButtonWrapperComponent;
  TailingButton?: ButtonWrapperComponent;
  tailingcolor?: string;
  borderWidth?: number;
  borderColor?: string;
  borderRadius?: number;
  leadingsize?: number;
  tailingsize?: number;
  secureTextEntry?: TextInputProps['secureTextEntry'];
  editable?: boolean;
  keyboardType?: TextInputProps['keyboardType'];
  multiline?: boolean;
  numberOfLines?: number;
  textAlignVertical?: 'auto' | 'top' | 'bottom' | 'center';
  textAlign?: TextInputProps['textAlign'];
}

const Input: React.FC<InputProps> = ({
  width,
  height,
  value,
  setValue,
  style,
  placeholder,
  elevation,
  onFocus,
  backgroundColor,
  color,
  placeholderTextColor,
  seperator,
  seperatorHeight,
  seperatorColor,
  fontSize,
  paddingVertical,
  paddingHorizontal,
  Leading_icon,
  onPress,
  Tailing_icon,
  leadingcolor,
  LeadingButton,
  TailingButton,
  tailingcolor,
  borderWidth,
  borderColor,
  borderRadius,
  leadingsize,
  tailingsize,
  secureTextEntry,
  editable = true,
  keyboardType,
  multiline = false,
  numberOfLines,
  textAlignVertical,
  ...rest
}) => {
  const styles = StyleSheet.create({
    row: {
      flexDirection: 'row',
    },
    center: {
      alignSelf: 'center',
    },
    view: {
      width: width ?? '90%',
      paddingVertical: paddingVertical ?? 5,
      paddingHorizontal: paddingHorizontal ?? 7,
      backgroundColor: backgroundColor ?? 'rgba(0, 0, 0, 0)',
      elevation: elevation ?? 0,
      borderRadius: borderRadius ?? 10,
      borderWidth: borderWidth ?? 1,
      borderColor: borderColor ?? '#aaaaaa',
    },
    input: {
      fontSize: fontSize ?? 12,
      flex: 1,
      flexGrow: 1,
      height: height ?? undefined,
      color: color ?? 'black',
    },
    seperator: {
      height: seperatorHeight ?? '80%',
      alignSelf: 'center',
      marginHorizontal: 5,
      width: seperator ?? 0,
      backgroundColor: seperatorColor ?? 'black',
    },
    leading: {
      flex: 0.15,
      alignItems: 'center',
    },
    tailing: {
      flex: 0.15,
      alignItems: 'center',
    },
  });

  return (
    <View style={[styles.row, styles.view, style]}>
      {Leading_icon ? (
        LeadingButton ? (
          <LeadingButton
            onPress={onPress}
            style={styles.leading}
            width={null}
            TextIcon={Leading_icon}
            texticonsize={leadingsize}
            texticoncolor={leadingcolor}
          />
        ) : (
          <View style={[styles.center, styles.leading]}>
            <Leading_icon
              width={leadingsize}
              height={leadingsize}
              color={leadingcolor}
            />
          </View>
        )
      ) : null}

      {seperator !== undefined ? <View style={styles.seperator} /> : null}

      <TextInput
        style={styles.input}
        onFocus={onFocus}
        value={value}
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor ?? '#000000af'}
        onChangeText={setValue}
        editable={editable ?? true}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        numberOfLines={numberOfLines}
        textAlignVertical={textAlignVertical}
        {...rest}
      />

      {Tailing_icon ? (
        TailingButton ? (
          <TailingButton
            width={null}
            TextIcon={Tailing_icon}
            texticonsize={tailingsize}
            texticoncolor={tailingcolor}
          />
        ) : (
          <View style={[styles.center, styles.leading]}>
            <Tailing_icon
              width={tailingsize}
              height={tailingsize}
              color={tailingcolor}
            />
          </View>
        )
      ) : null}
    </View>
  );
};

export default Input;
