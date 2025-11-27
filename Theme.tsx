import { Dimensions } from 'react-native';

type ColorsType = {
  green: string;
  black: string;
  grey: string;
  lightgrey: string;
  offwhite: string;
  white: string;
  orange: string;
  primaryblue: string;
  blue: string;
  red: string;
};

export const Colors: ColorsType = {
  green: '#22A45D',
  black: '#010F07',
  grey: '#868686',
  lightgrey: '#F1F1F1',
  offwhite: '#FBFBFB',
  white: '#FFFFFF',
  orange: '#EF9920',
  primaryblue: '#4285F4',
  blue: '#395998',
  red:'#E42727'
};

type FontSizeType = {
  Small: any;
  H4: any;
  H1: number;
  H2: number;
  H3: number;
  Headline: number;
  Subhead: number;
  Body: number;
  Caption: number;
  Button: number;
};

const { width } = Dimensions.get('screen');

export const FontSize: FontSizeType = {
  H1: width * 0.067, // 34
  H2: width * 0.059, // 28
  H3: width * 0.054, // 24
  Headline: width * 0.056, // 30
  Subhead: width * 0.047, // 20
  Body: width * 0.04, // 16
  Caption: width * 0.033, // 12
  Button: width * 0.036,
  Small: undefined,
  H4: undefined
};
