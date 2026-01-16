import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface ChevronLeftIconProps {
  size?: number;
  color?: string;
}

export const ChevronLeftIcon: React.FC<ChevronLeftIconProps> = ({ size = 24, color = '#000' }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 18L9 12L15 6"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};
