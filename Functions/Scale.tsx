import React from 'react';
import { Dimensions } from 'react-native';

interface ScaleResult {
  HEIGHT: number;
  WIDTH: number;
}

const Scale = (screen_width: number, width: number, height: number): ScaleResult => {
  const SW = Dimensions.get('window').width;

  const CARD_WIDTH = SW * (width / screen_width);
  const CARD_HEIGHT = CARD_WIDTH * (height / width);

  return {
    HEIGHT: CARD_HEIGHT,
    WIDTH: CARD_WIDTH,
  };
};

export default Scale;
