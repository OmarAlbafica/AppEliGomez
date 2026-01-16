import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

interface TruckIconProps {
  size?: number;
  color?: string;
}

export const TruckIcon: React.FC<TruckIconProps> = ({ size = 24, color = '#000' }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M1 3H15V13H1V3Z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M15 5H19L23 9V13H15V5Z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="5.5" cy="17.5" r="2.5" stroke={color} strokeWidth={2} />
      <Circle cx="18.5" cy="17.5" r="2.5" stroke={color} strokeWidth={2} />
    </Svg>
  );
};
